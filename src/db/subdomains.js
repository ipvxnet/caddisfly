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
  const s = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return s || 'site';
}

/** Is this exact subdomain already taken by any project? */
async function isTaken(db, candidate) {
  if (RESERVED.has(candidate)) return true;
  const row = await db
    .prepare(
      `SELECT 1 FROM ai_projects WHERE subdomain = ?1
       UNION ALL SELECT 1 FROM projects WHERE subdomain = ?1 LIMIT 1`
    )
    .bind(candidate)
    .first();
  return !!row;
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
