// Inventory API token data layer (Phase 3). One token per project (bridge
// ai_project_id XOR project_id). The token authorizes the public /api/inventory/*
// endpoints; it resolves to the project + owner email (for entitlement/cap checks).
// See migration 063.

import { generateToken } from '../utils/crypto.js';

function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { col: 'ai_project_id', val: projectKey.aiProjectId }
    : { col: 'project_id', val: projectKey.projectId };
}

/** The project's token row (or null). */
export async function getInventoryToken(db, projectKey) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT id, token, created_at, last_used_at FROM inventory_tokens WHERE ${k.col} = ?`).bind(k.val).first();
}

/** Create or rotate the project's token. Returns the new token string. */
export async function rotateInventoryToken(db, projectKey) {
  const k = keyWhere(projectKey);
  const token = 'inv_' + generateToken(28);
  const ai = k.col === 'ai_project_id' ? k.val : null;
  const rg = k.col === 'project_id' ? k.val : null;
  await db.batch([
    db.prepare(`DELETE FROM inventory_tokens WHERE ${k.col} = ?`).bind(k.val),
    db.prepare(`INSERT INTO inventory_tokens (ai_project_id, project_id, token) VALUES (?, ?, ?)`).bind(ai, rg, token),
  ]);
  return token;
}

/** Revoke (delete) the project's token. */
export async function revokeInventoryToken(db, projectKey) {
  const k = keyWhere(projectKey);
  await db.prepare(`DELETE FROM inventory_tokens WHERE ${k.col} = ?`).bind(k.val).run();
}

/**
 * Resolve a bearer token → { projectKey, email } or null. Stamps last_used_at.
 * email = the project owner (customer_email), for plugin/cap checks.
 */
export async function resolveProjectByToken(db, token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const row = await db.prepare(
    `SELECT ti.id, ti.ai_project_id, ti.project_id,
            COALESCE(a.customer_email, p.customer_email) AS email
       FROM inventory_tokens ti
       LEFT JOIN ai_projects a ON a.id = ti.ai_project_id
       LEFT JOIN projects p ON p.id = ti.project_id
      WHERE ti.token = ?`
  ).bind(t).first();
  if (!row) return null;
  await db.prepare(`UPDATE inventory_tokens SET last_used_at = unixepoch() WHERE id = ?`).bind(row.id).run().catch(() => {});
  const projectKey = row.ai_project_id != null ? { aiProjectId: row.ai_project_id } : { projectId: row.project_id };
  return { projectKey, email: row.email || '' };
}
