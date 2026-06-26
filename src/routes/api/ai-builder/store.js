// Commerce v1 — Stripe Connect plumbing (registered with PROJ middleware
// except the OAuth callback, which is public and gated by the signed state):
//   GET    /api/ai-builder/:project_id/store/stripe             connection status
//   POST   /api/ai-builder/:project_id/store/stripe/connect     -> { url } (OAuth authorize)
//   POST   /api/ai-builder/:project_id/store/stripe/disconnect  revoke + clear
//   GET    /store/stripe/callback?code&state                    Stripe redirects here
//
// The merchant's acct_… id lives on ai_website_configs.stripe_account_id
// (bridge-aware get-or-create below). Checkout/webhook arrive in later steps.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import {
  getWebsiteConfigByAIProjectId,
  getWebsiteConfigByRegularProjectId,
  createWebsiteConfig,
  updateWebsiteConfigById,
} from '../../../db/ai-config.js';
import {
  isConnectConfigured,
  connectAuthorizeUrl,
  exchangeConnectCode,
  deauthorizeConnect,
  signConnectState,
  verifyConnectState,
  createStoreCheckoutSession,
  createConnectCoupon,
  getStoreCheckoutSession,
  listConnectProducts,
  listConnectRecurringPrices,
  getConnectPrice,
  createConnectSubscriptionPrice,
  createSubscriptionCheckoutSession,
  verifyWebhook,
  getConnectAccount,
  stripeUnitAmount,
} from '../../../utils/stripe.js';
import { isValidStoreCurrency } from '../../../utils/currencies.js';
import { slugify } from '../../../db/blog-posts.js';
import { insertOrderIfNew, getOrdersByProject, markOrdersRead } from '../../../db/store-orders.js';
import { sendOrderBuyerEmail, sendOrderMerchantEmail, sendTicketEmail } from '../../../utils/email.js';
import { recordCoursePurchase, getCourseById } from '../../../db/courses.js';
import { t } from '../../../i18n/index.js';
import {
  createProduct, getProductsByProject, getProductById, updateProduct, deleteProduct,
  countProducts, uniqueProductSlug, decrementStock,
} from '../../../db/products.js';
import {
  listDiscounts, getDiscountByCode, createDiscount, updateDiscount, deleteDiscount,
  incrementDiscountUse, checkDiscount, discountAmountFor, normalizeCode,
} from '../../../db/discounts.js';
import {
  listVariants, getActiveVariants, getVariantById, createVariant, updateVariant,
  deleteVariant, decrementVariantStock,
} from '../../../db/variants.js';
import { callWorkersAI } from '../../../utils/ai-content-generator.js';
import { screenContent, stripPolicyEcho, policyError, POLICY_INSTRUCTION } from '../../../utils/content-policy.js';
import { hasPlugin } from '../../../plugins/entitlements.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS, PRODUCT_LIMITS } from '../../../utils/credits.js';
import { getUserTier } from '../../../utils/rate-limiter.js';
import { audit } from '../../../utils/audit.js';
import { settlePaidBooking } from '../booking.js';
import { generateImageToR2 } from './ai-edit.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resolve :project_id (ai-first, like blog.js) to project context. */
export async function resolveStoreProject(env, project_id) {
  const aiProject = await getAIProjectByProjectId(env.DB, project_id);
  if (aiProject) {
    return {
      projectKey: { aiProjectId: aiProject.id },
      email: aiProject.customer_email,
      language: aiProject.language || 'en',
      businessName: aiProject.project_name || 'My Website',
      industry: aiProject.industry || '',
    };
  }
  const regular = await getProjectByPreviewId(env.DB, project_id);
  if (regular) {
    let businessName = regular.website_url || 'My Website';
    let industry = '';
    try {
      const p = JSON.parse(regular.company_profile_json || '{}');
      if (p && p.name) businessName = p.name;
      if (p && p.category) industry = p.category;
    } catch { /* ignore */ }
    return {
      projectKey: { projectId: regular.id },
      email: regular.customer_email,
      language: regular.language || 'en',
      businessName,
      industry,
    };
  }
  return null;
}

/** Bridge-aware config get-or-create (refactor projects may not have one yet). */
export async function getOrCreateConfig(db, projectKey) {
  if (projectKey.aiProjectId) {
    return (
      (await getWebsiteConfigByAIProjectId(db, projectKey.aiProjectId)) ||
      (await createWebsiteConfig(db, { ai_project_id: projectKey.aiProjectId }))
    );
  }
  return (
    (await getWebsiteConfigByRegularProjectId(db, projectKey.projectId)) ||
    (await createWebsiteConfig(db, { project_id: projectKey.projectId }))
  );
}

/** GET /api/ai-builder/:project_id/store/stripe — connection status. */
export async function handleStoreStripeStatus(ctx) {
  const { env, params } = ctx;
  const resolved = await resolveStoreProject(env, params.project_id);
  if (!resolved) return json({ success: false, error: 'Project not found' }, 404);

  const config = await getOrCreateConfig(env.DB, resolved.projectKey);
  const accountId = config.stripe_account_id || '';
  return json({
    success: true,
    configured: isConnectConfigured(env),
    connected: !!accountId,
    // Mask the middle of the acct id — enough to recognize, not to reuse.
    account: accountId ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : '',
    currency: config.store_currency || 'usd',
  });
}

/** POST /api/ai-builder/:project_id/store/stripe/connect — mint OAuth URL. */
export async function handleStoreStripeConnect(ctx) {
  const { env, params, url } = ctx;
  if (!isConnectConfigured(env)) {
    return json({ success: false, error: 'Stripe Connect is not configured on this environment.' }, 503);
  }
  const resolved = await resolveStoreProject(env, params.project_id);
  if (!resolved) return json({ success: false, error: 'Project not found' }, 404);

  const state = await signConnectState(env, params.project_id);
  const authorizeUrl = connectAuthorizeUrl(env, {
    state,
    redirectUri: `${url.origin}/store/stripe/callback`,
    email: resolved.email || undefined,
  });
  return json({ success: true, url: authorizeUrl });
}

/** POST /api/ai-builder/:project_id/store/stripe/disconnect — revoke + clear. */
export async function handleStoreStripeDisconnect(ctx) {
  const { env, params } = ctx;
  const resolved = await resolveStoreProject(env, params.project_id);
  if (!resolved) return json({ success: false, error: 'Project not found' }, 404);

  const config = await getOrCreateConfig(env.DB, resolved.projectKey);
  if (config.stripe_account_id) {
    // Best-effort revoke: clearing our column is what actually stops checkout,
    // and the merchant can always revoke from their own Stripe dashboard.
    try {
      await deauthorizeConnect(env, config.stripe_account_id);
    } catch (e) {
      console.error('Stripe deauthorize failed (continuing):', e.message);
    }
    await updateWebsiteConfigById(env.DB, config.id, { stripe_account_id: '' });
  }
  audit(ctx, 'stripe.disconnect', { teamOwner: resolved.email, resourceType: 'site', resourceId: params.project_id });
  return json({ success: true, connected: false });
}

