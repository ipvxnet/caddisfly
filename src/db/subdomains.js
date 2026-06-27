// Per-project subdomain assignment for *.caddisfly.app hosting.
// A subdomain is a DNS label: lowercase a–z, 0–9, hyphens; no leading/trailing
// hyphen; <= 40 chars. Unique across BOTH ai_projects and projects.

import { updateAIProject } from './ai-projects.js';
import { updateProject } from './projects.js';

// Labels we never hand out (collide with app/infra hosts on caddisfly.app).
const RESERVED = new Set([
  'www', 'app', 'api', 'admin', 'mail', 'smtp', 'ftp', 'ns', 'ns1', 'ns2',
  'cdn', 'assets', 'static', 'static-assets', 'sites', 'site', 'preview',
  'dashboard', 'billing', 'status', 'blog', 'docs', 'support', 'help',
]);

export function subdomainSlugify(name) {
  let s = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  // `<sub>-preview.caddisfly.app` is the preview-env host convention — a prod
  // site whose label ended in -preview would route to the preview worker.
  while (s.endsWith('-preview')) s = s.slice(0, -'-preview'.length).replace(/-+$/g, '');
  return s || 'site';
}

/** Is this exact subdomain already taken by any project (or reserved)? */
async function isTaken(db, candidate) {
  if (RESERVED.has(candidate) || candidate.endsWith('-preview')) return true;
  const row = await db
    .prepare(
      `SELECT 1 FROM ai_projects WHERE subdomain = ?1
       UNION ALL SELECT 1 FROM projects WHERE subdomain = ?1 LIMIT 1`
    )
    .bind(candidate)
    .first();
  return !!row;
}

export const SUBDOMAIN_MIN = 3;
export const SUBDOMAIN_MAX = 40;

/**
 * Validate a USER-TYPED subdomain. Returns { ok, slug, error } where `slug` is
 * the normalized label and `error` is a stable code ('empty'|'too_short'|
 * 'too_long'|'reserved') for the UI to localize. Normalization is lenient
 * (slugify), so "5x Systems!" → "5x-systems".
 */
export function validateSubdomain(raw) {
  const slug = subdomainSlugify(raw);
  if (!raw || !String(raw).trim()) return { ok: false, slug: '', error: 'empty' };
  if (slug.length < SUBDOMAIN_MIN) return { ok: false, slug, error: 'too_short' };
  if (slug.length > SUBDOMAIN_MAX) return { ok: false, slug, error: 'too_long' };
  if (RESERVED.has(slug) || slug.endsWith('-preview')) return { ok: false, slug, error: 'reserved' };
  return { ok: true, slug, error: '' };
}

/** Public availability check for a normalized candidate (false = taken/reserved). */
export async function isSubdomainAvailable(db, candidate) {
  return !(await isTaken(db, candidate));
}

/**
 * Up to `n` FREE alternatives derived from a base name, for the "taken → pick
 * one of these" UX. Mixes descriptive suffixes + numeric fallbacks; only returns
 * labels that are actually free (and valid).
 */
export async function suggestFreeSubdomains(db, base, n = 5) {
  const root = subdomainSlugify(base);
  const candidates = [];
  for (const s of ['-co', '-online', '-site', '-hq', '-official', '-app', '-web', '-studio', '-shop']) {
    candidates.push((root + s).slice(0, SUBDOMAIN_MAX).replace(/-+$/g, ''));
  }
  for (let i = 2; i <= 20; i++) candidates.push(`${root}-${i}`.slice(0, SUBDOMAIN_MAX));
  const out = [];
  const seen = new Set();
  for (const c of candidates) {
    if (out.length >= n) break;
    if (!c || seen.has(c) || c.length < SUBDOMAIN_MIN) continue;
    seen.add(c);
    if (!(await isTaken(db, c))) out.push(c);
  }
  return out;
}

/**
 * Ensure the project has a unique subdomain, deriving one from baseName on first
 * call. Idempotent — returns the existing subdomain if already assigned.
 * @param {object} db
 * @param {{aiProjectId?:number, projectId?:number}} projectKey
 * @param {string} baseName - business/project name to derive from
 * @param {string} [existing] - the project's current subdomain, if known
 * @returns {Promise<string>}
 */
export async function ensureUniqueSubdomain(db, projectKey, baseName, existing) {
  if (existing) return existing;

  const root = subdomainSlugify(baseName);
  let candidate = root;
  let i = 2;
  // Dedup with -2, -3, … (also skips reserved labels).
  while (await isTaken(db, candidate)) {
    candidate = `${root}-${i}`.slice(0, 50);
    i++;
    if (i > 9999) {
      candidate = `${root}-${Math.floor(Date.now() / 1000)}`;
      break;
    }
  }

  if (projectKey.aiProjectId) {
    await updateAIProject(db, projectKey.aiProjectId, { subdomain: candidate });
  } else if (projectKey.projectId) {
    await updateProject(db, projectKey.projectId, { subdomain: candidate });
  }
  return candidate;
}
