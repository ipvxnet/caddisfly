// AI credit ledger: monthly per-tier allotments + persistent purchased balance.
// Spending draws down the monthly allotment first, then purchased credits.
// Enforced in production; in preview/dev it never blocks (so testing isn't
// throttled) but still decrements so the effect is visible.

import {
  getBillingAccount,
  ensureBillingAccount,
  applyCreditPeriodReset,
  spendCredits,
} from '../db/billing.js';

// Monthly allotment per tier (see memory/pricing.md).
export const MONTHLY_CREDITS = { free_trial: 50, starter: 500, pro: 2000, agency: 8000 };

// Cost per metered AI action (indicative; tune to measured per-call spend).
export const CREDIT_COSTS = { generate: 20, image: 5, text_edit: 1, enrich: 10, blog_post: 10, social_pack: 2, product_desc: 2, logo: 10, hero_video: 100, seo_review: 10, menu_ai: 3 };

// Published-site cap per tier (Agency = unlimited).
export const PUBLISH_LIMITS = { free_trial: 1, starter: 3, pro: 15, agency: Infinity };

// Custom-domain cap per tier (free gets a subdomain only).
export const DOMAIN_LIMITS = { free_trial: 0, starter: 1, pro: 5, agency: Infinity };

// Team seats per tier — TOTAL seats including the owner (free = owner only).
export const TEAM_LIMITS = { free_trial: 1, starter: 5, pro: 15, agency: 50 };

// Saved site versions kept per tier (oldest pruned beyond the cap).
export const SNAPSHOT_LIMITS = { free_trial: 2, starter: 5, pro: 10, agency: 30 };

// Store products per tier. Model B (2026-06-22): capacity lives on the TIER —
// raised the caps so small businesses aren't blocked at 10 products (the old
// floor was "problematic"); plugins add FEATURES, not headroom. Free can browse
// the store manager but not list products. Enforced in production only.
export const PRODUCT_LIMITS = { free_trial: 0, starter: 250, pro: 1000, agency: Infinity };

// Booking engine — free WITH CAPS on every tier (decided 2026-06-10; vs Wix
// gating bookings behind $29): service types per site, and confirmed bookings
// per site per calendar month. Service-type caps raised under Model B
// (2026-06-22). Enforced in production only (limitsDisabled).
export const BOOKING_SERVICE_LIMITS = { free_trial: 1, starter: 50, pro: 200, agency: Infinity };
export const BOOKING_MONTHLY_LIMITS = { free_trial: 20, starter: 200, pro: 1000, agency: Infinity };

/** Team seat cap for a tier (defaults to free). */
export function teamLimit(tier) {
  return TEAM_LIMITS[tier] != null ? TEAM_LIMITS[tier] : TEAM_LIMITS.free_trial;
}

/** Monthly allotment for a tier (defaults to free). */
export function monthlyAllotment(tier) {
  return MONTHLY_CREDITS[tier] != null ? MONTHLY_CREDITS[tier] : MONTHLY_CREDITS.free_trial;
}

/**
 * Resolve an account's current credit state, ensuring the row exists and the
 * monthly window is current. Returns { tier, allotment, used, purchased,
 * monthlyRemaining, totalRemaining, resetAt }.
 */
export async function getCreditState(db, email) {
  if (!email) {
    const allotment = MONTHLY_CREDITS.free_trial;
    return { tier: 'free_trial', allotment, used: 0, purchased: 0, monthlyRemaining: allotment, totalRemaining: allotment, resetAt: null };
  }
  await ensureBillingAccount(db, email);
  await applyCreditPeriodReset(db, email);
  const acct = await getBillingAccount(db, email);
  const tier = (acct && acct.pricing_tier) || 'free_trial';
  const allotment = monthlyAllotment(tier);
  const used = (acct && acct.ai_credits_used) || 0;
  const purchased = (acct && acct.ai_credits_purchased) || 0;
  const monthlyRemaining = Math.max(0, allotment - used);
  return {
    tier,
    allotment,
    used,
    purchased,
    monthlyRemaining,
    totalRemaining: monthlyRemaining + purchased,
    resetAt: acct ? acct.credits_reset_at : null,
  };
}

/** Whether credits are hard-enforced (production only). */
export function creditsEnforced(env) {
  return !!env && env.ENVIRONMENT === 'production';
}

/**
 * Charge credits for an action. Spends monthly allotment first, then purchased.
 * - Production: if the balance is insufficient, charges NOTHING and returns
 *   { allowed:false } so the caller can block + prompt to buy/upgrade.
 * - Preview/dev: never blocks — charges what's available (clamped) so the
 *   decrement is visible during testing — and returns { allowed:true }.
 * @returns {Promise<{allowed:boolean, charged:number, state:object}>}
 */
export async function chargeCredits(env, db, email, amount) {
  const state = await getCreditState(db, email);
  if (!email || amount <= 0) return { allowed: true, charged: 0, state };

  const available = state.totalRemaining;
  let toCharge = amount;
  if (available < amount) {
    if (creditsEnforced(env)) return { allowed: false, charged: 0, state };
    toCharge = available; // preview: clamp, never block
  }

  const fromMonthly = Math.min(toCharge, state.monthlyRemaining);
  const fromPurchased = toCharge - fromMonthly;
  if (toCharge > 0) await spendCredits(db, email, fromMonthly, fromPurchased);

  const newState = await getCreditState(db, email);
  return { allowed: true, charged: toCharge, state: newState };
}

/**
 * Pre-flight affordability check (no charge). True if the action may proceed.
 * Always true in preview/dev. Use before starting expensive work.
 */
export async function canAfford(env, db, email, amount) {
  if (!creditsEnforced(env)) return { ok: true, state: await getCreditState(db, email) };
  const state = await getCreditState(db, email);
  return { ok: state.totalRemaining >= amount, state };
}

/** Friendly error payload when a user can't afford an action (HTTP 402). */
export function formatCreditError(state, actionLabel = 'this action') {
  return {
    success: false,
    error: `Not enough AI credits for ${actionLabel}. You have ${state.totalRemaining} credit${state.totalRemaining === 1 ? '' : 's'} left.`,
    credits: {
      tier: state.tier,
      monthly_remaining: state.monthlyRemaining,
      purchased: state.purchased,
      total_remaining: state.totalRemaining,
    },
    upgrade_message: 'Buy more credits or upgrade your plan to keep going.',
    billing_url: '/billing',
  };
}
