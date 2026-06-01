// Billing database operations: subscription accounts, passwordless magic links,
// and cookie-backed billing sessions (all keyed by customer email — separate
// from admin `sessions`/`users`). See migrations/008_billing.sql.

import { generateToken } from '../utils/crypto.js';

const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 minutes
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

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
    const vals = cols.map((c) => (fields[c] !== undefined ? fields[c] : null));
    await db
      .prepare(
        `INSERT INTO billing_accounts
           (email, ${cols.join(', ')}, created_at, updated_at)
         VALUES (?, ${cols.map(() => '?').join(', ')}, ?, ?)`
      )
      .bind(email, ...vals, now, now)
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
