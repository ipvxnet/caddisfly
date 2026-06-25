// Drive data layer — account-level file ledger (migration 066). Files live in R2
// (env.STORAGE, key drive/<token>); this table tracks owner, size, type for
// listing + quota. Keyed by owner_email. Pure D1; R2 writes happen in the route.

const lc = (s) => String(s == null ? '' : s).trim().toLowerCase();

/** Total bytes the owner is using. */
export async function getDriveUsage(db, ownerEmail) {
  const row = await db.prepare('SELECT COALESCE(SUM(size), 0) AS used, COUNT(*) AS n FROM drive_files WHERE owner_email = ?').bind(lc(ownerEmail)).first();
  return { used: (row && row.used) || 0, count: (row && row.n) || 0 };
}

/** The owner's files, newest first. */
export async function listDriveFiles(db, ownerEmail) {
  const { results } = await db.prepare('SELECT id, token, name, r2_key, size, content_type, created_at FROM drive_files WHERE owner_email = ? ORDER BY created_at DESC').bind(lc(ownerEmail)).all();
  return results || [];
}

/** Insert a file row. Returns { id, token }. */
export async function addDriveFile(db, ownerEmail, { token, name, r2_key, size, content_type }) {
  await db.prepare('INSERT INTO drive_files (owner_email, token, name, r2_key, size, content_type) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(lc(ownerEmail), token, String(name || '').slice(0, 255), r2_key, Math.max(0, Math.round(size) || 0), String(content_type || '').slice(0, 120)).run();
  return { token };
}

/** Delete one file (scoped to owner). Returns the r2_key to remove, or null. */
export async function deleteDriveFile(db, ownerEmail, id) {
  const row = await db.prepare('SELECT r2_key FROM drive_files WHERE id = ? AND owner_email = ?').bind(id, lc(ownerEmail)).first();
  if (!row) return null;
  await db.prepare('DELETE FROM drive_files WHERE id = ? AND owner_email = ?').bind(id, lc(ownerEmail)).run();
  return row.r2_key;
}

/** Look up a file by its public token (for serving). */
export async function getDriveFileByToken(db, token) {
  return db.prepare('SELECT name, r2_key, content_type, size FROM drive_files WHERE token = ?').bind(String(token || '')).first();
}
