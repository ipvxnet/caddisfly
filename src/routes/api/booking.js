// Booking engine — PUBLIC API for the booking widget on published sites.
// Like /api/forms/submit and /api/track, these endpoints are called
// cross-origin from customer sites (the sites worker is DB-free); CORS is
// applied globally in index.js.
//
//   GET  /api/booking/:project_id/services       active services + settings
//   GET  /api/booking/:project_id/slots          ?service_id=&from=&days=
//   POST /api/booking/:project_id/book           claim a slot (atomic)
//
// The booking POST NEVER trusts the client's slot: availability is recomputed
// server-side for the requested date and the start must be in it, then the
// atomic claim in db/bookings.js settles any remaining race.
//
// Spam guards (bypassed in preview via limitsDisabled): honeypot, per-email
// 3 bookings/day, per-site 50 created/day, plus the per-tier monthly cap
// (BOOKING_MONTHLY_LIMITS — bookings are free-with-caps on every tier).

import { jsonResponse } from '../../utils/response.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import {
  getServices, getServiceById, getHours, getOverrides, getBookingsInRange,
  claimBooking, countBookingsInMonth, countBookingsCreatedSince, countBookingsByEmailSince,
} from '../../db/bookings.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import {
  parseBookingSettings, nowInTimezone, slotsForDate, slotsForRange, addDays,
  isValidDateStr, minutesLabel,
} from '../../utils/booking-slots.js';
import { sendBookingVisitorEmail, sendBookingOwnerEmail, isValidEmail } from '../../utils/email.js';
import { getUserTier, limitsDisabled } from '../../utils/rate-limiter.js';
import { BOOKING_MONTHLY_LIMITS } from '../../utils/credits.js';
import { generateToken } from '../../utils/crypto.js';
import { audit } from '../../utils/audit.js';
import { t } from '../../i18n/index.js';

const PUBLIC_ID_RE = /^[a-f0-9-]{8,64}$/i;
const EMAIL_DAILY_CAP = 3;    // bookings per visitor email per day
const SITE_DAILY_CAP = 50;    // bookings created per site per day
const MAX_RANGE_DAYS = 31;

/** Resolve a site by public id (ai-first), with config + owner identity. */
async function resolveSite(db, publicId) {
  if (!PUBLIC_ID_RE.test(publicId || '')) return null;
  const aiProject = await getAIProjectByProjectId(db, publicId);
  if (aiProject) {
    const config = await getWebsiteConfigByAIProjectId(db, aiProject.id);
    return {
      ownerEmail: aiProject.customer_email,
      notifyEmail: (config && config.notify_email) || aiProject.customer_email,
      siteName: aiProject.project_name || 'Your website',
      projectKey: { aiProjectId: aiProject.id },
      config,
    };
  }
  const rp = await getProjectByPreviewId(db, publicId);
  if (rp) {
    let name = rp.website_url || 'Your website';
    try {
      const p = JSON.parse(rp.company_profile_json || '{}');
      if (p && p.name) name = p.name;
    } catch { /* ignore */ }
    const config = await getWebsiteConfigByRegularProjectId(db, rp.id);
    return {
      ownerEmail: rp.customer_email,
      notifyEmail: (config && config.notify_email) || rp.customer_email,
      siteName: name,
      projectKey: { projectId: rp.id },
      config,
    };
  }
  return null;
}

/** Public shape of a service row (no internal flags). */
function publicService(s) {
  return {
    id: s.id, name: s.name, description: s.description || '',
    duration_min: s.duration_min,
    price_cents: s.price_cents != null ? s.price_cents : null,
    currency: s.currency || null,
  };
}

/** GET /api/booking/:project_id/services */
export async function handleBookingServices(ctx) {
  const { env, params } = ctx;
  try {
    const site = await resolveSite(env.DB, params.project_id);
    if (!site) return jsonResponse({ success: false, error: 'Unknown site' }, 404);
    const services = (await getServices(env.DB, site.projectKey, { activeOnly: true })).map(publicService);
    const settings = parseBookingSettings(site.config);
    return jsonResponse({
      success: true,
      services,
      timezone: settings.timezone,
      horizon_days: settings.horizon_days,
    });
  } catch (e) {
    console.error('booking services error:', e);
    return jsonResponse({ success: false, error: 'Something went wrong' }, 500);
  }
}

/** GET /api/booking/:project_id/slots?service_id=&from=YYYY-MM-DD&days=7 */
export async function handleBookingSlots(ctx) {
  const { env, params, url } = ctx;
  try {
    const site = await resolveSite(env.DB, params.project_id);
    if (!site) return jsonResponse({ success: false, error: 'Unknown site' }, 404);

    const serviceId = parseInt(url.searchParams.get('service_id'), 10);
    const service = serviceId ? await getServiceById(env.DB, site.projectKey, serviceId) : null;
    if (!service || !service.active) return jsonResponse({ success: false, error: 'Unknown service' }, 404);

    const settings = parseBookingSettings(site.config);
    const now = nowInTimezone(settings.timezone);
    let from = url.searchParams.get('from') || now.date;
    if (!isValidDateStr(from) || from < now.date) from = now.date;
    const days = Math.min(MAX_RANGE_DAYS, Math.max(1, parseInt(url.searchParams.get('days'), 10) || 7));

    const toDate = addDays(from, days - 1);
    const [hours, overrides, bookings] = await Promise.all([
      getHours(env.DB, site.projectKey),
      getOverrides(env.DB, site.projectKey, { fromDate: from }),
      getBookingsInRange(env.DB, site.projectKey, from, toDate),
    ]);

    const range = slotsForRange({ fromDate: from, days, service, hours, overrides, bookings, settings, now });
    return jsonResponse({
      success: true,
      timezone: settings.timezone,
      days: range.map((d) => ({
        date: d.date,
        slots: d.slots.map((s) => ({ start_min: s.start_min, label: minutesLabel(s.start_min) })),
      })),
    });
  } catch (e) {
    console.error('booking slots error:', e);
    return jsonResponse({ success: false, error: 'Something went wrong' }, 500);
  }
}

