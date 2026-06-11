// Public reschedule page (tokenized, sibling of /booking/cancel/:token).
//   GET  /booking/reschedule/:token   current booking + a slot picker
//   POST /booking/reschedule/:token   { date, start_min } → guarded move
// The cancel token is the credential (emailed with the confirmation). The
// picker reuses the PUBLIC slots API with exclude_token so the visitor's own
// booking doesn't block its neighboring times. The POST revalidates the slot
// server-side (never trusts the client) and moves atomically — payment fields
// are untouched and the reminder re-arms for the new time.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getBookingByToken, getServiceById, getHours, getOverrides, getBookingsInRange, rescheduleBooking } from '../../db/bookings.js';
import { siteForBooking } from './booking-cancel.js';
import { parseBookingSettings, nowInTimezone, slotsForDate, minutesLabel, isValidDateStr } from '../../utils/booking-slots.js';
import { sendBookingVisitorEmail, sendBookingOwnerEmail } from '../../utils/email.js';
import { notifyBookingEvent } from '../../utils/booking-notify.js';
import { bookingIcs } from '../../utils/booking-ics.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(ctx, title, bodyHtml, extra = '') {
  const lang = ctx.lang || 'en';
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
${headTags({ title: `${title} — Caddisfly`, description: title, path: '/booking/reschedule' })}
<style>${baseCss()}
.bkrs-wrap { max-width: 640px; margin: 50px auto; padding: 0 20px; }
.bkrs-card { background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 14px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,.06); }
.bkrs-card h1 { font-size: 1.4rem; margin-bottom: .8rem; }
.bkrs-meta { font-size: 1.05rem; color: #1a202c; font-weight: 700; margin: .8rem 0; }
.bkrs-muted { color: #667085; line-height: 1.6; }
.bkrs-nav { display: flex; gap: .5rem; justify-content: flex-end; margin: .8rem 0; }
.bkrs-nav button { background: #fff; border: 1px solid rgba(0,0,0,.12); border-radius: 8px; padding: .35rem .7rem; cursor: pointer; font-size: .85rem; }
.bkrs-days { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: .8rem; }
.bkrs-day h4 { font-size: .8rem; color: #4a5568; margin-bottom: .5rem; text-align: center; }
.bkrs-slot { display: block; width: 100%; background: #fff; border: 1px solid #7c3aed55; color: #7c3aed; border-radius: 8px; padding: .4rem; margin-bottom: .45rem; font-size: .85rem; font-weight: 600; cursor: pointer; }
.bkrs-slot:hover, .bkrs-slot.sel { background: #7c3aed; color: #fff; }
.bkrs-none { color: #a0aec0; font-size: .78rem; text-align: center; }
.bkrs-confirm { margin-top: 1.2rem; display: none; }
.bkrs-confirm.show { display: block; }
.bkrs-btn { background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; border: none; border-radius: 9px; padding: .7rem 1.4rem; font-weight: 700; font-size: .95rem; cursor: pointer; }
.bkrs-status { margin-top: .7rem; font-size: .9rem; }
.bkrs-status.err { color: #b91c1c; }
.bkrs-loading { color: #718096; text-align: center; padding: 1rem; }
</style>
</head>
<body>
${siteHeader('', { lang })}
<div class="bkrs-wrap"><div class="bkrs-card">${bodyHtml}</div></div>
${siteFooter({ lang })}
${extra}
</body></html>`;
  return htmlResponse(html);
}

export async function handleBookingReschedulePage(ctx) {
  const { env, params } = ctx;
  const tr = translator(ctx.lang || 'en');
  const booking = await getBookingByToken(env.DB, params.token || '');
  if (!booking || booking.status !== 'confirmed') {
    return page(ctx, tr('bkres.title'), `<h1>${tr('bkres.not_found_title')}</h1><p class="bkrs-muted">${tr('bkres.not_found')}</p>`);
  }
  const site = await siteForBooking(env.DB, booking);
  if (!site || !site.publicId) {
    return page(ctx, tr('bkres.title'), `<h1>${tr('bkres.not_found_title')}</h1><p class="bkrs-muted">${tr('bkres.not_found')}</p>`);
  }

  const when = `${esc(booking.date)} · ${minutesLabel(booking.start_min)}`;
  const body = `<h1>${tr('bkres.title')}</h1>
    <p class="bkrs-meta">${esc(booking.service_name || '')} — ${when} <span class="bkrs-muted">(${esc(site.settings.timezone)})</span></p>
    <p class="bkrs-muted">${tr('bkres.intro')}</p>
    <div class="bkrs-nav">
      <button type="button" id="rs-prev">‹ ${tr('bkres.prev')}</button>
      <button type="button" id="rs-next">${tr('bkres.next')} ›</button>
    </div>
    <div class="bkrs-days" id="rs-days"><div class="bkrs-loading">${tr('bkres.loading')}</div></div>
    <div class="bkrs-confirm" id="rs-confirm">
      <p class="bkrs-meta" id="rs-pick"></p>
      <button class="bkrs-btn" id="rs-go">${tr('bkres.confirm_btn')}</button>
      <div class="bkrs-status" id="rs-status"></div>
    </div>`;

  const cfg = {
    api: `/api/booking/${site.publicId}/slots?service_id=${booking.service_id}&exclude_token=${encodeURIComponent(params.token)}`,
    post: `/booking/reschedule/${encodeURIComponent(params.token)}`,
    msgs: {
      none: tr('bkres.no_slots'), pick: tr('bkres.pick'), moving: tr('bkres.moving'),
      err: tr('bkres.err'), taken: tr('bkres.taken'),
    },
  };
  const script = `<script>
(function () {
  var CFG = ${JSON.stringify(cfg)};
  var offset = 0, sel = null;
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function dateStr(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function dayLabel(iso) { try { return new Date(iso + 'T12:00:00').toLocaleDateString(document.documentElement.lang || 'en', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return iso; } }
  function load() {
    var days = document.getElementById('rs-days');
    days.innerHTML = '';
    days.appendChild(el('div', 'bkrs-loading', '…'));
    fetch(CFG.api + '&from=' + dateStr(offset) + '&days=5')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        days.innerHTML = '';
        if (!d.success) { days.appendChild(el('div', 'bkrs-none', CFG.msgs.err)); return; }
        var any = false;
        d.days.forEach(function (day) {
          var col = el('div', 'bkrs-day');
          col.appendChild(el('h4', '', dayLabel(day.date)));
          if (!day.slots.length) col.appendChild(el('div', 'bkrs-none', '—'));
          day.slots.forEach(function (s) {
            any = true;
            var b = el('button', 'bkrs-slot', s.label);
            b.type = 'button';
            b.onclick = function () {
              sel = { date: day.date, start_min: s.start_min };
              days.querySelectorAll('.bkrs-slot.sel').forEach(function (x) { x.classList.remove('sel'); });
              b.classList.add('sel');
              document.getElementById('rs-confirm').classList.add('show');
              document.getElementById('rs-pick').textContent = CFG.msgs.pick + ' ' + dayLabel(day.date) + ' · ' + s.label;
            };
            col.appendChild(b);
          });
          days.appendChild(col);
        });
        if (!any) days.appendChild(el('div', 'bkrs-none', CFG.msgs.none));
      })
      .catch(function () { days.innerHTML = ''; days.appendChild(el('div', 'bkrs-none', CFG.msgs.err)); });
  }
  document.getElementById('rs-prev').onclick = function () { if (offset >= 5) { offset -= 5; load(); } };
  document.getElementById('rs-next').onclick = function () { offset += 5; load(); };
  document.getElementById('rs-go').onclick = function () {
    if (!sel) return;
    var btn = document.getElementById('rs-go');
    var st = document.getElementById('rs-status');
    btn.disabled = true; st.className = 'bkrs-status'; st.textContent = CFG.msgs.moving;
    fetch(CFG.post, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sel) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok && d.success, d: d }; }); })
      .then(function (res) {
        if (res.ok) { window.location.reload(); return; }
        st.className = 'bkrs-status err'; st.textContent = (res.d && res.d.error) || CFG.msgs.err;
        btn.disabled = false; load();
      })
      .catch(function () { st.className = 'bkrs-status err'; st.textContent = CFG.msgs.err; btn.disabled = false; });
  };
  load();
})();
</script>`;
  return page(ctx, tr('bkres.title'), body, script);
}

export async function handleBookingRescheduleAction(ctx) {
  const { env, request, params } = ctx;
  const tr = translator(ctx.lang || 'en');
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
  try {
    const booking = await getBookingByToken(env.DB, params.token || '');
    if (!booking || booking.status !== 'confirmed') return json({ success: false, error: tr('bkres.not_found') }, 404);
    const site = await siteForBooking(env.DB, booking);
    if (!site) return json({ success: false, error: tr('bkres.not_found') }, 404);

    const body = await request.json().catch(() => ({}));
    const date = String(body.date || '');
    const startMin = parseInt(body.start_min, 10);
    if (!isValidDateStr(date) || Number.isNaN(startMin)) return json({ success: false, error: tr('bkres.err') }, 400);

    // Server-side revalidation in the owner's timezone, excluding SELF.
    const projectKey = booking.ai_project_id != null ? { aiProjectId: booking.ai_project_id } : { projectId: booking.project_id };
    const service = await getServiceById(env.DB, projectKey, booking.service_id)
      || { duration_min: booking.end_min - booking.start_min, buffer_min: 0 };
    const now = nowInTimezone(site.settings.timezone);
    const [hours, overrides, allBookings] = await Promise.all([
      getHours(env.DB, projectKey),
      getOverrides(env.DB, projectKey, { fromDate: date }),
      getBookingsInRange(env.DB, projectKey, date, date),
    ]);
    const bookings = allBookings.filter((b) => b.id !== booking.id);
    const valid = slotsForDate({ date, service, hours, overrides, bookings, settings: site.settings, now });
    const slot = valid.find((s) => s.start_min === startMin);
    if (!slot) return json({ success: false, error: tr('bkres.taken') }, 409);

    const oldWhen = `${booking.date} · ${minutesLabel(booking.start_min)}`;
    const outcome = await rescheduleBooking(env.DB, booking, { date, start_min: slot.start_min, end_min: slot.end_min });
    if (outcome !== 'moved') return json({ success: false, error: tr('bkres.taken') }, 409);

    // Emails + alerts: updated .ics keeps the SAME UID so calendars move the
    // existing event instead of duplicating it.
    const appOrigin = env.APP_URL || 'https://caddisfly.ai';
    const moved = { ...booking, date, start_min: slot.start_min, end_min: slot.end_min };
    const cancelUrl = `${appOrigin}/booking/cancel/${booking.cancel_token}`;
    const ics = bookingIcs({
      booking: moved, siteName: site.siteName, timezone: site.settings.timezone,
      serviceName: booking.service_name || '', cancelUrl, sequence: 1,
    });
    const work = Promise.allSettled([
      sendBookingVisitorEmail(env, {
        to: booking.customer_email, siteName: site.siteName, serviceName: booking.service_name || '',
        dateLabel: date, timeLabel: minutesLabel(slot.start_min), tz: site.settings.timezone,
        cancelUrl, rescheduleUrl: `${appOrigin}/booking/reschedule/${booking.cancel_token}`, ics, rescheduled: true, oldWhen,
      }),
      sendBookingOwnerEmail(env, {
        to: site.notifyEmail, siteName: site.siteName, serviceName: booking.service_name || '',
        customerName: booking.customer_name, customerEmail: booking.customer_email,
        dateLabel: date, timeLabel: minutesLabel(slot.start_min), note: booking.note || '',
        manageUrl: `${appOrigin}/ai-builder/bookings/${site.publicId}`, rescheduled: true, oldWhen,
      }),
      notifyBookingEvent(env, {
        config: site.config, settings: site.settings, siteName: site.siteName, publicId: site.publicId,
        booking: moved, serviceName: booking.service_name || '', rescheduled: true,
      }),
    ]);
    if (ctx.ctx && ctx.ctx.waitUntil) ctx.ctx.waitUntil(work);
    else await work;

    return json({ success: true, booking: { date, start_min: slot.start_min } });
  } catch (e) {
    console.error('booking reschedule error:', e);
    return json({ success: false, error: 'Something went wrong' }, 500);
  }
}
