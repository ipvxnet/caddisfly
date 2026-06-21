// Plugin entitlement gate — the single helper every plugin-gated surface uses.
// hasPlugin() = base paid plan + a valid (active or in-grace) entitlement row.
// See PLUGIN_PLATFORM_DESIGN.md §8 (gate server-side EVERYWHERE — IDOR lesson).

import { getBillingAccount } from '../db/billing.js';
import { getAccountPlugin, isEntitlementValid } from '../db/account-plugins.js';
import { PLUGINS } from './manifest.js';
import { redirect, jsonResponse } from '../utils/response.js';

// Subscription statuses that mean the base plan is NOT usable. A null status
// with a paid tier is allowed — that's how comped accounts are set (e.g. the
// agency-tier webdesigner@ account: tier set, no Stripe sub).
const LAPSED_STATUSES = ['canceled', 'past_due', 'incomplete', 'incomplete_expired', 'unpaid'];

/** Does the account hold a usable base PAID plan (required to own any plugin)? */
export function hasBasePlan(acct) {
  if (!acct || !acct.pricing_tier || acct.pricing_tier === 'free_trial') return false;
  return !LAPSED_STATUSES.includes(acct.subscription_status);
}

/**
 * Is `email` entitled to `pluginKey` right now? Requires (a) a base paid plan
 * AND (b) a valid entitlement (active, or within the 7-day grace past period end).
 * @returns {Promise<boolean>}
 */
export async function hasPlugin(env, email, pluginKey) {
  if (!email || !PLUGINS[pluginKey]) return false;
  const acct = await getBillingAccount(env.DB, email);
  if (!hasBasePlan(acct)) return false;
  const row = await getAccountPlugin(env.DB, email, pluginKey);
  return isEntitlementValid(row, Math.floor(Date.now() / 1000));
}

/**
 * Middleware factory: block a route unless the viewer is entitled to `pluginKey`.
 * Mount AFTER billingAuth (reads ctx.billingEmail). Page routes redirect to the
 * marketplace; pass {json:true} for APIs to return a 402 instead.
 * @param {string} pluginKey
 * @param {{json?: boolean}} [opts]
 */
export function pluginGate(pluginKey, { json = false } = {}) {
  return async function pluginGateMiddleware(ctx) {
    const ok = await hasPlugin(ctx.env, ctx.billingEmail, pluginKey);
    if (ok) return undefined; // entitled → continue
    if (json) return jsonResponse({ error: 'plugin_required', plugin: pluginKey }, 402);
    return redirect(`/plugins?upgrade=${encodeURIComponent(pluginKey)}`, 303);
  };
}
