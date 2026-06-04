// Authentication middleware

import { parseCookies } from '../utils/crypto.js';
import { getSessionByToken } from '../db/sessions.js';
import { unauthorized } from '../utils/response.js';

/**
 * Authentication middleware
 * Validates session and attaches user to request context
 * @param {object} ctx - Request context
 * @returns {Response|void} Response if unauthorized, void if authorized
 */
export async function authMiddleware(ctx) {
  const { request, env } = ctx;

  // Parse cookies from request
  const cookies = parseCookies(request);
  const sessionToken = cookies.session_token;

  if (!sessionToken) {
    // No session token found
    const acceptsJson = request.headers.get('Accept')?.includes('application/json');
    return unauthorized('Not authenticated', acceptsJson);
  }

  // Validate session
  const session = await getSessionByToken(env.DB, sessionToken);

  if (!session) {
    // Invalid or expired session
    const acceptsJson = request.headers.get('Accept')?.includes('application/json');
    return unauthorized('Session expired or invalid', acceptsJson);
  }

  // Attach user to context
  ctx.user = {
    id: session.user_id,
    email: session.email,
    name: session.name,
    avatarUrl: session.avatar_url,
    role: session.role,
  };

  ctx.session = {
    id: session.id,
    token: sessionToken,
    expiresAt: session.expires_at,
  };

  // Continue to next middleware or handler
  return;
}

/**
 * Is this email allowed admin access? Checks the ADMIN_EMAILS env var
 * (comma-separated, case-insensitive). When ADMIN_EMAILS is unset, NO email is
 * allowed (fail closed) — the SaaS dashboard exposes all customer data.
 * @param {object} env
 * @param {string} email
 * @returns {boolean}
 */
export function isAllowedAdmin(env, email) {
  if (!email || !env || !env.ADMIN_EMAILS) return false;
  const allow = String(env.ADMIN_EMAILS)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(String(email).trim().toLowerCase());
}

/**
 * Admin-only middleware (requires auth middleware to run first). Admin access is
 * gated by the ADMIN_EMAILS allowlist alone — it's the source of truth, so an
 * allowlisted owner gets in regardless of their stored role, and a signed-in
 * non-owner is shown a clear "access denied" page (NOT redirected back to login,
 * which would loop).
 * @param {object} ctx - Request context
 * @returns {Response|void} Response if not allowed, void if authorized
 */
export async function adminMiddleware(ctx) {
  const acceptsJson = ctx.request.headers.get('Accept')?.includes('application/json');
  if (!ctx.user) {
    // authMiddleware should have caught this; fall back to a login redirect.
    return unauthorized('Not authenticated', acceptsJson);
  }
  if (!isAllowedAdmin(ctx.env, ctx.user.email)) {
    if (acceptsJson) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const email = String(ctx.user.email || '');
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Access denied · Caddisfly</title>
       <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;background:#f5f6fa;color:#2d3748;text-align:center;padding:24px}
       .c{max-width:460px}h1{font-size:1.5rem;margin:0 0 .5rem}p{color:#718096;line-height:1.6}a{color:#7c3aed;font-weight:600;text-decoration:none}</style></head>
       <body><div class="c"><h1>Access denied</h1>
       <p><strong>${email.replace(/[&<>"]/g, '')}</strong> isn't authorized for the Caddisfly admin area.</p>
       <p>Sign out and use an authorized admin account, or ask an owner to add this email to the allowlist.</p>
       <p style="margin-top:1.5rem"><a href="/logout">Sign out</a></p></div></body></html>`,
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
  return;
}
