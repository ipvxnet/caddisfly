// Form-submission data layer (see migrations/019_form_submissions.sql).
// Submissions are keyed by the published site's public_id, like site_events —
// no bridge columns needed; ownership is resolved through the project tables.

export async function createSubmission(db, { public_id, name, email, message, page_path, visitor_hash, created_at }) {
  return db
    .prepare(
      `INSERT INTO form_submissions (public_id, name, email, message, page_path, visitor_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(public_id, name || '', email || '', message || '', page_path || '', visitor_hash || null, created_at)
    .first();
}

export async function getSubmissionsBySite(db, publicId, limit = 200) {
  const { results } = await db
    .prepare('SELECT * FROM form_submissions WHERE public_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(publicId, limit)
    .all();
  return results || [];
}

/** Unread count for one site — drives the dashboard badge. */
export async function countUnread(db, publicId) {
  const r = await db
    .prepare('SELECT COUNT(*) AS n FROM form_submissions WHERE public_id = ? AND is_read = 0')
    .bind(publicId)
    .first();
  return (r && r.n) || 0;
}

/** Viewing the inbox marks everything read (the page shows "new" pills first). */
export async function markAllRead(db, publicId) {
  await db.prepare('UPDATE form_submissions SET is_read = 1 WHERE public_id = ? AND is_read = 0').bind(publicId).run();
}

/** Delete one submission, scoped to its site so a forged id can't cross sites. */
export async function deleteSubmission(db, publicId, id) {
  const r = await db
    .prepare('DELETE FROM form_submissions WHERE public_id = ? AND id = ?')
    .bind(publicId, id)
    .run();
  return !!(r && r.meta && r.meta.changes);
}

/** Spam guard: submissions from the same daily visitor hash since `sinceTs`. */
export async function countRecentByHash(db, publicId, visitorHash, sinceTs) {
  const r = await db
    .prepare('SELECT COUNT(*) AS n FROM form_submissions WHERE public_id = ? AND visitor_hash = ? AND created_at >= ?')
    .bind(publicId, visitorHash, sinceTs)
    .first();
  return (r && r.n) || 0;
}

/** Site-wide submissions since `sinceTs` — daily flood cap + email-notify cap. */
export async function countSince(db, publicId, sinceTs) {
  const r = await db
    .prepare('SELECT COUNT(*) AS n FROM form_submissions WHERE public_id = ? AND created_at >= ?')
    .bind(publicId, sinceTs)
    .first();
  return (r && r.n) || 0;
}
