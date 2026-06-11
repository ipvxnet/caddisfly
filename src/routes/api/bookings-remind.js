// Booking reminder cron — hourly ("30 * * * *", prod-only like renewals).
// Sends each visitor ONE reminder email when their appointment is 23–25 hours
// away, measured in the OWNER's timezone (same model as the slot engine). The
// 2-hour window + hourly runs guarantee every booking is seen at least once;
// the atomic reminded_at claim guarantees it's sent at most once. Bookings
// made <24h ahead simply never enter the window (they just got a
// confirmation). Admin dry-run: GET /api/admin/bookings/remind?dry=1.

import { getReminderCandidates, claimReminder } from '../../db/bookings.js';
import { siteForBooking } from '../public/booking-cancel.js';
import { nowInTimezone, minutesUntil, minutesLabel, addDays } from '../../utils/booking-slots.js';
import { sendBookingReminderEmail } from '../../utils/email.js';

const WINDOW_MIN = 23 * 60;
const WINDOW_MAX = 25 * 60;

/** Pure window check — exported for unit tests. */
export function inReminderWindow(booking, now) {
  const until = minutesUntil(booking, now);
  return until >= WINDOW_MIN && until <= WINDOW_MAX;
}

/**
 * One cron tick. opts: { dryRun?: bool, now?: unix seconds (dry-run only) }.
 * Returns a summary for logs / the admin endpoint.
 */
export async function processBookingReminders(env, opts = {}) {
  const dryRun = !!opts.dryRun;
  const at = dryRun && Number.isFinite(opts.now) ? new Date(opts.now * 1000) : new Date();
  const summary = { checked: 0, reminded: 0, skipped: 0, errors: 0, dry: dryRun };

  // Candidate dates around "now": a 24h-ahead booking lands on UTC today,
  // tomorrow, or the day after across all owner timezones.
  const utcToday = at.toISOString().slice(0, 10);
  const dates = [utcToday, addDays(utcToday, 1), addDays(utcToday, 2)];
  const candidates = await getReminderCandidates(env.DB, dates);

  const siteCache = new Map(); // per-project resolver cache within one tick
  for (const b of candidates) {
    summary.checked++;
    try {
      const key = b.ai_project_id != null ? `a${b.ai_project_id}` : `p${b.project_id}`;
      let site = siteCache.get(key);
      if (site === undefined) {
        site = await siteForBooking(env.DB, b);
        siteCache.set(key, site);
      }
      if (!site) { summary.skipped++; continue; }

      const now = nowInTimezone(site.settings.timezone, at);
      if (!inReminderWindow(b, now)) { summary.skipped++; continue; }
      if (dryRun) { summary.reminded++; continue; }

      if (!(await claimReminder(env.DB, b.id))) { summary.skipped++; continue; }
      await sendBookingReminderEmail(env, {
        to: b.customer_email,
        siteName: site.siteName,
        serviceName: b.service_name || '',
        dateLabel: b.date,
        timeLabel: minutesLabel(b.start_min),
        tz: site.settings.timezone,
        cancelUrl: `${env.APP_URL || 'https://caddisfly.ai'}/booking/cancel/${b.cancel_token}`,
        rescheduleUrl: `${env.APP_URL || 'https://caddisfly.ai'}/booking/reschedule/${b.cancel_token}`,
      });
      summary.reminded++;
    } catch (e) {
      summary.errors++;
      console.error('booking reminder failed:', b.id, e.message);
    }
  }
  return summary;
}
