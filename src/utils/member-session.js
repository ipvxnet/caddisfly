// Members/Auth plugin — session + magic-link primitives. Published sites are
// static and served by a DB-free/secret-free worker, so member auth runs on the
// APP worker (caddisfly.ai) and is called cross-origin from the site. The member
// session is a STATELESS HMAC-signed cookie on caddisfly.ai (SameSite=None so it
// rides cross-site credentialed fetches from the customer site); the magic link
// is a short-lived signed token. Both are keyed off STRIPE_SECRET_KEY via
// utils/signed-token.js (same pragmatic key choice as course-access/video-sink).
import { signToken, verifyToken } from './signed-token.js';
import { getAIProjectByProjectId } from '../db/ai-projects.js';
import { getProjectByPreviewId } from '../db/projects.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../db/ai-config.js';
import { getDomainsByProject } from '../db/custom-domains.js';

export const MEMBER_COOKIE = 'cf_member';
const SESSION_TTL = 30 * 24 * 3600; // 30 days
const MAGIC_TTL = 15 * 60;          // 15 minutes
const PUBLIC_ID_RE = /^[a-f0-9-]{8,64}$/i;

function secret(env) {
  return env.STRIPE_SECRET_KEY || env.SESSION_SECRET || '';
}

/** Resolve a published site by public id (ai-first) → projectKey + meta. */
export async function resolveMemberSite(env, publicId) {
  if (!PUBLIC_ID_RE.test(publicId || '')) return null;
  const db = env.DB;
  const ai = await getAIProjectByProjectId(db, publicId);
  if (ai) {
    const projectKey = { aiProjectId: ai.id };
    const config = await getWebsiteConfigByAIProjectId(db, ai.id);
    return {
      publicId, projectKey,
      ownerEmail: ai.customer_email,
      siteName: ai.project_name || 'the site',
      lang: (config && config.language) || ai.language || 'en',
      domains: await siteHostnames(db, projectKey),
      config,
    };
  }
  const rp = await getProjectByPreviewId(db, publicId);
  if (rp) {
    const projectKey = { projectId: rp.id };
    let name = rp.website_url || 'the site';
    try { const p = JSON.parse(rp.company_profile_json || '{}'); if (p && p.name) name = p.name; } catch { /* ignore */ }
    const config = await getWebsiteConfigByRegularProjectId(db, rp.id);
    return {
      publicId, projectKey,
      ownerEmail: rp.customer_email,
      siteName: name,
      lang: (config && config.language) || rp.language || 'en',
      domains: await siteHostnames(db, projectKey),
      config,
    };
  }
  return null;
}

/** Custom-domain hostnames for a site (for return-URL validation). Best-effort. */
async function siteHostnames(db, projectKey) {
  try {
    const rows = await getDomainsByProject(db, projectKey);
    return (rows || []).map((r) => r.hostname).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Magic-link token (email → click → session) ──────────────────────────────

/** Sign a magic-link token. `ret` is a validated return URL on the site. */
export function signMagicToken(env, { site, email, name = '', ret = '' }) {
  return signToken(secret(env), 'member-login', { s: site, e: email, n: name, r: ret }, MAGIC_TTL);
}
/** Verify a magic-link token → { s, e, n, r } or null. */
export function verifyMagicToken(env, token) {
  return verifyToken(secret(env), 'member-login', token);
}

// ── Session cookie ──────────────────────────────────────────────────────────

/** Sign the session payload (site + email + member id). */
export function signSession(env, { site, email, mid }) {
  return signToken(secret(env), 'member-session', { s: site, e: email, m: mid }, SESSION_TTL);
}

/** Read + verify the member session from the request cookie. Returns the
 *  payload only if it belongs to `site` (so one site's cookie can't read
 *  another's), else null. */
export async function readSession(env, request, site) {
  const token = parseCookie(request, MEMBER_COOKIE);
  if (!token) return null;
  const payload = await verifyToken(secret(env), 'member-session', token);
  if (!payload || payload.s !== site) return null;
  return payload;
}

/** Set-Cookie value for a fresh session. SameSite=None;Secure is required for
 *  the cross-site credentialed fetches the published site makes. */
export function sessionCookie(token) {
  return `${MEMBER_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${SESSION_TTL}`;
}
/** Set-Cookie value that clears the session (logout). */
export function clearCookie() {
  return `${MEMBER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
}

function parseCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** Validate a caller-supplied return URL: must be http(s) and (in prod) point at
 *  a caddisfly host or the site's own custom domain — defends the redirect from
 *  open-redirect abuse. Falls back to '' (caller picks a safe default). */
export function safeReturnUrl(raw, allowHosts = []) {
  try {
    const u = new URL(String(raw));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    const host = u.hostname.toLowerCase();
    const ok = host.endsWith('.caddisfly.app') || host === 'caddisfly.app' ||
      host.endsWith('.caddisfly.ai') || host === 'caddisfly.ai' ||
      host.endsWith('.workers.dev') ||
      allowHosts.some((h) => h && (host === h.toLowerCase()));
    return ok ? u.toString() : '';
  } catch {
    return '';
  }
}
