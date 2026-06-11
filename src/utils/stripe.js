// Stripe integration via the raw REST API (no SDK dependency — mirrors how
// utils/email.js talks to Resend over HTTP). Subscriptions only.
//
// Configuration (per-environment):
//   Secrets: STRIPE_SECRET_KEY (sk_test_… / sk_live_…), STRIPE_WEBHOOK_SECRET (whsec_…)
//   Vars (price IDs): STRIPE_PRICE_{STARTER,PRO,AGENCY}_{MONTHLY,ANNUAL}
// When STRIPE_SECRET_KEY is unset the module reports "not configured" so the
// billing UI can degrade gracefully (same pattern as the email stub).

const STRIPE_API = 'https://api.stripe.com/v1';

// plan key (== rate-limiter tier) → { short interval → env var holding the Price id }
const PRICE_ENV = {
  starter: { mo: 'STRIPE_PRICE_STARTER_MONTHLY', yr: 'STRIPE_PRICE_STARTER_ANNUAL' },
  pro: { mo: 'STRIPE_PRICE_PRO_MONTHLY', yr: 'STRIPE_PRICE_PRO_ANNUAL' },
  agency: { mo: 'STRIPE_PRICE_AGENCY_MONTHLY', yr: 'STRIPE_PRICE_AGENCY_ANNUAL' },
};

/** Whether a Stripe secret key is configured for this environment. */
export function isStripeConfigured(env) {
  return !!(env && env.STRIPE_SECRET_KEY);
}

/** Normalize any interval input ('mo'|'month'|'yr'|'year') to 'mo' | 'yr'. */
function shortInterval(interval) {
  return interval === 'yr' || interval === 'year' || interval === 'annual' ? 'yr' : 'mo';
}

/** The Stripe Price id for a plan+interval, or null if the plan/var is unknown. */
export function priceIdFor(env, plan, interval) {
  const map = PRICE_ENV[plan];
  if (!map) return null;
  const varName = map[shortInterval(interval)];
  return (env && env[varName]) || null;
}

/**
 * Reverse-lookup a Price id back to { tier, interval('month'|'year') }.
 * Used by the webhook to map a Stripe subscription's price to our tier.
 */
export function planForPriceId(env, priceId) {
  if (!priceId) return null;
  for (const [plan, map] of Object.entries(PRICE_ENV)) {
    if (env[map.mo] === priceId) return { tier: plan, interval: 'month' };
    if (env[map.yr] === priceId) return { tier: plan, interval: 'year' };
  }
  return null;
}

// ---- form encoding (Stripe wants application/x-www-form-urlencoded with
// bracketed nested keys, e.g. line_items[0][price]=…) -----------------------
function appendForm(params, key, value) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => appendForm(params, `${key}[${i}]`, v));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) appendForm(params, `${key}[${k}]`, v);
  } else {
    params.append(key, String(value));
  }
}

function toForm(obj) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) appendForm(params, k, v);
  return params;
}

