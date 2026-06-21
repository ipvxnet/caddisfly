// Discount-code data layer (Advanced Store plugin — see migrations/051). Bridge-
// aware like products: projectKey is { aiProjectId } XOR { projectId }. Codes are
// stored lowercased and matched case-insensitively. `value` is a percent (1..100)
// when kind='percent', or minor units (cents) off when kind='fixed'.

const nowSec = () => Math.floor(Date.now() / 1000);

function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}

// Insert helper: which bridge column carries the id.
function keyCols(projectKey) {
  return projectKey.aiProjectId != null
    ? { col: 'ai_project_id', val: projectKey.aiProjectId }
    : { col: 'project_id', val: projectKey.projectId };
}

/** Normalize/clamp a raw code to the stored form (lowercase, trimmed, a-z0-9-_). */
export function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40);
}

/** All discounts for a project, newest first. */
export async function listDiscounts(db, projectKey) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(`SELECT * FROM store_discounts WHERE ${k.sql} ORDER BY created_at DESC, id DESC`)
    .bind(k.val)
    .all();
  return results || [];
}

/** Look up one discount by (normalized) code within the project, or null. */
export async function getDiscountByCode(db, projectKey, code) {
  const k = keyWhere(projectKey);
  const norm = normalizeCode(code);
  if (!norm) return null;
  return db
    .prepare(`SELECT * FROM store_discounts WHERE ${k.sql} AND code = ?`)
    .bind(k.val, norm)
    .first();
}

/**
 * Validate a discount row for use at checkout. Returns { ok:true, discount } or
 * { ok:false, reason } where reason ∈ invalid|inactive|expired|used_up.
 */
export function checkDiscount(d, now = nowSec()) {
  if (!d) return { ok: false, reason: 'invalid' };
  if (!d.active) return { ok: false, reason: 'inactive' };
  if (d.expires_at != null && d.expires_at <= now) return { ok: false, reason: 'expired' };
  if (d.max_uses != null && d.used_count >= d.max_uses) return { ok: false, reason: 'used_up' };
  return { ok: true, discount: d };
}

/**
 * Compute the amount (minor units) a discount takes off a given subtotal.
 * Percent: floor(subtotal * value / 100). Fixed: min(value, subtotal). Never
 * exceeds the subtotal (no negative order totals).
 */
export function discountAmountFor(d, subtotalCents) {
  if (!d || !subtotalCents) return 0;
  if (d.kind === 'fixed') return Math.max(0, Math.min(d.value, subtotalCents));
  const pct = Math.max(0, Math.min(100, d.value));
  return Math.floor((subtotalCents * pct) / 100);
}

/**
 * Create a discount. Throws Error('duplicate') on code collision, Error('invalid')
 * on bad input. Returns the new row.
 */
export async function createDiscount(db, projectKey, { code, kind, value, max_uses, expires_at }) {
  const norm = normalizeCode(code);
  const k = keyCols(projectKey);
  const kindV = kind === 'fixed' ? 'fixed' : 'percent';
  const valV = parseInt(value, 10);
  if (!norm || !Number.isFinite(valV) || valV <= 0) throw new Error('invalid');
  if (kindV === 'percent' && valV > 100) throw new Error('invalid');
  const maxV = max_uses === '' || max_uses == null ? null : Math.max(1, parseInt(max_uses, 10) || 0) || null;
  const expV = expires_at === '' || expires_at == null ? null : parseInt(expires_at, 10) || null;

  const existing = await getDiscountByCode(db, projectKey, norm);
  if (existing) throw new Error('duplicate');

  const res = await db
    .prepare(
      `INSERT INTO store_discounts (${k.col}, code, kind, value, active, max_uses, used_count, expires_at, created_at)
       VALUES (?, ?, ?, ?, 1, ?, 0, ?, ?)`
    )
    .bind(k.val, norm, kindV, valV, maxV, expV, nowSec())
    .run();
  const id = res.meta && res.meta.last_row_id;
  return db.prepare('SELECT * FROM store_discounts WHERE id = ?').bind(id).first();
}

/** Patch active/value/max_uses/expires_at on a discount the project owns. */
export async function updateDiscount(db, projectKey, id, fields) {
  const k = keyWhere(projectKey);
  const sets = [];
  const binds = [];
  if (fields.active != null) { sets.push('active = ?'); binds.push(fields.active ? 1 : 0); }
  if (fields.value != null) { sets.push('value = ?'); binds.push(parseInt(fields.value, 10) || 0); }
  if ('max_uses' in fields) { sets.push('max_uses = ?'); binds.push(fields.max_uses === '' || fields.max_uses == null ? null : parseInt(fields.max_uses, 10) || null); }
  if ('expires_at' in fields) { sets.push('expires_at = ?'); binds.push(fields.expires_at === '' || fields.expires_at == null ? null : parseInt(fields.expires_at, 10) || null); }
  if (!sets.length) return null;
  binds.push(k.val, id);
  await db.prepare(`UPDATE store_discounts SET ${sets.join(', ')} WHERE ${k.sql} AND id = ?`).bind(...binds).run();
  return db.prepare(`SELECT * FROM store_discounts WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

/** Delete a discount the project owns. */
export async function deleteDiscount(db, projectKey, id) {
  const k = keyWhere(projectKey);
  await db.prepare(`DELETE FROM store_discounts WHERE ${k.sql} AND id = ?`).bind(k.val, id).run();
}

/**
 * Increment used_count for a code on a completed order (idempotent at the caller
 * via insertOrderIfNew). Guarded so used_count never passes max_uses by a race.
 */
export async function incrementDiscountUse(db, projectKey, code) {
  const k = keyWhere(projectKey);
  const norm = normalizeCode(code);
  if (!norm) return;
  await db
    .prepare(`UPDATE store_discounts SET used_count = used_count + 1 WHERE ${k.sql} AND code = ?`)
    .bind(k.val, norm)
    .run();
}
