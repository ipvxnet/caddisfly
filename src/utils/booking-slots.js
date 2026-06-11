// Slot computation for the booking engine — pure functions, no DB access.
//
// TIMEZONE MODEL (v1, deliberate): everything is computed and displayed in the
// OWNER's timezone. Caddisfly's segment is local SMBs (salons, dentists,
// restaurants) whose visitors are local too, so showing owner-local times with
// an explicit timezone label sidesteps the DST/visitor-conversion bug class
// entirely. Visitor-timezone display is a later enhancement (visitor_tz is
// already captured on each booking for it).
//
// A "slot" is { start_min, end_min } on a YYYY-MM-DD date: minutes from
// midnight, owner-local. end_min includes the service buffer, so back-to-back
// bookings automatically respect prep/cleanup time.

export const DEFAULT_SETTINGS = {
  timezone: 'America/New_York',
  lead_time_min: 120,   // can't book closer than this to now
  max_per_day: 0,       // 0 = unlimited
  slot_step: 0,         // 0 = step by the service duration
  horizon_days: 60,     // how far ahead visitors can book
};

/** Parse booking_settings_json off a config row (safe, defaults applied). */
export function parseBookingSettings(config) {
  let raw = {};
  try { raw = JSON.parse((config && config.booking_settings_json) || '{}') || {}; } catch { /* ignore */ }
  const s = { ...DEFAULT_SETTINGS, ...raw };
  s.lead_time_min = clampInt(s.lead_time_min, 0, 7 * 24 * 60, DEFAULT_SETTINGS.lead_time_min);
  s.max_per_day = clampInt(s.max_per_day, 0, 200, 0);
  s.slot_step = [0, 15, 30, 60].includes(Number(s.slot_step)) ? Number(s.slot_step) : 0;
  s.horizon_days = clampInt(s.horizon_days, 1, 365, DEFAULT_SETTINGS.horizon_days);
  if (!isValidTimezone(s.timezone)) s.timezone = DEFAULT_SETTINGS.timezone;
  // Booking-notification platforms (validated against the allowed list in
  // booking-notify.js at send/save time; kept verbatim here).
  s.notify_platforms = Array.isArray(s.notify_platforms) ? s.notify_platforms : [];
  return s;
}

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

export function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

/** Current { date: 'YYYY-MM-DD', minutes } in the given timezone. */
export function nowInTimezone(tz, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
  };
}

/** date string + n days → date string. UTC-noon arithmetic dodges DST edges. */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Weekday 0=Sunday … 6=Saturday for a YYYY-MM-DD (calendar date, tz-free). */
export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

export function isValidDateStr(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** 'HH:MM' label for minutes-from-midnight. */
export function minutesLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Available slots for ONE date.
 * @param {object} args
 *   date         YYYY-MM-DD (owner tz)
 *   service      { duration_min, buffer_min }
 *   hours        all booking_hours rows for the project
 *   overrides    booking_overrides rows covering this date (or all)
 *   bookings     confirmed bookings rows for this date (or a range)
 *   settings     parsed booking settings
 *   now          { date, minutes } from nowInTimezone (lead-time anchor)
 * @returns [{ start_min, end_min }]
 */
export function slotsForDate({ date, service, hours, overrides, bookings, settings, now }) {
  const duration = service.duration_min;
  const block = duration + (service.buffer_min || 0);
  const step = settings.slot_step || duration;

  // Past dates / beyond the horizon never have slots.
  if (date < now.date) return [];
  if (date > addDays(now.date, settings.horizon_days)) return [];

  // Windows: a date override replaces the weekly schedule entirely.
  const ovr = (overrides || []).find((o) => o.date === date);
  let windows;
  if (ovr) {
    if (ovr.closed) return [];
    windows = [{ start_min: ovr.start_min, end_min: ovr.end_min }];
  } else {
    const wd = weekdayOf(date);
    windows = (hours || []).filter((h) => h.weekday === wd);
  }
  if (!windows.length) return [];

  const dayBookings = (bookings || []).filter((b) => b.date === date && b.status === 'confirmed');
  if (settings.max_per_day > 0 && dayBookings.length >= settings.max_per_day) return [];

  // Lead time: today's earliest start is now + lead (rounded up to the step).
  let earliest = 0;
  if (date === now.date) {
    earliest = now.minutes + settings.lead_time_min;
  }

  const out = [];
  for (const w of windows) {
    if (w.start_min == null || w.end_min == null || w.end_min <= w.start_min) continue;
    let start = w.start_min;
    if (start < earliest) start = w.start_min + Math.ceil((earliest - w.start_min) / step) * step;
    for (; start + block <= w.end_min; start += step) {
      const end = start + block;
      const clash = dayBookings.some((b) => b.start_min < end && b.end_min > start);
      if (!clash) out.push({ start_min: start, end_min: end });
    }
  }
  out.sort((a, b) => a.start_min - b.start_min);
  return out;
}

/**
 * Slots for a range of days: [{ date, slots: [{start_min, end_min}] }].
 * Caller supplies hours/overrides/bookings covering [fromDate, fromDate+days).
 */
export function slotsForRange({ fromDate, days, service, hours, overrides, bookings, settings, now }) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    out.push({ date, slots: slotsForDate({ date, service, hours, overrides, bookings, settings, now }) });
  }
  return out;
}