/**
 * GET /store/stripe/callback — public; Stripe redirects the merchant's browser
 * here after the OAuth screen. The signed state (minted by the project-gated
 * connect endpoint, 30-min expiry) is what authorizes the write.
 */
export async function handleStripeConnectCallback(ctx) {
  const { env, url } = ctx;
  const back = (projectId, q) =>
    Response.redirect(`${url.origin}/ai-builder/store/${projectId}?${q}`, 302);

  const state = url.searchParams.get('state') || '';
  const projectId = await verifyConnectState(env, state);
  if (!projectId) return new Response('Invalid or expired state', { status: 403 });

  // Merchant cancelled / Stripe error → bounce back with a notice.
  const oauthError = url.searchParams.get('error');
  if (oauthError) return back(projectId, `stripe_error=${encodeURIComponent(oauthError)}`);

  const code = url.searchParams.get('code');
  if (!code) return back(projectId, 'stripe_error=missing_code');

  const resolved = await resolveStoreProject(env, projectId);
  if (!resolved) return new Response('Project not found', { status: 404 });

  try {
    const accountId = await exchangeConnectCode(env, code);
    const config = await getOrCreateConfig(env.DB, resolved.projectKey);
    // Adopt the merchant's Stripe account currency so the store + bookings show
    // the right currency (R$, €, …) with no manual config. Only when still on the
    // default 'usd' so we never clobber a deliberate manual override.
    const connectUpdates = { stripe_account_id: accountId };
    try {
      const account = await getConnectAccount(env, accountId);
      const cur = account && String(account.default_currency || '').toLowerCase();
      if (cur && (!config.store_currency || config.store_currency === 'usd')) connectUpdates.store_currency = cur;
    } catch (e) { console.error('connect currency detect failed (non-fatal):', e.message); }
    await updateWebsiteConfigById(env.DB, config.id, connectUpdates);
    audit(ctx, 'stripe.connect', { teamOwner: resolved.email, resourceType: 'site', resourceId: projectId, metadata: { account: accountId } });
    return back(projectId, 'connected=1');
  } catch (e) {
    console.error('Stripe Connect exchange failed:', e.message);
    return back(projectId, `stripe_error=${encodeURIComponent(e.message.slice(0, 120))}`);
  }
}

// ---- products ---------------------------------------------------------------

const LANG_NAMES = { en: 'English', es: 'Spanish', pt: 'Portuguese' };
const PRODUCT_TYPES = ['physical', 'digital', 'service'];
// Stripe's minimum charge is ~$0.50; cap well below Checkout's per-item max.
const MIN_PRICE_CENTS = 50;
const MAX_PRICE_CENTS = 99999999;

function validPrice(cents) {
  const n = Math.round(Number(cents));
  if (!Number.isFinite(n) || n < MIN_PRICE_CENTS || n > MAX_PRICE_CENTS) return null;
  return n;
}

// Model B (2026-06-22): product capacity is a TIER concern (Starter 250 / Pro
// 1000 / Agency unlimited). Plugins add FEATURES (catalogue layouts, inventory,
// discounts, variants) — not product headroom — so the cap no longer keys off a
// plugin. (kept async: callers await it.)
async function effectiveProductLimit(env, email, tier) {
  return PRODUCT_LIMITS[tier] != null ? PRODUCT_LIMITS[tier] : PRODUCT_LIMITS.free_trial;
}

/** GET /api/ai-builder/:project_id/store/products — list + cap info. */
export async function handleProductList(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const products = await getProductsByProject(env.DB, r.projectKey);
  const tier = await getUserTier(env.DB, r.email);
  const limit = await effectiveProductLimit(env, r.email, tier);
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  return json({
    success: true,
    products,
    tier,
    limit: Number.isFinite(limit) ? limit : null, // null = unlimited
    enforced: env.ENVIRONMENT === 'production',
    currency: config.store_currency || 'usd',
  });
}

/** POST /api/ai-builder/:project_id/store/products — create (cap-gated). */
export async function handleProductCreate(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);

    // Product-count gate (production only, like PUBLISH_LIMITS in deploy.js).
    const tier = await getUserTier(env.DB, r.email);
    const limit = await effectiveProductLimit(env, r.email, tier);
    if (env.ENVIRONMENT === 'production' && Number.isFinite(limit)) {
      const n = await countProducts(env.DB, r.projectKey);
      if (n >= limit) {
        return json({
          success: false,
          error: `You've reached your plan's product limit (${limit} on ${tier.replace('_', ' ')}). Upgrade to add more.`,
          limit,
          billing_url: '/billing',
        }, 402);
      }
    }

    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').toString().trim().slice(0, 140);
    if (!name) return json({ success: false, error: 'Product name is required' }, 400);
    // Catalogue items can be info-only (for_sale=0) with no price; buyable items
    // require a valid price.
    const for_sale = body.for_sale === 0 || body.for_sale === false || body.for_sale === '0' ? 0 : 1;
    let price_cents = 0;
    if (for_sale) {
      price_cents = validPrice(body.price_cents);
      if (price_cents == null) return json({ success: false, error: 'Price must be between 0.50 and 999,999.99' }, 400);
    }
    const description = (body.description || '').toString().slice(0, 5000);
    const screen = screenContent(`${name}\n${description}`);
    if (!screen.allowed) return json(policyError(screen), 422);

    const slug = await uniqueProductSlug(env.DB, r.projectKey, name);
    const product = await createProduct(env.DB, r.projectKey, {
      slug,
      name,
      description,
      price_cents,
      image: (body.image || '').toString().trim().slice(0, 500),
      product_type: PRODUCT_TYPES.includes(body.product_type) ? body.product_type : 'physical',
      // Catalogue fields (Catalogue plugin) — harmless on plain shop products.
      category: (body.category || '').toString().trim().slice(0, 80),
      body: (body.body || '').toString().slice(0, 20000),
      media_json: body.media && typeof body.media === 'object' ? JSON.stringify(body.media) : (body.media_json || '').toString().slice(0, 20000),
      for_sale,
      // Inventory (Advanced Store plugin) — only honored when entitled.
      stock: body.stock != null && (await hasPlugin(env, r.email, 'advanced_store')) ? body.stock : null,
    });
    return json({ success: true, product }, 201);
  } catch (e) {
    console.error('product create error:', e);
    return json({ success: false, error: 'Failed to create product' }, 500);
  }
}

