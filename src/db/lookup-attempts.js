// Daily abuse cap for the refactor preview lookup (paid Google Places call).
// Counts attempts against BOTH the hashed IP and the email; either hitting the
// limit blocks. See migrations/045_lookup_attempts.sql.

import { sha256Hex } from '../utils/crypto.js';

export const LOOKUP_DAILY_LIMIT = 5;
const DAY_SECONDS = 24 * 60 * 60;

/** Hash a client IP (privacy — never store the raw IP). */
export async function hashIp(ip) {
  return ip ? sha256Hex(`lookup:${ip}`) : '';
}

/**
 * How many lookups remain for this (ip, email) in the last 24h. Returns the
 * smaller of the IP allowance and the email allowance.
 * @returns {Promise<{allowed: boolean, remaining: number, used: number}>}
 */
export async function lookupAllowance(db, ipHash, email) {
  const since = Math.floor(Date.now() / 1000) - DAY_SECONDS;
  const ipRow = ipHash
    ? await db.prepare('SELECT COUNT(*) AS c FROM lookup_attempts WHERE ip_hash = ? AND created_at >= ?').bind(ipHash, since).first()
    : { c: 0 };
  const emailRow = email
    ? await db.prepare('SELECT COUNT(*) AS c FROM lookup_attempts WHERE email = ? AND created_at >= ?').bind(email, since).first()
    : { c: 0 };
  const used = Math.max(ipRow?.c || 0, emailRow?.c || 0);
  const remaining = Math.max(0, LOOKUP_DAILY_LIMIT - used);
  return { allowed: remaining > 0, remaining, used };
}

/** Record one lookup attempt. */
export async function recordLookup(db, ipHash, email) {
  await db
    .prepare('INSERT INTO lookup_attempts (ip_hash, email, created_at) VALUES (?, ?, ?)')
    .bind(ipHash || '', email || '', Math.floor(Date.now() / 1000))
    .run();
}
