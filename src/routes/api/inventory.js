// Public inventory REST API (Phase 3). Token-authed (Authorization: Bearer <token>),
// NO session — the token resolves to a project. Lets external systems read + bulk
// upsert products/stock. Reuses upsertProductsBulk (products.js) + the CSV parser.
// Token generated/rotated by the owner from the Import page. See db/inventory-tokens.js.

import { resolveProjectByToken } from '../../db/inventory-tokens.js';
import { getProductsByProject, upsertProductsBulk, countProducts } from '../../db/products.js';
import { getProductIdsWithVariants, listVariants } from '../../db/variants.js';
import { parseDelimited, mapRows } from '../public/crm-stock-import.js';
import { getOrCreateConfig } from '../api/ai-builder/store.js';
import { hasPlugin } from '../../plugins/entitlements.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { PRODUCT_LIMITS } from '../../utils/credits.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

/** CORS preflight. */
export function handleInventoryOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Pull the bearer token and resolve to { projectKey, email } — or null. */
async function auth(ctx) {
  const h = ctx.request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return resolveProjectByToken(ctx.env.DB, m[1].trim());
}

/** GET /api/inventory/products — list products + variants + stock. */
export async function handleInventoryList(ctx) {
  const who = await auth(ctx);
  if (!who) return json({ success: false, error: 'Invalid or missing API token.' }, 401);
  const { env } = ctx;
  const config = await getOrCreateConfig(env.DB, who.projectKey).catch(() => ({}));
  const products = await getProductsByProject(env.DB, who.projectKey, false);
  const withVariants = new Set(await getProductIdsWithVariants(env.DB, who.projectKey));
  const out = [];
  for (const p of products) {
    const item = { id: p.id, name: p.name, slug: p.slug, price_cents: p.price_cents, type: p.product_type, category: p.category, stock: p.stock, active: !!p.active };
    if (withVariants.has(p.id)) {
      const variants = await listVariants(env.DB, who.projectKey, p.id);
      item.variants = variants.map((v) => ({ id: v.id, label: v.label, sku: v.sku, price_cents: v.price_cents, stock: v.stock, active: !!v.active }));
    }
    out.push(item);
  }
  return json({ success: true, currency: (config.store_currency || 'usd').toUpperCase(), count: out.length, products: out });
}

/**
 * POST /api/inventory/products — bulk create/update products.
 * Body: { products: [{name, price, stock, category, type, description}] }  OR  { csv: "..." }.
 * Matched by name→slug (update) else create; stock applied only with advanced_store;
 * respects the plan product cap. Returns the upsert summary.
 */
export async function handleInventoryUpsert(ctx) {
  const who = await auth(ctx);
  if (!who) return json({ success: false, error: 'Invalid or missing API token.' }, 401);
  const { env } = ctx;
  const body = await ctx.request.json().catch(() => ({}));
  let rows = [];
  if (typeof body.csv === 'string' && body.csv.trim()) rows = mapRows(parseDelimited(body.csv));
  else if (Array.isArray(body.products)) rows = body.products;
  if (!rows.length) return json({ success: false, error: 'Provide a non-empty `products` array or a `csv` string.' }, 400);
  if (rows.length > 1000) return json({ success: false, error: 'Too many rows — max 1000 per request.' }, 413);

  const hasAdv = await hasPlugin(env, who.email, 'advanced_store');
  const tier = await getUserTier(env.DB, who.email);
  const limit = PRODUCT_LIMITS[tier] != null ? PRODUCT_LIMITS[tier] : PRODUCT_LIMITS.free_trial;
  const current = await countProducts(env.DB, who.projectKey);
  const maxCreate = limit === Infinity ? Infinity : Math.max(0, limit - current);

  const res = await upsertProductsBulk(env.DB, who.projectKey, rows, { setStock: hasAdv, dryRun: false, maxCreate });
  return json({ success: true, stock_applied: hasAdv, created: res.created, updated: res.updated, skipped: res.skipped, errors: res.errors, rows: res.rows });
}
