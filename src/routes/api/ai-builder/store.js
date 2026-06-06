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
} from '../../../utils/stripe.js';
import {
  createProduct, getProductsByProject, getProductById, updateProduct, deleteProduct,
  countProducts, uniqueProductSlug,
} from '../../../db/products.js';
import { callWorkersAI } from '../../../utils/ai-content-generator.js';
import { screenContent, policyError, POLICY_INSTRUCTION } from '../../../utils/content-policy.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS, PRODUCT_LIMITS } from '../../../utils/credits.js';
import { getUserTier } from '../../../utils/rate-limiter.js';
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
    await updateWebsiteConfigById(env.DB, config.id, { stripe_account_id: accountId });
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

/** GET /api/ai-builder/:project_id/store/products — list + cap info. */
export async function handleProductList(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const products = await getProductsByProject(env.DB, r.projectKey);
  const tier = await getUserTier(env.DB, r.email);
  const limit = PRODUCT_LIMITS[tier] != null ? PRODUCT_LIMITS[tier] : PRODUCT_LIMITS.free_trial;
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
    const limit = PRODUCT_LIMITS[tier] != null ? PRODUCT_LIMITS[tier] : PRODUCT_LIMITS.free_trial;
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
    const price_cents = validPrice(body.price_cents);
    if (price_cents == null) return json({ success: false, error: 'Price must be between 0.50 and 999,999.99' }, 400);
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
    if (body.price_cents != null) {
      const price_cents = validPrice(body.price_cents);
      if (price_cents == null) return json({ success: false, error: 'Price must be between 0.50 and 999,999.99' }, 400);
      updates.price_cents = price_cents;
    }
    if (body.description != null) updates.description = body.description.toString().slice(0, 5000);
    if (body.image != null) updates.image = body.image.toString().trim().slice(0, 500);
    if (body.product_type != null && PRODUCT_TYPES.includes(body.product_type)) updates.product_type = body.product_type;
    if (body.active != null) updates.active = body.active ? 1 : 0;

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
    const description = start === -1 ? '' : String(raw).slice(start + 'DESCRIPTION:'.length).replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
    if (!description) return json({ success: false, error: 'The AI description came back malformed — please try again.' }, 502);
    const outScreen = screenContent(description);
    if (!outScreen.allowed) return json(policyError(outScreen), 422);

    await chargeCredits(env, env.DB, r.email, CREDIT_COSTS.product_desc);
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

    // Validate the cart: 1..20 distinct lines, qty 1..99 each.
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const wanted = new Map();
    for (const it of rawItems) {
      const id = parseInt(it && it.id, 10);
      const qty = Math.min(99, Math.max(1, parseInt(it && it.qty, 10) || 1));
      if (Number.isFinite(id) && id > 0) wanted.set(id, (wanted.get(id) || 0) + qty);
    }
    if (!wanted.size) return json({ success: false, error: 'Cart is empty' }, 400);

    // Reprice from the DB — active products only.
    const products = await getProductsByProject(env.DB, r.projectKey, true);
    const byId = new Map(products.map((p) => [p.id, p]));
    const appOrigin = env.APP_URL || '';
    const lineItems = [];
    let hasPhysical = false;
    for (const [id, qty] of wanted) {
      const p = byId.get(id);
      if (!p) return json({ success: false, error: 'A product in your cart is no longer available.' }, 409);
      if (p.product_type === 'physical') hasPhysical = true;
      const productData = { name: p.name };
      if (p.image) {
        // Stripe needs absolute image URLs; ours may be relative /preview-asset/…
        const abs = p.image.startsWith('/') ? `${appOrigin}${p.image}` : p.image;
        if (/^https:\/\//.test(abs)) productData.images = [abs];
      }
      lineItems.push({
        price_data: {
          currency: config.store_currency || 'usd',
          unit_amount: p.price_cents,
          product_data: productData,
        },
        quantity: qty,
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

    let session;
    try {
      session = await createStoreCheckoutSession(env, {
        account: config.stripe_account_id,
        lineItems,
        successUrl: `${origin}${path}?paid=1`,
        cancelUrl: `${origin}${path}?cancelled=1`,
        metadata: {
          type: 'store_order',
          site: publicId,
          // compact for the 500-char metadata cap: [[id,qty],…]
          items: JSON.stringify([...wanted]).slice(0, 480),
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
    const updated = await updateProduct(env.DB, r.projectKey, product.id, { image: url });
    return json({ success: true, image: url, product: updated });
  } catch (e) {
    console.error('product image error:', e);
    return json({ success: false, error: 'Image generation failed — please try again.' }, 500);
  }
}
