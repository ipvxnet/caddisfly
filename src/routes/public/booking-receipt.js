// GET /booking/receipt?s=<publicId>&sid=<cs_…> — paid-booking landing page
// after Stripe Checkout (mirrors /store/receipt). Verifies the session on the
// MERCHANT's connected account, binds it to the site, settles the pending
// hold (idempotent — the Connect webhook is the backstop), and renders the
// outcome. ?cancelled=1 renders the "payment not completed" note.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { getStoreCheckoutSession } from '../../utils/stripe.js';
import { settlePaidBooking } from '../api/booking.js';
import { minutesLabel } from '../../utils/booking-slots.js';
import { translator } from '../../i18n/index.js';

const PUBLIC_ID_RE = /^[a-f0-9-]{8,64}$/i;
const SESSION_ID_RE = /^cs_[a-zA-Z0-9_]{10,250}$/;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(ctx, title, bodyHtml) {
  const lang = ctx.lang || 'en';
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
${headTags({ title: `${title} — Caddisfly`, description: title, path: '/booking/receipt' })}
<style>${baseCss()}
.bkr-wrap { max-width: 520px; margin: 60px auto; padding: 0 20px; }
.bkr-card { background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 14px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,.06); }
.bkr-card h1 { font-size: 1.4rem; margin-bottom: .8rem; }
.bkr-meta { font-size: 1.05rem; color: #1a202c; font-weight: 700; margin: .8rem 0; }
.bkr-muted { color: #667085; line-height: 1.6; }
.bkr-ok { color: #065f46; }
.bkr-back { display: inline-block; background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; text-decoration: none; padding: .65rem 1.3rem; border-radius: 9px; font-weight: 700; }
</style>
</head>
<body>
${siteHeader('', { lang })}
<div class="bkr-wrap"><div class="bkr-card">${bodyHtml}</div></div>
${siteFooter({ lang })}
</body></html>`;
  return htmlResponse(html);
}

export async function handleBookingReceipt(ctx) {
  const { env, query } = ctx;
  const tr = translator(ctx.lang || 'en');
  const publicId = (query && query.s) || '';
  const sid = (query && query.sid) || '';

  if (query && (query.cancelled === '1' || query.bk_cancelled === '1')) {
    return page(ctx, tr('bkr.title'), `<h1>${tr('bkr.cancelled_title')}</h1><p class="bkr-muted">${tr('bkr.cancelled')}</p>`);
  }
  if (!PUBLIC_ID_RE.test(publicId) || !SESSION_ID_RE.test(sid)) {
    return page(ctx, tr('bkr.title'), `<h1>${tr('bkr.missing_title')}</h1><p class="bkr-muted">${tr('bkr.missing')}</p>`);
  }

  // Resolve the merchant's connected account + display name for this site.
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  let config = null;
  let siteName = '';
  if (ai) {
    config = await getWebsiteConfigByAIProjectId(env.DB, ai.id);
    siteName = ai.project_name || '';
  } else {
    const rp = await getProjectByPreviewId(env.DB, publicId);
    if (rp) {
      config = await getWebsiteConfigByRegularProjectId(env.DB, rp.id);
      siteName = rp.website_url || '';
      try { const p = JSON.parse(rp.company_profile_json || '{}'); if (p && p.name) siteName = p.name; } catch { /* ignore */ }
    }
  }
  if (!config || !config.stripe_account_id) {
    return page(ctx, tr('bkr.title'), `<h1>${tr('bkr.missing_title')}</h1><p class="bkr-muted">${tr('bkr.missing')}</p>`);
  }

  let session;
  try {
    session = await getStoreCheckoutSession(env, config.stripe_account_id, sid);
  } catch (e) {
    console.error('booking receipt session fetch failed:', e.message);
    return page(ctx, tr('bkr.title'), `<h1>${tr('bkr.missing_title')}</h1><p class="bkr-muted">${tr('bkr.missing')}</p>`);
  }
  // Bind the session to THIS site (no cross-site replays).
  if (!session || !session.metadata || session.metadata.site !== publicId || session.metadata.type !== 'booking') {
    return page(ctx, tr('bkr.title'), `<h1>${tr('bkr.missing_title')}</h1><p class="bkr-muted">${tr('bkr.missing')}</p>`);
  }

  const result = await settlePaidBooking(env, { session, account: config.stripe_account_id, publicId });
  const b = result.booking;
  const when = b ? `${esc(b.date)} · ${minutesLabel(b.start_min)}` : '';

  // Send the visitor HOME: back to the page they booked from (session
  // metadata, store-receipt pattern). Without it they were stranded on a
  // Caddisfly-branded page with no path back to the business's site.
  const backUrl = session.metadata && /^https?:\/\//.test(session.metadata.back || '') ? session.metadata.back : '';
  const backBtn = backUrl
    ? `<p style="margin-top:1.4rem"><a class="bkr-back" href="${esc(backUrl)}">← ${tr('bkr.back')} ${esc(siteName || tr('bkr.back_site'))}</a></p>`
    : '';

  if (result.state === 'confirmed' || result.state === 'already') {
    let remainLine = '';
    if (result.remaining_cents > 0 && b) {
      let amt;
      try { amt = new Intl.NumberFormat(ctx.lang || 'en', { style: 'currency', currency: (b.currency || 'usd').toUpperCase() }).format(result.remaining_cents / 100); }
      catch { amt = `${(result.remaining_cents / 100).toFixed(2)}`; }
      remainLine = `<p class="bkr-meta" style="color:#92400e">${tr('bkr.remaining', { amt })}</p>`;
    }
    return page(ctx, tr('bkr.title'), `<h1 class="bkr-ok">${tr('bkr.ok_title')}</h1>
      <p class="bkr-meta">${esc((b && b.service_name) || '')} — ${when}</p>
      ${remainLine}
      <p class="bkr-muted">${tr('bkr.ok')}</p>${backBtn}`);
  }
  if (result.state === 'unpaid') {
    return page(ctx, tr('bkr.title'), `<h1>${tr('bkr.unpaid_title')}</h1><p class="bkr-muted">${tr('bkr.unpaid')}</p>${backBtn}`);
  }
  if (result.state === 'conflict') {
    return page(ctx, tr('bkr.title'), `<h1>${tr('bkr.conflict_title')}</h1>
      <p class="bkr-meta">${esc((b && b.service_name) || '')} — ${when}</p>
      <p class="bkr-muted">${tr('bkr.conflict')}</p>${backBtn}`);
  }
  return page(ctx, tr('bkr.title'), `<h1>${tr('bkr.missing_title')}</h1><p class="bkr-muted">${tr('bkr.missing')}</p>`);
}