async function stripeRequest(env, path, body, stripeAccount = null) {
  if (!isStripeConfigured(env)) throw new Error('Stripe is not configured');
  const headers = {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  // Act on a connected account (Connect direct charge / read).
  if (stripeAccount) headers['Stripe-Account'] = stripeAccount;
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers,
    body: toForm(body).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error && json.error.message ? json.error.message : `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Create a subscription Checkout Session. Reuses an existing Stripe customer if
 * we have one; otherwise Stripe creates one from customer_email.
 * @returns {Promise<{id:string,url:string}>}
 */
export async function createCheckoutSession(env, { email, priceId, successUrl, cancelUrl, customerId }) {
  const body = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: email,
    allow_promotion_codes: true,
    subscription_data: { metadata: { email } },
    metadata: { email },
  };
  if (customerId) body.customer = customerId;
  else body.customer_email = email;
  return stripeRequest(env, '/checkout/sessions', body);
}

// One-time AI credit top-up packs (flat 50 credits per $1; purchased credits
// never expire). Keyed by USD amount so the route can validate the requested pack.
export const CREDIT_PACKS = [5, 10, 20, 30, 50, 100].map((usd) => ({ usd, credits: usd * 50 }));

/** Look up a credit pack by its dollar amount, or null. */
export function creditPackFor(usd) {
  const n = Number(usd);
  return CREDIT_PACKS.find((p) => p.usd === n) || null;
}

/**
 * Create a one-time (mode=payment) Checkout Session for an AI credit pack.
 * Uses inline price_data so packs live in code, not the Stripe catalog. The
 * webhook reads metadata.{type,email,credits} to credit the account.
 * @returns {Promise<{id:string,url:string}>}
 */
export async function createCreditCheckoutSession(env, { email, pack, successUrl, cancelUrl, customerId }) {
  const meta = { type: 'credit_pack', email, credits: String(pack.credits) };
  const body = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: pack.usd * 100,
          product_data: { name: `${pack.credits.toLocaleString()} AI credits` },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: email,
    metadata: meta,
    payment_intent_data: { metadata: meta },
  };
  if (customerId) body.customer = customerId;
  else body.customer_email = email;
  return stripeRequest(env, '/checkout/sessions', body);
}

// Countries we offer in Stripe Checkout's shipping-address collector when a
// cart contains physical goods (Checkout requires an explicit allowlist).
// Broad coverage of our customer base; configurable per store later.
export const SHIPPING_COUNTRIES = [
  'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY',
  'GB', 'IE', 'PT', 'ES', 'FR', 'DE', 'IT', 'NL', 'BE', 'AT', 'CH',
  'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'GR', 'RO',
  'AU', 'NZ', 'JP', 'SG', 'AE', 'ZA', 'IN',
];

/**
 * Commerce v1: create a one-time Checkout Session ON the merchant's connected
 * account (direct charge — funds settle to the merchant; we never hold money).
 * Line items use inline price_data; amounts come from OUR products table, never
 * from the client. The webhook/success path reads metadata.{type,site,items}.
 * @returns {Promise<{id:string,url:string}>}
 */
export async function createStoreCheckoutSession(env, {
  account, lineItems, successUrl, cancelUrl, metadata, collectShipping = false,
}) {
  const body = {
    mode: 'payment',
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    payment_intent_data: { metadata },
  };
  if (collectShipping) {
    body.shipping_address_collection = { allowed_countries: SHIPPING_COUNTRIES };
  }
  return stripeRequest(env, '/checkout/sessions', body, account);
}

/**
 * Domain-purchase Checkout Session on the PLATFORM account (we are the
 * merchant — unlike store/subscription checkouts, which run on the customer's
 * connected account). Saves the card for off-session auto-renewal.
 */
export async function createDomainCheckoutSession(env, { email, customerId, name, amountCents, currency, successUrl, cancelUrl, metadata }) {
  const body = {
    mode: 'payment',
    line_items: [{ price_data: { currency: currency || 'usd', unit_amount: amountCents, product_data: { name } }, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    payment_intent_data: { metadata, setup_future_usage: 'off_session' },
  };
  if (customerId) body.customer = customerId;
  else {
    body.customer_email = email;
    body.customer_creation = 'always'; // off-session renewal needs a customer
  }
  return stripeRequest(env, '/checkout/sessions', body);
}

/** Retrieve a PLATFORM Checkout Session (domain receipts). */
export async function getPlatformCheckoutSession(env, sessionId) {
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error && json.error.message ? json.error.message : `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/** Refund a payment intent in full (domain registration failed after payment). */
export async function refundPaymentIntent(env, paymentIntentId) {
  return stripeRequest(env, '/refunds', { payment_intent: paymentIntentId });
}

/** A customer's saved card payment methods (newest first). */
/** Full refund of a DIRECT CHARGE on a connected account (paid bookings). */
export async function refundConnectPayment(env, account, paymentIntentId) {
  return stripeRequest(env, '/refunds', { payment_intent: paymentIntentId }, account);
}

export async function listCustomerCards(env, customerId) {
  const res = await fetch(`${STRIPE_API}/payment_methods?customer=${encodeURIComponent(customerId)}&type=card&limit=10`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json.error && json.error.message) || `Stripe ${res.status}`);
  return json.data || [];
}

/**
 * Charge a saved card off-session (auto-renewal). Throws on decline /
 * authentication-required so the caller can dunning-email + retry. Picks the
 * customer's default card, else the most recent. → PaymentIntent
 */
export async function chargeOffSession(env, { customerId, amountCents, currency = 'usd', metadata = {} }) {
  const cards = await listCustomerCards(env, customerId);
  if (!cards.length) throw new Error('No saved card on file');
  const pm = cards[0].id;
  return stripeRequest(env, '/payment_intents', {
    amount: amountCents,
    currency,
    customer: customerId,
    payment_method: pm,
    off_session: true,
    confirm: true,
    metadata,
  });
}

/**
 * List a connected account's active RECURRING prices, product expanded —
 * drives the "attach a Stripe price" dropdown in the pricing-section editor.
 */
export async function listConnectRecurringPrices(env, account) {
  const res = await fetch(`${STRIPE_API}/prices?active=true&type=recurring&limit=100&expand[]=data.product`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Stripe-Account': account,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error && json.error.message ? json.error.message : `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json.data || [];
}

/**
 * Retrieve one price (product expanded) from a connected account — subscribe-
 * time validation: the price must exist on THIS merchant's account, be active,
 * and be recurring before we'll create a subscription session for it.
 */
export async function getConnectPrice(env, account, priceId) {
  const res = await fetch(`${STRIPE_API}/prices/${encodeURIComponent(priceId)}?expand[]=product`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Stripe-Account': account,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error && json.error.message ? json.error.message : `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Create a Product + recurring Price on the connected account ("create a plan
 * here" path — the result is a normal Stripe price, so both attach paths share
 * one source of truth).
 */
export async function createConnectSubscriptionPrice(env, account, { name, amountCents, currency, interval }) {
  const product = await stripeRequest(env, '/products', { name }, account);
  const price = await stripeRequest(
    env,
    '/prices',
    { product: product.id, unit_amount: amountCents, currency, recurring: { interval } },
    account
  );
  return price;
}

/**
 * Subscription Checkout Session on the connected account (direct charge — the
 * merchant's Stripe owns the subscription, invoices, and emails).
 */
export async function createSubscriptionCheckoutSession(env, { account, priceId, successUrl, cancelUrl, metadata }) {
  return stripeRequest(
    env,
    '/checkout/sessions',
    {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: { metadata },
    },
    account
  );
}

/**
 * List a connected account's active products with their default price expanded
 * (catalog import). One page of up to 100 — plenty for our product caps.
 */
export async function listConnectProducts(env, account) {
  const res = await fetch(`${STRIPE_API}/products?active=true&limit=100&expand[]=data.default_price`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Stripe-Account': account,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error && json.error.message ? json.error.message : `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json.data || [];
}

/**
 * Retrieve a Checkout Session (with line items expanded) from a connected
 * account — used by the receipt page and the Connect webhook to record orders.
 */
export async function getStoreCheckoutSession(env, account, sessionId) {
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Stripe-Account': account,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error && json.error.message ? json.error.message : `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Create a Billing Portal session so a customer can manage/cancel their plan.
 * @returns {Promise<{id:string,url:string}>}
 */
export async function createPortalSession(env, { customerId, returnUrl }) {
  return stripeRequest(env, '/billing_portal/sessions', {
    customer: customerId,
    return_url: returnUrl,
  });
}

// ---- webhook signature verification (Web Crypto HMAC-SHA256) ---------------
function hex(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// constant-time-ish compare of two hex strings
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Stripe webhook signature and return the parsed event.
 * Implements the Stripe scheme: header is "t=<ts>,v1=<sig>[,v1=<sig>...]" and
 * the signed payload is `${t}.${rawBody}` HMAC-SHA256'd with the signing secret.
 * @param {string} rawBody - the exact request body text
 * @param {string} sigHeader - the Stripe-Signature header
 * @param {string} secret - STRIPE_WEBHOOK_SECRET (whsec_…)
 * @param {number} toleranceSec - max timestamp skew (default 300s; <=0 disables)
 * @returns {Promise<object>} the parsed event
 */
export async function verifyWebhook(rawBody, sigHeader, secret, toleranceSec = 300) {
  if (!secret) throw new Error('Webhook secret not configured');
  if (!sigHeader) throw new Error('Missing Stripe-Signature header');

  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  );
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) throw new Error('Malformed Stripe-Signature header');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  if (!safeEqual(hex(mac), expected)) throw new Error('Signature mismatch');

  if (toleranceSec > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > toleranceSec) throw new Error('Timestamp outside tolerance');
  }

  return JSON.parse(rawBody);
}

// ---- Stripe Connect (Standard accounts, OAuth) — commerce v1 ----------------
// Merchants connect their OWN Stripe account in one OAuth click; Checkout
// Sessions are then created on the connected account so funds go straight to
// the merchant (we never touch the money — no PCI/KYC burden on us).
//
// Configuration (per-environment):
//   Var:    STRIPE_CONNECT_CLIENT_ID (ca_…, from Stripe → Settings → Connect)
//   The redirect URI <origin>/store/stripe/callback must be allow-listed in
//   the same Connect settings page for BOTH preview and prod origins.
// When unset, the store UI degrades to "not configured" (email-stub pattern).

const CONNECT_API = 'https://connect.stripe.com';

/** Whether Stripe Connect OAuth is configured for this environment. */
export function isConnectConfigured(env) {
  return !!(env && env.STRIPE_SECRET_KEY && env.STRIPE_CONNECT_CLIENT_ID);
}

/** The connect.stripe.com authorize URL to send the merchant to. */
export function connectAuthorizeUrl(env, { state, redirectUri, email }) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: env.STRIPE_CONNECT_CLIENT_ID,
    scope: 'read_write',
    redirect_uri: redirectUri,
    state,
  });
  if (email) p.set('stripe_user[email]', email); // prefill their signup/login
  return `${CONNECT_API}/oauth/authorize?${p.toString()}`;
}

