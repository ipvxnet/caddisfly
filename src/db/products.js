// Product data layer (see migrations/024_store.sql). Bridge-aware like
// blog_posts: projectKey is { aiProjectId } XOR { projectId }. Prices are
// integer minor units (cents); the store's single currency lives on the
// website config (one currency per Stripe Checkout Session).

import { slugify } from './blog-posts.js';

const nowSec = () => Math.floor(Date.now() / 1000);

// WHERE fragment + bind value for a project key.
function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}

/** Unique slug within the project (appends -2, -3, ... on collision). */
export async function uniqueProductSlug(db, projectKey, name, excludeId = null) {
  const k = keyWhere(projectKey);
  const base = slugify(name);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const row = excludeId != null
      ? await db.prepare(`SELECT id FROM products WHERE ${k.sql} AND slug = ? AND id != ?`).bind(k.val, slug, excludeId).first()
      : await db.prepare(`SELECT id FROM products WHERE ${k.sql} AND slug = ?`).bind(k.val, slug).first();
    if (!row) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now() % 10000}`;
}

export async function createProduct(db, projectKey, { slug, name, description, price_cents, image, product_type, category, body, media_json, for_sale, stock }) {
  return db
    .prepare(
      `INSERT INTO products (ai_project_id, project_id, slug, name, description, price_cents, image, product_type, category, body, media_json, for_sale, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      projectKey.aiProjectId != null ? projectKey.aiProjectId : null,
      projectKey.projectId != null ? projectKey.projectId : null,
      slug,
      name,
      description || '',
      Math.max(0, Math.round(price_cents) || 0),
      image || '',
      ['physical', 'digital', 'service'].includes(product_type) ? product_type : 'physical',
      category || '',
      body || '',
      typeof media_json === 'string' ? media_json : media_json ? JSON.stringify(media_json) : '',
      for_sale === 0 || for_sale === false ? 0 : 1,
      stock === '' || stock == null ? null : Math.max(0, Math.round(Number(stock)) || 0)
    )
    .first();
}

/** Distinct non-empty catalogue categories for a project (for the section config). */
export async function getProductCategories(db, projectKey, activeOnly = true) {
  const k = keyWhere(projectKey);
  const where = activeOnly ? `${k.sql} AND active = 1` : k.sql;
  const { results } = await db
    .prepare(`SELECT DISTINCT category FROM products WHERE ${where} AND category <> '' ORDER BY category`)
    .bind(k.val)
    .all();
  return (results || []).map((r) => r.category);
}

export async function getProductsByProject(db, projectKey, activeOnly = false) {
  const k = keyWhere(projectKey);
  const where = activeOnly ? `${k.sql} AND active = 1` : k.sql;
  const { results } = await db
    .prepare(`SELECT * FROM products WHERE ${where} ORDER BY sort_order, id`)
    .bind(k.val)
    .all();
  return results || [];
}

export async function getProductById(db, projectKey, id) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM products WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

const PRODUCT_FIELDS = ['slug', 'name', 'description', 'price_cents', 'image', 'product_type', 'active', 'sort_order', 'category', 'body', 'media_json', 'for_sale', 'stock'];

/** Decrement a product's stock by qty (Advanced Store). No-op when stock is
 *  untracked (NULL); clamps at 0. Returns the new stock or null if untracked. */
export async function decrementStock(db, projectKey, productId, qty) {
  const k = keyWhere(projectKey);
  const p = await db.prepare(`SELECT stock FROM products WHERE ${k.sql} AND id = ?`).bind(k.val, productId).first();
  if (!p || p.stock == null) return null; // untracked → unlimited
  const next = Math.max(0, p.stock - Math.max(1, qty || 1));
  await db.prepare(`UPDATE products SET stock = ?, updated_at = ? WHERE ${k.sql} AND id = ?`).bind(next, nowSec(), k.val, productId).run();
  return next;
}

/** Set a product's stock directly (scoped). '' / null = untracked. Returns true if changed. */
export async function setProductStock(db, projectKey, productId, stock) {
  const k = keyWhere(projectKey);
  const v = stock === '' || stock == null ? null : Math.max(0, Math.round(Number(stock)) || 0);
  const r = await db.prepare(`UPDATE products SET stock = ?, updated_at = ? WHERE ${k.sql} AND id = ?`).bind(v, nowSec(), k.val, productId).run();
  return r.meta.changes > 0;
}

export async function updateProduct(db, projectKey, id, updates) {
  const k = keyWhere(projectKey);
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    if (PRODUCT_FIELDS.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (!fields.length) return getProductById(db, projectKey, id);
  fields.push('updated_at = ?');
  values.push(nowSec(), k.val, id);
  return db
    .prepare(`UPDATE products SET ${fields.join(', ')} WHERE ${k.sql} AND id = ? RETURNING *`)
    .bind(...values)
    .first();
}

export async function deleteProduct(db, projectKey, id) {
  const k = keyWhere(projectKey);
  const r = await db.prepare(`DELETE FROM products WHERE ${k.sql} AND id = ?`).bind(k.val, id).run();
  return !!(r && r.meta && r.meta.changes);
}

export async function countProducts(db, projectKey) {
  const k = keyWhere(projectKey);
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM products WHERE ${k.sql}`).bind(k.val).first();
  return (r && r.n) || 0;
}
