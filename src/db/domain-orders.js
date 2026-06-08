// Domain reselling data layer (see migrations/027_domains_store.sql).
// Status flow: pending → paid → registered | failed | refunded. The paid→
// registered transition is claimed atomically so the receipt page and the
// Stripe webhook can't double-register.

export async function createDomainOrder(db, data) {
  return db
    .prepare(
      `INSERT INTO domain_orders (
         customer_email, ai_project_id, project_id, domain, years,
         wholesale_cents, price_cents, currency, stripe_session_id,
         registrant_json, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING *`
    )
    .bind(
      data.customer_email,
      data.ai_project_id ?? null,
      data.project_id ?? null,
      data.domain,
      data.years || 1,
      data.wholesale_cents,
      data.price_cents,
      data.currency || 'usd',
      data.stripe_session_id ?? null,
      data.registrant_json ?? null
    )
    .first();
}

export async function getOrderById(db, id) {
  return db.prepare('SELECT * FROM domain_orders WHERE id = ?').bind(id).first();
}

export async function getOrderBySession(db, sessionId) {
  return db.prepare('SELECT * FROM domain_orders WHERE stripe_session_id = ?').bind(sessionId).first();
}

export async function getOrdersByEmail(db, email) {
  const { results } = await db
    .prepare('SELECT * FROM domain_orders WHERE customer_email = ? COLLATE NOCASE ORDER BY created_at DESC')
    .bind(email)
    .all();
  return results || [];
}

/** Registered domains expiring within `withinDays` — the renewal/reminder set. */
export async function getExpiringDomains(db, nowTs, withinDays = 30) {
  const cutoff = nowTs + withinDays * 86400;
  const { results } = await db
    .prepare("SELECT * FROM domain_orders WHERE status = 'registered' AND expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at ASC")
    .bind(cutoff)
    .all();
  return results || [];
}

const ORDER_FIELDS = new Set([
  'status', 'error', 'stripe_customer_id', 'nc_domain_id', 'nc_transaction_id',
  'auto_renew', 'registered_at', 'expires_at', 'stripe_session_id',
  'renewal_attempts', 'renewal_last_at', 'renewal_session_id',
]);

/**
 * Atomically claim a manual-renewal Stripe session for one order. Returns true
 * for exactly the FIRST caller (receipt page vs webhook) for a given session —
 * so a single payment renews the domain once.
 */
export async function claimRenewalSession(db, id, sessionId) {
  const r = await db
    .prepare("UPDATE domain_orders SET renewal_session_id = ?, updated_at = unixepoch() WHERE id = ? AND COALESCE(renewal_session_id,'') != ?")
    .bind(sessionId, id, sessionId)
    .run();
  return !!(r && r.meta && r.meta.changes);
}

export async function updateOrder(db, id, fields) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!ORDER_FIELDS.has(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) return null;
  sets.push('updated_at = unixepoch()');
  vals.push(id);
  return db.prepare(`UPDATE domain_orders SET ${sets.join(', ')} WHERE id = ? RETURNING *`).bind(...vals).first();
}

/**
 * Atomically claim an order for registration (paid → registering). Returns
 * true for exactly ONE caller — the receipt page and webhook both try.
 */
export async function claimOrderForRegistration(db, id) {
  const r = await db
    .prepare("UPDATE domain_orders SET status = 'registering', updated_at = unixepoch() WHERE id = ? AND status IN ('pending', 'paid')")
    .bind(id)
    .run();
  return !!(r && r.meta && r.meta.changes);
}

/** Price cache (refreshed at most daily; quotes read from here). */
export async function getCachedPrices(db) {
  const { results } = await db.prepare('SELECT * FROM domain_prices').all();
  return results || [];
}

export async function upsertPrice(db, tld, registerCents, renewCents) {
  await db
    .prepare(
      `INSERT INTO domain_prices (tld, register_cents, renew_cents, updated_at)
       VALUES (?, ?, ?, unixepoch())
       ON CONFLICT(tld) DO UPDATE SET register_cents = excluded.register_cents,
         renew_cents = excluded.renew_cents, updated_at = unixepoch()`
    )
    .bind(tld, registerCents, renewCents)
    .run();
}
