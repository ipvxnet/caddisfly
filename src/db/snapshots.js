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
      ['pre_restore', 'auto', 'manual', 'original'].includes(trigger_type) ? trigger_type : 'manual',
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

/** Unix seconds of the most recent 'auto' snapshot (0 when none) — hourly throttle. */
export async function latestAutoSnapshotAt(db, projectKey) {
  const k = keyWhere(projectKey);
  const r = await db
    .prepare(`SELECT created_at FROM ai_snapshots WHERE ${k.sql} AND trigger_type = 'auto' ORDER BY created_at DESC LIMIT 1`)
    .bind(k.val)
    .first();
  return (r && r.created_at) || 0;
}

/** Count of MANUAL snapshots — autos never evict these (see takeSnapshot). */
export async function countManualSnapshots(db, projectKey) {
  const k = keyWhere(projectKey);
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM ai_snapshots WHERE ${k.sql} AND trigger_type = 'manual'`)
    .bind(k.val)
    .first();
  return (r && r.n) || 0;
}
