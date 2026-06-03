// Project access control for builder/editing routes.
//
// Policy (chosen 2026-06-03): "block cross-account only". A SIGNED-IN user who
// is neither the project's owner nor an active team member is denied. Signed-OUT
// users keep link-based access (preserves the no-account build flow). Roles:
//   member < publisher < admin < owner   (owner is implicit admin on their team)
// Editing is allowed for any of these (and for signed-out 'link' access).
// Publishing/domains are gated per role in the handlers via the helpers below.
//
// Run AFTER billingAuth (which sets ctx.billingEmail). ctx.projectRole and
// ctx.projectOwner are attached for handlers/pages to use.

import { getAIProjectByProjectId } from '../db/ai-projects.js';
import { getProjectByPreviewId } from '../db/projects.js';
import { getMember } from '../db/teams.js';

/** Resolve a project's owner email from its public id (ai or refactor). */
async function resolveOwnerEmail(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) return ai.customer_email || null;
  const rp = await getProjectByPreviewId(env.DB, publicId);
  if (rp) return rp.customer_email || null;
  return null;
}

/**
 * The viewer's role on a project:
 *   'owner' | 'admin' | 'publisher' | 'member'  (signed-in team relationship)
 *   'link'   — signed out (link-based, full access)
 *   null     — signed in but NOT the owner or an active member (blocked)
 */
export async function getViewerRole(env, viewerEmail, ownerEmail) {
  if (!ownerEmail) return 'link';        // unknown project — don't block
  if (!viewerEmail) return 'link';       // signed out → link-based access
  if (viewerEmail === ownerEmail) return 'owner';
  const m = await getMember(env.DB, ownerEmail, viewerEmail);
  if (m && m.status === 'active') {
    return m.role === 'admin' ? 'admin' : m.role === 'publisher' ? 'publisher' : 'member';
  }
  return null;
}

/** Can this role publish (deploy) the site? */
export function canDeploy(role) {
  return ['owner', 'admin', 'publisher', 'link'].includes(role);
}
/** Can this role add/remove custom domains? */
export function canManageDomains(role) {
  return ['owner', 'admin', 'link'].includes(role);
}

function deniedResponse(ctx) {
  const url = ctx.url || new URL(ctx.request.url);
  const isApi = ctx.request.method !== 'GET' || url.pathname.startsWith('/api/');
  if (isApi) {
    return new Response(JSON.stringify({ success: false, error: "You don't have access to this site." }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>No access · Caddisfly</title>
     <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;background:#f5f6fa;color:#2d3748;text-align:center;padding:24px}
     .c{max-width:440px}h1{font-size:1.5rem;margin:0 0 .5rem}p{color:#718096;line-height:1.6}a{color:#7c3aed;font-weight:600;text-decoration:none}</style></head>
     <body><div class="c"><h1>You don't have access</h1>
     <p>This site belongs to another account. Ask its owner to invite you to their team.</p>
     <p style="margin-top:1.5rem"><a href="/dashboard">Go to your dashboard</a></p></div></body></html>`,
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/** Middleware: block signed-in non-members; attach ctx.projectRole + owner. */
export async function projectAccess(ctx) {
  const publicId = ctx.params && ctx.params.project_id;
  if (!publicId) return; // nothing to gate
  const owner = await resolveOwnerEmail(ctx.env, publicId);
  const role = await getViewerRole(ctx.env, ctx.billingEmail, owner);
  if (role === null) {
    return deniedResponse(ctx);
  }
  ctx.projectRole = role;
  ctx.projectOwner = owner;
}
