// Public booking-cancel page (tokenized, like /team/accept/:token).
//   GET  /booking/cancel/:token   show the booking + a confirm button
//   POST /booking/cancel/:token   cancel it, notify owner + visitor
// The token is the only credential — it was emailed to the visitor with their
// confirmation, is unguessable (24 random bytes), and cancelling is the only
// thing it can do.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getBookingByToken, cancelBookingByToken } from '../../db/bookings.js';
import { getAIProjectById } from '../../db/ai-projects.js';
import { getProjectById } from '../../db/projects.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { parseBookingSettings, minutesLabel } from '../../utils/booking-slots.js';
import { sendBookingVisitorEmail, sendBookingOwnerEmail } from '../../utils/email.js';
import { notifyBookingEvent, refundCancelledBooking } from '../../utils/booking-notify.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Owner identity + site name + timezone for a booking row (also used by the
 *  reminder cron in routes/api/bookings-remind.js). */
export async function siteForBooking(db, booking) {
  if (booking.ai_project_id != null) {
    const p = await getAIProjectById(db, booking.ai_project_id);
    if (!p) return null;
    const config = await getWebsiteConfigByAIProjectId(db, p.id);
    return {
      siteName: p.project_name || 'Your website',
      ownerEmail: p.customer_email,
      notifyEmail: (config && config.notify_email) || p.customer_email,
      publicId: p.project_id,
      settings: parseBookingSettings(config),
      config,
    };
  }
  const p = await getProjectById(db, booking.project_id);
  if (!p) return null;
  let name = p.website_url || 'Your website';
  try { const prof = JSON.parse(p.company_profile_json || '{}'); if (prof && prof.name) name = prof.name; } catch { /* ignore */ }
  const config = await getWebsiteConfigByRegularProjectId(db, p.id);
  return {
    siteName: name,
    ownerEmail: p.customer_email,
    notifyEmail: (config && config.notify_email) || p.customer_email,
    publicId: p.preview_id,
    settings: parseBookingSettings(config),
    config,
  };
}

function page(ctx, tr, title, bodyHtml) {
  const lang = ctx.lang || 'en';
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
${headTags({ title: `${title} — Caddisfly`, description: title, path: '/booking/cancel' })}
<style>${baseCss()}
.bkc-wrap { max-width: 520px; margin: 60px auto; padding: 0 20px; }
.bkc-card { background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 14px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,.06); }
.bkc-card h1 { font-size: 1.4rem; margin-bottom: .8rem; }
.bkc-meta { font-size: 1.05rem; color: #1a202c; font-weight: 700; margin: .8rem 0; }
.bkc-muted { color: #667085; line-height: 1.6; }
.bkc-btn { display: inline-block; margin-top: 1.2rem; background: #fff; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 9px; padding: .65rem 1.4rem; font-weight: 700; cursor: pointer; font-size: 1rem; }
.bkc-btn:hover { background: #fef2f2; }
</style>
</head>
<body>
${siteHeader('', { lang })}
<div class="bkc-wrap"><div class="bkc-card">${bodyHtml}</div></div>
${siteFooter({ lang })}
</body></html>`;
  return htmlResponse(html);
}

export async function handleBookingCancelPage(ctx) {
  const { env, params } = ctx;
  const tr = translator(ctx.lang || 'en');
  const booking = await getBookingByToken(env.DB, params.token || '');
  if (!booking) {
    return page(ctx, tr, tr('bkc.title'), `<h1>${tr('bkc.not_found_title')}</h1><p class="bkc-muted">${tr('bkc.not_found')}</p>`);
  }
  const when = `${esc(booking.date)} · ${minutesLabel(booking.start_min)}`;
  if (booking.status !== 'confirmed') {
    return page(ctx, tr, tr('bkc.title'), `<h1>${tr('bkc.already_title')}</h1>
      <p class="bkc-meta">${esc(booking.service_name || '')} — ${when}</p>
      <p class="bkc-muted">${tr('bkc.already')}</p>`);
  }
  return page(ctx, tr, tr('bkc.title'), `<h1>${tr('bkc.title')}</h1>
    <p class="bkc-meta">${esc(booking.service_name || '')} — ${when}</p>
    <p class="bkc-muted">${tr('bkc.confirm_note')}</p>
    <form method="POST"><button class="bkc-btn" type="submit">${tr('bkc.confirm_btn')}</button></form>`);
}

export async function handleBookingCancelAction(ctx) {
  const { env, params } = ctx;
  const tr = translator(ctx.lang || 'en');
  const booking = await cancelBookingByToken(env.DB, params.token || '');
  if (!booking) {
    // Token bad OR already cancelled — re-render the GET view either way.
    return handleBookingCancelPage(ctx);
  }
  const site = await siteForBooking(env.DB, booking);
  if (site) {
    const dateLabel = booking.date;
    const timeLabel = minutesLabel(booking.start_min);
    const appOrigin = env.APP_URL || 'https://caddisfly.ai';
    // Paid booking → auto-refund BEFORE the emails so they can say so.
    const refund = await refundCancelledBooking(env, { booking, config: site.config });
    const work = Promise.allSettled([
      sendBookingVisitorEmail(env, {
        to: booking.customer_email, siteName: site.siteName, serviceName: booking.service_name || '',
        dateLabel, timeLabel, tz: site.settings.timezone, cancelled: true, refund,
      }),
      sendBookingOwnerEmail(env, {
        to: site.notifyEmail, siteName: site.siteName, serviceName: booking.service_name || '',
        customerName: booking.customer_name, customerEmail: booking.customer_email,
        dateLabel, timeLabel, note: '', cancelled: true,
        manageUrl: site.publicId ? `${appOrigin}/ai-builder/bookings/${site.publicId}` : '',
      }),
      notifyBookingEvent(env, {
        config: site.config, settings: site.settings, siteName: site.siteName, publicId: site.publicId,
        booking, serviceName: booking.service_name || '', cancelled: true,
      }),
    ]);
    if (ctx.ctx && ctx.ctx.waitUntil) ctx.ctx.waitUntil(work);
    else await work;
  }
  return page(ctx, tr, tr('bkc.title'), `<h1>${tr('bkc.done_title')}</h1>
    <p class="bkc-meta">${esc(booking.service_name || '')} — ${esc(booking.date)} · ${minutesLabel(booking.start_min)}</p>
    <p class="bkc-muted">${tr('bkc.done')}</p>`);
}
