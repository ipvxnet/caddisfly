// audit(ctx, action, opts) — fire-and-forget audit logging. Resolves the actor
// and the team-owner context, then writes one append-only row off the response
// path (waitUntil). NEVER throws into the calling request — a logging failure
// must not break the action it records.
//
// team_owner_email: a team member's action is filed under the team owner so
// team admins can see it; an own-account action files under the actor. The
// caller can pass opts.teamOwner explicitly; otherwise we use the actor email.

import { insertAuditLog } from '../db/audit-logs.js';

/**
 * @param {object} ctx   request context (env, request, billingEmail/ctx.ctx…)
 * @param {string} action  dotted verb, e.g. 'site.delete', 'domain.connect'
 * @param {object} opts  { actor?, teamOwner?, resourceType?, resourceId?,
 *                         resourceName?, status?, error?, metadata? }
 */
export function audit(ctx, action, opts = {}) {
  try {
    const env = ctx.env;
    if (!env || !env.DB) return;
    const actor = opts.actor || ctx.billingEmail || (ctx.session && ctx.session.email) || ctx.userEmail || 'unknown';
    const teamOwner = opts.teamOwner || actor;
    let ip = null;
    try { ip = ctx.request && ctx.request.headers.get('CF-Connecting-IP'); } catch { /* ignore */ }
    const row = {
      user_email: String(actor).slice(0, 320),
      team_owner_email: String(teamOwner).slice(0, 320),
      action: String(action).slice(0, 80),
      resource_type: opts.resourceType ? String(opts.resourceType).slice(0, 40) : null,
      resource_id: opts.resourceId != null ? String(opts.resourceId).slice(0, 120) : null,
      resource_name: opts.resourceName != null ? String(opts.resourceName).slice(0, 200) : null,
      status: opts.status || 'success',
      error: opts.error ? String(opts.error).slice(0, 500) : null,
      metadata: opts.metadata || null,
      ip: ip || null,
    };
    const p = insertAuditLog(env.DB, row).catch((e) => console.error('audit insert failed:', e.message));
    if (ctx.ctx && typeof ctx.ctx.waitUntil === 'function') ctx.ctx.waitUntil(p);
  } catch (e) {
    console.error('audit() error (ignored):', e.message);
  }
}
