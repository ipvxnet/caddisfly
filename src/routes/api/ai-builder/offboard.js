// Offboarding — unpublish + delete a website (the Offboarding Wizard backend).
//
//   GET  /api/ai-builder/:project_id/offboard      → wizard state
//   POST /api/ai-builder/:project_id/unpublish     → take the site offline
//   POST /api/ai-builder/:project_id/delete        → { confirm:'DELETE', cleanup_dns }
//
// Delete is a hard cascade of SITE CONTENT, but RETAINS financial/ownership
// records: store_orders (sales history) and domain_orders (the customer still
// owns the domain + it renews). Custom domains are disconnected (CF hostname +
// worker route + R2 pointer + rows). Optionally resets our managed DNS records
// on bought domains (keeps the customer's own MX/TXT). Owner+admins only.

import { getAIProjectByProjectId, deleteAIProject } from '../../../db/ai-projects.js';
import { getProjectByPreviewId, deleteProject } from '../../../db/projects.js';
import { getDomainsByProject } from '../../../db/custom-domains.js';
import { isSaaSConfigured, deleteCustomHostname, deleteWorkerRoute } from '../../../utils/cloudflare-saas.js';
import { isNamecheapConfigured, getDnsHosts, setDnsHosts } from '../../../utils/namecheap.js';
import { canManageDomains } from '../../../middleware/project-access.js';
import { audit } from '../../../utils/audit.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resolve a public id to project context (ai-first, else refactor bridge). */
async function resolve(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) {
    return {
      kind: 'ai', row: ai, projectKey: { aiProjectId: ai.id },
      publicId: ai.project_id, subdomain: ai.subdomain || null,
      name: ai.project_name || 'Untitled', email: ai.customer_email,
    };
  }
  const rp = await getProjectByPreviewId(env.DB, publicId);
  if (rp) {
    let name = rp.website_url || 'Untitled';
    try { const p = JSON.parse(rp.company_profile_json || '{}'); if (p && p.name) name = p.name; } catch { /* ignore */ }
    return {
      kind: 'refactor', row: rp, projectKey: { projectId: rp.id },
      publicId: rp.preview_id, subdomain: rp.subdomain || null,
      name, email: rp.customer_email,
    };
  }
  return null;
}

/** Run a scoped DELETE on a bridge table (table name is a fixed literal). */
async function scopedDelete(db, table, projectKey) {
  if (projectKey.aiProjectId != null) {
    await db.prepare(`DELETE FROM ${table} WHERE ai_project_id = ?`).bind(projectKey.aiProjectId).run().catch(() => {});
  } else {
    await db.prepare(`DELETE FROM ${table} WHERE project_id = ?`).bind(projectKey.projectId).run().catch(() => {});
  }
}

