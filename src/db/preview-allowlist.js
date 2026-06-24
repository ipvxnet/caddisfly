// Preview-only publish allowlist. Gates who can PUBLISH on the preview worker
// (ENVIRONMENT=preview) so randoms can't ship sites there. An entry is a full
// email OR a domain ('@live.com' / 'live.com'). See migration 060.

const lc = (s) => String(s == null ? '' : s).trim().toLowerCase();

export async function listPreviewAllowlist(db) {
  const { results } = await db.prepare(`SELECT id, entry, created_at FROM preview_allowlist ORDER BY entry`).all();
  return results || [];
}

export async function addPreviewAllowlistEntry(db, entry) {
  const e = lc(entry);
  if (!e || (!e.includes('@') && !e.includes('.'))) throw new Error('invalid_entry');
  await db.prepare(`INSERT OR IGNORE INTO preview_allowlist (entry) VALUES (?)`).bind(e).run();
}

export async function removePreviewAllowlistEntry(db, id) {
  const res = await db.prepare(`DELETE FROM preview_allowlist WHERE id = ?`).bind(id).run();
  return res.meta.changes > 0;
}

/** Is `email` allowed to publish on preview? Matches a full-email entry, or a
 *  domain entry against the email's domain. */
export async function isPreviewPublishAllowed(db, email) {
  const e = lc(email);
  if (!e) return false;
  const domain = e.split('@')[1] || '';
  const { results } = await db.prepare(`SELECT entry FROM preview_allowlist`).all();
  for (const row of results || []) {
    const entry = row.entry;
    if (entry.includes('@') && !entry.startsWith('@')) {
      if (entry === e) return true;          // full email
    } else if (entry.replace(/^@/, '') === domain) {
      return true;                           // domain match
    }
  }
  return false;
}
