// Stripe webhook: keeps billing_accounts in sync with subscription state.
// Verifies the signature with STRIPE_WEBHOOK_SECRET before trusting anything.

import { jsonResponse } from '../../utils/response.js';
import { sanitizeEmail } from '../../utils/email.js';
import { verifyWebhook, planForPriceId } from '../../utils/stripe.js';
import { upsertBillingAccount, getBillingAccountByCustomer, addPurchasedCredits, resetMonthlyCredits } from '../../db/billing.js';
import { entitlementKeyForPriceId, isFreePlugin } from '../../plugins/manifest.js';
import { getAccountPlugins, upsertAccountPlugin } from '../../db/account-plugins.js';
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

/**
 * Reconcile account_plugins from a subscription's items: plugin add-on items →
 * active; an active row whose item vanished → canceling (keep period end for the
 * 7-day grace). Webhook is the source of truth for entitlements.
 */
async function syncAccountPlugins(env, email, sub, periodEnd) {
  const items = (sub.items && sub.items.data) || [];
  const present = new Map(); // pluginKey -> stripe item id
  for (const it of items) {
    const key = entitlementKeyForPriceId(env, it.price && it.price.id);
    if (key) present.set(key, it.id);
  }
  for (const [key, itemId] of present) {
    await upsertAccountPlugin(env.DB, { email, pluginKey: key, status: 'active', stripeItemId: itemId, currentPeriodEnd: periodEnd });
  }
  const existing = await getAccountPlugins(env.DB, email);
  for (const row of existing) {
    // FREE plugins (opt-in, no Stripe item) must NOT be reconciled away just
    // because they aren't in the subscription's items.
    if (isFreePlugin(row.plugin_key)) continue;
    if (row.status === 'active' && !present.has(row.plugin_key)) {
      await upsertAccountPlugin(env.DB, { email, pluginKey: row.plugin_key, status: 'canceling', stripeItemId: row.stripe_item_id, currentPeriodEnd: row.current_period_end });
    }
  }
}

async function applySubscription(env, sub) {
  const email = await emailForSubscription(env, sub);
  if (!email) {
    console.warn('Subscription event without resolvable email:', sub.id);
    return null;
  }
  const items = (sub.items && sub.items.data) || [];
  // Find the BASE-PLAN item — a subscription may also carry plugin add-on items,
  // so don't assume items[0] is the plan.
  let plan = null;
  for (const it of items) {
    const p = planForPriceId(env, it.price && it.price.id);
    if (p) { plan = p; break; }
  }
  // Recent Stripe API versions moved current_period_end from the subscription
  // onto the subscription item; fall back to it when the top-level is absent.
  const anchorItem = items[0] || null;
  const periodEnd =
    sub.current_period_end != null ? sub.current_period_end : anchorItem && anchorItem.current_period_end != null ? anchorItem.current_period_end : null;
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
  await syncAccountPlugins(env, email, sub, periodEnd);
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
            // Ledger entry for the admin revenue panel (idempotent via session).
            await env.DB.prepare(
              `INSERT INTO credit_pack_purchases (email, credits, amount_cents, stripe_session_id)
               VALUES (?, ?, ?, ?) ON CONFLICT(stripe_session_id) DO NOTHING`
            ).bind(emailNorm, credits, s.amount_total || 0, s.id).run().catch(() => {});
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
          // Base plan gone → PAID plugins can't be held (hasPlugin requires a
          // base plan). Mark them canceled for cleanliness. FREE plugins survive
          // (they never required a base plan).
          const plugins = await getAccountPlugins(env.DB, email);
          for (const row of plugins) {
            if (isFreePlugin(row.plugin_key)) continue;
            if (row.status !== 'canceled') {
              await upsertAccountPlugin(env.DB, { email, pluginKey: row.plugin_key, status: 'canceled', stripeItemId: row.stripe_item_id, currentPeriodEnd: row.current_period_end });
            }
          }
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