/** PUT /api/ai-builder/:project_id/store/products/:product_id */
export async function handleProductUpdate(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const product = await getProductById(env.DB, r.projectKey, parseInt(params.product_id, 10));
    if (!product) return json({ success: false, error: 'Product not found' }, 404);
    const body = await request.json().catch(() => ({}));

    const updates = {};
    if (body.name != null) {
      const name = body.name.toString().trim().slice(0, 140);
      if (!name) return json({ success: false, error: 'Product name is required' }, 400);
      updates.name = name;
      if (name !== product.name) updates.slug = await uniqueProductSlug(env.DB, r.projectKey, name, product.id);
    }
    if (body.for_sale != null) updates.for_sale = (body.for_sale === 0 || body.for_sale === false || body.for_sale === '0') ? 0 : 1;
    if (body.price_cents != null) {
      // Info-only catalogue items (for_sale=0) may have a 0 price.
      const infoOnly = updates.for_sale === 0 || (updates.for_sale == null && product.for_sale === 0);
      if (infoOnly && (body.price_cents === 0 || body.price_cents === '0' || body.price_cents === '')) {
        updates.price_cents = 0;
      } else {
        const price_cents = validPrice(body.price_cents);
        if (price_cents == null) return json({ success: false, error: 'Price must be between 0.50 and 999,999.99' }, 400);
        updates.price_cents = price_cents;
      }
    }
    if (body.description != null) updates.description = body.description.toString().slice(0, 5000);
    if (body.image != null) updates.image = body.image.toString().trim().slice(0, 500);
    if (body.product_type != null && PRODUCT_TYPES.includes(body.product_type)) updates.product_type = body.product_type;
    if (body.active != null) updates.active = body.active ? 1 : 0;
    if (body.category != null) updates.category = body.category.toString().trim().slice(0, 80);
    if (body.body != null) updates.body = body.body.toString().slice(0, 20000);
    if (body.media != null) updates.media_json = typeof body.media === 'object' ? JSON.stringify(body.media) : body.media.toString().slice(0, 20000);
    // Inventory (Advanced Store) — '' clears to untracked; gated by entitlement.
    if (body.stock != null && (await hasPlugin(env, r.email, 'advanced_store'))) {
      updates.stock = body.stock === '' ? null : Math.max(0, Math.round(Number(body.stock)) || 0);
    }

    if (updates.name != null || updates.description != null) {
      const screen = screenContent(`${updates.name || product.name}\n${updates.description != null ? updates.description : product.description}`);
      if (!screen.allowed) return json(policyError(screen), 422);
    }

    const updated = await updateProduct(env.DB, r.projectKey, product.id, updates);
    return json({ success: true, product: updated });
  } catch (e) {
    console.error('product update error:', e);
    return json({ success: false, error: 'Failed to update product' }, 500);
  }
}

/** DELETE /api/ai-builder/:project_id/store/products/:product_id */
export async function handleProductDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const ok = await deleteProduct(env.DB, r.projectKey, parseInt(params.product_id, 10));
  if (!ok) return json({ success: false, error: 'Product not found' }, 404);
  return json({ success: true });
}

/**
 * POST /api/ai-builder/:project_id/store/products/ai-describe
 * { name, notes? } -> { description } — a writing helper, does NOT create rows.
 */
