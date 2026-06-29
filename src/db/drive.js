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
  const { results } = await db.prepare(`SELECT id, token, name, r2_key, size, content_type, folder_id, created_at FROM drive_files WHERE owner_email = ? AND ${where} AND deleted_at IS NULL ORDER BY created_at DESC`).bind(...binds).all();
  return results || [];
}

/** Insert a file row (optionally in a folder). Returns { token }. */
export async function addDriveFile(db, ownerEmail, { token, name, r2_key, size, content_type, folder_id = null }) {
  await db.prepare('INSERT INTO drive_files (owner_email, token, name, r2_key, size, content_type, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(lc(ownerEmail), token, String(name || '').slice(0, 255), r2_key, Math.max(0, Math.round(size) || 0), String(content_type || '').slice(0, 120), folder_id == null ? null : Number(folder_id)).run();
  return { token };
}

/** The owner's IMAGE files (for the editor "Insert from Drive" picker), newest first. */
export async function listDriveImages(db, ownerEmail) {
  const { results } = await db.prepare("SELECT token, name FROM drive_files WHERE owner_email = ? AND content_type LIKE 'image/%' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200").bind(lc(ownerEmail)).all();
  return results || [];
}

// A top-level "Shared" folder is the boundary a site MANAGER may see of the
// owner's Drive: the owner moves only what they want to share into it, so a
// manager never browses the owner's whole (possibly private) Drive.
export const SHARED_FOLDER_NAME = 'Shared';

/** The owner's top-level "Shared" folder row, or null. */
export async function getSharedFolder(db, ownerEmail) {
  return db
    .prepare("SELECT id, name FROM drive_folders WHERE owner_email = ? AND parent_id IS NULL AND lower(name) = 'shared' AND deleted_at IS NULL")
    .bind(lc(ownerEmail))
    .first();
}

/** Get-or-create the owner's top-level "Shared" folder; returns its id. */
export async function ensureSharedFolder(db, ownerEmail) {
  const existing = await getSharedFolder(db, ownerEmail);
  if (existing) return existing.id;
  const res = await db
    .prepare('INSERT INTO drive_folders (owner_email, name, parent_id) VALUES (?, ?, NULL)')
    .bind(lc(ownerEmail), SHARED_FOLDER_NAME)
    .run();
  return res && res.meta && res.meta.last_row_id;
}

/** IMAGE files inside the owner's "Shared" folder (and its subfolders) — what a
 *  site manager may pick from. Empty if there's no Shared folder yet. */
export async function listSharedDriveImages(db, ownerEmail) {
  const shared = await getSharedFolder(db, ownerEmail);
  if (!shared) return [];
  // Shared + every descendant folder (folders are few; walk in memory).
  const all = await allFoldersRaw(db, ownerEmail);
  const childrenOf = new Map();
  for (const f of all) {
    const p = f.parent_id == null ? null : Number(f.parent_id);
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p).push(Number(f.id));
  }
  const ids = [];
  const stack = [Number(shared.id)];
  while (stack.length) {
    const id = stack.pop();
    ids.push(id);
    for (const c of childrenOf.get(id) || []) stack.push(c);
  }
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const ph = chunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(`SELECT token, name FROM drive_files WHERE owner_email = ? AND folder_id IN (${ph}) AND content_type LIKE 'image/%' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`)
      .bind(lc(ownerEmail), ...chunk)
      .all();
    for (const r of results || []) out.push(r);
  }
  return out;
}

/** One file by id (owner-scoped) — for move/copy. */
export async function getDriveFileById(db, ownerEmail, id) {
  return db.prepare('SELECT id, token, name, r2_key, size, content_type, folder_id FROM drive_files WHERE id = ? AND owner_email = ? AND deleted_at IS NULL').bind(Number(id), lc(ownerEmail)).first();
}

/** Move a file to a folder (NULL = root). Returns true if changed. */
export async function moveDriveFile(db, ownerEmail, fileId, folderId) {
  const res = await db.prepare('UPDATE drive_files SET folder_id = ? WHERE id = ? AND owner_email = ?').bind(folderId == null ? null : Number(folderId), Number(fileId), lc(ownerEmail)).run();
  return res.meta.changes > 0;
}

/** Move a folder under another folder (NULL = root). Rejects a cycle (moving a
 *  folder into itself or one of its own descendants). Returns { ok } / { error }. */
export async function moveFolder(db, ownerEmail, folderId, newParentId) {
  const id = Number(folderId);
  const np = newParentId == null ? null : Number(newParentId);
  if (np === id) return { ok: false, error: 'cycle' };
  if (np != null) {
    const dest = await getFolder(db, ownerEmail, np); // active + owned only
    if (!dest) return { ok: false, error: 'dest_missing' };
    const { folderIds } = await collectFolderTree(db, ownerEmail, id); // self + descendants
    if (folderIds.includes(np)) return { ok: false, error: 'cycle' };
  }
  const res = await db.prepare('UPDATE drive_folders SET parent_id = ? WHERE id = ? AND owner_email = ?').bind(np, id, lc(ownerEmail)).run();
  return { ok: (res.meta.changes || 0) > 0 };
}

