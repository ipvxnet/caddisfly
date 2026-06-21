// Plugin subscribe / cancel — add or remove a $5/mo plugin as a Stripe
// subscription ITEM on the account's existing base subscription. The billing
// webhook is the authoritative writer of account_plugins; these routes do an
// optimistic upsert for instant UX and let the webhook reconcile.
// See PLUGIN_PLATFORM_DESIGN.md §7.

import { jsonResponse } from '../../utils/response.js';
import { getBillingAccount } from '../../db/billing.js';
import { PLUGINS } from '../../plugins/manifest.js';
import { hasBasePlan } from '../../plugins/entitlements.js';
import { getAccountPlugin, upsertAccountPlugin } from '../../db/account-plugins.js';
import {
  getSubscription,
  addSubscriptionItem,
  deleteSubscriptionItem,
  isStripeConfigured,
} from '../../utils/stripe.js';

/** Pull the paid-through timestamp from a subscription (API-version tolerant). */
function periodEndOf(sub) {
  if (!sub) return null;
  if (sub.current_period_end != null) return sub.current_period_end;
  const it = sub.items && sub.items.data && sub.items.data[0];
  return it && it.current_period_end != null ? it.current_period_end : null;
}

/** Find the subscription item whose price matches `priceId`. */
function findItem(sub, priceId) {
  const items = (sub && sub.items && sub.items.data) || [];
  return items.find((it) => it.price && it.price.id === priceId) || null;
}

/** Resolve (plugin, account, priceId, subId) or a Response error. */
async function resolve(ctx) {
  const key = ctx.params && ctx.params.key;
  const plugin = key && PLUGINS[key];
  if (!plugin) return { error: jsonResponse({ error: 'unknown_plugin' }, 404) };
  const email = ctx.billingEmail;
  if (!email) return { error: jsonResponse({ error: 'sign_in_required' }, 401) };
  if (!isStripeConfigured(ctx.env)) return { error: jsonResponse({ error: 'billing_unavailable' }, 503) };
  const priceId = ctx.env[plugin.priceVar];
  if (!priceId) return { error: jsonResponse({ error: 'plugin_not_configured' }, 503) };
  const acct = await getBillingAccount(ctx.env.DB, email);
  if (!hasBasePlan(acct)) return { error: jsonResponse({ error: 'base_plan_required' }, 402) };
  if (!acct.stripe_subscription_id) {
    // Comped accounts (paid tier, no Stripe sub) can't attach an item — grant
    // such plugins manually in the DB if ever needed.
    return { error: jsonResponse({ error: 'no_subscription' }, 409) };
  }
  return { key, plugin, email, priceId, acct, subId: acct.stripe_subscription_id };
}

/** POST /api/plugins/:key/subscribe */
export async function handlePluginSubscribe(ctx) {
  const r = await resolve(ctx);
  if (r.error) return r.error;
  try {
    const sub = await getSubscription(ctx.env, r.subId);
    let item = findItem(sub, r.priceId);
    if (!item) {
      item = await addSubscriptionItem(ctx.env, r.subId, r.priceId);
    }
    // Optimistic entitlement (webhook will reconcile as source of truth).
    await upsertAccountPlugin(ctx.env.DB, {
      email: r.email,
      pluginKey: r.key,
      status: 'active',
      stripeItemId: item.id,
      currentPeriodEnd: periodEndOf(sub),
    });
    return jsonResponse({ ok: true, plugin: r.key, status: 'active' });
  } catch (err) {
    console.error('Plugin subscribe failed:', err.message);
    return jsonResponse({ error: 'subscribe_failed', detail: err.message }, 502);
  }
}

/** POST /api/plugins/:key/cancel */
export async function handlePluginCancel(ctx) {
  const r = await resolve(ctx);
  if (r.error) return r.error;
  try {
    const sub = await getSubscription(ctx.env, r.subId);
    const item = findItem(sub, r.priceId);
    if (item) await deleteSubscriptionItem(ctx.env, item.id);
    // Keep the row in 'canceling' with its period end so the 7-day grace applies.
    const existing = await getAccountPlugin(ctx.env.DB, r.email, r.key);
    await upsertAccountPlugin(ctx.env.DB, {
      email: r.email,
      pluginKey: r.key,
      status: 'canceling',
      stripeItemId: (existing && existing.stripe_item_id) || null,
      currentPeriodEnd: (existing && existing.current_period_end) || periodEndOf(sub),
    });
    return jsonResponse({ ok: true, plugin: r.key, status: 'canceling' });
  } catch (err) {
    console.error('Plugin cancel failed:', err.message);
    return jsonResponse({ error: 'cancel_failed', detail: err.message }, 502);
  }
}