export async function handleProductAIDescribe(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').toString().trim().slice(0, 140);
    const notes = (body.notes || '').toString().trim().slice(0, 1000);
    if (!name) return json({ success: false, error: 'Give the product a name first.' }, 400);
    const screen = screenContent(`${name}\n${notes}`);
    if (!screen.allowed) return json(policyError(screen), 422);

    const afford = await canAfford(env, env.DB, r.email, CREDIT_COSTS.product_desc);
    if (!afford.ok) return json({ success: false, error: formatCreditError(afford.state, 'AI product description').error }, 402);

    const langName = LANG_NAMES[r.language] || 'English';
    const prompt = `You are writing an online-store product description for "${r.businessName}"${r.industry ? ` (${r.industry})` : ''}.

Product name: ${name}
${notes ? `Owner's notes about the product:\n"""\n${notes}\n"""` : ''}

Write a persuasive product description of 50-120 words in ${langName}. Plain sentences and at most one short "- " bullet list; no headings, no markdown emphasis. Do not invent specific facts, materials, sizes or prices the notes don't mention.

Respond in EXACTLY this format (plain text, no JSON, no commentary, keep the uppercase label):
DESCRIPTION:
the product description
${POLICY_INSTRUCTION}`;

    const raw = await callWorkersAI(env, prompt, { max_tokens: 512, temperature: 0.6, system_message: 'You are a professional e-commerce copywriter for small businesses.' });
    const start = String(raw || '').search(/DESCRIPTION:/);
    // stripPolicyEcho: weak models sometimes parrot the trailing policy
    // instruction into the output, which would screen against itself.
    const description = start === -1 ? '' : stripPolicyEcho(String(raw).slice(start + 'DESCRIPTION:'.length).replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, ''));
    if (!description) return json({ success: false, error: 'The AI description came back malformed — please try again.' }, 502);
    const outScreen = screenContent(description);
    if (!outScreen.allowed) return json(policyError(outScreen), 422);

    await chargeCredits(env, env.DB, r.email, CREDIT_COSTS.product_desc);
    audit(ctx, 'credit.product_desc', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, metadata: { credits: CREDIT_COSTS.product_desc } });
    return json({ success: true, description: description.slice(0, 5000) });
  } catch (e) {
    console.error('product ai-describe error:', e);
    return json({ success: false, error: 'AI description failed — please try again.' }, 500);
  }
}

// ---- public checkout ---------------------------------------------------------

// Same shape as forms.js/track.js — refactor preview ids contain dashes.
const PUBLIC_ID_RE = /^[a-f0-9-]{8,64}$/i;

/**
 * POST /api/store/checkout — PUBLIC; the mini cart on published shop pages
 * POSTs here cross-origin (forms/analytics pattern). Body:
 *   { s: publicId, items: [{id, qty}], path }
 * Creates a Stripe Checkout Session on the merchant's CONNECTED account
 * (direct charge — funds go to the merchant) and returns { url }.
 * Server truth: every line is repriced from the products table; the client
 * only chooses ids + quantities.
 */
export async function handleStoreCheckout(ctx) {
  const { env, request } = ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = (body.s || '').toString();
    if (!PUBLIC_ID_RE.test(publicId)) return json({ success: false, error: 'Unknown site' }, 404);

    const r = await resolveStoreProject(env, publicId);
    if (!r) return json({ success: false, error: 'Unknown site' }, 404);

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    if (!config.stripe_account_id) {
      return json({ success: false, error: 'This store isn’t accepting payments yet.' }, 503);
    }

    // Validate the cart: 1..20 distinct lines (by product+variant), qty 1..99.
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const merged = new Map(); // `${id}:${variant_id}` -> { id, qty, variant_id }
    for (const it of rawItems) {
      const id = parseInt(it && it.id, 10);
      const qty = Math.min(99, Math.max(1, parseInt(it && it.qty, 10) || 1));
      const vid = parseInt(it && it.variant_id, 10);
      const variant_id = Number.isFinite(vid) && vid > 0 ? vid : 0;
      if (Number.isFinite(id) && id > 0) {
        const key = `${id}:${variant_id}`;
        const ex = merged.get(key);
        if (ex) ex.qty = Math.min(99, ex.qty + qty);
        else merged.set(key, { id, qty, variant_id });
      }
    }
    const lines = [...merged.values()];
    if (!lines.length) return json({ success: false, error: 'Cart is empty' }, 400);

    // Reprice from the DB — active products only. Variant lines reprice + stock-
    // check against the chosen variant (its price overrides the product's).
    const products = await getProductsByProject(env.DB, r.projectKey, true);
    const byId = new Map(products.map((p) => [p.id, p]));
    const appOrigin = env.APP_URL || '';
    const lineItems = [];
    let hasPhysical = false;
    let subtotalCents = 0;
    for (const ln of lines) {
      const p = byId.get(ln.id);
      if (!p) return json({ success: false, error: 'A product in your cart is no longer available.' }, 409);
      let unit = p.price_cents;
      let stock = p.stock;
      let nameSuffix = '';
      if (ln.variant_id) {
        const v = await getVariantById(env.DB, r.projectKey, ln.variant_id);
        if (!v || v.product_id !== p.id || !v.active) {
          return json({ success: false, error: 'A product in your cart is no longer available.' }, 409);
        }
        unit = v.price_cents;
        stock = v.stock;
        nameSuffix = ` — ${v.label}`;
      }
      // Advanced Store inventory: block buying more than is in stock (NULL = untracked).
      if (stock != null && stock < ln.qty) {
        return json({ success: false, error: t(r.language, ln.variant_id ? 'varw.out_of_stock' : 'shopw.out_of_stock'), out_of_stock: true, product: p.name + nameSuffix }, 409);
      }
      subtotalCents += unit * ln.qty;
      if (p.product_type === 'physical') hasPhysical = true;
      const productData = { name: p.name + nameSuffix };
      if (p.image) {
        // Stripe needs absolute image URLs; ours may be relative /preview-asset/…
        const abs = p.image.startsWith('/') ? `${appOrigin}${p.image}` : p.image;
        if (/^https:\/\//.test(abs)) productData.images = [abs];
      }
      lineItems.push({
        price_data: {
          currency: config.store_currency || 'usd',
          unit_amount: stripeUnitAmount(unit, config.store_currency || 'usd'),
          product_data: productData,
        },
        quantity: ln.qty,
      });
    }

    // Redirect targets: back to the page the buyer came from. Origin header is
    // present on cross-origin fetches from the published site; fall back to the
    // app origin (the /site/:id serving surface).
    const origin = (request.headers.get('Origin') || appOrigin || '').replace(/\/$/, '');
    if (!/^https?:\/\/[\w.-]+(:\d+)?$/.test(origin)) {
      return json({ success: false, error: 'Bad origin' }, 400);
    }
    let path = (body.path || '/shop').toString().split('?')[0].slice(0, 200);
    if (!path.startsWith('/')) path = '/shop';

    // Advanced Store discount code (optional). Only honoured when the OWNER is
    // entitled to advanced_store; validated server-side (active/expiry/uses) and
    // applied as a one-off Stripe coupon. Invalid codes 409 so the cart can react.
    let discounts = null;
    let discountCode = null;
    const rawCode = normalizeCode(body.discount_code);
    if (rawCode) {
      const entitled = await hasPlugin(env, r.email, 'advanced_store');
      if (entitled) {
        const d = await getDiscountByCode(env.DB, r.projectKey, rawCode);
        const chk = checkDiscount(d);
        if (!chk.ok) {
          return json({ success: false, error: t(r.language, `discw.${chk.reason}`), discount_error: chk.reason }, 409);
        }
        if (discountAmountFor(d, subtotalCents) > 0) {
          try {
            const coupon = await createConnectCoupon(env, config.stripe_account_id, {
              kind: d.kind, value: d.value, currency: config.store_currency || 'usd', name: d.code,
            });
            discounts = [{ coupon }];
            discountCode = d.code;
          } catch (e) {
            console.error('discount coupon create failed (non-fatal):', e.message);
          }
        }
      }
    }

    let session;
    try {
      session = await createStoreCheckoutSession(env, {
        account: config.stripe_account_id,
        lineItems,
        discounts,
        // Success lands on OUR receipt page (server-verified order details,
        // print-to-PDF, triggers order recording + emails). {CHECKOUT_SESSION_ID}
        // is a literal Stripe placeholder — must not be URL-encoded.
        successUrl: `${appOrigin}/store/receipt?s=${publicId}&sid={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}${path}?cancelled=1`,
        metadata: {
          type: 'store_order',
          site: publicId,
          back: `${origin}${path}`.slice(0, 400), // receipt's "back to shop" link
          // compact for the 500-char metadata cap: [[id,qty,variantId],…]
          items: JSON.stringify(lines.map((l) => [l.id, l.qty, l.variant_id])).slice(0, 480),
          ...(discountCode ? { discount: discountCode } : {}),
        },
        collectShipping: hasPhysical,
      });
    } catch (e) {
      // Surface Stripe's message — usually merchant-fixable setup issues
      // (e.g. "you must set an account or business name"). Benign to show.
      console.error('store checkout (stripe) error:', e.message);
      return json({ success: false, error: e.message.slice(0, 300) }, 502);
    }
    return json({ success: true, url: session.url });
  } catch (e) {
    console.error('store checkout error:', e);
    return json({ success: false, error: 'Could not start checkout — please try again.' }, 500);
  }
}

// ---- Advanced Store: discount codes --------------------------------------
// Admin CRUD is gated at the route (pluginGate('advanced_store')). The buyer
// validate endpoint is public (no auth) like checkout, and self-gates on the
// OWNER's entitlement so a lapsed store silently stops honouring codes.

/** Shape a discount row for the admin UI (kept lean). */
function discountView(d) {
  return {
    id: d.id, code: d.code, kind: d.kind, value: d.value, active: !!d.active,
    max_uses: d.max_uses, used_count: d.used_count, expires_at: d.expires_at,
  };
}

/** GET /api/ai-builder/:project_id/store/discounts */
export async function handleDiscountList(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const rows = await listDiscounts(env.DB, r.projectKey);
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  return json({ success: true, discounts: rows.map(discountView), currency: config.store_currency || 'usd' });
}

/** POST /api/ai-builder/:project_id/store/discounts */
export async function handleDiscountCreate(ctx) {
  const { env, request, params } = ctx;
  let lang = 'en';
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    lang = r.language || 'en';
    const body = await request.json().catch(() => ({}));
    const discount = await createDiscount(env.DB, r.projectKey, {
      code: body.code, kind: body.kind, value: body.value,
      max_uses: body.max_uses, expires_at: body.expires_at,
    });
    return json({ success: true, discount: discountView(discount) }, 201);
  } catch (e) {
    if (e.message === 'duplicate') return json({ success: false, error: t(lang, 'discw.duplicate') }, 409);
    if (e.message === 'invalid') return json({ success: false, error: t(lang, 'discw.bad_input') }, 400);
    console.error('discount create error:', e);
    return json({ success: false, error: 'Failed to create discount' }, 500);
  }
}

/** PUT /api/ai-builder/:project_id/store/discounts/:discount_id */
export async function handleDiscountUpdate(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const updated = await updateDiscount(env.DB, r.projectKey, parseInt(params.discount_id, 10), {
    active: body.active, value: body.value, max_uses: body.max_uses, expires_at: body.expires_at,
  });
  if (!updated) return json({ success: false, error: 'Discount not found' }, 404);
  return json({ success: true, discount: discountView(updated) });
}

/** DELETE /api/ai-builder/:project_id/store/discounts/:discount_id */
export async function handleDiscountDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  await deleteDiscount(env.DB, r.projectKey, parseInt(params.discount_id, 10));
  return json({ success: true });
}

/**
 * POST /api/store/discount/validate — PUBLIC. Buyer cart previews a code:
 * { s: publicId, code, items:[{id,qty}] } → { success, code, amount_cents }
 * (amount the code takes off the current cart). Repriced from the DB; mirrors
 * the authoritative checkout-time validation so the preview can't be gamed.
 */
export async function handleDiscountValidate(ctx) {
  const { env, request } = ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = (body.s || '').toString();
    if (!PUBLIC_ID_RE.test(publicId)) return json({ success: false, error: 'Unknown site' }, 404);
    const code = normalizeCode(body.code);
    if (!code) return json({ success: false, error: t('en', 'discw.bad_input') }, 400);

    const r = await resolveStoreProject(env, publicId);
    if (!r) return json({ success: false, error: 'Unknown site' }, 404);
    if (!(await hasPlugin(env, r.email, 'advanced_store'))) {
      return json({ success: false, error: t(r.language, 'discw.invalid'), discount_error: 'invalid' }, 409);
    }

    const d = await getDiscountByCode(env.DB, r.projectKey, code);
    const chk = checkDiscount(d);
    if (!chk.ok) return json({ success: false, error: t(r.language, `discw.${chk.reason}`), discount_error: chk.reason }, 409);

    // Reprice the cart subtotal so the previewed amount matches checkout (variant
    // lines use the variant's price, like checkout does).
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const products = await getProductsByProject(env.DB, r.projectKey, true);
    const byId = new Map(products.map((p) => [p.id, p]));
    let subtotal = 0;
    for (const it of rawItems) {
      const id = parseInt(it && it.id, 10);
      const qty = Math.min(99, Math.max(1, parseInt(it && it.qty, 10) || 1));
      const vid = parseInt(it && it.variant_id, 10);
      const p = Number.isFinite(id) ? byId.get(id) : null;
      if (!p) continue;
      if (Number.isFinite(vid) && vid > 0) {
        const v = await getVariantById(env.DB, r.projectKey, vid);
        subtotal += (v && v.product_id === p.id ? v.price_cents : p.price_cents) * qty;
      } else {
        subtotal += p.price_cents * qty;
      }
    }
    const amount = discountAmountFor(d, subtotal);
    return json({ success: true, code: d.code, kind: d.kind, value: d.value, amount_cents: amount });
  } catch (e) {
    console.error('discount validate error:', e);
    return json({ success: false, error: 'Could not check the code.' }, 500);
  }
}

// ---- Advanced Store: product variants ------------------------------------
// A product with >= 1 active variant sells by variant (each its own price +
// stock). Admin CRUD is gated at the route (pluginGate('advanced_store')).

function variantView(v) {
  return {
    id: v.id, product_id: v.product_id, label: v.label, price_cents: v.price_cents,
    stock: v.stock, sku: v.sku, sort_order: v.sort_order, active: !!v.active,
  };
}

/** GET /api/ai-builder/:project_id/store/products/:product_id/variants */
export async function handleVariantList(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const rows = await listVariants(env.DB, r.projectKey, parseInt(params.product_id, 10));
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  return json({ success: true, variants: rows.map(variantView), currency: config.store_currency || 'usd' });
}

/** POST /api/ai-builder/:project_id/store/products/:product_id/variants */
export async function handleVariantCreate(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const productId = parseInt(params.product_id, 10);
  const product = await getProductById(env.DB, r.projectKey, productId);
  if (!product) return json({ success: false, error: 'Product not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const label = (body.label || '').toString().trim();
  if (!label) return json({ success: false, error: t(r.language, 'varw.label_required') }, 400);
  const variant = await createVariant(env.DB, r.projectKey, productId, {
    label, price_cents: body.price_cents, stock: body.stock, sku: body.sku, sort_order: body.sort_order,
  });
  return json({ success: true, variant: variantView(variant) }, 201);
}

/** PUT /api/ai-builder/:project_id/store/products/:product_id/variants/:variant_id */
export async function handleVariantUpdate(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const updated = await updateVariant(env.DB, r.projectKey, parseInt(params.variant_id, 10), {
    label: body.label, price_cents: body.price_cents, stock: body.stock, sku: body.sku,
    active: body.active, sort_order: body.sort_order,
  });
  if (!updated) return json({ success: false, error: 'Variant not found' }, 404);
  return json({ success: true, variant: variantView(updated) });
}

/** DELETE /api/ai-builder/:project_id/store/products/:product_id/variants/:variant_id */
export async function handleVariantDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  await deleteVariant(env.DB, r.projectKey, parseInt(params.variant_id, 10));
  return json({ success: true });
}

// ---- Subscriptions via the pricing section -------------------------------
// Plan cards attach a RECURRING Stripe price from the merchant's connected
// account (picked from their catalog, or created here — which just makes a
// real Stripe price, so both paths share one source of truth).

const PRICE_ID_RE = /^price_[A-Za-z0-9]+$/;
const SUB_INTERVALS = new Set(['month', 'year']);

/** Shape one Stripe price for the editor dropdown. */
function priceView(p) {
  return {
    id: p.id,
    product_name: (p.product && p.product.name) || p.nickname || p.id,
    amount: p.unit_amount,
    currency: p.currency,
    interval: p.recurring && p.recurring.interval,
  };
}

/** GET /api/ai-builder/:project_id/store/prices — recurring prices to attach. */
export async function handleSubPriceList(ctx) {
  const { env, params } = ctx;
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const config = await getOrCreateConfig(env.DB, r.projectKey);
    if (!config.stripe_account_id) {
      return json({ success: true, connected: false, prices: [] });
    }
    const prices = await listConnectRecurringPrices(env, config.stripe_account_id);
    return json({ success: true, connected: true, prices: prices.map(priceView), currency: config.store_currency || 'usd' });
  } catch (e) {
    console.error('sub price list error:', e.message);
    return json({ success: false, error: e.message.slice(0, 300) }, 502);
  }
}

/** POST /api/ai-builder/:project_id/store/prices — create a recurring price
 *  on the connected account. Body: { name, amount_cents, interval }. */
export async function handleSubPriceCreate(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);

    // Selling is a paid feature (same gate as products: free blocked in prod).
    const tier = await getUserTier(env.DB, r.email);
    if (env.ENVIRONMENT === 'production' && tier === 'free_trial') {
      return json({ success: false, error: 'Selling subscriptions requires a paid plan.', billing_url: '/billing' }, 402);
    }

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    if (!config.stripe_account_id) {
      return json({ success: false, error: 'Connect your Stripe account first.' }, 409);
    }

    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').toString().trim().slice(0, 120);
    const amountCents = parseInt(body.amount_cents, 10);
    const interval = (body.interval || '').toString();
    if (!name) return json({ success: false, error: 'Plan name is required' }, 400);
    if (!Number.isFinite(amountCents) || amountCents < 50 || amountCents > 99999999) {
      return json({ success: false, error: 'Invalid amount' }, 400);
    }
    if (!SUB_INTERVALS.has(interval)) return json({ success: false, error: 'Invalid interval' }, 400);

    const screen = screenContent(name);
    if (!screen.allowed) return json(policyError(screen), 422);

    const price = await createConnectSubscriptionPrice(env, config.stripe_account_id, {
      name,
      amountCents,
      currency: config.store_currency || 'usd',
      interval,
    });
    return json({ success: true, price: priceView({ ...price, product: { name } }) });
  } catch (e) {
    console.error('sub price create error:', e.message);
    return json({ success: false, error: e.message.slice(0, 300) }, 502);
  }
}

/** POST /api/store/subscribe — public; body { s, price, path }. Validates the
 *  price on the site's connected account (active + recurring), then opens a
 *  subscription Checkout Session. */
export async function handleStoreSubscribe(ctx) {
  const { env, request } = ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = (body.s || '').toString();
    if (!PUBLIC_ID_RE.test(publicId)) return json({ success: false, error: 'Unknown site' }, 404);

    const r = await resolveStoreProject(env, publicId);
    if (!r) return json({ success: false, error: 'Unknown site' }, 404);

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    if (!config.stripe_account_id) {
      return json({ success: false, error: 'This site isn’t accepting payments yet.' }, 503);
    }

    const priceId = (body.price || '').toString();
    if (!PRICE_ID_RE.test(priceId)) return json({ success: false, error: 'Unknown plan' }, 400);

    // Server truth: the price must live on THIS merchant's account, be active,
    // and be recurring. Amount/interval come from Stripe, never the client.
    let price;
    try {
      price = await getConnectPrice(env, config.stripe_account_id, priceId);
    } catch (e) {
      console.error('subscribe price lookup failed:', e.message);
      return json({ success: false, error: 'This plan is not available.' }, 409);
    }
    if (!price.active || !price.recurring) {
      return json({ success: false, error: 'This plan is not available.' }, 409);
    }

    const appOrigin = env.APP_URL || '';
    const origin = (request.headers.get('Origin') || appOrigin || '').replace(/\/$/, '');
    if (!/^https?:\/\/[\w.-]+(:\d+)?$/.test(origin)) {
      return json({ success: false, error: 'Bad origin' }, 400);
    }
    let path = (body.path || '/').toString().split('?')[0].slice(0, 200);
    if (!path.startsWith('/')) path = '/';

    let session;
    try {
      session = await createSubscriptionCheckoutSession(env, {
        account: config.stripe_account_id,
        priceId,
        successUrl: `${appOrigin}/store/receipt?s=${publicId}&sid={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}${path}?cancelled=1`,
        metadata: {
          type: 'store_sub',
          site: publicId,
          back: `${origin}${path}`.slice(0, 400),
        },
      });
    } catch (e) {
      // Surface Stripe's message — usually merchant-fixable setup issues.
      console.error('subscribe (stripe) error:', e.message);
      return json({ success: false, error: e.message.slice(0, 300) }, 502);
    }
    return json({ success: true, url: session.url });
  } catch (e) {
    console.error('subscribe error:', e);
    return json({ success: false, error: 'Could not start checkout — please try again.' }, 500);
  }
}

/**
 * POST /api/ai-builder/:project_id/store/import — one-click catalog import
 * from the merchant's connected Stripe account. Idempotent by slug; one-time
 * prices only (no subscriptions); the first import sets the store currency
 * and mismatched-currency products are skipped (one currency per Checkout
 * Session). Counts against PRODUCT_LIMITS like manual adds.
 */
export async function handleProductImport(ctx) {
  const { env, params } = ctx;
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const config = await getOrCreateConfig(env.DB, r.projectKey);
    if (!config.stripe_account_id) {
      return json({ success: false, error: 'Connect your Stripe account first.' }, 400);
    }

    let stripeProducts;
    try {
      stripeProducts = await listConnectProducts(env, config.stripe_account_id);
    } catch (e) {
      return json({ success: false, error: e.message.slice(0, 200) }, 502);
    }

    const tier = await getUserTier(env.DB, r.email);
    const limit = await effectiveProductLimit(env, r.email, tier);
    const enforced = env.ENVIRONMENT === 'production' && Number.isFinite(limit);
    let count = await countProducts(env.DB, r.projectKey);

    const existing = await getProductsByProject(env.DB, r.projectKey);
    const existingSlugs = new Set(existing.map((p) => p.slug));
    // First import into an empty store adopts the merchant's Stripe currency.
    let currency = existing.length ? (config.store_currency || 'usd') : null;

    let imported = 0;
    const skipped = [];
    for (const sp of stripeProducts) {
      const name = (sp.name || '').trim().slice(0, 140);
      if (!name) continue;
      const price = sp.default_price;
      if (!price || typeof price !== 'object') { skipped.push({ name, reason: 'no_price' }); continue; }
      if (price.type !== 'one_time' || price.unit_amount == null) { skipped.push({ name, reason: 'recurring' }); continue; }
      if (price.unit_amount < MIN_PRICE_CENTS || price.unit_amount > MAX_PRICE_CENTS) { skipped.push({ name, reason: 'price_range' }); continue; }
      if (currency && price.currency !== currency) { skipped.push({ name, reason: 'currency' }); continue; }
      const slug = slugify(name);
      if (existingSlugs.has(slug)) { skipped.push({ name, reason: 'exists' }); continue; }
      if (enforced && count >= limit) { skipped.push({ name, reason: 'limit' }); continue; }
      const screen = screenContent(`${name}\n${sp.description || ''}`);
      if (!screen.allowed) { skipped.push({ name, reason: 'policy' }); continue; }

      if (!currency) {
        currency = price.currency;
        await updateWebsiteConfigById(env.DB, config.id, { store_currency: currency });
      }
      await createProduct(env.DB, r.projectKey, {
        slug,
        name,
        description: (sp.description || '').slice(0, 5000),
        price_cents: price.unit_amount,
        image: (Array.isArray(sp.images) && sp.images[0] ? sp.images[0] : '').slice(0, 500),
        product_type: 'physical',
      });
      existingSlugs.add(slug);
      imported++;
      count++;
    }

    return json({ success: true, imported, skipped, found: stripeProducts.length });
  } catch (e) {
    console.error('product import error:', e);
    return json({ success: false, error: 'Import failed — please try again.' }, 500);
  }
}

// ---- order recording (receipt page + Connect webhook, idempotent) ------------

/** Line items off a retrieved session -> [{name, qty, amount}] (minor units). */
export function sessionItems(session) {
  const data = (session.line_items && session.line_items.data) || [];
  return data.map((li) => ({
    name: li.description || 'Item',
    qty: li.quantity || 1,
    amount: li.amount_total != null ? li.amount_total : 0,
  }));
}

/**
 * Record a paid Checkout Session as an order (idempotent on session id) and —
 * only on first insert — email the buyer (site language) and the merchant.
 * Callers: the /store/receipt success page and the Connect webhook.
 */
export async function recordStoreOrder(env, publicId, session) {
  const r = await resolveStoreProject(env, publicId);
  if (!r) return null;
  const items = sessionItems(session);
  const details = session.customer_details || {};
  const shipping = session.shipping_details || (session.collected_information && session.collected_information.shipping_details) || null;

  const row = await insertOrderIfNew(env.DB, r.projectKey, publicId, {
    stripe_session_id: session.id,
    amount_total: session.amount_total || 0,
    currency: session.currency || 'usd',
    customer_email: details.email || '',
    customer_name: details.name || '',
    shipping_json: shipping ? JSON.stringify(shipping).slice(0, 2000) : '',
    items_json: JSON.stringify(items).slice(0, 4000),
  });
  if (!row) return { isNew: false }; // already recorded (other writer won)

  // Advanced Store: decrement stock for tracked products (idempotent — only on
  // a newly-recorded order). metadata.items = [[id,qty],…] set at checkout.
  try {
    const cart = JSON.parse((session.metadata && session.metadata.items) || '[]');
    for (const [id, qty, vid] of cart) {
      // 3-tuple [id,qty,variantId]; older 2-tuples have vid undefined → product stock.
      if (vid) await decrementVariantStock(env.DB, r.projectKey, vid, qty);
      else if (Number.isFinite(id)) await decrementStock(env.DB, r.projectKey, id, qty);
    }
  } catch (e) { console.error('stock decrement failed (non-fatal):', e.message); }

  // Advanced Store: bump the discount code's usage count (idempotent — only on a
  // newly-recorded order). metadata.discount = the applied code.
  try {
    const code = session.metadata && session.metadata.discount;
    if (code) await incrementDiscountUse(env.DB, r.projectKey, code);
  } catch (e) { console.error('discount use bump failed (non-fatal):', e.message); }

  const appOrigin = env.APP_URL || '';
  const orderRef = session.id.slice(-8).toUpperCase();
  const lang = r.language || 'en';

  if (details.email) {
    await sendOrderBuyerEmail(env, {
      to: details.email,
      businessName: r.businessName,
      orderRef,
      items,
      total: session.amount_total || 0,
      currency: session.currency || 'usd',
      lang,
      labels: {
        subject: t(lang, 'rcpt.subject', { name: r.businessName, ref: orderRef }),
        subject_line: t(lang, 'rcpt.subject_line'),
        intro: t(lang, 'rcpt.intro', { name: r.businessName }),
        order_ref: t(lang, 'rcpt.order_ref'),
        total: t(lang, 'rcpt.total'),
        view_receipt: t(lang, 'rcpt.view_receipt'),
        questions: t(lang, 'rcpt.questions'),
      },
      receiptUrl: `${appOrigin}/store/receipt?s=${publicId}&sid=${encodeURIComponent(session.id)}`,
      merchantEmail: r.email || '',
    });
  }
  if (r.email) {
    await sendOrderMerchantEmail(env, {
      to: r.email,
      siteName: r.businessName,
      orderRef,
      buyerEmail: details.email || '',
      items,
      total: session.amount_total || 0,
      currency: session.currency || 'usd',
      ordersUrl: `${appOrigin}/ai-builder/store/${publicId}`,
    });
  }
  return { isNew: true, order: row };
}

const COURSE_EMAIL_T = {
  en: { subject: (c) => `Access your course: ${c}`, heading: 'You’re enrolled! 🎓', intro: (c, biz) => `Thanks for your purchase from ${biz}. Click below to start “${c}”. Bookmark the link — it’s your private access to the course.`, cta: 'Open your course' },
  es: { subject: (c) => `Accede a tu curso: ${c}`, heading: '¡Estás inscrito! 🎓', intro: (c, biz) => `Gracias por tu compra en ${biz}. Haz clic abajo para empezar “${c}”. Guarda el enlace — es tu acceso privado al curso.`, cta: 'Abrir mi curso' },
  pt: { subject: (c) => `Acesse seu curso: ${c}`, heading: 'Você está inscrito! 🎓', intro: (c, biz) => `Obrigado pela sua compra em ${biz}. Clique abaixo para começar “${c}”. Salve o link — é o seu acesso privado ao curso.`, cta: 'Abrir meu curso' },
};

/**
 * Settle a paid-course checkout: record the purchase (idempotent on the Stripe
 * session) and, on a NEW purchase, email the buyer their private access link
 * (/course-access/:token). Called by the /course-access/claim success handler
 * and by the webhook backstop. Reuses the store's Stripe Connect plumbing.
 */
export async function settleCoursePurchase(env, publicId, session) {
  const r = await resolveStoreProject(env, publicId);
  if (!r) return null;
  const meta = (session && session.metadata) || {};
  const courseId = parseInt(meta.course_id, 10);
  if (!Number.isFinite(courseId)) return null;
  const details = session.customer_details || {};
  const { purchase, isNew } = await recordCoursePurchase(env.DB, r.projectKey, {
    courseId,
    buyerEmail: details.email || '',
    stripeSessionId: session.id,
    amountCents: session.amount_total || 0,
    currency: session.currency || 'usd',
  });
  if (isNew && details.email) {
    const course = await getCourseById(env.DB, r.projectKey, courseId);
    const lang = r.language || 'en';
    const T = COURSE_EMAIL_T[lang] || COURSE_EMAIL_T.en;
    try {
      await sendTicketEmail(env, {
        to: details.email,
        subject: T.subject((course && course.title) || ''),
        heading: T.heading,
        intro: T.intro((course && course.title) || '', r.businessName),
        body: '',
        linkUrl: `${env.APP_URL || ''}/course-access/${purchase.access_token}`,
        linkLabel: T.cta,
      });
    } catch (e) { console.error('course access email failed (non-fatal):', e.message); }
  }
  return { purchase, isNew };
}

/**
 * POST /api/store/webhook — Stripe Connect webhook (events from connected
 * accounts; configure a "Listen to events on Connected accounts" endpoint in
 * Stripe pointing here, secret in STRIPE_CONNECT_WEBHOOK_SECRET). Reliability
 * backstop: records the order even if the buyer never returns to the receipt
 * page. Idempotent with the receipt-page writer.
 */
export async function handleStoreWebhook(ctx) {
  const { env, request } = ctx;
  const secret = env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) return json({ success: false, error: 'Webhook not configured' }, 503);
  let event;
  try {
    const raw = await request.text();
    event = await verifyWebhook(raw, request.headers.get('Stripe-Signature'), secret);
  } catch (e) {
    console.error('store webhook signature error:', e.message);
    return json({ success: false, error: 'Bad signature' }, 400);
  }
  try {
    if (event.type === 'checkout.session.completed' && event.account) {
      const session = event.data && event.data.object;
      const meta = (session && session.metadata) || {};
      if (meta.type === 'store_order' && meta.site && session.payment_status === 'paid') {
        // Re-fetch with line items expanded (webhook payloads omit them).
        const full = await getStoreCheckoutSession(env, event.account, session.id);
        await recordStoreOrder(env, meta.site, full);
      }
      // Paid-bookings backstop: settle the pending hold even if the visitor
      // never lands on the receipt page (idempotent in settlePaidBooking).
      if (meta.type === 'booking' && meta.site && session.payment_status === 'paid') {
        const full = await getStoreCheckoutSession(env, event.account, session.id);
        const r = await settlePaidBooking(env, { session: full, account: event.account, publicId: meta.site });
        console.log('booking webhook settle:', meta.booking_id, r.state);
      }
      // Paid-course backstop: record the purchase + email the access link even if
      // the buyer never lands on the claim page (idempotent on the session id).
      if (meta.type === 'course_purchase' && meta.site && session.payment_status === 'paid') {
        const full = await getStoreCheckoutSession(env, event.account, session.id);
        await settleCoursePurchase(env, meta.site, full);
      }
    }
    return json({ received: true });
  } catch (e) {
    console.error('store webhook error:', e);
    return json({ success: false }, 500); // non-2xx → Stripe retries
  }
}

/** PUT /api/ai-builder/:project_id/store/currency — manual override of the store
 *  currency (normally auto-detected from the connected Stripe account). Applies to
 *  the store, catalogue, courses AND paid bookings (they all read store_currency). */
export async function handleStoreCurrency(ctx) {
  const { env, params, request } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const cur = String(body.currency || '').toLowerCase();
  if (!isValidStoreCurrency(cur)) return json({ success: false, error: 'Unsupported currency' }, 400);
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  await updateWebsiteConfigById(env.DB, config.id, { store_currency: cur });
  return json({ success: true, currency: cur });
}

/** GET /api/ai-builder/:project_id/store/orders — list + clear unread. */
export async function handleOrderList(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const orders = await getOrdersByProject(env.DB, r.projectKey);
  // Surface which rows are new, then mark them read (viewing = acknowledging).
  await markOrdersRead(env.DB, r.projectKey);
  return json({ success: true, orders });
}

/** POST /api/ai-builder/:project_id/store/products/:product_id/image — AI product shot. */
export async function handleProductImage(ctx) {
  const { env, params } = ctx;
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const product = await getProductById(env.DB, r.projectKey, parseInt(params.product_id, 10));
    if (!product) return json({ success: false, error: 'Product not found' }, 404);

    const afford = await canAfford(env, env.DB, r.email, CREDIT_COSTS.image);
    if (!afford.ok) return json({ success: false, error: formatCreditError(afford.state, 'AI image generation').error }, 402);

    const desc = (product.description || '').slice(0, 200);
    const subject = product.product_type === 'service'
      ? `Professional photograph representing the service "${product.name}"`
      : `Professional e-commerce product photograph of "${product.name}"`;
    const prompt =
      `${subject}. ${desc} ` +
      `${r.industry ? `Business: ${r.industry}. ` : ''}` +
      `Clean studio composition on a softly lit neutral background, photorealistic, high quality, square format. ` +
      `Strictly NO text, NO words, NO letters, NO typography, NO logos, NO watermarks.`;

    const url = await generateImageToR2(env, params.project_id, prompt);
    await chargeCredits(env, env.DB, r.email, CREDIT_COSTS.image);
    audit(ctx, 'credit.product_image', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, metadata: { credits: CREDIT_COSTS.image } });
    const updated = await updateProduct(env.DB, r.projectKey, product.id, { image: url });
    return json({ success: true, image: url, product: updated });
  } catch (e) {
    console.error('product image error:', e);
    return json({ success: false, error: 'Image generation failed — please try again.' }, 500);
  }
}
