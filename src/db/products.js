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

const BULK_TYPES = ['physical', 'digital', 'service'];
function priceToCents(v) { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0; }
function normStockVal(v) { const s = String(v == null ? '' : v).trim(); if (s === '') return null; const n = parseInt(s, 10); return Number.isFinite(n) ? Math.max(0, n) : null; }

/**
 * Bulk create-or-update products from normalized rows — the SHARED CORE for
 * spreadsheet import (Phase 2) and the future inventory API/MCP (Phases 3-4).
 * Each row: { name (required), price, stock, category, type, description }.
 * Matched to an existing product by slug(name): found → partial update of the
 * provided fields, else → create. `setStock` gates writing the stock column
 * (advanced_store). `dryRun` classifies without writing (for a preview).
 * Returns { created, updated, errors, rows:[{rowNum, name, action, error, price_cents, stock}] }.
 */
export async function upsertProductsBulk(db, projectKey, rows, { setStock = false, dryRun = false, maxCreate = Infinity } = {}) {
  const k = keyWhere(projectKey);
  const out = { created: 0, updated: 0, errors: 0, skipped: 0, rows: [] };
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] || {};
    const name = String(raw.name == null ? '' : raw.name).trim();
    const rec = { rowNum: i + 1, name, action: '', error: '' };
    if (!name) { rec.action = 'error'; rec.error = 'missing_name'; out.errors++; out.rows.push(rec); continue; }
    const slug = slugify(name);
    const hasPrice = raw.price != null && String(raw.price).trim() !== '';
    const price_cents = hasPrice ? priceToCents(raw.price) : null;
    const type = BULK_TYPES.includes(String(raw.type || '').toLowerCase()) ? String(raw.type).toLowerCase() : '';
    const category = raw.category != null ? String(raw.category).trim().slice(0, 100) : '';
    const description = raw.description != null ? String(raw.description).trim().slice(0, 5000) : '';
    const stockVal = setStock ? normStockVal(raw.stock) : undefined;
    rec.price_cents = price_cents; rec.stock = stockVal;
    let existing;
    try { existing = await db.prepare(`SELECT id FROM products WHERE ${k.sql} AND slug = ?`).bind(k.val, slug).first(); }
    catch (e) { rec.action = 'error'; rec.error = e.message; out.errors++; out.rows.push(rec); continue; }
    rec.action = existing ? 'update' : 'create';
    // Respect the plan's product cap — new products beyond the limit are skipped.
    if (rec.action === 'create' && out.created >= maxCreate) {
      rec.action = 'skipped'; rec.error = 'limit_reached'; out.skipped++; out.rows.push(rec); continue;
    }
    if (!dryRun) {
      try {
        if (existing) {
          const sets = [], binds = [];
          if (hasPrice) { sets.push('price_cents = ?'); binds.push(price_cents); }
          if (type) { sets.push('product_type = ?'); binds.push(type); }
          if (category) { sets.push('category = ?'); binds.push(category); }
          if (description) { sets.push('description = ?'); binds.push(description); }
          if (setStock && stockVal !== undefined) { sets.push('stock = ?'); binds.push(stockVal); }
          if (sets.length) { sets.push('updated_at = ?'); binds.push(nowSec()); await db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE ${k.sql} AND id = ?`).bind(...binds, k.val, existing.id).run(); }
        } else {
          const uslug = await uniqueProductSlug(db, projectKey, name);
          await createProduct(db, projectKey, { slug: uslug, name, description, price_cents: price_cents || 0, image: '', product_type: type || 'physical', category, body: '', media_json: '', for_sale: 1, stock: setStock ? stockVal : null });
        }
      } catch (e) { rec.action = 'error'; rec.error = e.message; out.errors++; out.rows.push(rec); continue; }
    }
    if (rec.action === 'create') out.created++; else out.updated++;
    out.rows.push(rec);
  }
  return out;
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
