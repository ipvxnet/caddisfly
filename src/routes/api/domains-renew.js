// Domain auto-renewal — runs daily from the scheduled (cron) handler.
//
// For each registered domain expiring within the window:
//   auto_renew ON  → charge the saved card off-session, then renew at Namecheap,
//                    push expiry +1yr, email "renewed". On charge/renew failure:
//                    dunning email + Slack, bump renewal_attempts, retry next day.
//   auto_renew OFF → expiry reminder emails (~14 / ~3 days), then let it lapse.
//
// Guards: one action per domain per day (renewal_last_at), give up auto-charge
// after MAX_ATTEMPTS, never double-charge (success pushes expiry out of window).
// Charging is the only "safe-default" automatic money movement (per the
// Domain-Ops guardrail) — every other irreversible action stays human-confirmed.

import { getExpiringDomains, updateOrder, getCachedPrices } from '../../db/domain-orders.js';
import { renewDomain, isNamecheapConfigured } from '../../utils/namecheap.js';
import { chargeOffSession } from '../../utils/stripe.js';
import { notifyOps } from '../../utils/ops-notify.js';
import {
  sendDomainRenewedEmail, sendDomainRenewalFailedEmail, sendDomainExpiringEmail,
} from '../../utils/email.js';

const RENEW_WINDOW_DAYS = 30;   // start trying this far out
const CHARGE_WINDOW_DAYS = 21;  // begin auto-charge attempts this far out
const MAX_ATTEMPTS = 4;         // dunning attempts before giving up
const MARKUP_CENTS = 500;       // retail = wholesale renew + markup (matches buy)
const DAY = 86400;

const tld = (domain) => domain.slice(domain.indexOf('.') + 1);
const daysLeft = (order, now) => Math.floor((order.expires_at - now) / DAY);
const sameDay = (a, b) => Math.floor(a / DAY) === Math.floor(b / DAY);

/** Retail renew price (cents) for a domain, from the wholesale cache + markup. */
async function renewPriceCents(db, domain) {
  const rows = await getCachedPrices(db);
  const row = rows.find((r) => r.tld === tld(domain));
  if (!row || !row.renew_cents) return null;
  return row.renew_cents + MARKUP_CENTS;
}

/**
 * Process all due renewals. Returns a summary for logging/Slack.
 * @param {object} opts - { now?: unix seconds (testing), dryRun?: bool }
 */
export async function processRenewals(env, opts = {}) {
  const now = opts.now || Math.floor(Date.now() / 1000);
  const dryRun = !!opts.dryRun;
  const summary = { checked: 0, renewed: 0, failed: 0, reminded: 0, skipped: 0, dry: dryRun };
  if (!isNamecheapConfigured(env)) return { ...summary, error: 'namecheap not configured' };

  const due = await getExpiringDomains(env.DB, now, RENEW_WINDOW_DAYS);
  const appUrl = env.APP_URL || 'https://caddisfly.ai';

  for (const order of due) {
    summary.checked++;
    // One action per domain per day.
    if (order.renewal_last_at && sameDay(order.renewal_last_at, now)) { summary.skipped++; continue; }
    const left = daysLeft(order, now);

    // ---- auto-renew OFF: reminders only ----
    if (!order.auto_renew) {
      if (left <= 14) {
        if (!dryRun) {
          await sendDomainExpiringEmail(env, { to: order.customer_email, domain: order.domain, daysLeft: Math.max(0, left), manageUrl: `${appUrl}/domains` }).catch(() => {});
          await updateOrder(env.DB, order.id, { renewal_last_at: now });
        }
        summary.reminded++;
      } else {
        summary.skipped++;
      }
      continue;
    }

    // ---- auto-renew ON ----
    if (left > CHARGE_WINDOW_DAYS) { summary.skipped++; continue; } // too early to charge
    if (order.renewal_attempts >= MAX_ATTEMPTS) { summary.skipped++; continue; } // gave up; lapses
    if (!order.stripe_customer_id) {
      if (!dryRun) {
        await notifyOps(env, `🚨 *Domain renewal* ${order.domain}: auto-renew on but no saved card (customer ${order.customer_email}).`);
        await updateOrder(env.DB, order.id, { renewal_last_at: now, renewal_attempts: (order.renewal_attempts || 0) + 1 });
      }
      summary.failed++;
      continue;
    }

    if (dryRun) { summary.skipped++; continue; }

    const amount = await renewPriceCents(env.DB, order.domain);
    if (!amount) {
      await notifyOps(env, `🚨 *Domain renewal* ${order.domain}: no cached renew price — skipped.`);
      await updateOrder(env.DB, order.id, { renewal_last_at: now });
      summary.skipped++;
      continue;
    }

    try {
      // 1) Charge the saved card off-session.
      await chargeOffSession(env, {
        customerId: order.stripe_customer_id,
        amountCents: amount,
        currency: order.currency || 'usd',
        metadata: { type: 'domain_renewal', order_id: String(order.id), domain: order.domain },
      });
      // 2) Renew at Namecheap (money already taken — failure here needs ops).
      try {
        await renewDomain(env, order.domain, 1);
      } catch (e) {
        await notifyOps(env, `🚨 *Domain renewal* ${order.domain}: CHARGED ${order.customer_email} but Namecheap renew FAILED: ${e.message.slice(0, 160)} — manual renew/refund (order #${order.id}).`);
        await updateOrder(env.DB, order.id, { renewal_last_at: now });
        summary.failed++;
        continue;
      }
      // 3) Success: push expiry +1yr, reset dunning.
      const newExpiry = order.expires_at + 365 * DAY;
      await updateOrder(env.DB, order.id, { expires_at: newExpiry, renewal_attempts: 0, renewal_last_at: now, error: null });
      const amtLabel = `$${(amount / 100).toFixed(2)}`;
      const expLabel = new Date(newExpiry * 1000).toISOString().slice(0, 10);
      await sendDomainRenewedEmail(env, { to: order.customer_email, domain: order.domain, amountLabel: amtLabel, expiresLabel: expLabel }).catch(() => {});
      await notifyOps(env, `🔁 *Domain renewed*: ${order.domain} → ${order.customer_email} (${amtLabel})`);
      summary.renewed++;
    } catch (e) {
      // Charge failed (decline / authentication needed) → dunning.
      const attempts = (order.renewal_attempts || 0) + 1;
      await updateOrder(env.DB, order.id, { renewal_attempts: attempts, renewal_last_at: now, error: e.message.slice(0, 300) });
      await sendDomainRenewalFailedEmail(env, { to: order.customer_email, domain: order.domain, daysLeft: Math.max(0, left), manageUrl: `${appUrl}/billing` }).catch(() => {});
      await notifyOps(env, `⚠️ *Domain renewal failed* (try ${attempts}/${MAX_ATTEMPTS}): ${order.domain} — ${e.message.slice(0, 120)}`);
      summary.failed++;
    }
  }

  return summary;
}
