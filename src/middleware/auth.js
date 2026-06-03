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
 * Admin-only middleware (requires auth middleware to run first). Requires BOTH
 * the 'admin' role AND membership in the ADMIN_EMAILS allowlist.
 * @param {object} ctx - Request context
 * @returns {Response|void} Response if not admin, void if authorized
 */
export async function adminMiddleware(ctx) {
  const acceptsJson = ctx.request.headers.get('Accept')?.includes('application/json');
  if (!ctx.user) {
    return unauthorized('Not authenticated', acceptsJson);
  }
  if (ctx.user.role !== 'admin' || !isAllowedAdmin(ctx.env, ctx.user.email)) {
    return unauthorized('Admin access required', acceptsJson);
  }
  return;
}
