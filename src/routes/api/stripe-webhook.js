// Stripe webhook: keeps billing_accounts in sync with subscription state.
// Verifies the signature with STRIPE_WEBHOOK_SECRET before trusting anything.

import { jsonResponse } from '../../utils/response.js';
import { sanitizeEmail } from '../../utils/email.js';
import { verifyWebhook, planForPriceId } from '../../utils/stripe.js';
import { upsertBillingAccount, getBillingAccountByCustomer } from '../../db/billing.js';

async function emailForSubscription(env, sub) {
  if (sub.metadata && sub.metadata.email) return sanitizeEmail(sub.metadata.email);
  if (sub.customer) {
    const acct = await getBillingAccountByCustomer(env.DB, sub.customer);
    if (acct) return acct.email;
  }
  return null;
}

async function applySubscription(env, sub) {
  const email = await emailForSubscription(env, sub);
  if (!email) {
    console.warn('Subscription event without resolvable email:', sub.id);
    return;
  }
  const priceId = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price
    ? sub.items.data[0].price.id
    : null;
  const plan = planForPriceId(env, priceId);
  const fields = {
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    current_period_end: sub.current_period_end,
    cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
  };
  if (plan) {
    fields.pricing_tier = plan.tier;
    fields.plan_interval = plan.interval;
  }
  await upsertBillingAccount(env.DB, email, fields);
}

/** POST /api/stripe/webhook */
export async function handleStripeWebhook(ctx) {
  const { env, request } = ctx;
  const raw = await request.text();
  const sig = request.headers.get('Stripe-Signature');

  let event;
  try {
    event = await verifyWebhook(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return jsonResponse({ error: 'invalid signature' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const email =
          s.client_reference_id ||
          (s.customer_details && s.customer_details.email) ||
          (s.metadata && s.metadata.email);
        if (email) {
          await upsertBillingAccount(env.DB, sanitizeEmail(email), {
            stripe_customer_id: s.customer,
            stripe_subscription_id: s.subscription,
          });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await applySubscription(env, event.data.object);
        break;
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const email = await emailForSubscription(env, sub);
        if (email) {
          await upsertBillingAccount(env.DB, email, {
            pricing_tier: 'free_trial',
            plan_interval: null,
            subscription_status: 'canceled',
            cancel_at_period_end: 0,
          });
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
    return jsonResponse({ error: 'handler error' }, 500);
  }

  return jsonResponse({ received: true });
}
