// Project access control for builder/editing routes.
//
// Policy (revised 2026-06-15): the builder URL holds only the public project_id
// (not a secret), so link possession alone must NOT grant access. Roles:
//   member < publisher < admin < owner   (owner is implicit admin on their team)
//   'draft' — signed-OUT but carrying a valid per-browser build grant (the
//             cf_build cookie set at anonymous create). Can EDIT, cannot publish.
//   null    — no session and no grant (or signed-in non-member) → BLOCKED.
// Editing is allowed for any non-null role. Publishing/domains/destructive
// actions require a VERIFIED session role (owner/admin/publisher) — a draft must
// sign in (magic link to the project's email) before it can publish.
//
// Run AFTER billingAuth (which sets ctx.billingEmail). ctx.projectRole and
// ctx.projectOwner are attached for handlers/pages to use.

import { getAIProjectByProjectId } from '../db/ai-projects.js';
import { getProjectByPreviewId } from '../db/projects.js';
import { getMember, memberHasSiteAccess } from '../db/teams.js';
import { parseCookies } from '../utils/crypto.js';
import { hasBuildGrant, BUILD_COOKIE } from '../db/build-grants.js';
import { getSiteManagerRole } from '../db/site-transfer.js';

/** Resolve a project's owner email + bridge key from its public id (ai or refactor). */
async function resolveOwner(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) return { email: ai.customer_email || null, projectKey: { aiProjectId: ai.id } };
  const rp = await getProjectByPreviewId(env.DB, publicId);
  if (rp) return { email: rp.customer_email || null, projectKey: { projectId: rp.id } };
  return null;
}

/**
 * The viewer's role on a project:
 *   'owner' | 'admin' | 'publisher' | 'member'  (signed-in team relationship)
 *   'draft'  — signed out but holding a valid per-browser build grant (edit only)
 *   null     — no session and no grant, or signed-in non-member (blocked)
 * @param {object} env
 * @param {string} viewerEmail - verified session email (ctx.billingEmail) or ''
 * @param {string} ownerEmail  - project owner email, or null if unknown
 * @param {boolean} hasGrant   - request carries a valid build grant for this project
 */
export async function getViewerRole(env, viewerEmail, ownerEmail, hasGrant) {
  if (ownerEmail && viewerEmail) {
    if (viewerEmail === ownerEmail) return 'owner';
    const m = await getMember(env.DB, ownerEmail, viewerEmail);
    if (m && m.status === 'active') {
      return m.role === 'admin' ? 'admin' : m.role === 'publisher' ? 'publisher' : 'member';
    }
    return null; // signed in, but not the owner or an active member → blocked
  }
  // No verified session for the owner (or unknown project): allow EDIT-only draft
  // access when this browser built the project; otherwise the link alone is not
  // enough — block. A signed-in viewer on an unclaimed project may draft too.
  if (hasGrant) return 'draft';
  if (!ownerEmail && viewerEmail) return 'draft';
  return null;
}

/** Can this role publish (deploy) the site? Requires a verified session.
 *  'manager' = a per-site delegate (transferred a site, kept builder access). */
export function canDeploy(role) {
  return ['owner', 'admin', 'publisher', 'manager'].includes(role);
}
/** Can this role add/remove custom domains? Requires a verified session. */
export function canManageDomains(role) {
  return ['owner', 'admin', 'manager'].includes(role);
}
/** May this role attempt to publish (shows the button; verification gates it)? */
export function canRequestDeploy(role) {
  return canDeploy(role) || role === 'draft';
}

function deniedResponse(ctx) {
  const url = ctx.url || new URL(ctx.request.url);
  const isApi = ctx.request.method !== 'GET' || url.pathname.startsWith('/api/');
  const signedIn = !!ctx.billingEmail;
  if (isApi) {
    return new Response(
      JSON.stringify({
        success: false,
        error: signedIn ? "You don't have access to this site." : 'Please sign in to edit this site.',
        auth_required: !signedIn,
      }),
      { status: signedIn ? 403 : 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // Signed-out (e.g. cleared cookies / different device): offer sign-in, since
  // the project is linked to a verifiable email. Signed-in non-member: explain.
  const signin = `/billing?next=${encodeURIComponent(url.pathname)}`;
  const body = signedIn
    ? `<h1>You don't have access</h1>
       <p>This site belongs to another account. Ask its owner to invite you to their team.</p>
       <p style="margin-top:1.5rem"><a href="/dashboard">Go to your dashboard</a></p>`
    : `<h1>Sign in to edit this site</h1>
       <p>This site is linked to an email. Sign in to keep editing or to publish it.</p>
       <p style="margin-top:1.5rem"><a href="${signin}">Sign in</a></p>`;
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign in · Caddisfly</title>
     <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;background:#f5f6fa;color:#2d3748;text-align:center;padding:24px}
     .c{max-width:440px}h1{font-size:1.5rem;margin:0 0 .5rem}p{color:#718096;line-height:1.6}a{color:#7c3aed;font-weight:600;text-decoration:none}</style></head>
     <body><div class="c">${body}</div></body></html>`,
    { status: signedIn ? 403 : 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/** Middleware: gate access; attach ctx.projectRole + owner. */
export async function projectAccess(ctx) {
  const publicId = ctx.params && ctx.params.project_id;
  if (!publicId) return; // nothing to gate
  const ownerInfo = await resolveOwner(ctx.env, publicId);
  const owner = ownerInfo ? ownerInfo.email : null;
  // Grant check only matters when there's no verified owner session.
  let hasGrant = false;
  if (!ctx.billingEmail || ctx.billingEmail !== owner) {
    const token = parseCookies(ctx.request)[BUILD_COOKIE];
    hasGrant = await hasBuildGrant(ctx.env.DB, publicId, token);
  }
  let role = await getViewerRole(ctx.env, ctx.billingEmail, owner, hasGrant);
  // Per-site member scope: a team member (not the owner) who was invited to only
  // specific sites is blocked on every other site. Unscoped members are unaffected.
  if (role && owner && ctx.billingEmail && ctx.billingEmail !== owner
      && ['member', 'publisher', 'admin'].includes(role) && ownerInfo.projectKey) {
    const ok = await memberHasSiteAccess(ctx.env.DB, owner, ctx.billingEmail, ownerInfo.projectKey);
    if (!ok) role = null;
  }
  // Per-site Manager delegate: a signed-in viewer who isn't the owner or an active
  // team member, but holds a manager grant for THIS specific site.
  if (role === null && ctx.billingEmail && ownerInfo && ownerInfo.projectKey) {
    const mrole = await getSiteManagerRole(ctx.env.DB, ownerInfo.projectKey, ctx.billingEmail);
    if (mrole) role = 'manager';
  }
  if (role === null) {
    return deniedResponse(ctx);
  }
  ctx.projectRole = role;
  ctx.projectOwner = owner;
}
