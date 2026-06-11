// New-booking / cancellation notifications to the owner's connected socials —
// reuses the blog-syndication connections (social_connections_json) and
// postToPlatform, so "connect once, use everywhere". Which platforms fire is
// the owner's choice in booking settings (notify_platforms). Mastodon is
// deliberately EXCLUDED: statuses are public toots, and a booking carries a
// customer's name + email (Discord/Slack/Telegram go to private channels).
// Best-effort like the emails: failures log, never block the booking.

import { parseConnections, postToPlatform, PLATFORM_FIELDS } from './social-share.js';
import { minutesLabel } from './booking-slots.js';

export const BOOKING_NOTIFY_PLATFORMS = ['discord', 'slack', 'telegram'];

/** Sanitize the notify_platforms list from booking settings. */
export function notifyPlatforms(settings) {
  const raw = Array.isArray(settings && settings.notify_platforms) ? settings.notify_platforms : [];
  return raw.filter((p) => BOOKING_NOTIFY_PLATFORMS.includes(p));
}

/** Platforms that are BOTH selected for booking notifications AND connected. */
export function activeNotifyPlatforms(settings, config) {
  const conns = parseConnections(config);
  return notifyPlatforms(settings).filter((p) => {
    const c = conns[p];
    return c && (PLATFORM_FIELDS[p] || []).every((f) => c[f]);
  });
}

/**
 * Fire-and-forget per platform. booking = { date, start_min, customer_name,
 * customer_email, note? }; serviceName resolved by the caller.
 */
export async function notifyBookingEvent(env, { config, settings, siteName, publicId, booking, serviceName, cancelled = false }) {
  try {
    const targets = activeNotifyPlatforms(settings, config);
    if (!targets.length) return;
    const conns = parseConnections(config);
    const when = `${booking.date} · ${minutesLabel(booking.start_min)}`;
    const ann = {
      title: cancelled ? `❌ Booking cancelled — ${serviceName}` : `📅 New booking — ${serviceName}`,
      excerpt: `${when}\n${booking.customer_name} <${booking.customer_email}>${booking.note ? `\n“${booking.note}”` : ''}`,
      url: `${env.APP_URL || 'https://caddisfly.ai'}/ai-builder/bookings/${publicId}`,
      image: '',
    };
    for (const p of targets) {
      const r = await postToPlatform(p, conns[p], ann);
      if (!r.ok) console.error(`booking notify ${p} failed:`, r.error);
    }
  } catch (e) {
    console.error('booking notify failed:', e.message);
  }
}
