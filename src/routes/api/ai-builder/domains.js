// Custom-domain management for a published site.
//   POST   /api/ai-builder/:project_id/domains            (add)
//   GET    /api/ai-builder/:project_id/domains/:id/status (refresh CF state)
//   DELETE /api/ai-builder/:project_id/domains/:id        (remove)
//
// The lean caddisfly-sites worker resolves a custom Host via an R2 pointer
// (domains/<hostname> -> subdomain), written here when a domain goes active.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getUserTier } from '../../../utils/rate-limiter.js';
import { audit } from '../../../utils/audit.js';
import { DOMAIN_LIMITS } from '../../../utils/credits.js';
import { uploadToR2 } from '../../../utils/r2-storage.js';
import {
  isSaaSConfigured,
  cnameTarget,
  normalizeHostname,
  isValidHostname,
  createCustomHostname,
  getCustomHostname,
  deleteCustomHostname,
  isActive,
} from '../../../utils/cloudflare-saas.js';
import {
  getDomainsByProject,
  countDomainsByProject,
  getDomainById,
  getDomainByHostname,
  createDomain,
  updateDomain,
  deleteDomain,
} from '../../../db/custom-domains.js';
import { canManageDomains } from '../../../middleware/project-access.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function resolveProject(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) return { projectKey: { aiProjectId: ai.id }, subdomain: ai.subdomain, email: ai.customer_email };
  const rp = await getProjectByPreviewId(env.DB, publicId);
  if (rp) return { projectKey: { projectId: rp.id }, subdomain: rp.subdomain, email: rp.customer_email };
  return null;
}

const pointerKey = (hostname) => `domains/${hostname}`;

/** POST … /domains — connect a custom domain. */
export async function handleAddDomain(ctx) {
  const { env, request, params } = ctx;
  if (ctx.projectRole && !canManageDomains(ctx.projectRole)) {
    return json({ success: false, error: 'Only the owner and admins can manage custom domains.' }, 403);
  }
  const proj = await resolveProject(env, params.project_id);
  if (!proj) return json({ success: false, error: 'Project not found' }, 404);
  if (!proj.subdomain) {
    return json({ success: false, error: 'Publish your site first so it has an address to point your domain at.' }, 400);
  }

  // Plan gate (enforced in production; open in preview for testing).
  const tier = await getUserTier(env.DB, proj.email);
  const limit = DOMAIN_LIMITS[tier] != null ? DOMAIN_LIMITS[tier] : 0;
  if (env.ENVIRONMENT === 'production') {
    const count = await countDomainsByProject(env.DB, proj.projectKey);
    if (count >= limit) {
      return json(
        {
          success: false,
          error: limit === 0
            ? 'Custom domains are available on paid plans. Upgrade to connect your own domain.'
            : `You've reached your plan's custom-domain limit (${limit}). Upgrade to add more.`,
          billing_url: '/billing',
        },
        402
      );
    }
  }

  const body = await request.json().catch(() => ({}));
  const hostname = normalizeHostname(body.hostname);
  if (!isValidHostname(hostname)) {
    return json({ success: false, error: 'Enter a valid domain like www.yourbusiness.com.' }, 400);
  }
  const dup = await getDomainByHostname(env.DB, hostname);
  if (dup) return json({ success: false, error: 'That domain is already connected.' }, 409);

  let cf = null;
  if (isSaaSConfigured(env)) {
    try {
      cf = await createCustomHostname(env, hostname);
    } catch (e) {
      console.error('CF custom hostname error:', e.message);
      return json({ success: false, error: `Could not register the domain: ${e.message}` }, 502);
    }
  }

  const rec = await createDomain(env.DB, proj.projectKey, {
    hostname,
    subdomain: proj.subdomain,
    status: 'pending',
    cf_hostname_id: cf ? cf.cf_hostname_id : null,
    ssl_status: cf ? cf.ssl_status : null,
    cname_target: cf ? cf.cname_target : cnameTarget(env),
    dcv_type: cf ? cf.dcv_type : null,
    dcv_name: cf ? cf.dcv_name : null,
    dcv_value: cf ? cf.dcv_value : null,
  });

  audit(ctx, 'domain.connect', { teamOwner: proj.email, resourceType: 'domain', resourceId: hostname, resourceName: hostname });
  return json({ success: true, domain: rec, configured: isSaaSConfigured(env) });
}

/** GET … /domains/:id/status — re-check Cloudflare; activate when ready. */
export async function handleDomainStatus(ctx) {
  const { env, params } = ctx;
  const rec = await getDomainById(env.DB, parseInt(params.id));
  if (!rec) return json({ success: false, error: 'Domain not found' }, 404);

  if (isSaaSConfigured(env) && rec.cf_hostname_id) {
    try {
      const state = await getCustomHostname(env, rec.cf_hostname_id);
      const active = isActive(state);
      const updated = await updateDomain(env.DB, rec.id, {
        status: active ? 'active' : 'pending',
        ssl_status: state.ssl_status,
        dcv_type: state.dcv_type,
        dcv_name: state.dcv_name,
        dcv_value: state.dcv_value,
        last_error: null,
      });
      // On activation, write the R2 pointer so the sites worker can serve it.
      if (active) {
        await uploadToR2(env.STORAGE, pointerKey(rec.hostname), rec.subdomain, 'text/plain');
      }
      return json({ success: true, domain: updated, configured: true });
    } catch (e) {
      console.error('CF status error:', e.message);
      const updated = await updateDomain(env.DB, rec.id, { last_error: e.message });
      return json({ success: true, domain: updated, configured: true });
    }
  }

  return json({ success: true, domain: rec, configured: isSaaSConfigured(env) });
}

/** DELETE … /domains/:id — disconnect a custom domain. */
export async function handleRemoveDomain(ctx) {
  const { env, params } = ctx;
  if (ctx.projectRole && !canManageDomains(ctx.projectRole)) {
    return json({ success: false, error: 'Only the owner and admins can manage custom domains.' }, 403);
  }
  const rec = await getDomainById(env.DB, parseInt(params.id));
  if (!rec) return json({ success: false, error: 'Domain not found' }, 404);

  if (isSaaSConfigured(env) && rec.cf_hostname_id) {
    try {
      await deleteCustomHostname(env, rec.cf_hostname_id);
    } catch (e) {
      console.error('CF delete error (continuing):', e.message);
    }
  }
  try {
    await env.STORAGE.delete(pointerKey(rec.hostname));
  } catch (e) {
    console.error('pointer delete error (continuing):', e.message);
  }
  await deleteDomain(env.DB, rec.id);
  audit(ctx, 'domain.disconnect', { resourceType: 'domain', resourceId: rec.hostname, resourceName: rec.hostname });
  return json({ success: true });
}

/** Used by the customize page to render the current domains. */
export async function listProjectDomains(env, projectKey) {
  return getDomainsByProject(env.DB, projectKey);
}
