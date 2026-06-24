// Site-manager controls — the owner sees who still helps manage their site (a
// Builder/Designer kept on after a site transfer) and can Disconnect them.
//
//   GET  /api/ai-builder/:project_id/managers          → list managers
//   POST /api/ai-builder/:project_id/managers/remove    → { email } (owner-only)
//
// Disconnecting is OWNER-only: a manager must not be able to drop a co-manager
// or silently re-home access. Removing the grant cuts the Builder's access at
// once (project-access resolves the role live from site_managers).

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { listSiteManagers, removeSiteManager } from '../../../db/site-transfer.js';
import { audit } from '../../../utils/audit.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resolve a public id to { projectKey, name, email }. ai-first, else refactor. */
async function resolve(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) return { projectKey: { aiProjectId: ai.id }, publicId: ai.project_id, name: ai.project_name || 'Untitled', email: ai.customer_email };
  const rp = await getProjectByPreviewId(env.DB, publicId);
  if (rp) {
    let name = rp.website_url || 'Untitled';
    try { const p = JSON.parse(rp.company_profile_json || '{}'); if (p && p.name) name = p.name; } catch { /* ignore */ }
    return { projectKey: { projectId: rp.id }, publicId: rp.preview_id, name, email: rp.customer_email };
  }
  return null;
}

/** GET — list this site's managers. */
export async function handleListManagers(ctx) {
  const { env, params } = ctx;
  const r = await resolve(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const managers = await listSiteManagers(env.DB, r.projectKey).catch(() => []);
  return json({ success: true, managers });
}

/** POST — Disconnect a manager (owner-only). Body { email }. */
export async function handleRemoveManager(ctx) {
  const { env, request, params } = ctx;
  if (ctx.projectRole && ctx.projectRole !== 'owner') {
    return json({ success: false, error: 'Only the site owner can disconnect a manager.' }, 403);
  }
  const r = await resolve(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);

  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').toString().trim().toLowerCase();
  if (!email) return json({ success: false, error: 'Missing email.' }, 400);

  const removed = await removeSiteManager(env.DB, r.projectKey, email);
  audit(ctx, 'site.manager.remove', {
    teamOwner: r.email, resourceType: 'site', resourceId: r.publicId, resourceName: r.name,
    metadata: { manager: email, found: removed },
  });
  return json({ success: true, removed });
}
