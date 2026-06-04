// Billing database operations: subscription accounts, passwordless magic links,
// and cookie-backed billing sessions (all keyed by customer email — separate
// from admin `sessions`/`users`). See migrations/008_billing.sql.

import { generateToken } from '../utils/crypto.js';

const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 minutes
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const MONTH_SECONDS = 30 * 24 * 60 * 60; // monthly credit period

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// ---- billing accounts ------------------------------------------------------

/** Fetch a billing account by email, or null. */
export async function getBillingAccount(db, email) {
  return db.prepare('SELECT * FROM billing_accounts WHERE email = ?').bind(email).first();
}

/** Fetch a billing account by Stripe customer id, or null. */
export async function getBillingAccountByCustomer(db, customerId) {
  return db
    .prepare('SELECT * FROM billing_accounts WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first();
}

/**
 * Insert or update a billing account (upsert by email). Only the provided
 * fields are written; omitted fields keep their existing values.
 * @param {object} db
 * @param {string} email
 * @param {object} fields - any of stripe_customer_id, stripe_subscription_id,
 *   pricing_tier, plan_interval, subscription_status, current_period_end,
 *   cancel_at_period_end
 */
export async function upsertBillingAccount(db, email, fields = {}) {
  const cols = [
    'stripe_customer_id',
    'stripe_subscription_id',
    'pricing_tier',
    'plan_interval',
    'subscription_status',
    'current_period_end',
    'cancel_at_period_end',
  ];
  const existing = await getBillingAccount(db, email);
  const now = nowSec();

  if (!existing) {
    // Insert ONLY provided columns so NOT NULL defaults (e.g. pricing_tier
    // 'free_trial') apply when a field is absent — checkout.session.completed
    // carries no tier, so binding NULL here would violate the constraint.
    const provided = cols.filter((c) => fields[c] !== undefined);
    const insertCols = ['email', ...provided];
    const insertVals = [email, ...provided.map((c) => fields[c])];
    await db
      .prepare(
        `INSERT INTO billing_accounts
           (${insertCols.join(', ')}, created_at, updated_at)
         VALUES (${insertCols.map(() => '?').join(', ')}, ?, ?)`
      )
      .bind(...insertVals, now, now)
      .run();
    return getBillingAccount(db, email);
  }

  const updates = cols.filter((c) => fields[c] !== undefined);
  if (updates.length === 0) return existing;
  const setSql = updates.map((c) => `${c} = ?`).join(', ');
  await db
    .prepare(`UPDATE billing_accounts SET ${setSql}, updated_at = ? WHERE email = ?`)
    .bind(...updates.map((c) => fields[c]), now, email)
    .run();
  return getBillingAccount(db, email);
}

/** Ensure a billing account row exists for an email (default free_trial tier). */
export async function ensureBillingAccount(db, email) {
  const now = nowSec();
  await db
    .prepare('INSERT OR IGNORE INTO billing_accounts (email, created_at, updated_at) VALUES (?, ?, ?)')
    .bind(email, now, now)
    .run();
  return getBillingAccount(db, email);
}

/**
 * Roll the monthly credit window forward if it has elapsed (or initialize it).
 * On first touch sets credits_reset_at = now + 1 month. Once past, zeroes
 * ai_credits_used and advances credits_reset_at to the next future boundary.
 * Free users have no Stripe invoice, so this is their reset mechanism; paid
 * users also get an invoice.paid reset (both converge).
 */
export async function applyCreditPeriodReset(db, email) {
  const now = nowSec();
  const acct = await getBillingAccount(db, email);
  if (!acct) return;
  if (acct.credits_reset_at == null) {
    await db
      .prepare('UPDATE billing_accounts SET credits_reset_at = ?, updated_at = ? WHERE email = ?')
      .bind(now + MONTH_SECONDS, now, email)
      .run();
  } else if (acct.credits_reset_at <= now) {
    let next = acct.credits_reset_at;
    while (next <= now) next += MONTH_SECONDS;
    await db
      .prepare('UPDATE billing_accounts SET ai_credits_used = 0, credits_reset_at = ?, updated_at = ? WHERE email = ?')
      .bind(next, now, email)
      .run();
  }
}

/** Spend credits: increment monthly used and decrement the purchased balance. */
export async function spendCredits(db, email, fromMonthly, fromPurchased) {
  const now = nowSec();
  await db
    .prepare(
      `UPDATE billing_accounts
       SET ai_credits_used = ai_credits_used + ?,
           ai_credits_purchased = ai_credits_purchased - ?,
           updated_at = ?
       WHERE email = ?`
    )
    .bind(fromMonthly, fromPurchased, now, email)
    .run();
}

/** Reset the monthly allotment (invoice.paid). Sets used=0 and the next reset. */
export async function resetMonthlyCredits(db, email, resetAt) {
  const now = nowSec();
  await db
    .prepare('UPDATE billing_accounts SET ai_credits_used = 0, credits_reset_at = ?, updated_at = ? WHERE email = ?')
    .bind(resetAt, now, email)
    .run();
}

/**
 * Count DISTINCT published sites for an email across both bridges (AI builder
 * ai_projects + refactor projects), excluding a given public id (the site
 * being (re)published shouldn't count against its own cap).
 */
export async function countPublishedSites(db, email, excludePublicId = '') {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM ai_projects WHERE customer_email = ?1 AND status = 'deployed' AND project_id != ?2)
       + (SELECT COUNT(*) FROM projects     WHERE customer_email = ?1 AND status = 'deployed' AND preview_id != ?2) AS n`
    )
    .bind(email, excludePublicId)
    .first();
  return (row && row.n) || 0;
}

/**
 * Add purchased AI credits to an account (atomic upsert). Creates the account
 * at the default tier if it doesn't exist yet. Purchased credits never expire.
 */
export async function addPurchasedCredits(db, email, credits) {
  const now = nowSec();
  await db
    .prepare(
      `INSERT INTO billing_accounts (email, ai_credits_purchased, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         ai_credits_purchased = ai_credits_purchased + excluded.ai_credits_purchased,
         updated_at = excluded.updated_at`
    )
    .bind(email, credits, now, now)
    .run();
  return getBillingAccount(db, email);
}

// ---- magic links -----------------------------------------------------------

/** Create a single-use magic-link token (15-min TTL) for an email. */
export async function createMagicLink(db, email) {
  const token = generateToken(32);
  const expiresAt = nowSec() + MAGIC_LINK_TTL_SECONDS;
  await db
    .prepare('INSERT INTO billing_magic_links (token, email, expires_at) VALUES (?, ?, ?)')
    .bind(token, email, expiresAt)
    .run();
  return token;
}

/**
 * Consume a magic-link token: returns its email if valid+unused+unexpired and
 * marks it used; otherwise null.
 */
export async function consumeMagicLink(db, token) {
  const now = nowSec();
  const row = await db
    .prepare('SELECT * FROM billing_magic_links WHERE token = ?')
    .bind(token)
    .first();
  if (!row || row.used_at || row.expires_at <= now) return null;
  await db
    .prepare('UPDATE billing_magic_links SET used_at = ? WHERE token = ?')
    .bind(now, token)
    .run();
  return row.email;
}

// ---- billing sessions ------------------------------------------------------

/** Create a 30-day billing session for an email; returns its token. */
export async function createBillingSession(db, email) {
  const token = generateToken(32);
  const expiresAt = nowSec() + SESSION_TTL_SECONDS;
  await db
    .prepare('INSERT INTO billing_sessions (token, email, expires_at) VALUES (?, ?, ?)')
    .bind(token, email, expiresAt)
    .run();
  return { token, expiresAt, maxAge: SESSION_TTL_SECONDS };
}

/** Resolve a billing session token to its email if valid+unexpired, else null. */
export async function getBillingSession(db, token) {
  if (!token) return null;
  const row = await db
    .prepare('SELECT * FROM billing_sessions WHERE token = ? AND expires_at > ?')
    .bind(token, nowSec())
    .first();
  return row || null;
}

/** Delete a billing session (logout). */
export async function deleteBillingSession(db, token) {
  if (!token) return false;
  const res = await db.prepare('DELETE FROM billing_sessions WHERE token = ?').bind(token).run();
  return res.success;
}

export const BILLING_COOKIE = 'cf_billing';
