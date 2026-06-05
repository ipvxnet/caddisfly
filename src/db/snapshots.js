// Snapshot metadata rows (see migrations/022_snapshots.sql). The state blobs
// live in R2; these rows are the timeline. Bridge-aware like ai_pages.

function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}

export async function createSnapshotRow(db, projectKey, { label, trigger_type, r2_path, size_bytes }) {
  return db
    .prepare(
      `INSERT INTO ai_snapshots (ai_project_id, project_id, label, trigger_type, r2_path, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      projectKey.aiProjectId != null ? projectKey.aiProjectId : null,
      projectKey.projectId != null ? projectKey.projectId : null,
      (label || '').slice(0, 120),
      trigger_type === 'pre_restore' ? 'pre_restore' : 'manual',
      r2_path,
      size_bytes || 0
    )
    .first();
}

export async function getSnapshotsByProject(db, projectKey) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(`SELECT * FROM ai_snapshots WHERE ${k.sql} ORDER BY created_at DESC, id DESC`)
    .bind(k.val)
    .all();
  return results || [];
}

export async function getSnapshotById(db, projectKey, id) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM ai_snapshots WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

export async function deleteSnapshotRow(db, projectKey, id) {
  const k = keyWhere(projectKey);
  const r = await db.prepare(`DELETE FROM ai_snapshots WHERE ${k.sql} AND id = ?`).bind(k.val, id).run();
  return !!(r && r.meta && r.meta.changes);
}

/** Rows beyond the newest `keep` — returned so the caller can delete R2 blobs too. */
export async function snapshotsBeyondCap(db, projectKey, keep) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(
      `SELECT * FROM ai_snapshots WHERE ${k.sql}
       ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET ?`
    )
    .bind(k.val, keep)
    .all();
  return results || [];
}
