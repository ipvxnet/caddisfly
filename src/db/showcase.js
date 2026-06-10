// Showroom (/showcase) data layer — admin-curated example sites. See
// migrations/035_showcase.sql.

const nowSec = () => Math.floor(Date.now() / 1000);

/** All entries (admin), or enabled-only (public), ordered for display. */
export async function listShowcase(db, { enabledOnly = false } = {}) {
  const where = enabledOnly ? 'WHERE enabled = 1' : '';
  const { results } = await db
    .prepare(`SELECT * FROM showcase_entries ${where} ORDER BY sort_order ASC, id DESC`)
    .all();
  return results || [];
}

export async function getShowcaseById(db, id) {
  return db.prepare('SELECT * FROM showcase_entries WHERE id = ?').bind(id).first();
}

export async function getShowcaseByPublicId(db, publicId) {
  return db.prepare('SELECT * FROM showcase_entries WHERE project_public_id = ?').bind(publicId).first();
}

export async function createShowcase(db, { project_public_id, kind, subdomain, title, category, blurb, featured, sort_order }) {
  return db
    .prepare(
      `INSERT INTO showcase_entries (project_public_id, kind, subdomain, title, category, blurb, featured, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      project_public_id,
      kind === 'refactor' ? 'refactor' : 'ai',
      subdomain || '',
      title,
      category || '',
      blurb || '',
      featured ? 1 : 0,
      sort_order || 0,
      nowSec()
    )
    .first();
}

const FIELDS = ['title', 'category', 'blurb', 'featured', 'sort_order', 'enabled', 'subdomain'];

export async function updateShowcase(db, id, updates) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(updates)) {
    if (FIELDS.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return getShowcaseById(db, id);
  vals.push(id);
  return db.prepare(`UPDATE showcase_entries SET ${sets.join(', ')} WHERE id = ? RETURNING *`).bind(...vals).first();
}

export async function deleteShowcase(db, id) {
  const r = await db.prepare('DELETE FROM showcase_entries WHERE id = ?').bind(id).run();
  return !!(r && r.meta && r.meta.changes);
}
