// Non-blocking billing auth: resolves the billing session cookie to an email
// and attaches it to ctx. Never short-circuits — public /billing shows a
// sign-in form when there's no session; API handlers enforce as needed.

import { parseCookies } from '../utils/crypto.js';
import { getBillingSession, BILLING_COOKIE } from '../db/billing.js';

export async function billingAuth(ctx) {
  const token = parseCookies(ctx.request)[BILLING_COOKIE];
  if (token) {
    const session = await getBillingSession(ctx.env.DB, token);
    if (session) {
      ctx.billingEmail = session.email;
      ctx.billingToken = token;
    }
  }
  return undefined; // continue
}