async function connectRequest(env, path, body) {
  if (!isStripeConfigured(env)) throw new Error('Stripe is not configured');
  const res = await fetch(`${CONNECT_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toForm(body).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error_description || (json.error && json.error.message) || json.error || `Stripe Connect ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Exchange the OAuth authorization code for the connected account id.
 * @returns {Promise<string>} the acct_… id
 */
export async function exchangeConnectCode(env, code) {
  const out = await connectRequest(env, '/oauth/token', {
    grant_type: 'authorization_code',
    code,
  });
  if (!out.stripe_user_id) throw new Error('Stripe did not return an account id');
  return out.stripe_user_id;
}

/** Revoke our platform's access to a connected account (merchant disconnect). */
export async function deauthorizeConnect(env, accountId) {
  return connectRequest(env, '/oauth/deauthorize', {
    client_id: env.STRIPE_CONNECT_CLIENT_ID,
    stripe_user_id: accountId,
  });
}

// ---- signed OAuth state ------------------------------------------------------
// The callback is a public GET (browser redirect from Stripe), so the state is
// the capability: `<projectId>.<exp>.<hmac>` keyed off STRIPE_SECRET_KEY. It can
// only be minted by our project-gated connect endpoint and expires in 30 min.
// This matches the app's link-based access model (see middleware/project-access).

async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

/** Mint a signed state token binding the OAuth flow to one project. */
export async function signConnectState(env, projectId, ttlSec = 1800) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = await hmacHex(env.STRIPE_SECRET_KEY, `connect:${projectId}.${exp}`);
  return `${projectId}.${exp}.${sig}`;
}

/** Verify a state token; returns the projectId or null (bad sig / expired). */
export async function verifyConnectState(env, state) {
  const parts = String(state || '').split('.');
  if (parts.length !== 3) return null;
  const [projectId, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now() / 1000)) return null;
  const expected = await hmacHex(env.STRIPE_SECRET_KEY, `connect:${projectId}.${exp}`);
  if (!safeEqual(expected, sig)) return null;
  return projectId;
}
