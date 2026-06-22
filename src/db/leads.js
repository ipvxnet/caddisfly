// Leads data layer — Caddisfly's own outbound-sales prospects (admin CRM).
// See migrations/053_leads.sql. Distinct from the per-customer CRM plugin.

const nowSec = () => Math.floor(Date.now() / 1000);
export const LEAD_STATUSES = ['new', 'contacted', 'interested', 'won', 'lost'];

const clean = (s, max) => String(s == null ? '' : s).trim().slice(0, max);

/**
 * Insert a batch of leads, skipping rows that duplicate an existing place_id
 * (INSERT OR IGNORE against the partial unique index) so re-runs don't clobber
 * the status/notes you've set. Returns { received, inserted }.
 */
export async function bulkInsertLeads(db, leads) {
  if (!Array.isArray(leads) || !leads.length) return { received: 0, inserted: 0 };
  let inserted = 0;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO leads (business, website, phone, email, address, area, vertical, place_id, rating, has_site, status, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`
  );
  const t = nowSec();
  for (const l of leads.slice(0, 1000)) {
    const business = clean(l.business || l.name, 200);
    if (!business) continue;
    const res = await stmt
      .bind(
        business,
        clean(l.website, 400),
        clean(l.phone, 40),
        clean(l.email, 200).toLowerCase(),
        clean(l.address, 300),
        clean(l.area, 80),
        clean(l.vertical, 60),
        clean(l.place_id, 120),
        l.rating != null && Number.isFinite(Number(l.rating)) ? Number(l.rating) : null,
        l.has_site ? 1 : 0,
        clean(l.source || 'places', 30),
        t, t
      )
      .run();
    if (res.meta && res.meta.changes) inserted += res.meta.changes;
  }
  return { received: leads.length, inserted };
}

/** Filtered lead list. opts: { status, vertical, area, has_site, q, limit }. */
export async function listLeads(db, opts = {}) {
  const where = [];
  const binds = [];
  if (opts.status && LEAD_STATUSES.includes(opts.status)) { where.push('status = ?'); binds.push(opts.status); }
  if (opts.vertical) { where.push('vertical = ?'); binds.push(opts.vertical); }
  if (opts.area) { where.push('area = ?'); binds.push(opts.area); }
  if (opts.has_site === 0 || opts.has_site === 1) { where.push('has_site = ?'); binds.push(opts.has_site); }
  if (opts.q) { where.push('(business LIKE ? OR website LIKE ? OR email LIKE ? OR phone LIKE ?)'); const q = `%${opts.q}%`; binds.push(q, q, q, q); }
  const sql = `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY has_site ASC, (rating IS NULL), rating DESC, created_at DESC LIMIT ?`;
  binds.push(Math.min(2000, Math.max(1, opts.limit || 500)));
  const { results } = await db.prepare(sql).bind(...binds).all();
  return results || [];
}

/** Aggregate counts for the pipeline header. */
export async function leadStats(db) {
  const { results } = await db.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN has_site = 0 THEN 1 ELSE 0 END) AS no_site,
       SUM(CASE WHEN email <> '' THEN 1 ELSE 0 END) AS with_email,
       SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) AS s_new,
       SUM(CASE WHEN status='contacted' THEN 1 ELSE 0 END) AS s_contacted,
       SUM(CASE WHEN status='interested' THEN 1 ELSE 0 END) AS s_interested,
       SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) AS s_won,
       SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END) AS s_lost
     FROM leads`
  ).all();
  return (results && results[0]) || {};
}

/** Distinct verticals + areas present (for the filter dropdowns). */
export async function leadFacets(db) {
  const v = await db.prepare(`SELECT DISTINCT vertical FROM leads WHERE vertical <> '' ORDER BY vertical`).all();
  const a = await db.prepare(`SELECT DISTINCT area FROM leads WHERE area <> '' ORDER BY area`).all();
  return { verticals: (v.results || []).map((r) => r.vertical), areas: (a.results || []).map((r) => r.area) };
}

/** Patch status / notes / promo_code (admin UI). */
export async function updateLead(db, id, fields) {
  const sets = [];
  const binds = [];
  if (fields.status && LEAD_STATUSES.includes(fields.status)) { sets.push('status = ?'); binds.push(fields.status); }
  if (fields.notes != null) { sets.push('notes = ?'); binds.push(clean(fields.notes, 5000)); }
  if (fields.promo_code != null) { sets.push('promo_code = ?'); binds.push(clean(fields.promo_code, 60)); }
  if (fields.email != null) { sets.push('email = ?'); binds.push(clean(fields.email, 200).toLowerCase()); }
  if (!sets.length) return null;
  sets.push('updated_at = ?'); binds.push(nowSec());
  binds.push(id);
  await db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
  return db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
}

export async function deleteLead(db, id) {
  await db.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
}

/** Add one lead by hand (admin UI). Returns the row, or null on dup place/empty. */
export async function addManualLead(db, l) {
  const business = clean(l.business, 200);
  if (!business) throw new Error('business_required');
  const t = nowSec();
  const res = await db.prepare(
    `INSERT INTO leads (business, website, phone, email, address, area, vertical, has_site, status, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', 'manual', ?, ?)`
  ).bind(
    business, clean(l.website, 400), clean(l.phone, 40), clean(l.email, 200).toLowerCase(),
    clean(l.address, 300), clean(l.area, 80), clean(l.vertical, 60), l.has_site ? 1 : 0, t, t
  ).run();
  const id = res.meta && res.meta.last_row_id;
  return db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
}
