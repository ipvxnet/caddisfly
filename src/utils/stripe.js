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

async function stripeRequest(env, path, body) {
  if (!isStripeConfigured(env)) throw new Error('Stripe is not configured');
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
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
