// Scheduled holiday color skins — the safest possible "holiday theme": ONLY
// primary/secondary colors change (works with every template/variant, no
// dark-mode brittleness), the prior colors are saved for the revert, and the
// daily cron republishes the static site on both transitions. Windows are
// calendar dates (UTC) — a day of skew at the edges is fine for decor.

import { easterDate } from './booking-holidays.js';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

function easterYmd(year, offsetDays) {
  const e = easterDate(year);
  const t = new Date(Date.UTC(year, e.month - 1, e.day, 12));
  t.setUTCDate(t.getUTCDate() + offsetDays);
  return t.toISOString().slice(0, 10);
}

// Each skin: label (for the UI), colors, and the [start, end] window for a year.
export const HOLIDAY_SKINS = {
  christmas: {
    emoji: '🎄', key: 'christmas',
    colors: { primary: '#b3252f', secondary: '#1e6b40' },
    window: (y) => [ymd(y, 12, 18), ymd(y, 12, 27)],
  },
  halloween: {
    emoji: '🎃', key: 'halloween',
    colors: { primary: '#e67e22', secondary: '#4a235a' },
    window: (y) => [ymd(y, 10, 24), ymd(y, 11, 1)],
  },
  valentines: {
    emoji: '💝', key: 'valentines',
    colors: { primary: '#d6336c', secondary: '#862e9c' },
    window: (y) => [ymd(y, 2, 7), ymd(y, 2, 15)],
  },
  july4: {
    emoji: '🇺🇸', key: 'july4',
    colors: { primary: '#b22234', secondary: '#3c3b6e' },
    window: (y) => [ymd(y, 6, 28), ymd(y, 7, 5)],
  },
  easter: {
    emoji: '🐣', key: 'easter',
    colors: { primary: '#8e7cc3', secondary: '#5a9a68' },
    window: (y) => [easterYmd(y, -7), easterYmd(y, 1)],
  },
};

export const HOLIDAY_KEYS = Object.keys(HOLIDAY_SKINS);

/** Parse holiday_themes_json off a config row (safe). */
export function parseHolidaySettings(config) {
  let raw = {};
  try { raw = JSON.parse((config && config.holiday_themes_json) || '{}') || {}; } catch { /* ignore */ }
  return {
    enabled: !!raw.enabled,
    holidays: (Array.isArray(raw.holidays) ? raw.holidays : []).filter((h) => HOLIDAY_KEYS.includes(h)),
    decor: raw.decor !== false, // animated decorations (Santa flyby…) — default ON
    applied: raw.applied && HOLIDAY_KEYS.includes(raw.applied.holiday) ? raw.applied : null,
  };
}

/** Which SELECTED holiday is active on dateStr (YYYY-MM-DD)? First match wins. */
export function activeHoliday(dateStr, selected) {
  const year = parseInt(String(dateStr).slice(0, 4), 10);
  for (const key of selected || []) {
    const skin = HOLIDAY_SKINS[key];
    if (!skin) continue;
    // Check this year's and last year's window (windows never span years today,
    // but the check is cheap and future-proofs a New Year's skin).
    for (const y of [year, year - 1]) {
      const [start, end] = skin.window(y);
      if (dateStr >= start && dateStr <= end) return key;
    }
  }
  return null;
}

/** Is the given APPLIED holiday's window over on dateStr? */
export function holidayWindowOver(key, dateStr) {
  const skin = HOLIDAY_SKINS[key];
  if (!skin) return true;
  const year = parseInt(String(dateStr).slice(0, 4), 10);
  for (const y of [year, year - 1]) {
    const [start, end] = skin.window(y);
    if (dateStr >= start && dateStr <= end) return false;
  }
  return true;
}
