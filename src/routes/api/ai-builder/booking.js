// Booking engine — OWNER management API (registered with [billingAuth,
// projectAccess] like blog/store routes).
//
//   GET    /api/ai-builder/:project_id/booking/services            list (all)
//   POST   /api/ai-builder/:project_id/booking/services            create (cap)
//   PUT    /api/ai-builder/:project_id/booking/services/:sid       update
//   DELETE /api/ai-builder/:project_id/booking/services/:sid       delete
//   PUT    /api/ai-builder/:project_id/booking/hours               replace weekly schedule
//   POST   /api/ai-builder/:project_id/booking/overrides           add/replace a date override
//   DELETE /api/ai-builder/:project_id/booking/overrides/:oid      remove
//   PUT    /api/ai-builder/:project_id/booking/settings            timezone/lead/max/step
//   POST   /api/ai-builder/:project_id/booking/:booking_id/cancel  owner cancel (emails visitor)
//
// Service-count cap: BOOKING_SERVICE_LIMITS per tier (free-with-caps model),
// enforced in production only (limitsDisabled), 402 + billing_url like other
// gates so the UI can show the upgrade prompt.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getOrCreateConfig } from './store.js';
import { updateWebsiteConfigById } from '../../../db/ai-config.js';
import {
  getServices, getServiceById, countServices, createService, updateService, deleteService,
  replaceHours, upsertOverride, deleteOverride, addHolidayOverrides, getBookingById, cancelBookingById,
} from '../../../db/bookings.js';
import { upcomingHolidays, HOLIDAY_COUNTRIES } from '../../../utils/booking-holidays.js';
import { BOOKING_NOTIFY_PLATFORMS, notifyBookingEvent, refundCancelledBooking } from '../../../utils/booking-notify.js';
import {
  parseBookingSettings, isValidTimezone, isValidDateStr, minutesLabel, nowInTimezone, DEFAULT_SETTINGS,
} from '../../../utils/booking-slots.js';
import { sendBookingVisitorEmail } from '../../../utils/email.js';
import { getUserTier, limitsDisabled } from '../../../utils/rate-limiter.js';
import { BOOKING_SERVICE_LIMITS, CREDIT_COSTS, canAfford, chargeCredits, formatCreditError } from '../../../utils/credits.js';
import { callWorkersAI } from '../../../utils/ai-content-generator.js';
import { audit } from '../../../utils/audit.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resolve :project_id (ai-first) to { projectKey, email, name, industry, language }. */
async function resolveProject(env, project_id) {
  const ai = await getAIProjectByProjectId(env.DB, project_id);
  if (ai) {
    return {
      projectKey: { aiProjectId: ai.id }, email: ai.customer_email,
      name: ai.project_name || 'My Website', industry: ai.industry || '', language: ai.language || 'en',
    };
  }
  const rp = await getProjectByPreviewId(env.DB, project_id);
  if (rp) {
    let name = rp.website_url || 'My Website';
    let industry = '';
    try {
      const p = JSON.parse(rp.company_profile_json || '{}');
      if (p && p.name) name = p.name;
      if (p && p.category) industry = p.category;
    } catch { /* ignore */ }
    return { projectKey: { projectId: rp.id }, email: rp.customer_email, name, industry, language: rp.language || 'en' };
  }
  return null;
}

const clampInt = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? dflt : Math.min(max, Math.max(min, n));
};

/**
 * The "require payment at booking" toggle needs: a price, Stripe connected,
 * and Starter+ (paid plans sell — same gate as store products; bypassed in
 * preview via limitsDisabled). Returns a Response to short-circuit, or null.
 */
