// Drive data layer — account-level file ledger (migration 066). Files live in R2
// (env.STORAGE, key drive/<token>); this table tracks owner, size, type for
// listing + quota. Keyed by owner_email. Pure D1; R2 writes happen in the route.

const lc = (s) => String(s == null ? '' : s).trim().toLowerCase();

/** Total bytes the owner is using. */
export async function getDriveUsage(db, ownerEmail) {
  const row = await db.prepare('SELECT COALESCE(SUM(size), 0) AS used, COUNT(*) AS n FROM drive_files WHERE owner_email = ?').bind(lc(ownerEmail)).first();
  return { used: (row && row.used) || 0, count: (row && row.n) || 0 };
}

/** The owner's files in one folder (NULL = root), newest first. */
export async function listDriveFiles(db, ownerEmail, folderId = null) {
  const fid = folderId == null ? null : Number(folderId);
  const where = fid == null ? 'folder_id IS NULL' : 'folder_id = ?';
  const binds = fid == null ? [lc(ownerEmail)] : [lc(ownerEmail), fid];
  const { results } = await db.prepare(`SELECT id, token, name, r2_key, size, content_type, folder_id, created_at FROM drive_files WHERE owner_email = ? AND ${where} ORDER BY created_at DESC`).bind(...binds).all();
  return results || [];
}

/** Insert a file row (optionally in a folder). Returns { token }. */
export async function addDriveFile(db, ownerEmail, { token, name, r2_key, size, content_type, folder_id = null }) {
  await db.prepare('INSERT INTO drive_files (owner_email, token, name, r2_key, size, content_type, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(lc(ownerEmail), token, String(name || '').slice(0, 255), r2_key, Math.max(0, Math.round(size) || 0), String(content_type || '').slice(0, 120), folder_id == null ? null : Number(folder_id)).run();
  return { token };
}

/** One file by id (owner-scoped) — for move/copy. */
export async function getDriveFileById(db, ownerEmail, id) {
  return db.prepare('SELECT id, token, name, r2_key, size, content_type, folder_id FROM drive_files WHERE id = ? AND owner_email = ?').bind(Number(id), lc(ownerEmail)).first();
}

/** Move a file to a folder (NULL = root). Returns true if changed. */
export async function moveDriveFile(db, ownerEmail, fileId, folderId) {
  const res = await db.prepare('UPDATE drive_files SET folder_id = ? WHERE id = ? AND owner_email = ?').bind(folderId == null ? null : Number(folderId), Number(fileId), lc(ownerEmail)).run();
  return res.meta.changes > 0;
}

// ---- folders ----------------------------------------------------------------

/** Subfolders of `parentId` (NULL = root), alphabetical. */
export async function listFolders(db, ownerEmail, parentId = null) {
  const pid = parentId == null ? null : Number(parentId);
  const where = pid == null ? 'parent_id IS NULL' : 'parent_id = ?';
  const binds = pid == null ? [lc(ownerEmail)] : [lc(ownerEmail), pid];
  const { results } = await db.prepare(`SELECT id, name, parent_id, created_at FROM drive_folders WHERE owner_email = ? AND ${where} ORDER BY name`).bind(...binds).all();
  return results || [];
}

/** Every folder the owner has (for move/copy pickers + path labels). */
export async function listAllFolders(db, ownerEmail) {
  const { results } = await db.prepare('SELECT id, name, parent_id FROM drive_folders WHERE owner_email = ? ORDER BY name').bind(lc(ownerEmail)).all();
  return results || [];
}

/** One folder (owner-scoped). */
export async function getFolder(db, ownerEmail, id) {
  if (id == null) return null;
  return db.prepare('SELECT id, name, parent_id FROM drive_folders WHERE id = ? AND owner_email = ?').bind(Number(id), lc(ownerEmail)).first();
}

/** Create a folder. Returns the new id. */
export async function createFolder(db, ownerEmail, name, parentId = null) {
  const res = await db.prepare('INSERT INTO drive_folders (owner_email, name, parent_id) VALUES (?, ?, ?)')
    .bind(lc(ownerEmail), String(name || '').trim().slice(0, 120) || 'Untitled', parentId == null ? null : Number(parentId)).run();
  return res.meta.last_row_id;
}

/** Rename a folder (owner-scoped). */
export async function renameFolder(db, ownerEmail, id, name) {
  const res = await db.prepare('UPDATE drive_folders SET name = ? WHERE id = ? AND owner_email = ?')
    .bind(String(name || '').trim().slice(0, 120) || 'Untitled', Number(id), lc(ownerEmail)).run();
  return res.meta.changes > 0;
}

/** True if a folder holds any files or subfolders. */
export async function folderHasContents(db, ownerEmail, id) {
  const a = await db.prepare('SELECT COUNT(*) AS n FROM drive_files WHERE owner_email = ? AND folder_id = ?').bind(lc(ownerEmail), Number(id)).first();
  const b = await db.prepare('SELECT COUNT(*) AS n FROM drive_folders WHERE owner_email = ? AND parent_id = ?').bind(lc(ownerEmail), Number(id)).first();
  return (((a && a.n) || 0) + ((b && b.n) || 0)) > 0;
}

/** Delete an (empty) folder, owner-scoped. */
export async function deleteFolder(db, ownerEmail, id) {
  const res = await db.prepare('DELETE FROM drive_folders WHERE id = ? AND owner_email = ?').bind(Number(id), lc(ownerEmail)).run();
  return res.meta.changes > 0;
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
