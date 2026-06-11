// GET /ai-builder/bookings/:project_id — the owner's booking manager:
// bookable services (name/duration/buffer/price), weekly hours, per-date
// overrides, settings (timezone/lead/max-per-day/step), and the upcoming
// bookings inbox with owner cancel. Mirrors the blog-manager shell.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { getServices, getHours, getOverrides, getUpcomingBookings } from '../../db/bookings.js';
import { parseBookingSettings, nowInTimezone, minutesLabel } from '../../utils/booking-slots.js';
import { parseConnections, PLATFORM_FIELDS } from '../../utils/social-share.js';
import { BOOKING_NOTIFY_PLATFORMS, notifyPlatforms } from '../../utils/booking-notify.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** <option> list for time-of-day selects, 30-minute steps. */
function timeOptions(selected) {
  let out = '';
  for (let m = 0; m <= 1410; m += 30) {
    out += `<option value="${m}"${m === selected ? ' selected' : ''}>${minutesLabel(m)}</option>`;
  }
  return out;
}

const COMMON_TZS = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix',
  'America/Sao_Paulo', 'America/Mexico_City', 'America/Bogota', 'America/Argentina/Buenos_Aires',
  'Europe/London', 'Europe/Madrid', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin',
  'Atlantic/Azores', 'Australia/Sydney', 'Asia/Tokyo', 'Asia/Dubai',
];