async function paidToggleGate(env, r, fields) {
  if (!fields.require_payment) return null;
  if (!fields.price_cents || fields.price_cents <= 0) {
    return json({ success: false, error: 'Set a price to require payment at booking.' }, 400);
  }
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  if (!config.stripe_account_id) {
    return json({ success: false, error: 'Connect Stripe first (Store page → Connect Stripe), then enable paid bookings.' }, 400);
  }
  if (!limitsDisabled(env)) {
    const tier = await getUserTier(env.DB, r.email);
    if (tier === 'free_trial') {
      return json({
        success: false,
        error: 'Paid bookings are available on paid plans.',
        upgrade_message: 'Upgrade to Starter or higher to charge for bookings.',
        billing_url: '/billing',
      }, 402);
    }
  }
  return null;
}

/** Validate a service payload from the manager form. */
function serviceFields(body) {
  const name = String(body.name || '').trim().slice(0, 120);
  if (!name) return { error: 'Give the service a name.' };
  const out = {
    name,
    description: String(body.description || '').trim().slice(0, 500) || null,
    duration_min: clampInt(body.duration_min, 5, 12 * 60, 30),
    buffer_min: clampInt(body.buffer_min, 0, 4 * 60, 0),
    active: body.active === false || body.active === 0 ? 0 : 1,
    sort_order: clampInt(body.sort_order, 0, 9999, 0),
  };
  const price = body.price_cents != null && body.price_cents !== '' ? clampInt(body.price_cents, 0, 100000000, null) : null;
  out.price_cents = price;
  out.currency = price != null ? (String(body.currency || 'usd').toLowerCase().slice(0, 3) || 'usd') : null;
  // Paid bookings: visitors pay this price in Stripe Checkout before the slot
  // confirms (gated in paidToggleGate — price + Stripe connected + Starter+).
  out.require_payment = body.require_payment ? 1 : 0;
  return { fields: out };
}

export async function handleBookingServiceList(ctx) {
  const { env, params } = ctx;
  const r = await resolveProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const services = await getServices(env.DB, r.projectKey);
  return json({ success: true, services });
}

export async function handleBookingServiceCreate(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);

    if (!limitsDisabled(env)) {
      const tier = await getUserTier(env.DB, r.email);
      const cap = BOOKING_SERVICE_LIMITS[tier] != null ? BOOKING_SERVICE_LIMITS[tier] : BOOKING_SERVICE_LIMITS.free_trial;
      if (Number.isFinite(cap) && (await countServices(env.DB, r.projectKey)) >= cap) {
        return json({
          success: false,
          error: `Your plan includes ${cap} service type${cap === 1 ? '' : 's'}.`,
          upgrade_message: 'Upgrade to add more bookable services.',
          billing_url: '/billing',
        }, 402);
      }
    }

    const body = await request.json().catch(() => ({}));
    const v = serviceFields(body);
    if (v.error) return json({ success: false, error: v.error }, 400);
    const gate = await paidToggleGate(env, r, v.fields);
    if (gate) return gate;
    const id = await createService(env.DB, r.projectKey, v.fields);
    audit(ctx, 'booking.service_create', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, resourceName: v.fields.name });
    return json({ success: true, id });
  } catch (e) {
    console.error('booking service create error:', e);
    return json({ success: false, error: 'Could not save the service.' }, 500);
  }
}

export async function handleBookingServiceUpdate(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const v = serviceFields(body);
    if (v.error) return json({ success: false, error: v.error }, 400);
    const gate = await paidToggleGate(env, r, v.fields);
    if (gate) return gate;
    const okay = await updateService(env.DB, r.projectKey, parseInt(params.service_id, 10), v.fields);
    if (!okay) return json({ success: false, error: 'Service not found' }, 404);
    return json({ success: true });
  } catch (e) {
    console.error('booking service update error:', e);
    return json({ success: false, error: 'Could not save the service.' }, 500);
  }
}

export async function handleBookingServiceDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const okay = await deleteService(env.DB, r.projectKey, parseInt(params.service_id, 10));
  if (!okay) return json({ success: false, error: 'Service not found' }, 404);
  return json({ success: true });
}

const DESC_LANGS = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

/**
 * POST /booking/services/describe  { name } — AI writes a 1-2 sentence service
 * description in the site language (CREDIT_COSTS.product_desc, charged on
 * success). Returns { description }; the manager fills the field, the owner
 * edits freely and saves as usual.
 */
