// Custom site address (subdomain) — one-time rename for *.caddisfly.app sites.
//
//   GET  /api/ai-builder/:project_id/subdomain/check?name=…  -> {available, slug, suggestions[]}
//   POST /api/ai-builder/:project_id/subdomain  { name }     -> rename (once)
//
// The good pipeline assigns a derived subdomain at first publish (db/subdomains.js).
// This lets the owner pick a nicer one ONCE: type → live availability check →
// ✓ save or ✗ + 5 free suggestions. On save we re-host the published R2 objects
// from sites/<old>/ → sites/<new>/ (rewriting the baked canonical/og host so SEO
// stays correct without a republish) and repoint any custom-domain pointers.
// Owner/admin/manager only (projectAccess); one-time gated by subdomain_changed_at.
import { jsonResponse } from '../../../utils/response.js';
import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { getProjectByPreviewId, updateProject } from '../../../db/projects.js';
import { getDomainsByProject } from '../../../db/custom-domains.js';
import { validateSubdomain, isSubdomainAvailable, suggestFreeSubdomains } from '../../../db/subdomains.js';
import { canManageDomains } from '../../../middleware/project-access.js';

async function resolve(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) return { row: ai, projectKey: { aiProjectId: ai.id }, update: (d) => updateAIProject(env.DB, ai.id, d) };
  const rp = await getProjectByPreviewId(env.DB, publicId);
  if (rp) return { row: rp, projectKey: { projectId: rp.id }, update: (d) => updateProject(env.DB, rp.id, d) };
  return null;
}

const liveUrl = (env, sub) => `https://${sub}${env.SITES_PREVIEW_SUFFIX || ''}.${env.SITES_BASE || 'caddisfly.app'}`;

/** GET …/subdomain/check?name= — live availability + suggestions. */
export async function handleSubdomainCheck(ctx) {
  const { env, params, url } = ctx;
  const r = await resolve(env, params.project_id);
  if (!r) return jsonResponse({ success: false, error: 'not_found' }, 404);

  const v = validateSubdomain(url.searchParams.get('name') || '');
  const current = r.row.subdomain || '';
  if (!v.ok) return jsonResponse({ success: true, available: false, slug: v.slug, error: v.error, suggestions: [] });
  if (v.slug === current) return jsonResponse({ success: true, available: false, slug: v.slug, is_current: true, suggestions: [] });

  const available = await isSubdomainAvailable(env.DB, v.slug);
  const suggestions = available ? [] : await suggestFreeSubdomains(env.DB, v.slug, 5);
  return jsonResponse({ success: true, available, slug: v.slug, suggestions, url: liveUrl(env, v.slug) });
}

/** POST …/subdomain — perform the one-time rename. */
export async function handleSubdomainRename(ctx) {
  const { env, params, request } = ctx;
  if (!canManageDomains(ctx.projectRole)) return jsonResponse({ success: false, error: 'forbidden' }, 403);
  const r = await resolve(env, params.project_id);
  if (!r) return jsonResponse({ success: false, error: 'not_found' }, 404);
  // The one-time limit + the R2 re-host apply only to a PUBLISHED site. Before
  // first publish the address is just RESERVED (deploy uses it as-is) — freely
  // changeable, since there's nothing live to move and no "generic" name yet.
  const published = r.row.status === 'deployed';
  if (published && r.row.subdomain_changed_at) return jsonResponse({ success: false, error: 'already_changed' }, 409);

  const body = await request.json().catch(() => ({}));
  const v = validateSubdomain(body.name || '');
  if (!v.ok) return jsonResponse({ success: false, error: v.error, slug: v.slug }, 400);
  const oldSub = r.row.subdomain || '';
  if (v.slug === oldSub) return jsonResponse({ success: false, error: 'same' }, 400);
  if (!(await isSubdomainAvailable(env.DB, v.slug))) {
    return jsonResponse({ success: false, error: 'taken', suggestions: await suggestFreeSubdomains(env.DB, v.slug, 5) }, 409);
  }

  // Reserve the name (BEFORE any R2 move so a concurrent check sees it taken).
  // Lock it as the one-time change ONLY when the site is already published.
  const patch = { subdomain: v.slug };
  if (published) patch.subdomain_changed_at = Math.floor(Date.now() / 1000);
  await r.update(patch);

  let rehosted = 0;
  if (published && oldSub && oldSub !== v.slug) {
    try { rehosted = await rehostSite(env, oldSub, v.slug); } catch (e) { console.error('subdomain rehost error:', e.message); }
    try { await repointCustomDomains(env, r.projectKey, v.slug); } catch (e) { console.error('subdomain repoint error:', e.message); }
  }
  return jsonResponse({ success: true, subdomain: v.slug, url: liveUrl(env, v.slug), reserved: !published, rehosted });
}

/** Copy published pages sites/<old>/* → sites/<new>/*, rewriting the baked
 *  subdomain host in HTML, then delete the old prefix so it stops resolving. */
async function rehostSite(env, oldSub, newSub) {
  const base = env.SITES_BASE || 'caddisfly.app';
  const suffix = env.SITES_PREVIEW_SUFFIX || '';
  const oldHost = `${oldSub}${suffix}.${base}`;
  const newHost = `${newSub}${suffix}.${base}`;
  const prefix = `sites/${oldSub}/`;
  const listed = await env.STORAGE.list({ prefix });
  const objects = listed.objects || [];
  let n = 0;
  for (const o of objects) {
    const rest = o.key.slice(prefix.length);
    const obj = await env.STORAGE.get(o.key);
    if (!obj) continue;
    const contentType = (obj.httpMetadata && obj.httpMetadata.contentType) || 'text/html; charset=utf-8';
    if (o.key.endsWith('.html')) {
      let html = await obj.text();
      if (oldHost !== newHost) html = html.split(oldHost).join(newHost); // canonical + og:url
      await env.STORAGE.put(`sites/${newSub}/${rest}`, html, { httpMetadata: { contentType } });
    } else {
      await env.STORAGE.put(`sites/${newSub}/${rest}`, obj.body, { httpMetadata: { contentType } });
    }
    n++;
  }
  for (const o of objects) { try { await env.STORAGE.delete(o.key); } catch { /* best effort */ } }
  return n;
}

/** Point any custom-domain rows + R2 host pointers at the new subdomain. */
async function repointCustomDomains(env, projectKey, newSub) {
  const rows = await getDomainsByProject(env.DB, projectKey);
  for (const d of rows || []) {
    if (d.subdomain !== newSub) {
      await env.DB.prepare('UPDATE custom_domains SET subdomain = ? WHERE id = ?').bind(newSub, d.id).run();
    }
    try { await env.STORAGE.put(`domains/${d.hostname}`, newSub, { httpMetadata: { contentType: 'text/plain' } }); } catch { /* best effort */ }
  }
}