export async function handleBookingManager(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const publicId = params.project_id;

  const aiProject = await getAIProjectByProjectId(env.DB, publicId);
  let name;
  let projectKey;
  let config;
  if (aiProject) {
    name = aiProject.project_name || 'Your Website';
    projectKey = { aiProjectId: aiProject.id };
    config = await getWebsiteConfigByAIProjectId(env.DB, aiProject.id);
  } else {
    const rp = await getProjectByPreviewId(env.DB, publicId);
    if (!rp) return htmlResponse('<h1>Not found</h1>', 404);
    name = rp.website_url || 'Your Website';
    try { const p = JSON.parse(rp.company_profile_json || '{}'); if (p && p.name) name = p.name; } catch { /* ignore */ }
    projectKey = { projectId: rp.id };
    config = await getWebsiteConfigByRegularProjectId(env.DB, rp.id);
  }

  const settings = parseBookingSettings(config);
  const conns = parseConnections(config);
  const selectedNotify = notifyPlatforms(settings);
  const today = nowInTimezone(settings.timezone).date;
  const [services, hours, overrides, upcoming] = await Promise.all([
    getServices(env.DB, projectKey),
    getHours(env.DB, projectKey),
    getOverrides(env.DB, projectKey, { fromDate: today }),
    getUpcomingBookings(env.DB, projectKey, today),
  ]);

  // ---- settings panel ----
  const stepOpts = [[0, tr('bkm.step_auto')], [15, '15 min'], [30, '30 min'], [60, '60 min']]
    .map(([v, l]) => `<option value="${v}"${settings.slot_step === v ? ' selected' : ''}>${l}</option>`).join('');
  const leadOpts = [[0, tr('bkm.lead_none')], [60, '1h'], [120, '2h'], [240, '4h'], [1440, '24h'], [2880, '48h']]
    .map(([v, l]) => `<option value="${v}"${settings.lead_time_min === v ? ' selected' : ''}>${l}</option>`).join('');
  const settingsPanel = `
    <div class="panel">
      <h2>${tr('bkm.settings_title')}</h2>
      <div class="grid-4">
        <div><label>${tr('bkm.timezone')}</label>
          <select id="bk-tz-sel" onchange="bkTzToggle()">
            ${COMMON_TZS.map((z) => `<option value="${z}"${z === settings.timezone ? ' selected' : ''}>${z}</option>`).join('')}
            <option value="__other__"${COMMON_TZS.includes(settings.timezone) ? '' : ' selected'}>${tr('bkm.tz_other')}</option>
          </select>
          <input id="bk-tz" value="${esc(settings.timezone)}" placeholder="America/New_York"
            style="margin-top:.4rem;${COMMON_TZS.includes(settings.timezone) ? 'display:none' : ''}"></div>
        <div><label>${tr('bkm.lead')} <span class="hint">${tr('bkm.lead_hint')}</span></label>
          <select id="bk-lead">${leadOpts}</select></div>
        <div><label>${tr('bkm.max_day')} <span class="hint">${tr('bkm.max_day_hint')}</span></label>
          <input id="bk-max" type="number" min="0" max="200" value="${settings.max_per_day}"></div>
        <div><label>${tr('bkm.step')}</label>
          <select id="bk-step">${stepOpts}</select></div>
        <div><label>${tr('bkm.cutoff')} <span class="hint">${tr('bkm.cutoff_hint')}</span></label>
          <select id="bk-cutoff">
            ${[[0, tr('bkm.cutoff_none')], [120, '2h'], [720, '12h'], [1440, '24h'], [2880, '48h']]
              .map(([v, l]) => `<option value="${v}"${settings.cancel_cutoff_min === v ? ' selected' : ''}>${l}</option>`).join('')}
          </select></div>
      </div>
      <div style="margin-top:.9rem">
        <label>${tr('bkm.notify_title')} <span class="hint">${tr('bkm.notify_hint')}</span></label>
        ${BOOKING_NOTIFY_PLATFORMS.map((p) => {
          const c = conns[p];
          const connected = !!(c && (PLATFORM_FIELDS[p] || []).every((f) => c[f]));
          const on = selectedNotify.includes(p);
          return `<label class="bk-check" style="margin-right:1.1rem${connected ? '' : ';opacity:.5'}">
            <input type="checkbox" class="bk-notify" value="${p}"${on && connected ? ' checked' : ''}${connected ? '' : ' disabled'}>
            ${p.charAt(0).toUpperCase() + p.slice(1)}${connected ? '' : ` <span class="hint">(${tr('bkm.notify_not_connected')})</span>`}
          </label>`;
        }).join('')}
        <div class="muted" style="margin-top:.3rem">${tr('bkm.notify_connect_note')} <a href="/ai-builder/blog/${esc(publicId)}">${tr('bkm.notify_connect_link')}</a></div>
      </div>
      <div class="brief-actions">
        <button class="btn" onclick="bkSaveSettings(this)">${tr('bkm.save')}</button>
        <span class="muted" id="bk-settings-status"></span>
      </div>
    </div>`;

  // ---- services panel ----
  const durOpts = (sel) => [15, 30, 45, 60, 90, 120, 180, 240]
    .map((v) => `<option value="${v}"${v === sel ? ' selected' : ''}>${v} min</option>`).join('');
  const bufOpts = (sel) => [0, 5, 10, 15, 30, 60]
    .map((v) => `<option value="${v}"${v === sel ? ' selected' : ''}>${v ? `${v} min` : tr('bkm.buffer_none')}</option>`).join('');
  const serviceRow = (s) => `
    <div class="bk-svc" data-id="${s.id}">
      <div class="grid-4">
        <div><label>${tr('bkm.svc_name')}</label><input class="sv-name" value="${esc(s.name)}" maxlength="120"></div>
        <div><label>${tr('bkm.svc_duration')}</label><select class="sv-dur">${durOpts(s.duration_min)}</select></div>
        <div><label>${tr('bkm.svc_buffer')} <span class="hint">${tr('bkm.svc_buffer_hint')}</span></label><select class="sv-buf">${bufOpts(s.buffer_min)}</select></div>
        <div><label>${tr('bkm.svc_price')} <span class="hint">${tr('bkm.svc_price_hint')}</span></label>
          <input class="sv-price" type="number" min="0" step="0.01" value="${s.price_cents != null ? (s.price_cents / 100).toFixed(2) : ''}" placeholder="—"></div>
      </div>
      <div><label>${tr('bkm.svc_desc')}</label>
        <div class="bk-desc-row"><input class="sv-desc" value="${esc(s.description || '')}" maxlength="500">
        <button class="btn ghost" onclick="bkAiDesc(this)" title="${esc(tr('bkm.svc_ai_desc_title'))}">${tr('bkm.svc_ai_desc')}</button></div></div>
      <div class="brief-actions">
        <label class="bk-check"><input type="checkbox" class="sv-active"${s.active ? ' checked' : ''}> ${tr('bkm.svc_active')}</label>
        <label class="bk-check" title="${esc(tr('bkm.svc_paid_title'))}"><input type="checkbox" class="sv-paid"${s.require_payment ? ' checked' : ''}> ${tr('bkm.svc_paid')}</label>
        <button class="btn ghost" onclick="bkSaveService(this)">${tr('bkm.save')}</button>
        <button class="link-btn danger" onclick="bkDeleteService(this)">${tr('bkm.delete')}</button>
      </div>
    </div>`;
  const servicesPanel = `
    <div class="panel">
      <h2>${tr('bkm.services_title')} (${services.length})</h2>
      <p class="muted">${tr('bkm.services_intro')}</p>
      ${services.map(serviceRow).join('')}
      <div class="bk-svc bk-new">
        <div class="grid-4">
          <div><label>${tr('bkm.svc_name')}</label><input id="nsv-name" placeholder="${esc(tr('bkm.svc_name_ph'))}" maxlength="120"></div>
          <div><label>${tr('bkm.svc_duration')}</label><select id="nsv-dur">${durOpts(60)}</select></div>
          <div><label>${tr('bkm.svc_buffer')}</label><select id="nsv-buf">${bufOpts(0)}</select></div>
          <div><label>${tr('bkm.svc_price')}</label><input id="nsv-price" type="number" min="0" step="0.01" placeholder="—"></div>
        </div>
        <div><label>${tr('bkm.svc_desc')}</label>
          <div class="bk-desc-row"><input id="nsv-desc" class="sv-desc" maxlength="500" placeholder="${esc(tr('bkm.svc_desc_ph'))}">
          <button class="btn ghost" onclick="bkAiDesc(this)" title="${esc(tr('bkm.svc_ai_desc_title'))}">${tr('bkm.svc_ai_desc')}</button></div></div>
        <div class="brief-actions">
          <button class="btn" onclick="bkAddService(this)">${tr('bkm.svc_add')}</button>
          <span class="muted" id="bk-svc-status"></span>
        </div>
      </div>
    </div>`;

  // ---- weekly hours panel (display Mon→Sun; weekday numbers 0=Sun…6=Sat) ----
  const dayNames = [tr('bkm.d_sun'), tr('bkm.d_mon'), tr('bkm.d_tue'), tr('bkm.d_wed'), tr('bkm.d_thu'), tr('bkm.d_fri'), tr('bkm.d_sat')];
  const hourRow = (wd) => {
    const w = hours.find((h) => h.weekday === wd); // v1 UI: one window/day (DB supports more)
    const open = !!w;
    return `
      <div class="bk-day" data-wd="${wd}">
        <label class="bk-check bk-dayname"><input type="checkbox" class="hr-open"${open ? ' checked' : ''}> ${dayNames[wd]}</label>
        <select class="hr-start"${open ? '' : ' disabled'}>${timeOptions(open ? w.start_min : 540)}</select>
        <span class="muted">–</span>
        <select class="hr-end"${open ? '' : ' disabled'}>${timeOptions(open ? w.end_min : 1020)}</select>
      </div>`;
  };
  const hoursPanel = `
    <div class="panel">
      <h2>${tr('bkm.hours_title')}</h2>
      <p class="muted">${tr('bkm.hours_intro')}</p>
      ${[1, 2, 3, 4, 5, 6, 0].map(hourRow).join('')}
      <div class="brief-actions">
        <button class="btn" onclick="bkSaveHours(this)">${tr('bkm.save')}</button>
        <span class="muted" id="bk-hours-status"></span>
      </div>
    </div>`;

  // ---- date overrides panel ----
  const overrideRow = (o) => `
    <div class="bk-ovr">
      <span><strong>${esc(o.date)}</strong>${o.label ? ` · ${esc(o.label)}` : ''} — ${o.closed ? tr('bkm.ovr_closed') : `${minutesLabel(o.start_min)}–${minutesLabel(o.end_min)}`}</span>
      <button class="link-btn danger" onclick="bkDeleteOverride(${o.id}, this)">${tr('bkm.delete')}</button>
    </div>`;
  const overridesPanel = `
    <div class="panel">
      <h2>${tr('bkm.ovr_title')}</h2>
      <p class="muted">${tr('bkm.ovr_intro')}</p>
      ${overrides.map(overrideRow).join('') || ''}
      <div class="bk-ovr-form">
        <input id="ovr-date" type="date" min="${today}">
        <label class="bk-check"><input type="checkbox" id="ovr-closed" checked onchange="bkOvrToggle()"> ${tr('bkm.ovr_closed')}</label>
        <span id="ovr-times" style="display:none">
          <select id="ovr-start">${timeOptions(540)}</select>
          <span class="muted">–</span>
          <select id="ovr-end">${timeOptions(1020)}</select>
        </span>
        <button class="btn ghost" onclick="bkAddOverride(this)">${tr('bkm.ovr_add')}</button>
        <span class="muted" id="bk-ovr-status"></span>
      </div>
      <div class="bk-ovr-form" style="border-top:1px solid var(--line);padding-top:.8rem;margin-top:.9rem">
        <span class="muted">${tr('bkm.holidays_intro')}</span>
        <select id="bk-holiday-country">
          ${['US', 'BR', 'MX', 'ES', 'PT'].map((c) => `<option value="${c}">${tr(`bkm.country_${c.toLowerCase()}`)}</option>`).join('')}
        </select>
        <button class="btn ghost" onclick="bkAddHolidays(this)">${tr('bkm.holidays_add')}</button>
      </div>
    </div>`;

  // ---- upcoming bookings panel ----
  const bookingRow = (b) => `
    <div class="bk-row${b.status !== 'confirmed' ? ' cancelled' : ''}">
      <div>
        <strong>${esc(b.date)} · ${minutesLabel(b.start_min)}</strong> — ${esc(b.service_name || '')}
        ${b.payment_status === 'paid' ? `<span class="pill ok">💳 ${tr('bkm.b_paid')}</span>` : ''}
        ${b.payment_status === 'refunded' ? `<span class="pill">↩ ${tr('bkm.b_refunded')}</span>` : ''}
        ${b.status !== 'confirmed' ? `<span class="pill">${tr('bkm.b_cancelled')}</span>` : ''}
        <div class="muted">${esc(b.customer_name)} &lt;${esc(b.customer_email)}&gt;${b.note ? ` — “${esc(b.note)}”` : ''}</div>
      </div>
      ${b.status === 'confirmed' ? `<button class="link-btn danger" onclick="bkCancelBooking(${b.id}, this)">${tr('bkm.b_cancel')}</button>` : ''}
    </div>`;
  const bookingsPanel = `
    <div class="panel">
      <h2>${tr('bkm.inbox_title')} (${upcoming.filter((b) => b.status === 'confirmed').length})</h2>
      ${upcoming.length ? upcoming.map(bookingRow).join('') : `<p class="muted">${tr('bkm.inbox_empty')}</p>`}
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('bkm.meta_title', { name: esc(name) }), description: 'Manage your bookings.', origin: url.origin })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    .awrap{max-width:860px;margin:0 auto;padding:2.5rem 1.5rem 4rem}
    .ahead{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1.4rem}
    .ahead h1{font-size:clamp(1.6rem,3.5vw,2.2rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .ahead .sub{color:var(--muted);font-size:.92rem}
    .ahead .acts{display:flex;gap:.5rem;flex-wrap:wrap}
    .mgr-tabs{display:flex;gap:.5rem;margin-bottom:1.2rem;border-bottom:2px solid var(--line);padding-bottom:0}
    .mgr-tab{background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;padding:.6rem 1rem;font-size:.95rem;font-weight:700;color:var(--muted);cursor:pointer}
    .mgr-tab.active{color:var(--ink);border-bottom-color:var(--p1)}
    .panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem 1.6rem;margin-bottom:1.2rem}
    .panel h2{font-size:1.05rem;color:var(--ink);margin-bottom:.6rem}
    .muted{color:var(--muted);font-size:.88rem}
    label{display:block;font-size:.8rem;font-weight:700;color:var(--ink);margin:.8rem 0 .3rem;text-transform:uppercase;letter-spacing:.03em}
    label .hint{font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted)}
    input,select{box-sizing:border-box;padding:.6rem .8rem;border:1.5px solid var(--line);border-radius:11px;font-family:inherit;font-size:.92rem;background:#fff}
    input{width:100%}
    input:focus,select:focus{outline:none;border-color:var(--p1)}
    .btn{display:inline-flex;align-items:center;gap:.3rem;background:var(--grad);color:#fff;border:none;border-radius:10px;padding:.5rem .9rem;font-size:.85rem;font-weight:700;cursor:pointer;text-decoration:none}
    .btn.ghost{background:#fff;color:var(--p2);border:1px solid var(--line)}
    .btn.ghost:hover{border-color:var(--p1)}
    .btn:disabled{opacity:.6;cursor:default}
    .link-btn{background:none;border:none;color:var(--p2);cursor:pointer;font-size:.85rem;font-weight:600;padding:0 .3rem}
    .link-btn.danger{color:#b91c1c}
    .pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.1rem .6rem;font-size:.72rem;font-weight:700;color:var(--p2);vertical-align:middle}
    .pill.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
    .grid-4{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:.8rem}
    .bk-svc{border:1px solid var(--line);border-radius:12px;padding:.9rem 1.1rem 1rem;margin:.8rem 0;background:var(--soft,#f8f9fc)}
    .bk-svc.bk-new{background:#fff;border-style:dashed}
    .bk-desc-row{display:flex;gap:.5rem;align-items:center}
    .bk-desc-row input{flex:1}
    .bk-check{display:inline-flex;align-items:center;gap:.45rem;text-transform:none;letter-spacing:0;font-size:.88rem;margin:0;cursor:pointer}
    .bk-check input{width:auto}
    .brief-actions{display:flex;gap:.6rem;align-items:center;margin-top:.8rem;flex-wrap:wrap}
    .bk-day{display:flex;gap:.6rem;align-items:center;padding:.35rem 0}
    .bk-dayname{width:130px}
    .bk-ovr{display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--line)}
    .bk-ovr:last-of-type{border-bottom:none}
    .bk-ovr-form{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-top:.8rem}
    .bk-ovr-form input[type=date]{width:auto}
    .bk-row{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;padding:.7rem 0;border-bottom:1px solid var(--line)}
    .bk-row:last-child{border-bottom:none}
    .bk-row.cancelled{opacity:.55}
    @media (max-width:700px){.grid-4{grid-template-columns:1fr 1fr}}
  </style>
</head>
<body>
  ${siteHeader('', { lang })}
  <main><div class="awrap">
    <div class="ahead">
      <div>
        <h1>📅 ${esc(name)}</h1>
        <div class="sub">${tr('bkm.title_sub')}</div>
      </div>
      <div class="acts">
        <a class="btn ghost" href="/ai-builder/customize/${esc(publicId)}">${tr('bkm.customize')}</a>
      </div>
    </div>
    ${services.length === 0 ? `<div class="panel" style="background:#eff6ff;border-color:#bfdbfe"><p class="muted" style="color:#1e40af">${tr('bkm.getting_started')}</p></div>` : ''}
    <div class="mgr-tabs">
      <button class="mgr-tab" data-tab="upcoming" onclick="showTab('upcoming')">${tr('bkm.tab_upcoming')}</button>
      <button class="mgr-tab" data-tab="settings" onclick="showTab('settings')">${tr('bkm.tab_settings')}</button>
    </div>
    <div class="mgr-pane" data-tab="upcoming">${bookingsPanel}</div>
    <div class="mgr-pane" data-tab="settings" hidden>${settingsPanel + servicesPanel + hoursPanel + overridesPanel}</div>
  </div></main>
  ${siteFooter({ lang })}
  <script>
    // Tabs persist across the save-triggered reloads via the URL hash.
    function showTab(name) {
      document.querySelectorAll('.mgr-pane').forEach(function (p) { p.hidden = p.dataset.tab !== name; });
      document.querySelectorAll('.mgr-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
      try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ }
    }
    var PID = ${JSON.stringify(publicId)};
    // First visit with nothing configured → land on Settings (onboarding);
    // otherwise Upcoming first, hash wins across reloads.
    var NO_SERVICES = ${services.length === 0 ? 'true' : 'false'};
    showTab(location.hash === '#settings' || (NO_SERVICES && !location.hash) ? 'settings' : 'upcoming');
    var T = ${JSON.stringify({
      saved: tr('bkm.saved'), err: tr('bkm.err'), confirm_del: tr('bkm.confirm_del'),
      confirm_cancel: tr('bkm.confirm_cancel'), need_name: tr('bkm.svc_need_name'),
      holidays_none: tr('bkm.holidays_none'),
    })};
    async function api(method, path, body) {
      const r = await fetch('/api/ai-builder/' + PID + '/booking' + path, {
        method: method, headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(function () { return {}; });
      if (r.status === 402) {
        if (confirm((d && d.upgrade_message) || (d && d.error) || 'Upgrade required.')) location.href = (d && d.billing_url) || '/billing';
        throw new Error((d && d.error) || T.err);
      }
      if (!r.ok || !d.success) throw new Error((d && d.error) || T.err);
      return d;
    }
    function status(id, msg, bad) { var el = document.getElementById(id); if (el) { el.textContent = msg; el.style.color = bad ? '#b91c1c' : '#065f46'; } }
    function busy(btn, on) { if (btn) btn.disabled = !!on; }

    async function bkSaveSettings(btn) {
      busy(btn, 1);
      try {
        var tzSel = document.getElementById('bk-tz-sel').value;
        var notify = [];
        document.querySelectorAll('.bk-notify:checked').forEach(function (el) { notify.push(el.value); });
        await api('PUT', '/settings', {
          timezone: (tzSel === '__other__' ? document.getElementById('bk-tz').value : tzSel).trim(),
          lead_time_min: parseInt(document.getElementById('bk-lead').value, 10),
          max_per_day: parseInt(document.getElementById('bk-max').value, 10) || 0,
          slot_step: parseInt(document.getElementById('bk-step').value, 10),
          cancel_cutoff_min: parseInt(document.getElementById('bk-cutoff').value, 10),
          notify_platforms: notify,
        });
        status('bk-settings-status', T.saved);
      } catch (e) { status('bk-settings-status', e.message, 1); }
      busy(btn, 0);
    }
    function svcBody(root) {
      var price = root.querySelector('.sv-price, #nsv-price').value;
      return {
        name: root.querySelector('.sv-name, #nsv-name').value.trim(),
        description: root.querySelector('.sv-desc, #nsv-desc') ? root.querySelector('.sv-desc, #nsv-desc').value.trim() : '',
        duration_min: parseInt(root.querySelector('.sv-dur, #nsv-dur').value, 10),
        buffer_min: parseInt(root.querySelector('.sv-buf, #nsv-buf').value, 10),
        price_cents: price === '' ? null : Math.round(parseFloat(price) * 100),
        active: root.querySelector('.sv-active') ? root.querySelector('.sv-active').checked : true,
        require_payment: root.querySelector('.sv-paid') ? root.querySelector('.sv-paid').checked : false,
      };
    }
    async function bkAddService(btn) {
      busy(btn, 1);
      try { await api('POST', '/services', svcBody(btn.closest('.bk-svc'))); location.reload(); }
      catch (e) { status('bk-svc-status', e.message, 1); busy(btn, 0); }
    }
    async function bkSaveService(btn) {
      var root = btn.closest('.bk-svc');
      busy(btn, 1);
      try { await api('PUT', '/services/' + root.dataset.id, svcBody(root)); location.reload(); }
      catch (e) { alert(e.message); busy(btn, 0); }
    }
    async function bkDeleteService(btn) {
      if (!confirm(T.confirm_del)) return;
      var root = btn.closest('.bk-svc');
      try { await api('DELETE', '/services/' + root.dataset.id); location.reload(); }
      catch (e) { alert(e.message); }
    }
    async function bkSaveHours(btn) {
      var windows = [];
      document.querySelectorAll('.bk-day').forEach(function (row) {
        if (!row.querySelector('.hr-open').checked) return;
        windows.push({
          weekday: parseInt(row.dataset.wd, 10),
          start_min: parseInt(row.querySelector('.hr-start').value, 10),
          end_min: parseInt(row.querySelector('.hr-end').value, 10),
        });
      });
      busy(btn, 1);
      try { await api('PUT', '/hours', { windows: windows }); status('bk-hours-status', T.saved); }
      catch (e) { status('bk-hours-status', e.message, 1); }
      busy(btn, 0);
    }
    document.addEventListener('change', function (e) {
      if (!e.target.classList || !e.target.classList.contains('hr-open')) return;
      var row = e.target.closest('.bk-day');
      row.querySelector('.hr-start').disabled = row.querySelector('.hr-end').disabled = !e.target.checked;
    });
    async function bkAiDesc(btn) {
      var root = btn.closest('.bk-svc');
      var name = root.querySelector('.sv-name, #nsv-name').value.trim();
      var descEl = root.querySelector('.sv-desc, #nsv-desc');
      if (!name) { alert(T.need_name); return; }
      busy(btn, 1); var was = btn.textContent; btn.textContent = '…';
      try {
        var d = await api('POST', '/services/describe', { name: name });
        descEl.value = d.description || '';
      } catch (e) { alert(e.message); }
      busy(btn, 0); btn.textContent = was;
    }
    function bkTzToggle() {
      var other = document.getElementById('bk-tz-sel').value === '__other__';
      document.getElementById('bk-tz').style.display = other ? '' : 'none';
    }
    function bkOvrToggle() {
      document.getElementById('ovr-times').style.display = document.getElementById('ovr-closed').checked ? 'none' : 'inline';
    }
    async function bkAddOverride(btn) {
      var date = document.getElementById('ovr-date').value;
      var closed = document.getElementById('ovr-closed').checked;
      busy(btn, 1);
      try {
        await api('POST', '/overrides', {
          date: date, closed: closed,
          start_min: closed ? null : parseInt(document.getElementById('ovr-start').value, 10),
          end_min: closed ? null : parseInt(document.getElementById('ovr-end').value, 10),
        });
        location.reload();
      } catch (e) { status('bk-ovr-status', e.message, 1); busy(btn, 0); }
    }
    async function bkAddHolidays(btn) {
      busy(btn, 1);
      try {
        var d = await api('POST', '/holidays', { country: document.getElementById('bk-holiday-country').value });
        if (d.added > 0) { location.reload(); return; }
        status('bk-ovr-status', T.holidays_none);
      } catch (e) { status('bk-ovr-status', e.message, 1); }
      busy(btn, 0);
    }
    async function bkDeleteOverride(id, btn) {
      try { await api('DELETE', '/overrides/' + id); location.reload(); }
      catch (e) { alert(e.message); }
    }
    async function bkCancelBooking(id, btn) {
      if (!confirm(T.confirm_cancel)) return;
      busy(btn, 1);
      try { await api('POST', '/' + id + '/cancel'); location.reload(); }
      catch (e) { alert(e.message); busy(btn, 0); }
    }
  </script>
</body></html>`;
  return htmlResponse(html);
}