export async function handleBookingServiceDescribe(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const svcName = String(body.name || '').trim().slice(0, 120);
    if (!svcName) return json({ success: false, error: 'Give the service a name first.' }, 400);

    const afford = await canAfford(env, env.DB, r.email, CREDIT_COSTS.product_desc);
    if (!afford.ok) return json({ ...formatCreditError(afford.state, 'service descriptions') }, 402);

    const langName = DESC_LANGS[r.language] || 'English';
    const prompt = `Write a short, inviting description (1-2 sentences, max 220 characters, in ${langName}) for this bookable service offered by "${r.name}"${r.industry ? ` (${r.industry})` : ''}: "${svcName}". Speak to the customer, mention the benefit, no quotes, no price, no emoji.`;
    const raw = await callWorkersAI(env, prompt, { max_tokens: 120, temperature: 0.6, system_message: 'You write crisp service descriptions for small-business booking pages.' });
    const description = String(raw || '').replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!description) return json({ success: false, error: 'The AI came back empty — please try again (you were not charged).' }, 502);

    await chargeCredits(env, env.DB, r.email, CREDIT_COSTS.product_desc);
    audit(ctx, 'credit.booking_desc', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, metadata: { credits: CREDIT_COSTS.product_desc, service: svcName } });
    return json({ success: true, description });
  } catch (e) {
    console.error('booking describe error:', e);
    return json({ success: false, error: 'Could not write the description.' }, 500);
  }
}

/** PUT hours — body { windows: [{weekday, start_min, end_min}] } replaces all. */
export async function handleBookingHoursSave(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const raw = Array.isArray(body.windows) ? body.windows.slice(0, 50) : [];
    const rows = [];
    for (const w of raw) {
      const weekday = clampInt(w.weekday, 0, 6, -1);
      const start = clampInt(w.start_min, 0, 1439, -1);
      const end = clampInt(w.end_min, 1, 1440, -1);
      if (weekday < 0 || start < 0 || end < 0) return json({ success: false, error: 'Invalid window.' }, 400);
      if (end <= start) return json({ success: false, error: `End must be after start (${minutesLabel(start)}–${minutesLabel(end)}).` }, 400);
      rows.push({ weekday, start_min: start, end_min: end });
    }
    await replaceHours(env.DB, r.projectKey, rows);
    return json({ success: true });
  } catch (e) {
    console.error('booking hours error:', e);
    return json({ success: false, error: 'Could not save your hours.' }, 500);
  }
}

/** POST overrides — { date, closed } or { date, closed:false, start_min, end_min }. */
export async function handleBookingOverrideSave(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const date = String(body.date || '');
    if (!isValidDateStr(date)) return json({ success: false, error: 'Pick a valid date.' }, 400);
    const closed = !(body.closed === false || body.closed === 0);
    let start = null;
    let end = null;
    if (!closed) {
      start = clampInt(body.start_min, 0, 1439, -1);
      end = clampInt(body.end_min, 1, 1440, -1);
      if (start < 0 || end < 0 || end <= start) return json({ success: false, error: 'End must be after start.' }, 400);
    }
    await upsertOverride(env.DB, r.projectKey, { date, closed, start_min: start, end_min: end });
    return json({ success: true });
  } catch (e) {
    console.error('booking override error:', e);
    return json({ success: false, error: 'Could not save the override.' }, 500);
  }
}

export async function handleBookingOverrideDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const okay = await deleteOverride(env.DB, r.projectKey, parseInt(params.override_id, 10));
  if (!okay) return json({ success: false, error: 'Override not found' }, 404);
  return json({ success: true });
}

/**
 * POST /booking/holidays  { country } — one-click closed-date overrides for the
 * country's major holidays, from today (owner tz) through the end of NEXT
 * year. Dates that already have an override are skipped (owner's custom days
 * win); every inserted row is individually deletable like any override.
 */
