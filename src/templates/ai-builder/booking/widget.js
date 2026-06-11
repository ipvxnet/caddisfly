// 📅 Bookings — ADDABLE body section: the site's bookable services with a live
// slot picker. Services are injected at render time (assemblePage
// opts.bookingServices → config.booking_services) like the products section,
// so the cards never go stale; SLOTS are always fetched live from the public
// booking API (/api/booking/:id/slots), cross-origin like the contact form.
// Booking only works once published (config.trackId); previews render the
// cards with an inert note, so editing can never create a real booking.

import { t } from '../../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(cents, currency, lang) {
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${(currency || 'usd').toUpperCase()}`;
  }
}

export function bookingWidgetTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const services = Array.isArray(config.booking_services) ? config.booking_services : [];
  const published = !!config.trackId;
  const siteId = config.trackId || '';
  const apiBase = `${config.appOrigin || 'https://caddisfly.ai'}/api/booking/${siteId}`;
  const heading = data.heading || t(lang, 'bkw.heading');
  const description = data.description || '';

  // Nothing bookable: helper while editing, invisible once published.
  if (!services.length) {
    if (published) return '';
    return `
<section class="bkg-section">
  <div class="bkg-container" style="text-align:center">
    <h2 class="bkg-heading" style="font-family:${font_heading},sans-serif">${esc(heading)}</h2>
    <p class="bkg-empty">${t(lang, 'bkw.empty_hint')}</p>
  </div>