/** POST /api/booking/:project_id/book */
export async function handleBookingCreate(ctx) {
  const { env, request, params } = ctx;
  try {
    const site = await resolveSite(env.DB, params.project_id);
    if (!site) return jsonResponse({ success: false, error: 'Unknown site' }, 404);

    const body = await request.json().catch(() => ({}));

    // Honeypot: silent success, nothing stored.
    if ((body.hp || '').toString().trim() !== '') return jsonResponse({ success: true });

    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 320);
    const note = String(body.note || '').trim().slice(0, 500);
    const date = String(body.date || '');
    const startMin = parseInt(body.start_min, 10);
    const serviceId = parseInt(body.service_id, 10);
    const visitorTz = String(body.tz || '').slice(0, 64);
    if (!name || !isValidEmail(email) || !isValidDateStr(date) || Number.isNaN(startMin) || !serviceId) {
      return jsonResponse({ success: false, error: t(ctx.lang, 'bkw.err_fields') }, 400);
    }

    const service = await getServiceById(env.DB, site.projectKey, serviceId);
    if (!service || !service.active) return jsonResponse({ success: false, error: 'Unknown service' }, 404);

    // Spam + tier caps (production only).
    if (!limitsDisabled(env)) {
      const dayAgo = Math.floor(Date.now() / 1000) - 86400;
      if (await countBookingsByEmailSince(env.DB, site.projectKey, email, dayAgo) >= EMAIL_DAILY_CAP
        || await countBookingsCreatedSince(env.DB, site.projectKey, dayAgo) >= SITE_DAILY_CAP) {
        return jsonResponse({ success: false, error: t(ctx.lang, 'bkw.err_rate') }, 429);
      }
      const tier = await getUserTier(env.DB, site.ownerEmail);
      const cap = BOOKING_MONTHLY_LIMITS[tier] != null ? BOOKING_MONTHLY_LIMITS[tier] : BOOKING_MONTHLY_LIMITS.free_trial;
      if (Number.isFinite(cap) && (await countBookingsInMonth(env.DB, site.projectKey, date.slice(0, 7))) >= cap) {
        // The visitor can't fix this — phrase it as fully-booked, not billing.
        return jsonResponse({ success: false, error: t(ctx.lang, 'bkw.err_full') }, 409);
      }
    }

    // Server-side revalidation: the requested start must be an available slot.
    const settings = parseBookingSettings(site.config);
    const now = nowInTimezone(settings.timezone);
    const [hours, overrides, bookings] = await Promise.all([
      getHours(env.DB, site.projectKey),
      getOverrides(env.DB, site.projectKey, { fromDate: date }),
      getBookingsInRange(env.DB, site.projectKey, date, date),
    ]);
    const valid = slotsForDate({ date, service, hours, overrides, bookings, settings, now });
    const slot = valid.find((s) => s.start_min === startMin);
    if (!slot) return jsonResponse({ success: false, error: t(ctx.lang, 'bkw.err_taken') }, 409);

    const cancelToken = generateToken(24);
    const claimed = await claimBooking(env.DB, site.projectKey, {
      service_id: service.id, customer_name: name, customer_email: email, note,
      date, start_min: slot.start_min, end_min: slot.end_min,
      cancel_token: cancelToken, visitor_tz: visitorTz,
    });
    if (!claimed) return jsonResponse({ success: false, error: t(ctx.lang, 'bkw.err_taken') }, 409);

    audit(ctx, 'booking.created', {
      actor: email, teamOwner: site.ownerEmail, resourceType: 'site', resourceId: params.project_id,
      resourceName: site.siteName, metadata: { service: service.name, date, start_min: slot.start_min },
    });

    // Emails off the response path — the booking is already safe in D1.
    const appOrigin = env.APP_URL || 'https://caddisfly.ai';
    const dateLabel = date;
    const timeLabel = minutesLabel(slot.start_min);
    const emailWork = Promise.allSettled([
      sendBookingVisitorEmail(env, {
        to: email, siteName: site.siteName, serviceName: service.name,
        dateLabel, timeLabel, tz: settings.timezone,
        cancelUrl: `${appOrigin}/booking/cancel/${cancelToken}`,
      }),
      sendBookingOwnerEmail(env, {
        to: site.notifyEmail, siteName: site.siteName, serviceName: service.name,
        customerName: name, customerEmail: email, dateLabel, timeLabel, note,
        manageUrl: `${appOrigin}/ai-builder/bookings/${params.project_id}`,
      }),
    ]);
    if (ctx.ctx && ctx.ctx.waitUntil) ctx.ctx.waitUntil(emailWork);
    else await emailWork;

    return jsonResponse({
      success: true,
      booking: { service: service.name, date, start_min: slot.start_min, time: timeLabel, timezone: settings.timezone },
    });
  } catch (e) {
    console.error('booking create error:', e);
    return jsonResponse({ success: false, error: 'Something went wrong' }, 500);
  }
}
