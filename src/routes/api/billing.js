// Billing API: issue magic links, start Stripe Checkout, open the Billing Portal.
// Checkout/portal require a billing session (billingAuth middleware sets ctx.billingEmail).

import { redirect } from '../../utils/response.js';
import { isValidEmail, sanitizeEmail, sendMagicLinkEmail } from '../../utils/email.js';
import { setCookie } from '../../utils/crypto.js';
import { createMagicLink, getBillingAccount } from '../../db/billing.js';
import { NEXT_COOKIE, isSafeNext } from '../public/billing.js';
import {
  isStripeConfigured,
  priceIdFor,
  createCheckoutSession,
  createPortalSession,
  createCreditCheckoutSession,
  creditPackFor,
} from '../../utils/stripe.js';

async function readForm(request) {
  try {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return {};
  }
}

/** POST /api/billing/login — email a one-time sign-in link. */
export async function handleBillingLogin(ctx) {
  const { env, request, url } = ctx;
  const body = await readForm(request);
  const raw = (body.email || '').toString();
  if (!isValidEmail(raw)) {
    return redirect('/billing?error=' + encodeURIComponent('Please enter a valid email address.'), 303);
  }
  const email = sanitizeEmail(raw);
  const token = await createMagicLink(env.DB, email);
  const linkUrl = `${url.origin}/billing/verify/${token}`;
  await sendMagicLinkEmail(env, email, linkUrl);

  let res = redirect('/billing?sent=1', 303);
  // Remember intended destination (e.g. a plan checkout) across the email round-trip.
  const next = (body.next || '').toString();
  if (isSafeNext(next)) {
    res = setCookie(res, NEXT_COOKIE, encodeURIComponent(next), {
      maxAge: 20 * 60,
      secure: env.ENVIRONMENT === 'production',
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    });
  }
  return res;
}

/** POST /api/billing/checkout — create a Stripe Checkout Session and redirect. */
export async function handleBillingCheckout(ctx) {
  const { env, request, url } = ctx;
  if (!ctx.billingEmail) return redirect('/billing', 303);
  if (!isStripeConfigured(env)) {
    return redirect('/billing?error=' + encodeURIComponent('Billing is not enabled yet.'), 303);
  }
  const body = await readForm(request);
  const plan = (body.plan || '').toString();
  const interval = (body.interval || 'mo').toString();
  const priceId = priceIdFor(env, plan, interval);
  if (!priceId) {
    return redirect('/billing?error=' + encodeURIComponent('That plan is unavailable.'), 303);
  }
  try {
    const account = await getBillingAccount(env.DB, ctx.billingEmail);
    const session = await createCheckoutSession(env, {
      email: ctx.billingEmail,
      priceId,
      customerId: account && account.stripe_customer_id ? account.stripe_customer_id : undefined,
      successUrl: `${url.origin}/billing?checkout=success`,
      cancelUrl: `${url.origin}/billing?checkout=cancelled`,
    });
    return redirect(session.url, 303);
  } catch (err) {
    console.error('Checkout error:', err);
    return redirect('/billing?error=' + encodeURIComponent('Could not start checkout. Please try again.'), 303);
  }
}

/** POST /api/billing/credits/checkout — one-time payment for an AI credit pack. */
export async function handleCreditCheckout(ctx) {
  const { env, request, url } = ctx;
  if (!ctx.billingEmail) return redirect('/billing', 303);
  if (!isStripeConfigured(env)) {
    return redirect('/billing?error=' + encodeURIComponent('Billing is not enabled yet.'), 303);
  }
  const body = await readForm(request);
  const pack = creditPackFor(body.pack);
  if (!pack) {
    return redirect('/billing?error=' + encodeURIComponent('That credit pack is unavailable.'), 303);
  }
  try {
    const account = await getBillingAccount(env.DB, ctx.billingEmail);
    const session = await createCreditCheckoutSession(env, {
      email: ctx.billingEmail,
      pack,
      customerId: account && account.stripe_customer_id ? account.stripe_customer_id : undefined,
      successUrl: `${url.origin}/billing?credits=success`,
      cancelUrl: `${url.origin}/billing?credits=cancelled`,
    });
    return redirect(session.url, 303);
  } catch (err) {
    console.error('Credit checkout error:', err);
    return redirect('/billing?error=' + encodeURIComponent('Could not start checkout. Please try again.'), 303);
  }
}

/** POST /api/billing/portal — open the Stripe Billing Portal. */
export async function handleBillingPortal(ctx) {
  const { env, url } = ctx;
  if (!ctx.billingEmail) return redirect('/billing', 303);
  if (!isStripeConfigured(env)) {
    return redirect('/billing?error=' + encodeURIComponent('Billing is not enabled yet.'), 303);
  }
  const account = await getBillingAccount(env.DB, ctx.billingEmail);
  if (!account || !account.stripe_customer_id) {
    return redirect('/billing?error=' + encodeURIComponent('No subscription on file yet.'), 303);
  }
  try {
    const session = await createPortalSession(env, {
      customerId: account.stripe_customer_id,
      returnUrl: `${url.origin}/billing`,
    });
    return redirect(session.url, 303);
  } catch (err) {
    console.error('Portal error:', err);
    return redirect('/billing?error=' + encodeURIComponent('Could not open the billing portal.'), 303);
  }
}