// ---- folders ----------------------------------------------------------------

/** Subfolders of `parentId` (NULL = root), alphabetical. */
export async function listFolders(db, ownerEmail, parentId = null) {
  const pid = parentId == null ? null : Number(parentId);
  const where = pid == null ? 'parent_id IS NULL' : 'parent_id = ?';
  const binds = pid == null ? [lc(ownerEmail)] : [lc(ownerEmail), pid];
  const { results } = await db.prepare(`SELECT id, name, parent_id, created_at FROM drive_folders WHERE owner_email = ? AND ${where} AND deleted_at IS NULL ORDER BY name`).bind(...binds).all();
  return results || [];
}

/** Every folder the owner has (for move/copy pickers + path labels). */
export async function listAllFolders(db, ownerEmail) {
  const { results } = await db.prepare('SELECT id, name, parent_id FROM drive_folders WHERE owner_email = ? AND deleted_at IS NULL ORDER BY name').bind(lc(ownerEmail)).all();
  return results || [];
}

/** Every folder the owner has, INCLUDING trashed ones (for tree traversal in delete/restore/purge). */
export async function allFoldersRaw(db, ownerEmail) {
  const { results } = await db.prepare('SELECT id, name, parent_id FROM drive_folders WHERE owner_email = ?').bind(lc(ownerEmail)).all();
  return results || [];
}

/** One LIVE folder (owner-scoped). */
export async function getFolder(db, ownerEmail, id) {
  if (id == null) return null;
  return db.prepare('SELECT id, name, parent_id FROM drive_folders WHERE id = ? AND owner_email = ? AND deleted_at IS NULL').bind(Number(id), lc(ownerEmail)).first();
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

/**
 * Collect a folder + ALL descendants: every folder id, and every file {id, r2_key}.
 * Traverses trashed rows too (uses allFoldersRaw + unfiltered file query) so it works
 * for soft-delete, restore, AND purge of a whole subtree.
 */
export async function collectFolderTree(db, ownerEmail, rootId) {
  const all = await allFoldersRaw(db, ownerEmail);
  const childrenOf = new Map();
  for (const f of all) {
    const p = f.parent_id == null ? null : Number(f.parent_id);
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p).push(Number(f.id));
  }
  const folderIds = [];
  const stack = [Number(rootId)];
  while (stack.length) {
    const id = stack.pop();
    folderIds.push(id);
    for (const c of childrenOf.get(id) || []) stack.push(c);
  }
  const files = [];
  for (let i = 0; i < folderIds.length; i += 50) {
    const chunk = folderIds.slice(i, i + 50);
    const ph = chunk.map(() => '?').join(',');
    const { results } = await db.prepare(`SELECT id, r2_key FROM drive_files WHERE owner_email = ? AND folder_id IN (${ph})`).bind(lc(ownerEmail), ...chunk).all();
    for (const r of results || []) files.push(r);
  }
  return { folderIds, files };
}

/** Delete a set of folders + files by id (rows only; caller removes R2 objects). */
export async function purgeFolderTree(db, ownerEmail, folderIds, fileIds) {
  for (let i = 0; i < fileIds.length; i += 50) {
    const chunk = fileIds.slice(i, i + 50);
    const ph = chunk.map(() => '?').join(',');
    await db.prepare(`DELETE FROM drive_files WHERE owner_email = ? AND id IN (${ph})`).bind(lc(ownerEmail), ...chunk).run();
  }
  for (let i = 0; i < folderIds.length; i += 50) {
    const chunk = folderIds.slice(i, i + 50);
    const ph = chunk.map(() => '?').join(',');
    await db.prepare(`DELETE FROM drive_folders WHERE owner_email = ? AND id IN (${ph})`).bind(lc(ownerEmail), ...chunk).run();
  }
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
  return db.prepare('SELECT name, r2_key, content_type, size FROM drive_files WHERE token = ? AND deleted_at IS NULL').bind(String(token || '')).first();
}

/**
 * Look up a file's R2 key by token for deploy-time copy-on-publish, scoped to the
 * site owner. Ignores deleted_at so a publish can still rescue a just-trashed file
 * (the R2 object is kept until purge).
 */
export async function getDriveAssetByToken(db, ownerEmail, token) {
  return db.prepare('SELECT r2_key, content_type, name FROM drive_files WHERE token = ? AND owner_email = ?').bind(String(token || ''), lc(ownerEmail)).first();
}

// ---- trash (soft-delete) ----------------------------------------------------

const chunked = (arr, n = 50) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

/** Soft-delete one file (stamp deleted_at). Returns true if it was live. */
export async function softDeleteFile(db, ownerEmail, id, when) {
  const res = await db.prepare('UPDATE drive_files SET deleted_at = ? WHERE id = ? AND owner_email = ? AND deleted_at IS NULL')
    .bind(when, Number(id), lc(ownerEmail)).run();
  return res.meta.changes > 0;
}

