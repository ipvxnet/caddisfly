// CRM plugin — Quotation & Order Management. Quotes + line items, scoped per
// project by the bridge pattern (ai_project_id XOR project_id). An accepted quote
// becomes an "order" via the fulfillment column. Matches src/db/crm.js style.
// See migration 054_crm_quotes.sql.

import { keyCol } from './bridge.js';

const lc = (s) => String(s == null ? '' : s).trim().toLowerCase();
const clampStr = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const posInt = (v, d = 1) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : d; };
const nonNegInt = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
export const FULFILLMENTS = ['unfulfilled', 'fulfilled', 'cancelled'];

/** Normalize a raw item list → validated rows. Drops items with no description. */
function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      description: clampStr(it && it.description, 500),
      qty: posInt(it && it.qty, 1),
      unit_price_cents: nonNegInt(it && it.unit_price_cents),
    }))
    .filter((it) => it.description !== '');
}

/**
 * Create a quote with line items. `items` = [{description, qty, unit_price_cents}].
 * Throws Error('items_required') if no valid line item remains after cleaning.
 * @returns {Promise<number>} new quote id
 */
export async function createQuote(db, projectKey, { email, title, currency, valid_until, notes, items }) {
  const rows = cleanItems(items);
  if (rows.length === 0) throw new Error('items_required');
  const k = keyCol(projectKey);
  const cur = clampStr(currency, 3).toUpperCase() || 'USD';
  const validTs = Number.isFinite(Number(valid_until)) && Number(valid_until) > 0 ? Math.floor(Number(valid_until)) : null;

  const res = await db
    .prepare(`INSERT INTO crm_quotes (${k.col}, contact_email, title, currency, valid_until, notes)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(k.val, lc(email), clampStr(title, 200), cur, validTs, clampStr(notes, 5000))
    .run();
  const quoteId = res.meta.last_row_id;

  for (let i = 0; i < rows.length; i++) {
    const it = rows[i];
    await db
      .prepare(`INSERT INTO crm_quote_items (quote_id, description, qty, unit_price_cents, sort) VALUES (?, ?, ?, ?, ?)`)
      .bind(quoteId, it.description, it.qty, it.unit_price_cents, i)
      .run();
  }
  return quoteId;
}

/**
 * Quotes for a project (optionally one contact), newest first, each with a
 * computed total_cents + item_count via a single aggregate query (no N+1).
 */
export async function listQuotes(db, projectKey, email = '') {
  const k = keyCol(projectKey);
  const e = lc(email);
  const where = e ? `q.${k.col} = ? AND q.contact_email = ?` : `q.${k.col} = ?`;
  const binds = e ? [k.val, e] : [k.val];
  const { results } = await db
    .prepare(`SELECT q.id, q.contact_email, q.title, q.currency, q.status, q.fulfillment,
                     q.valid_until, q.notes, q.created_at, q.updated_at,
                     q.public_token, q.sent_at, q.viewed_at,
                     COALESCE(SUM(i.qty * i.unit_price_cents), 0) AS total_cents,
                     COUNT(i.id) AS item_count
              FROM crm_quotes q
              LEFT JOIN crm_quote_items i ON i.quote_id = q.id
              WHERE ${where}
              GROUP BY q.id
              ORDER BY q.updated_at DESC`)
    .bind(...binds)
    .all();
  return results || [];
}

/** One quote with its ordered items array, or null. Scoped to the project. */
export async function getQuote(db, projectKey, id) {
  const k = keyCol(projectKey);
  const quote = await db
    .prepare(`SELECT * FROM crm_quotes WHERE ${k.col} = ? AND id = ?`)
    .bind(k.val, id)
    .first();
  if (!quote) return null;
  const { results } = await db
    .prepare(`SELECT id, description, qty, unit_price_cents FROM crm_quote_items WHERE quote_id = ? ORDER BY sort, id`)
    .bind(id)
    .all();
  const items = results || [];
  quote.items = items;
  quote.total_cents = items.reduce((s, it) => s + it.qty * it.unit_price_cents, 0);
  return quote;
}

/** Set quote status (whitelisted). @returns true if a row was updated. */
export async function setQuoteStatus(db, projectKey, id, status) {
  if (!QUOTE_STATUSES.includes(status)) throw new Error('invalid_status');
  const k = keyCol(projectKey);
  const res = await db
    .prepare(`UPDATE crm_quotes SET status = ?, updated_at = unixepoch() WHERE ${k.col} = ? AND id = ?`)
    .bind(status, k.val, id)
    .run();
  return res.meta.changes > 0;
}

/**
 * Set fulfillment status on an ACCEPTED quote (whitelisted). @returns true if a
 * row was updated (false if the quote isn't accepted or doesn't exist).
 */
export async function setOrderStatus(db, projectKey, id, fulfillment) {
  if (!FULFILLMENTS.includes(fulfillment)) throw new Error('invalid_fulfillment');
  const k = keyCol(projectKey);
  const res = await db
    .prepare(`UPDATE crm_quotes SET fulfillment = ?, updated_at = unixepoch()
              WHERE ${k.col} = ? AND id = ? AND status = 'accepted'`)
    .bind(fulfillment, k.val, id)
    .run();
  return res.meta.changes > 0;
}

/** Delete a quote + its items. Children removed explicitly (D1 doesn't cascade). */
export async function deleteQuote(db, projectKey, id) {
  const k = keyCol(projectKey);
  // Only touch items belonging to a quote this project owns.
  await db
    .prepare(`DELETE FROM crm_quote_items WHERE quote_id IN
              (SELECT id FROM crm_quotes WHERE ${k.col} = ? AND id = ?)`)
    .bind(k.val, id)
    .run();
  const res = await db
    .prepare(`DELETE FROM crm_quotes WHERE ${k.col} = ? AND id = ?`)
    .bind(k.val, id)
    .run();
  return res.meta.changes > 0;
}

/** Generate + persist a public token for the quote if it lacks one. The token is
 *  the unguessable id for the hosted quote page (/q/:token). @returns the token, or null. */
export async function ensureQuoteToken(db, owner, id) {
  const k = keyCol(owner);
  const row = await db.prepare(`SELECT public_token FROM crm_quotes WHERE ${k.col} = ? AND id = ?`).bind(k.val, id).first();
  if (!row) return null;
  if (row.public_token) return row.public_token;
  const token = crypto.randomUUID().replace(/-/g, '');
  await db.prepare(`UPDATE crm_quotes SET public_token = ?, updated_at = unixepoch() WHERE ${k.col} = ? AND id = ?`).bind(token, k.val, id).run();
  return token;
}

/** Mark a quote as sent (sets sent_at; promotes draft→sent). */
export async function markQuoteSent(db, owner, id) {
  const k = keyCol(owner);
  await db.prepare(
    `UPDATE crm_quotes SET sent_at = unixepoch(),
       status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
       updated_at = unixepoch()
     WHERE ${k.col} = ? AND id = ?`
  ).bind(k.val, id).run();
}

/** Public lookup by token (the token IS the auth — no owner scope). Returns the
 *  quote with items + total + its owner columns (so the caller resolves branding), or null. */
export async function getQuoteByToken(db, token) {
  if (!token) return null;
  const quote = await db.prepare(`SELECT * FROM crm_quotes WHERE public_token = ?`).bind(token).first();
  if (!quote) return null;
  const { results } = await db
    .prepare(`SELECT id, description, qty, unit_price_cents FROM crm_quote_items WHERE quote_id = ? ORDER BY sort, id`)
    .bind(quote.id).all();
  quote.items = results || [];
  quote.total_cents = quote.items.reduce((s, it) => s + it.qty * it.unit_price_cents, 0);
  return quote;
}

/** Record the customer's first view of a SENT quote (so previewing your own
 *  draft doesn't trip the viewed badge). */
export async function markQuoteViewed(db, token) {
  await db.prepare(`UPDATE crm_quotes SET viewed_at = unixepoch()
                    WHERE public_token = ? AND viewed_at IS NULL AND sent_at IS NOT NULL`).bind(token).run();
}

/** Update the customer email on an existing quote. Lowercased + length-clamped.
 *  @returns true if a row changed. */
export async function updateQuoteEmail(db, owner, id, email) {
  const k = keyCol(owner);
  const e = lc(email);
  if (!e) throw new Error('email_required');
  const res = await db.prepare(`UPDATE crm_quotes SET contact_email = ?, updated_at = unixepoch() WHERE ${k.col} = ? AND id = ?`)
    .bind(e, k.val, id).run();
  return res.meta.changes > 0;
}

/** Freeze the issuer branding snapshot (JSON) onto the quote at send time. */
export async function setQuoteIssuer(db, owner, id, issuer) {
  const k = keyCol(owner);
  await db.prepare(`UPDATE crm_quotes SET issuer_json = ?, updated_at = unixepoch() WHERE ${k.col} = ? AND id = ?`)
    .bind(JSON.stringify(issuer || {}), k.val, id).run();
}
