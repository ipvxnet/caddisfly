// GET /booking/feed/:token — the owner's subscribable iCal feed (Google /
// Apple / Outlook "subscribe by URL"). The token is the only credential
// (secret, per-site, rotatable from the booking manager); the feed is
// read-only and contains confirmed bookings from the last 30 days onward.

import { getConfigByIcalToken } from '../../db/ai-config.js';
import { getAIProjectById } from '../../db/ai-projects.js';
import { getProjectById } from '../../db/projects.js';
import { getFeedBookings } from '../../db/bookings.js';
import { parseBookingSettings, nowInTimezone, addDays } from '../../utils/booking-slots.js';
import { bookingsFeedIcs } from '../../utils/booking-ics.js';

const TOKEN_RE = /^[a-f0-9]{24,64}$/;

export async function handleBookingFeed(ctx) {
  const { env, params } = ctx;
  const token = params.token || '';
  if (!TOKEN_RE.test(token)) return new Response('Not found', { status: 404 });

  const config = await getConfigByIcalToken(env.DB, token);
  if (!config) return new Response('Not found', { status: 404 });

  let projectKey = null;
  let siteName = 'Bookings';
  if (config.ai_project_id != null) {
    projectKey = { aiProjectId: config.ai_project_id };
    const p = await getAIProjectById(env.DB, config.ai_project_id);
    if (p) siteName = p.project_name || siteName;
  } else if (config.project_id != null) {
    projectKey = { projectId: config.project_id };
    const p = await getProjectById(env.DB, config.project_id);
    if (p) {
      siteName = p.website_url || siteName;
      try { const prof = JSON.parse(p.company_profile_json || '{}'); if (prof && prof.name) siteName = prof.name; } catch { /* ignore */ }
    }
  }
  if (!projectKey) return new Response('Not found', { status: 404 });

  const settings = parseBookingSettings(config);
  const fromDate = addDays(nowInTimezone(settings.timezone).date, -30);
  const bookings = await getFeedBookings(env.DB, projectKey, fromDate);

  const ics = bookingsFeedIcs({ siteName, timezone: settings.timezone, bookings });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="bookings.ics"',
      'Cache-Control': 'private, max-age=300', // calendar apps poll — keep it light
    },
  });
}
