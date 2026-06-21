// Product-variant data layer (Advanced Store plugin — see migrations/051). A
// product "has variants" when it owns >= 1 active row; each variant carries its
// own price (overrides the product price) and its own stock. Bridge-aware like
// products/discounts: projectKey is { aiProjectId } XOR { projectId }.

const nowSec = () => Math.floor(Date.now() / 1000);

function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}
function keyCols(projectKey) {
  return projectKey.aiProjectId != null
    ? { col: 'ai_project_id', val: projectKey.aiProjectId }
    : { col: 'project_id', val: projectKey.projectId };
}

/** All variants for a product (admin: active + inactive), ordered. */
export async function listVariants(db, projectKey, productId) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(`SELECT * FROM product_variants WHERE ${k.sql} AND product_id = ? ORDER BY sort_order, id`)
    .bind(k.val, productId)
    .all();
  return results || [];
}

/** Active variants only (storefront). */
export async function getActiveVariants(db, projectKey, productId) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(`SELECT * FROM product_variants WHERE ${k.sql} AND product_id = ? AND active = 1 ORDER BY sort_order, id`)
    .bind(k.val, productId)
    .all();
  return results || [];
}

/** Set of product ids (within the project) that have >= 1 active variant. */
export async function getProductIdsWithVariants(db, projectKey) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(`SELECT DISTINCT product_id FROM product_variants WHERE ${k.sql} AND active = 1`)
    .bind(k.val)
    .all();
  return new Set((results || []).map((r) => r.product_id));
}

/** One variant by id (checkout repricing / stock). */
export async function getVariantById(db, projectKey, id) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM product_variants WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

/** Create a variant under a product. Returns the new row. */
export async function createVariant(db, projectKey, productId, { label, price_cents, stock, sku, sort_order }) {
  const k = keyCols(projectKey);
  const lbl = String(label || '').trim().slice(0, 80);
  const price = Math.max(0, parseInt(price_cents, 10) || 0);
  const stk = stock === '' || stock == null ? null : Math.max(0, parseInt(stock, 10) || 0);
  const res = await db
    .prepare(
      `INSERT INTO product_variants (${k.col}, product_id, label, price_cents, stock, sku, sort_order, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .bind(k.val, productId, lbl, price, stk, String(sku || '').trim().slice(0, 60), parseInt(sort_order, 10) || 0, nowSec())
    .run();
  const id = res.meta && res.meta.last_row_id;
  return db.prepare('SELECT * FROM product_variants WHERE id = ?').bind(id).first();
}

/** Patch label/price/stock/sku/active on a variant the project owns. */
export async function updateVariant(db, projectKey, id, fields) {
  const k = keyWhere(projectKey);
  const sets = [];
  const binds = [];
  if (fields.label != null) { sets.push('label = ?'); binds.push(String(fields.label).trim().slice(0, 80)); }
  if (fields.price_cents != null) { sets.push('price_cents = ?'); binds.push(Math.max(0, parseInt(fields.price_cents, 10) || 0)); }
  if ('stock' in fields) { sets.push('stock = ?'); binds.push(fields.stock === '' || fields.stock == null ? null : Math.max(0, parseInt(fields.stock, 10) || 0)); }
  if (fields.sku != null) { sets.push('sku = ?'); binds.push(String(fields.sku).trim().slice(0, 60)); }
  if (fields.active != null) { sets.push('active = ?'); binds.push(fields.active ? 1 : 0); }
  if ('sort_order' in fields) { sets.push('sort_order = ?'); binds.push(parseInt(fields.sort_order, 10) || 0); }
  if (!sets.length) return null;
  binds.push(k.val, id);
  await db.prepare(`UPDATE product_variants SET ${sets.join(', ')} WHERE ${k.sql} AND id = ?`).bind(...binds).run();
  return db.prepare(`SELECT * FROM product_variants WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

/** Delete a variant the project owns. */
export async function deleteVariant(db, projectKey, id) {
  const k = keyWhere(projectKey);
  await db.prepare(`DELETE FROM product_variants WHERE ${k.sql} AND id = ?`).bind(k.val, id).run();
}

/**
 * Decrement a variant's stock (mirrors products.decrementStock). NULL stock =
 * untracked (no-op). Clamps at 0. Returns the new stock, or null if untracked.
 */
export async function decrementVariantStock(db, projectKey, variantId, qty) {
  const k = keyWhere(projectKey);
  const v = await db.prepare(`SELECT stock FROM product_variants WHERE ${k.sql} AND id = ?`).bind(k.val, variantId).first();
  if (!v || v.stock == null) return null;
  const next = Math.max(0, v.stock - Math.max(1, qty || 1));
  await db.prepare(`UPDATE product_variants SET stock = ? WHERE ${k.sql} AND id = ?`).bind(next, k.val, variantId).run();
  return next;
}
