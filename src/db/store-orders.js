// Store order data layer (see migrations/024_store.sql). One row per completed
// Stripe Checkout Session; stripe_session_id is UNIQUE so the two writers
// (receipt page + Connect webhook) are idempotent — whoever runs first inserts,
// the other is a no-op. Bridge-aware like products.

function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}

/**
 * Insert an order if its session hasn't been recorded yet.
 * @returns {object|null} the new row, or null when it already existed.
 */
export async function insertOrderIfNew(db, projectKey, publicId, order) {
  const row = await db
    .prepare(
      `INSERT INTO store_orders (
         ai_project_id, project_id, public_id, stripe_session_id,
         amount_total, currency, customer_email, customer_name,
         shipping_json, items_json, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid')
       ON CONFLICT(stripe_session_id) DO NOTHING
       RETURNING *`
    )
    .bind(
      projectKey.aiProjectId != null ? projectKey.aiProjectId : null,
      projectKey.projectId != null ? projectKey.projectId : null,
      publicId,
      order.stripe_session_id,
      order.amount_total || 0,
      order.currency || 'usd',
      order.customer_email || '',
      order.customer_name || '',
      order.shipping_json || '',
      order.items_json || '[]'
    )
    .first();
  return row || null;
}

export async function getOrdersByProject(db, projectKey, limit = 100) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(`SELECT * FROM store_orders WHERE ${k.sql} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .bind(k.val, limit)
    .all();
  return results || [];
}

export async function countUnreadOrders(db, projectKey) {
  const k = keyWhere(projectKey);
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM store_orders WHERE ${k.sql} AND is_read = 0`).bind(k.val).first();
  return (r && r.n) || 0;
}

export async function markOrdersRead(db, projectKey) {
  const k = keyWhere(projectKey);
  await db.prepare(`UPDATE store_orders SET is_read = 1 WHERE ${k.sql} AND is_read = 0`).bind(k.val).run();
}
