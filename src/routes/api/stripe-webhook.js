// Stripe webhook: keeps billing_accounts in sync with subscription state.
// Verifies the signature with STRIPE_WEBHOOK_SECRET before trusting anything.

import { jsonResponse } from '../../utils/response.js';
import { sanitizeEmail } from '../../utils/email.js';
import { verifyWebhook, planForPriceId } from '../../utils/stripe.js';
import { upsertBillingAccount, getBillingAccountByCustomer, addPurchasedCredits, resetMonthlyCredits } from '../../db/billing.js';
import { notifyOpsAsync } from '../../utils/ops-notify.js';
import { processDomainOrder, processManualRenewal } from './domains-store.js';
import { updateOrder as updateDomainOrder } from '../../db/domain-orders.js';

const MONTH_SECONDS = 30 * 24 * 60 * 60;

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
    return null;
  }
  const item = sub.items && sub.items.data && sub.items.data[0] ? sub.items.data[0] : null;
  const priceId = item && item.price ? item.price.id : null;
  const plan = planForPriceId(env, priceId);
  // Recent Stripe API versions moved current_period_end from the subscription
  // onto the subscription item; fall back to it when the top-level is absent.
  const periodEnd =
    sub.current_period_end != null ? sub.current_period_end : item && item.current_period_end != null ? item.current_period_end : null;
  const fields = {
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    current_period_end: periodEnd,
    cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
  };
  if (plan) {
    fields.pricing_tier = plan.tier;
    fields.plan_interval = plan.interval;
  }
  await upsertBillingAccount(env.DB, email, fields);
  return { email, plan };
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

        // Domain purchase: registration backstop (receipt page is the primary
        // writer; processDomainOrder claims atomically so this can't double).
        if (s.metadata && s.metadata.type === 'domain_order' && s.metadata.order_id) {
          const orderId = parseInt(s.metadata.order_id, 10);
          if (Number.isFinite(orderId) && s.payment_status === 'paid') {
            if (s.customer) await updateDomainOrder(env.DB, orderId, { stripe_customer_id: s.customer });
            const run = processDomainOrder(env, orderId, s.payment_intent || null);
            if (ctx.ctx && ctx.ctx.waitUntil) ctx.ctx.waitUntil(run); else await run;
          }
          break;
        }

        // Manual "renew now" backstop (receipt page is the primary writer;
        // processManualRenewal claims by session id so this can't double).
        if (s.metadata && s.metadata.type === 'domain_renewal_manual' && s.metadata.order_id) {
          const orderId = parseInt(s.metadata.order_id, 10);
          if (Number.isFinite(orderId) && s.payment_status === 'paid') {
            const run = processManualRenewal(env, orderId, s.id);
            if (ctx.ctx && ctx.ctx.waitUntil) ctx.ctx.waitUntil(run); else await run;
          }
          break;
        }

        const email =
          s.client_reference_id ||
          (s.customer_details && s.customer_details.email) ||
          (s.metadata && s.metadata.email);
        if (!email) break;
        const emailNorm = sanitizeEmail(email);

        // One-time AI credit top-up: add the purchased credits (never expire).
        if (s.mode === 'payment' && s.metadata && s.metadata.type === 'credit_pack') {
          const credits = parseInt(s.metadata.credits, 10);
          if (Number.isFinite(credits) && credits > 0) {
            await addPurchasedCredits(env.DB, emailNorm, credits);
            if (s.customer) {
              await upsertBillingAccount(env.DB, emailNorm, { stripe_customer_id: s.customer });
            }
            notifyOpsAsync(ctx, `✨ *Credit pack purchased*: ${emailNorm} +${credits} credits`);
          }
          break;
        }

        // Subscription checkout: link the Stripe customer + subscription.
        await upsertBillingAccount(env.DB, emailNorm, {
          stripe_customer_id: s.customer,
          stripe_subscription_id: s.subscription,
        });
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const applied = await applySubscription(env, event.data.object);
        if (applied && event.type === 'customer.subscription.created') {
          notifyOpsAsync(ctx, `💳 *New subscription*: ${applied.email} → ${applied.plan ? `${applied.plan.tier} (${applied.plan.interval})` : 'unknown plan'}`);
        }
        break;
      }
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
          notifyOpsAsync(ctx, `🚪 *Subscription canceled*: ${email} → free_trial`);
        }
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        // Renewal (or first) payment → reset the monthly AI-credit allotment.
        const inv = event.data.object;
        let email = null;
        if (inv.customer) {
          const acct = await getBillingAccountByCustomer(env.DB, inv.customer);
          if (acct) email = acct.email;
        }
        if (email) {
          await resetMonthlyCredits(env.DB, email, Math.floor(Date.now() / 1000) + MONTH_SECONDS);
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