export async function handleBookingHolidaysAdd(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const country = String(body.country || '').toUpperCase();
    if (!HOLIDAY_COUNTRIES.includes(country)) return json({ success: false, error: 'Pick a country.' }, 400);

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    const settings = parseBookingSettings(config);
    const today = nowInTimezone(settings.timezone).date;
    const added = await addHolidayOverrides(env.DB, r.projectKey, upcomingHolidays(country, today));
    audit(ctx, 'booking.holidays_add', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, metadata: { country, added } });
    return json({ success: true, added });
  } catch (e) {
    console.error('booking holidays error:', e);
    return json({ success: false, error: 'Could not add the holidays.' }, 500);
  }
}

/** PUT settings — { timezone, lead_time_min, max_per_day, slot_step, horizon_days }. */
export async function handleBookingSettingsSave(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const tz = String(body.timezone || '').trim();
    if (tz && !isValidTimezone(tz)) return json({ success: false, error: 'That timezone is not a valid IANA name (e.g. America/New_York).' }, 400);
    const next = {
      timezone: tz || DEFAULT_SETTINGS.timezone,
      lead_time_min: clampInt(body.lead_time_min, 0, 7 * 24 * 60, DEFAULT_SETTINGS.lead_time_min),
      max_per_day: clampInt(body.max_per_day, 0, 200, 0),
      slot_step: [0, 15, 30, 60].includes(Number(body.slot_step)) ? Number(body.slot_step) : 0,
      horizon_days: clampInt(body.horizon_days, 1, 365, DEFAULT_SETTINGS.horizon_days),
      notify_platforms: (Array.isArray(body.notify_platforms) ? body.notify_platforms : [])
        .filter((p) => BOOKING_NOTIFY_PLATFORMS.includes(p)),
      cancel_cutoff_min: clampInt(body.cancel_cutoff_min, 0, 7 * 24 * 60, 0),
    };
    const config = await getOrCreateConfig(env.DB, r.projectKey);
    await updateWebsiteConfigById(env.DB, config.id, { booking_settings_json: JSON.stringify(next) });
    return json({ success: true, settings: next });
  } catch (e) {
    console.error('booking settings error:', e);
    return json({ success: false, error: 'Could not save your settings.' }, 500);
  }
}

/** POST :booking_id/cancel — owner cancels; visitor gets the cancellation email. */
export async function handleBookingOwnerCancel(ctx) {
  const { env, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const id = parseInt(params.booking_id, 10);
    const booking = await getBookingById(env.DB, r.projectKey, id);
    if (!booking) return json({ success: false, error: 'Booking not found' }, 404);
    if (booking.status !== 'confirmed') return json({ success: false, error: 'Already cancelled.' }, 400);

    await cancelBookingById(env.DB, r.projectKey, id);
    audit(ctx, 'booking.cancelled', {
      teamOwner: r.email, resourceType: 'site', resourceId: params.project_id,
      metadata: { booking_id: id, by: 'owner' },
    });

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    const settings = parseBookingSettings(config);
    const service = await getServiceById(env.DB, r.projectKey, booking.service_id);
    const refund = await refundCancelledBooking(env, { booking, config });
    const work = Promise.allSettled([
      sendBookingVisitorEmail(env, {
        to: booking.customer_email, siteName: r.name, serviceName: (service && service.name) || '',
        dateLabel: booking.date, timeLabel: minutesLabel(booking.start_min), tz: settings.timezone, cancelled: true, refund,
      }),
      notifyBookingEvent(env, {
        config, settings, siteName: r.name, publicId: params.project_id,
        booking, serviceName: (service && service.name) || '', cancelled: true,
      }),
    ]);
    if (ctx.ctx && ctx.ctx.waitUntil) ctx.ctx.waitUntil(work);
    else await work;
    return json({ success: true });
  } catch (e) {
    console.error('booking owner cancel error:', e);
    return json({ success: false, error: 'Could not cancel the booking.' }, 500);
  }
}