</section>
<style>.bkg-section{padding:5rem 2rem;background:#fff}.bkg-container{max-width:900px;margin:0 auto}.bkg-heading{font-size:clamp(2rem,3vw,2.5rem);font-weight:700;color:#1a202c}.bkg-empty{margin-top:1rem;color:#718096;border:2px dashed #e2e8f0;border-radius:12px;padding:2rem}</style>`;
  }

  const card = (s) => `
    <div class="bkg-card" data-svc="${s.id}" data-dur="${s.duration_min}" data-paid="${s.require_payment ? 1 : 0}">
      <div class="bkg-card-body">
        <h3>${esc(s.name)}</h3>
        <div class="bkg-meta">${s.duration_min} min${s.price_cents != null ? ` · ${money(s.price_cents, s.currency, lang)}` : ''}</div>
        ${s.description ? `<p class="bkg-desc">${esc(s.description)}</p>` : ''}
      </div>
      <button class="bkg-book-btn" type="button">${s.require_payment && s.price_cents
        ? (s.deposit_cents > 0 && s.deposit_cents < s.price_cents
          ? t(lang, 'bkw.deposit_btn', { amt: money(s.deposit_cents, s.currency, lang) })
          : t(lang, 'bkw.pay_btn'))
        : t(lang, 'bkw.book_btn')}</button>
    </div>`;

  const styles = `
<style>
.bkg-section { padding: 5rem 2rem; background: #fff; }
.bkg-container { max-width: 900px; margin: 0 auto; }
.bkg-header { text-align: center; margin-bottom: 2.6rem; }
.bkg-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; }
.bkg-sub { font-size: 1.1rem; color: #4a5568; margin-top: .6rem; }
.bkg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.4rem; }
.bkg-card { background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 12px; padding: 1.4rem; display: flex; flex-direction: column; gap: .8rem;
  box-shadow: 0 4px 18px rgba(0,0,0,.06); transition: transform .2s ease; }
.bkg-card:hover { transform: translateY(-3px); }
.bkg-card h3 { color: #1a202c; font-size: 1.15rem; }
.bkg-meta { color: ${primary_color}; font-weight: 700; font-size: .9rem; }
.bkg-desc { color: #4a5568; font-size: .92rem; line-height: 1.5; }
.bkg-book-btn { margin-top: auto; background: ${primary_color}; color: #fff; border: none; border-radius: 9px; padding: .65rem 1rem; font-size: .95rem; font-weight: 700; cursor: pointer; }
.bkg-book-btn:hover { opacity: .9; }
.bkg-panel { grid-column: 1 / -1; background: #f8f9fc; border: 1px solid rgba(0,0,0,.07); border-radius: 12px; padding: 1.3rem; }
.bkg-panel-head { display: flex; justify-content: space-between; align-items: center; gap: .8rem; flex-wrap: wrap; margin-bottom: .9rem; }
.bkg-panel-head strong { color: #1a202c; }
.bkg-tz { color: #718096; font-size: .8rem; }
.bkg-nav { display: flex; gap: .5rem; }
.bkg-nav button, .bkg-close { background: #fff; border: 1px solid rgba(0,0,0,.12); border-radius: 8px; padding: .35rem .7rem; cursor: pointer; font-size: .85rem; }
.bkg-days { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: .8rem; }
.bkg-day-col h4 { font-size: .8rem; color: #4a5568; margin-bottom: .5rem; text-align: center; }
.bkg-slot { display: block; width: 100%; background: #fff; border: 1px solid ${primary_color}55; color: ${primary_color}; border-radius: 8px;
  padding: .4rem; margin-bottom: .45rem; font-size: .85rem; font-weight: 600; cursor: pointer; }
.bkg-slot:hover, .bkg-slot.sel { background: ${primary_color}; color: #fff; }
.bkg-noslots { color: #a0aec0; font-size: .78rem; text-align: center; }
.bkg-form { margin-top: 1.1rem; display: none; }
.bkg-form.show { display: block; }
.bkg-form .bkg-pick { font-weight: 700; color: #1a202c; margin-bottom: .7rem; }
.bkg-form input, .bkg-form textarea { width: 100%; box-sizing: border-box; border: 1px solid rgba(0,0,0,.14); border-radius: 9px; padding: .6rem .8rem; margin-bottom: .6rem; font-family: inherit; font-size: .92rem; }
.bkg-submit { background: ${primary_color}; color: #fff; border: none; border-radius: 9px; padding: .7rem 1.4rem; font-weight: 700; font-size: .95rem; cursor: pointer; }
.bkg-status { margin-top: .7rem; font-size: .9rem; }
.bkg-status.ok { color: #065f46; font-weight: 700; }
.bkg-status.err { color: #b91c1c; }
.bkg-hp { position: absolute; left: -9999px; opacity: 0; height: 0; }
.bkg-loading { color: #718096; font-size: .9rem; text-align: center; padding: 1rem; }
</style>`;

  const msgs = {
    preview: t(lang, 'bkw.preview_note'),
    loading: t(lang, 'bkw.loading'),
    noslots: t(lang, 'bkw.no_slots'),
    pick: t(lang, 'bkw.pick_time'),
    name: t(lang, 'bkw.f_name'),
    email: t(lang, 'bkw.f_email'),
    note: t(lang, 'bkw.f_note'),
    submit: t(lang, 'bkw.f_submit'),
    pay_submit: t(lang, 'bkw.f_pay_submit'),
    redirecting: t(lang, 'bkw.redirecting'),
    sending: t(lang, 'bkw.sending'),
    success: t(lang, 'bkw.success'),
    error: t(lang, 'bkw.err_generic'),
    your_time: t(lang, 'bkw.your_time'),
    next: t(lang, 'bkw.next_days'),
    prev: t(lang, 'bkw.prev_days'),
    close: t(lang, 'bkw.close'),
  };

  const script = `
<script>
(function () {
  if (window.__bkgInit) return; window.__bkgInit = 1;
  var CFG = { api: ${JSON.stringify(published ? apiBase : '')}, msgs: ${JSON.stringify(msgs)} };
  var state = { svc: 0, dur: 0, offset: 0, sel: null, panel: null };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function dateStr(offsetDays) { var d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10); }
  function dayLabel(iso) { try { return new Date(iso + 'T12:00:00').toLocaleDateString(document.documentElement.lang || 'en', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return iso; } }
  function closePanel() { if (state.panel) { state.panel.remove(); state.panel = null; state.sel = null; } }
  function loadSlots() {
    var days = state.panel.querySelector('.bkg-days');
    days.innerHTML = '';
    days.appendChild(el('div', 'bkg-loading', CFG.msgs.loading));
    fetch(CFG.api + '/slots?service_id=' + state.svc + '&from=' + dateStr(state.offset) + '&days=5')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        days.innerHTML = '';
        if (!d.success) { days.appendChild(el('div', 'bkg-noslots', d.error || CFG.msgs.error)); return; }
        state.tz = d.timezone || '';
        state.panel.querySelector('.bkg-tz').textContent = d.timezone || '';
        var any = false;
        d.days.forEach(function (day) {
          var col = el('div', 'bkg-day-col');
          col.appendChild(el('h4', '', dayLabel(day.date)));
          if (!day.slots.length) { col.appendChild(el('div', 'bkg-noslots', '—')); }
          day.slots.forEach(function (s) {
            any = true;
            var b = el('button', 'bkg-slot', s.label);
            b.type = 'button';
            b.onclick = function () {
              state.sel = { date: day.date, start_min: s.start_min, label: dayLabel(day.date) + ' · ' + s.label };
              state.panel.querySelectorAll('.bkg-slot.sel').forEach(function (x) { x.classList.remove('sel'); });
              b.classList.add('sel');
              var f = state.panel.querySelector('.bkg-form');
              f.classList.add('show');
              var pick = CFG.msgs.pick + ' ' + state.sel.label;
              // When the visitor's clock differs from the business's, show
              // their LOCAL time too — the moment of commitment is where
              // timezone mistakes happen.
              try {
                var vtz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone;
                if (s.ts && vtz && state.tz && vtz !== state.tz) {
                  pick += ' — ' + CFG.msgs.your_time + ' ' + new Date(s.ts * 1000).toLocaleString(document.documentElement.lang || 'en', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
                }
              } catch (e) { /* cosmetic only */ }
              f.querySelector('.bkg-pick').textContent = pick;
            };
            col.appendChild(b);
          });
          days.appendChild(col);
        });
        if (!any) days.appendChild(el('div', 'bkg-noslots', CFG.msgs.noslots));
      })
      .catch(function () { days.innerHTML = ''; days.appendChild(el('div', 'bkg-noslots', CFG.msgs.error)); });
  }
  function openPanel(card) {
    closePanel();
    state.svc = card.dataset.svc; state.dur = card.dataset.dur; state.offset = 0;
    var p = el('div', 'bkg-panel');
    p.innerHTML = '<div class="bkg-panel-head"><strong>' + card.querySelector('h3').textContent + '</strong>'
      + '<span class="bkg-tz"></span>'
      + '<div class="bkg-nav"><button type="button" class="bkg-prev">‹ ' + CFG.msgs.prev + '</button>'
      + '<button type="button" class="bkg-next">' + CFG.msgs.next + ' ›</button>'
      + '<button type="button" class="bkg-close">✕ ' + CFG.msgs.close + '</button></div></div>'
      + '<div class="bkg-days"></div>'
      + '<form class="bkg-form"><div class="bkg-pick"></div>'
      + '<input name="name" placeholder="' + CFG.msgs.name + '" required maxlength="120">'
      + '<input name="email" type="email" placeholder="' + CFG.msgs.email + '" required maxlength="320">'
      + '<textarea name="note" placeholder="' + CFG.msgs.note + '" rows="2" maxlength="500"></textarea>'
      + '<input class="bkg-hp" name="hp" tabindex="-1" autocomplete="off">'
      + '<button class="bkg-submit" type="submit">' + (card.dataset.paid === '1' ? CFG.msgs.pay_submit : CFG.msgs.submit) + '</button>'
      + '<div class="bkg-status"></div></form>';
    card.parentNode.insertBefore(p, card.nextSibling);
    state.panel = p;
    p.querySelector('.bkg-close').onclick = closePanel;
    p.querySelector('.bkg-prev').onclick = function () { if (state.offset >= 5) { state.offset -= 5; loadSlots(); } };
    p.querySelector('.bkg-next').onclick = function () { state.offset += 5; loadSlots(); };
    p.querySelector('.bkg-form').onsubmit = function (e) {
      e.preventDefault();
      if (!state.sel) return;
      var f = e.target;
      var st = f.querySelector('.bkg-status');
      st.className = 'bkg-status'; st.textContent = CFG.msgs.sending;
      f.querySelector('.bkg-submit').disabled = true;
      fetch(CFG.api + '/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: state.svc, date: state.sel.date, start_min: state.sel.start_min,
          name: f.name.value, email: f.email.value, note: f.note.value, hp: f.hp.value,
          tz: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '',
          back: location.href,
        }),
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok && d.success, d: d }; }); })
        .then(function (res) {
          if (res.ok && res.d.checkout_url) { st.className = 'bkg-status ok'; st.textContent = CFG.msgs.redirecting; window.location.href = res.d.checkout_url; return; }
          if (res.ok) { st.className = 'bkg-status ok'; st.textContent = CFG.msgs.success; f.querySelector('.bkg-submit').style.display = 'none'; }
          else {
            st.className = 'bkg-status err'; st.textContent = (res.d && res.d.error) || CFG.msgs.error;
            f.querySelector('.bkg-submit').disabled = false;
            loadSlots(); // a 409 usually means the slot just got taken — refresh
          }
        })
        .catch(function () { st.className = 'bkg-status err'; st.textContent = CFG.msgs.error; f.querySelector('.bkg-submit').disabled = false; });
    };
    loadSlots();
  }
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.bkg-book-btn') : null;
    if (!btn) return;
    if (!CFG.api) { alert(CFG.msgs.preview); return; }
    openPanel(btn.closest('.bkg-card'));
  });
})();
</script>`;

  return `
<section class="bkg-section">
  <div class="bkg-container">
    <div class="bkg-header">
      <h2 class="bkg-heading">${esc(heading)}</h2>
      ${description ? `<p class="bkg-sub">${esc(description)}</p>` : ''}
    </div>
    <div class="bkg-grid">
      ${services.map(card).join('')}
    </div>
  </div>
</section>
${styles}
${script}`;
}