/** GET — what the wizard needs to decide which steps to show. */
export async function handleOffboardStatus(ctx) {
  const { env, params } = ctx;
  const r = await resolve(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const domains = await getDomainsByProject(env.DB, r.projectKey).catch(() => []);
  const bought = await boughtDomainsForProject(env.DB, r.projectKey);
  return json({
    success: true,
    name: r.name,
    published: !!r.subdomain,
    never_published: !r.subdomain,
    domains: domains.map((d) => ({ id: d.id, hostname: d.hostname, status: d.status })),
    has_bought_dns: bought.length > 0,
    bought_domains: bought,
  });
}

/** Take the site offline: remove R2 copies + clear publish state. */
export async function handleUnpublish(ctx) {
  const { env, params } = ctx;
  if (ctx.projectRole && !canManageDomains(ctx.projectRole)) {
    return json({ success: false, error: 'Only the owner and admins can unpublish.' }, 403);
  }
  const r = await resolve(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  if (!r.subdomain) return json({ success: true, already: true });

  try {
    for (const prefix of [`published/${r.publicId}/`, `sites/${r.subdomain}/`]) {
      let cursor;
      do {
        const listed = await env.STORAGE.list({ prefix, cursor });
        await Promise.all((listed.objects || []).map((o) => env.STORAGE.delete(o.key)));
        cursor = listed.truncated ? listed.cursor : null;
      } while (cursor);
    }
    if (r.kind === 'ai') {
      await env.DB.prepare('UPDATE ai_projects SET subdomain = NULL, deployed_url = NULL, status = ? WHERE id = ?').bind('draft', r.row.id).run();
    } else {
      await env.DB.prepare('UPDATE projects SET subdomain = NULL, status = ? WHERE id = ?').bind('draft', r.row.id).run();
    }
    audit(ctx, 'site.unpublish', { teamOwner: r.email, resourceType: 'site', resourceId: r.publicId, resourceName: r.name });
    return json({ success: true });
  } catch (e) {
    console.error('unpublish error:', e.message);
    audit(ctx, 'site.unpublish', { teamOwner: r.email, resourceType: 'site', resourceId: r.publicId, resourceName: r.name, status: 'error', error: e.message });
    return json({ success: false, error: 'Could not unpublish — please try again.' }, 500);
  }
}

/** Disconnect one custom domain: CF hostname + worker route + R2 pointer + row. */
async function disconnectDomain(env, d) {
  if (isSaaSConfigured(env) && d.cf_hostname_id) {
    await deleteCustomHostname(env, d.cf_hostname_id).catch((e) => console.error('cf hostname del:', e.message));
  }
  await deleteWorkerRoute(env, d.hostname).catch(() => {});
  await env.STORAGE.delete(`domains/${d.hostname}`).catch(() => {});
  await env.DB.prepare('DELETE FROM custom_domains WHERE id = ?').bind(d.id).run().catch(() => {});
}

/** Registered bought domains bound to this project (we retain domain_orders). */
async function boughtDomainsForProject(db, projectKey) {
  const col = projectKey.aiProjectId != null ? 'ai_project_id' : 'project_id';
  const val = projectKey.aiProjectId != null ? projectKey.aiProjectId : projectKey.projectId;
  const { results } = await db
    .prepare(`SELECT DISTINCT domain FROM domain_orders WHERE ${col} = ? AND status = 'registered'`)
    .bind(val)
    .all()
    .catch(() => ({ results: [] }));
  return (results || []).map((r) => r.domain);
}

/** Remove OUR managed records (www CNAME + root redirect) from a bought
 *  domain's DNS, keeping everything the customer added (MX/TXT/etc). */
async function cleanupManagedDns(env, domain) {
  const hosts = await getDnsHosts(env, domain);
  const kept = hosts.filter(
    (h) => !(h.name === 'www' && h.type === 'CNAME') && !(h.name === '@' && (h.type === 'URL301' || h.type === 'URL' || h.type === 'FRAME'))
  );
  if (kept.length !== hosts.length) await setDnsHosts(env, domain, kept);
}

/** POST — hard-delete the site. Body { confirm, cleanup_dns }. */
export async function handleDeleteSite(ctx) {
  const { env, request, params } = ctx;
  if (ctx.projectRole && !canManageDomains(ctx.projectRole)) {
    return json({ success: false, error: 'Only the owner and admins can delete a website.' }, 403);
  }
  const r = await resolve(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);

  const body = await request.json().catch(() => ({}));
  if ((body.confirm || '').toString().trim().toUpperCase() !== 'DELETE') {
    return json({ success: false, error: 'Type DELETE to confirm.' }, 400);
  }

  try {
    const domains = await getDomainsByProject(env.DB, r.projectKey).catch(() => []);

    // 1) Disconnect every custom domain (CF hostname + worker route + pointer + row).
    for (const d of domains) await disconnectDomain(env, d);

    // 2) Optional: reset our managed DNS records on BOUGHT domains bound to this
    //    site (keep the customer's own MX/TXT). Based on domain_orders (which we
    //    RETAIN), so it works regardless of custom_domains teardown above.
    let dnsCleaned = 0;
    if (body.cleanup_dns && isNamecheapConfigured(env)) {
      const bought = await boughtDomainsForProject(env.DB, r.projectKey);
      for (const dom of bought) {
        await cleanupManagedDns(env, dom).then(() => { dnsCleaned++; }).catch((e) => console.error('dns cleanup:', e.message));
      }
    }

    // 3) Unpublish (remove R2 output).
    if (r.subdomain) {
      for (const prefix of [`published/${r.publicId}/`, `sites/${r.subdomain}/`]) {
        let cursor;
        do {
          const listed = await env.STORAGE.list({ prefix, cursor });
          await Promise.all((listed.objects || []).map((o) => env.STORAGE.delete(o.key)));
          cursor = listed.truncated ? listed.cursor : null;
        } while (cursor);
      }
    }

    // 4) Delete site content. KEEP store_orders + domain_orders (money/ownership).
    for (const t of ['ai_sections', 'ai_pages', 'ai_website_configs', 'blog_posts', 'products', 'ai_snapshots']) {
      await scopedDelete(env.DB, t, r.projectKey);
    }
    if (r.kind === 'ai') {
      await scopedDelete(env.DB, 'ai_assets', r.projectKey);
      await scopedDelete(env.DB, 'ai_conversations', r.projectKey);
    }
    // public-id-keyed tables
    await env.DB.prepare('DELETE FROM form_submissions WHERE public_id = ?').bind(r.publicId).run().catch(() => {});
    await env.DB.prepare('DELETE FROM site_events WHERE public_id = ?').bind(r.publicId).run().catch(() => {});

    // 5) Delete the project row itself.
    if (r.kind === 'ai') await deleteAIProject(env.DB, r.row.id);
    else await deleteProject(env.DB, r.row.id);

    audit(ctx, 'site.delete', {
      teamOwner: r.email, resourceType: 'site', resourceId: r.publicId, resourceName: r.name,
      metadata: { domains_disconnected: domains.length, dns_cleaned: dnsCleaned },
    });
    return json({ success: true, dns_cleaned: dnsCleaned });
  } catch (e) {
    console.error('delete site error:', e.message);
    audit(ctx, 'site.delete', { teamOwner: r.email, resourceType: 'site', resourceId: r.publicId, resourceName: r.name, status: 'error', error: e.message });
    return json({ success: false, error: 'Could not delete the website — please try again.' }, 500);
  }
}