/** Soft-delete a whole subtree (folders + files) in one timestamp; skips already-trashed rows. */
export async function softDeleteTree(db, ownerEmail, folderIds, fileIds, when) {
  for (const chunk of chunked(fileIds)) {
    const ph = chunk.map(() => '?').join(',');
    await db.prepare(`UPDATE drive_files SET deleted_at = ? WHERE owner_email = ? AND deleted_at IS NULL AND id IN (${ph})`).bind(when, lc(ownerEmail), ...chunk).run();
  }
  for (const chunk of chunked(folderIds)) {
    const ph = chunk.map(() => '?').join(',');
    await db.prepare(`UPDATE drive_folders SET deleted_at = ? WHERE owner_email = ? AND deleted_at IS NULL AND id IN (${ph})`).bind(when, lc(ownerEmail), ...chunk).run();
  }
}

/** Restore a whole subtree (clear deleted_at). */
export async function restoreTree(db, ownerEmail, folderIds, fileIds) {
  for (const chunk of chunked(fileIds)) {
    const ph = chunk.map(() => '?').join(',');
    await db.prepare(`UPDATE drive_files SET deleted_at = NULL WHERE owner_email = ? AND id IN (${ph})`).bind(lc(ownerEmail), ...chunk).run();
  }
  for (const chunk of chunked(folderIds)) {
    const ph = chunk.map(() => '?').join(',');
    await db.prepare(`UPDATE drive_folders SET deleted_at = NULL WHERE owner_email = ? AND id IN (${ph})`).bind(lc(ownerEmail), ...chunk).run();
  }
}

/** Restore one trashed file. If its old folder is gone/trashed, drop it to root. Returns its name or null. */
export async function restoreFile(db, ownerEmail, id) {
  const row = await db.prepare('SELECT id, name, folder_id FROM drive_files WHERE id = ? AND owner_email = ? AND deleted_at IS NOT NULL').bind(Number(id), lc(ownerEmail)).first();
  if (!row) return null;
  let orphan = false;
  if (row.folder_id != null) {
    const live = await db.prepare('SELECT id FROM drive_folders WHERE id = ? AND owner_email = ? AND deleted_at IS NULL').bind(Number(row.folder_id), lc(ownerEmail)).first();
    orphan = !live;
  }
  if (orphan) await db.prepare('UPDATE drive_files SET deleted_at = NULL, folder_id = NULL WHERE id = ? AND owner_email = ?').bind(Number(id), lc(ownerEmail)).run();
  else await db.prepare('UPDATE drive_files SET deleted_at = NULL WHERE id = ? AND owner_email = ?').bind(Number(id), lc(ownerEmail)).run();
  return row.name;
}

/** A trashed file (for restore/purge validation). */
export async function getDeletedFile(db, ownerEmail, id) {
  return db.prepare('SELECT id, name, r2_key FROM drive_files WHERE id = ? AND owner_email = ? AND deleted_at IS NOT NULL').bind(Number(id), lc(ownerEmail)).first();
}

/** A trashed folder (for restore/purge validation). */
export async function getDeletedFolder(db, ownerEmail, id) {
  return db.prepare('SELECT id, name, parent_id FROM drive_folders WHERE id = ? AND owner_email = ? AND deleted_at IS NOT NULL').bind(Number(id), lc(ownerEmail)).first();
}

/** Bytes + count currently in the trash (still counts toward quota until purged). */
export async function getTrashStats(db, ownerEmail) {
  const row = await db.prepare('SELECT COALESCE(SUM(size), 0) AS used, COUNT(*) AS n FROM drive_files WHERE owner_email = ? AND deleted_at IS NOT NULL').bind(lc(ownerEmail)).first();
  return { used: (row && row.used) || 0, count: (row && row.n) || 0 };
}

/**
 * Trash ROOTS — the items the user explicitly deleted, not their cascaded descendants.
 * A trashed folder/file is a root when its parent folder is NOT itself trashed.
 */
export async function listTrashRoots(db, ownerEmail) {
  const fol = (await db.prepare('SELECT id, name, parent_id, deleted_at FROM drive_folders WHERE owner_email = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC').bind(lc(ownerEmail)).all()).results || [];
  const fil = (await db.prepare('SELECT id, name, size, folder_id, token, deleted_at FROM drive_files WHERE owner_email = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC').bind(lc(ownerEmail)).all()).results || [];
  const deletedFolderIds = new Set(fol.map((f) => Number(f.id)));
  const isRootParent = (pid) => pid == null || !deletedFolderIds.has(Number(pid));
  return {
    folders: fol.filter((f) => isRootParent(f.parent_id)),
    files: fil.filter((f) => isRootParent(f.folder_id)),
  };
}

/** Everything in the trash (for Empty trash): files {id, r2_key} + all trashed folder ids. */
export async function listAllDeleted(db, ownerEmail) {
  const files = (await db.prepare('SELECT id, r2_key FROM drive_files WHERE owner_email = ? AND deleted_at IS NOT NULL').bind(lc(ownerEmail)).all()).results || [];
  const folders = (await db.prepare('SELECT id FROM drive_folders WHERE owner_email = ? AND deleted_at IS NOT NULL').bind(lc(ownerEmail)).all()).results || [];
  return { files, folderIds: folders.map((f) => Number(f.id)) };
}
