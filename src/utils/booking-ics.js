// "Add to calendar" — a minimal RFC-5545 .ics for one booking, attached to the
// confirmation email. Times are emitted in UTC (Z), converted from the
// owner-timezone slot via Intl (no tz database needed), so every calendar app
// lands the event at the right local moment for the visitor.

import { nowInTimezone } from './booking-slots.js';

/**
 * Owner-local (date string + minutes-from-midnight in `tz`) → UTC epoch ms.
 * Guess-and-correct via Intl: format the guess in tz, measure the miss, adjust
 * (twice, for DST edges). Inverse of nowInTimezone.
 */
export function zonedTimeToUtc(dateStr, minutes, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const want = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let ts = want;
  for (let i = 0; i < 2; i++) {
    const p = nowInTimezone(tz, new Date(ts));
    const [py, pm, pd] = p.date.split('-').map(Number);
    const have = Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60);
    ts += want - have;
  }
  return ts;
}

const pad = (n) => String(n).padStart(2, '0');
const icsStamp = (ms) => {
  const t = new Date(ms);
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`;
};
const icsEscape = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * One-event ICS string. booking: { date, start_min, end_min, cancel_token };
 * site: { siteName, timezone }; serviceName; cancelUrl.
 */
export function bookingIcs({ booking, siteName, timezone, serviceName, cancelUrl }) {
  const startMs = zonedTimeToUtc(booking.date, booking.start_min, timezone);
  const endMs = zonedTimeToUtc(booking.date, booking.end_min, timezone);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Caddisfly//Bookings//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.cancel_token}@caddisfly.ai`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(startMs)}`,
    `DTEND:${icsStamp(endMs)}`,
    `SUMMARY:${icsEscape(`${serviceName} — ${siteName}`)}`,
    `DESCRIPTION:${icsEscape(`Booked via ${siteName}.${cancelUrl ? ` Cancel: ${cancelUrl}` : ''}`)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}
