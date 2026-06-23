// Plugin entitlement gate — the single helper every plugin-gated surface uses.
// hasPlugin() = base paid plan + a valid (active or in-grace) entitlement row.
// See PLUGIN_PLATFORM_DESIGN.md §8 (gate server-side EVERYWHERE — IDOR lesson).

import { getBillingAccount } from '../db/billing.js';
import { getAccountPlugin, isEntitlementValid } from '../db/account-plugins.js';
import { PLUGINS, pluginForSectionType, bundlesIncluding } from './manifest.js';
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
  const now = Math.floor(Date.now() / 1000);
  const row = await getAccountPlugin(env.DB, email, pluginKey);
  if (isEntitlementValid(row, now)) return true;
  // A bundle that includes this plugin entitles it too (one bundle row covers
  // several plugins — see BUNDLES.all_access).
  for (const b of bundlesIncluding(pluginKey)) {
    const brow = await getAccountPlugin(env.DB, email, b.key);
    if (isEntitlementValid(brow, now)) return true;
  }
  return false;
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

/**
 * Build a synchronous section filter for a site owner — drops sections whose
 * type belongs to a plugin the owner isn't entitled to (assemble-time gating,
 * §8.3). Each plugin's entitlement is checked ONCE here; the returned predicate
 * is cheap to apply across many section arrays / pages. Non-plugin sections and
 * unknown owners pass through unchanged (no gated types → no-op).
 * @returns {Promise<(sections: any[]) => any[]>}
 */
export async function entitledSectionFilter(env, ownerEmail) {
  const denied = new Set(); // plugin keys the owner is NOT entitled to
  for (const p of Object.values(PLUGINS)) {
    if (!(await hasPlugin(env, ownerEmail, p.key))) denied.add(p.key);
  }
  return function filterSections(sections) {
    if (!Array.isArray(sections) || denied.size === 0) return sections;
    return sections.filter((s) => {
      const plugin = pluginForSectionType(s && (s.section_type || s.type));
      return !plugin || !denied.has(plugin.key);
    });
  };
}
