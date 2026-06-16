// Build grants — per-browser "draft editing" capability for the no-account
// build flow. See migrations/044_build_grants.sql and middleware/project-access.js.

import { sha256Hex } from '../utils/crypto.js';

/** Name of the first-party cookie holding the per-browser build token. */
export const BUILD_COOKIE = 'cf_build';

/**
 * Record that the browser holding `token` may draft-edit `projectId`.
 * Idempotent (UNIQUE(project_id, token_hash)).
 * @param {object} db
 * @param {string} projectId - public project id
 * @param {string} token - raw cf_build cookie token
 */
export async function createBuildGrant(db, projectId, token) {
  if (!projectId || !token) return;
  const hash = await sha256Hex(token);
  await db
    .prepare('INSERT OR IGNORE INTO build_grants (project_id, token_hash, created_at) VALUES (?, ?, ?)')
    .bind(projectId, hash, Math.floor(Date.now() / 1000))
    .run();
}

/**
 * Does `token` carry a draft-edit grant for `projectId`?
 * @param {object} db
 * @param {string} projectId - public project id
 * @param {string} token - raw cf_build cookie token (may be falsy)
 * @returns {Promise<boolean>}
 */
export async function hasBuildGrant(db, projectId, token) {
  if (!projectId || !token) return false;
  const hash = await sha256Hex(token);
  const row = await db
    .prepare('SELECT 1 FROM build_grants WHERE project_id = ? AND token_hash = ? LIMIT 1')
    .bind(projectId, hash)
    .first();
  return !!row;
}
