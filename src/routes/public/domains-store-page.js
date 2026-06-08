// GET /domains — the domain store: search, buy, and see your domains.
// billingAuth-gated (purchases are account-bound; renewal cards are saved).
// When Namecheap isn't configured the page renders a "coming soon" note so
// the UI can ship ahead of the secrets (email-stub degradation pattern).

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { isNamecheapConfigured } from '../../utils/namecheap.js';
import { countryOptions } from '../../utils/countries.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** The signed-in user's published sites (both flows) for the connect select. */
async function userSites(db, email) {
  const out = [];
  const ai = await db
    .prepare('SELECT project_id AS id, project_name AS name, subdomain FROM ai_projects WHERE customer_email = ? AND subdomain IS NOT NULL ORDER BY id DESC LIMIT 25')
    .bind(email).all();
  for (const r of ai.results || []) out.push({ id: r.id, label: r.name || r.subdomain });
  const rp = await db
    .prepare('SELECT preview_id AS id, website_url AS name, subdomain FROM projects WHERE customer_email = ? AND subdomain IS NOT NULL ORDER BY id DESC LIMIT 25')
    .bind(email).all();
  for (const r of rp.results || []) out.push({ id: r.id, label: r.name || r.subdomain });
  return out;
}

export async function handleDomainsStorePage(ctx) {
  const { env, url } = ctx;
  const lang = ctx.lang || 'en';
  const tr = translator(lang);
  const email = ctx.billingEmail;
  if (!email) {
    return new Response(null, { status: 303, headers: { Location: '/billing?next=/domains' } });
  }
  const configured = isNamecheapConfigured(env);
  const sites = email ? await userSites(env.DB, email) : [];

  const T = {
    searching: tr('domstore.searching'), search_btn: tr('domstore.search_btn'),
    taken: tr('domstore.taken_label'), buy: tr('domstore.buy'), per_year: tr('domstore.per_year'),
    err: tr('domstore.err'), starting: tr('domstore.starting'), continue_btn: tr('domstore.continue'),
    none: tr('domstore.results_empty'),
    st_registered: tr('domstore.st_registered'), st_working: tr('domstore.st_working'),
    st_failed: tr('domstore.st_failed'), expires: tr('domstore.expires'),
    autorenew: tr('domstore.autorenew'), autorenew_off_note: tr('domstore.autorenew_off_note'),
    reconnect: tr('domstore.reconnect'), reconnecting: tr('domstore.reconnecting'),
    reconnect_ok: tr('domstore.reconnect_ok'), reconnect_fail: tr('domstore.reconnect_fail'),
    dns: tr('domstore.dns'), dns_title: tr('domstore.dns_title'), dns_intro: tr('domstore.dns_intro'),
    dns_locked: tr('domstore.dns_locked'), dns_loading: tr('domstore.dns_loading'),
    dns_add: tr('domstore.dns_add'), dns_save: tr('domstore.dns_save'), dns_saving: tr('domstore.dns_saving'),
    dns_saved: tr('domstore.dns_saved'), dns_name: tr('domstore.dns_name'), dns_type: tr('domstore.dns_type'),
    dns_value: tr('domstore.dns_value'), dns_prio: tr('domstore.dns_prio'), dns_ttl: tr('domstore.dns_ttl'),
    dns_remove: tr('domstore.dns_remove'), dns_empty: tr('domstore.dns_empty'),
    email_setup: tr('domstore.email_setup'), email_pick: tr('domstore.email_pick'),
    email_applying: tr('domstore.email_applying'), email_done: tr('domstore.email_done'),
    email_dkim_note: tr('domstore.email_dkim_note'),
    email_mx_host: tr('domstore.email_mx_host'), email_mx_prio: tr('domstore.email_mx_prio'),
    email_need_mx: tr('domstore.email_need_mx'),
  };

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('domstore.meta_title'), description: 'Buy a domain for your website.', origin: url.origin })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    .dwrap{max-width:760px;margin:0 auto;padding:2.5rem 1.5rem 4rem}
    h1{font-size:clamp(1.6rem,3.5vw,2.2rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .sub{color:var(--muted);margin:.4rem 0 1.6rem}
    .searchrow{display:flex;gap:.6rem;margin-bottom:1.6rem}
    .searchrow input{flex:1;padding:.85rem 1rem;border:2px solid var(--line);border-radius:12px;font:inherit;font-size:1rem}
    .searchrow button{background:var(--grad);color:#fff;border:none;border-radius:12px;padding:.85rem 1.5rem;font-weight:800;font-size:.95rem;cursor:pointer}
    .res{background:#fff;border:1px solid var(--line);border-radius:14px;margin-bottom:.7rem;padding:1rem 1.2rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .res .d{font-weight:800;color:var(--ink);font-size:1.05rem}
    .res .p{color:var(--muted);font-size:.9rem}
    .res .p b{color:var(--ink)}
    .res button{background:var(--grad);color:#fff;border:none;border-radius:10px;padding:.55rem 1.2rem;font-weight:700;cursor:pointer}
    .res .taken{color:#b91c1c;font-weight:700;font-size:.9rem}
    .note{color:var(--muted);font-size:.92rem}
    .empty-note{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:1rem 1.2rem;color:#92400e;margin-bottom:1.4rem}
    /* contact modal */
    #buy-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:1rem;z-index:50}
    #buy-modal.open{display:flex}
    .bm-card{background:#fff;border-radius:16px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:1.6rem 1.8rem}
    .bm-card h2{font-size:1.2rem;color:var(--ink);margin-bottom:.2rem}
    .bm-card .bm-sub{color:var(--muted);font-size:.88rem;margin-bottom:1rem}
    .bm-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}
    .bm-grid .full{grid-column:1/-1}
    .bm-card label{display:block;font-size:.78rem;font-weight:700;color:#4a5568;margin-bottom:.25rem}
    .bm-card input,.bm-card select{width:100%;padding:.6rem .7rem;border:1.5px solid var(--line);border-radius:9px;font:inherit;font-size:.9rem}
    .bm-acts{display:flex;justify-content:flex-end;gap:.7rem;margin-top:1.2rem}
    .bm-acts .ghost{background:none;border:1.5px solid var(--line);border-radius:10px;padding:.6rem 1.2rem;font-weight:700;cursor:pointer;color:#4a5568}
    .bm-acts .go{background:var(--grad);color:#fff;border:none;border-radius:10px;padding:.6rem 1.4rem;font-weight:800;cursor:pointer}
    .bm-err{color:#b91c1c;font-size:.85rem;margin-top:.6rem;min-height:1.1em}
    .mydom{margin-top:2.6rem}
    .mydom h2{font-size:1.15rem;color:var(--ink);margin-bottom:.8rem}
    .dom-row{background:#fff;border:1px solid var(--line);border-radius:12px;padding:.8rem 1.1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;gap:.8rem;align-items:center;flex-wrap:wrap}
    .pill{display:inline-block;border-radius:999px;padding:.12rem .6rem;font-size:.74rem;font-weight:700}
    .pill.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
    .pill.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e}
    .pill.bad{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}
    .ar-toggle{display:inline-flex;align-items:center;gap:.4rem;font-size:.8rem;color:#4a5568;cursor:pointer;user-select:none}
    .ar-toggle input{width:auto;cursor:pointer}
    .reconnect-btn{background:none;border:1.5px solid var(--line);border-radius:8px;padding:.35rem .8rem;font-size:.8rem;font-weight:700;color:#4a5568;cursor:pointer}
    .reconnect-btn:hover{border-color:#a3b3f5;color:#4338ca}
    .reconnect-btn:disabled{opacity:.6;cursor:default}
    .dns-card{max-width:680px}
    .email-row{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin:.4rem 0 .3rem}
    .email-row label{font-size:.82rem;font-weight:700;color:#4a5568}
    .email-row select{padding:.45rem .6rem;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:.85rem}
    .dns-dkim{font-size:.76rem;color:#a0aec0;margin:0 0 1rem}
    #email-custom{background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:.8rem .9rem;margin:.2rem 0 1rem}
    #email-custom .bm-sub{margin:0 0 .6rem}
    .ec-label{display:block;font-size:.76rem;font-weight:700;color:#4a5568;margin:.6rem 0 .25rem}
    .ec-input{width:100%;padding:.45rem .6rem;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:.84rem}
    .ec-mx{display:flex;gap:.4rem;margin-bottom:.4rem;align-items:center}
    .ec-mx .ec-mx-host{flex:1}.ec-mx .ec-mx-prio{width:90px}
    .ec-dkim{display:flex;gap:.4rem}.ec-dkim .ec-input:first-child{max-width:38%}
    #dns-table{border-top:1px solid var(--line);padding-top:.6rem}
    .dns-row{display:grid;grid-template-columns:90px 1fr 1.6fr 60px 28px;gap:.4rem;align-items:center;margin-bottom:.4rem}
    .dns-row.dns-head{font-size:.72rem;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:.03em}
    .dns-row input,.dns-row select{padding:.4rem .5rem;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:.83rem;min-width:0}
    .dns-row.locked{color:#718096}
    .dns-row .dns-val{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.83rem}
    .dns-lock{text-align:center}
    .dns-del{background:none;border:none;color:#b91c1c;cursor:pointer;font-size:.9rem}
    .dns-add{margin:.4rem 0 .2rem;padding:.4rem .8rem;border:1.5px dashed var(--line);border-radius:8px;background:none;font-weight:700;font-size:.82rem;color:#4a5568;cursor:pointer}
  </style>
</head>
<body>
  ${siteHeader('', { lang })}
  <main><div class="dwrap">
    <h1>${tr('domstore.title')}</h1>
    <p class="sub">${tr('domstore.sub')}</p>
    ${configured ? '' : `<div class="empty-note">${tr('domstore.coming_soon')}</div>`}
    <div class="searchrow">
      <input type="text" id="dq" placeholder="${tr('domstore.search_ph')}" onkeydown="if(event.key==='Enter')searchDomains()">
      <button id="dq-btn" onclick="searchDomains()"${configured ? '' : ' disabled'}>${tr('domstore.search_btn')}</button>
    </div>
    <div id="results"></div>
    <p class="note">${tr('domstore.privacy_note')}</p>

    <div class="mydom" id="mydom" hidden>
      <h2>${tr('domstore.my_domains')}</h2>
      <div id="mydom-list"></div>
    </div>
  </div></main>

  <div id="buy-modal" onclick="if(event.target===this)closeBuy()">
    <div class="bm-card">
      <h2 id="bm-domain"></h2>
      <p class="bm-sub">${tr('domstore.contact_sub')}</p>
      <div class="bm-grid">
        <div><label>${tr('domstore.f_first')}</label><input id="c-first"></div>
        <div><label>${tr('domstore.f_last')}</label><input id="c-last"></div>
        <div class="full"><label>${tr('domstore.f_email')}</label><input id="c-email" type="email" value="${esc(email || '')}"></div>
        <div class="full"><label>${tr('domstore.f_address')}</label><input id="c-address"></div>
        <div><label>${tr('domstore.f_city')}</label><input id="c-city"></div>
        <div><label>${tr('domstore.f_state')}</label><input id="c-state"></div>
        <div><label>${tr('domstore.f_postal')}</label><input id="c-postal"></div>
        <div><label>${tr('domstore.f_country')}</label><select id="c-country">${countryOptions('US')}</select></div>
        <div><label>${tr('domstore.f_phone_cc')}</label><input id="c-cc" placeholder="1" maxlength="3"></div>
        <div><label>${tr('domstore.f_phone')}</label><input id="c-phone" placeholder="5551234567"></div>
        ${sites.length ? `<div class="full"><label>${tr('domstore.site_label')}</label>
          <select id="c-site"><option value="">${tr('domstore.site_none')}</option>
          ${sites.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}</select></div>` : ''}
      </div>
      <p class="bm-err" id="bm-err"></p>
      <div class="bm-acts">
        <button class="ghost" onclick="closeBuy()">${tr('domstore.cancel')}</button>
        <button class="go" id="bm-go" onclick="startCheckout(this)">${tr('domstore.continue')}</button>
      </div>
    </div>
  </div>

  <div id="dns-modal" onclick="if(event.target===this)closeDns()">
    <div class="bm-card dns-card">
      <h2>${tr('domstore.dns_title')}: <span id="dns-domain"></span></h2>
      <p class="bm-sub">${tr('domstore.dns_intro')}</p>
      <div class="email-row">
        <label>${tr('domstore.email_pick')}</label>
        <select id="email-provider" onchange="emailProviderChange()">
          <option value="">—</option>
          <option value="google">Google Workspace</option>
          <option value="microsoft">Microsoft 365</option>
          <option value="zoho">Zoho Mail</option>
          <option value="custom">${tr('domstore.email_custom')}</option>
        </select>
        <button class="ghost" id="email-go" onclick="applyEmail(this)">${tr('domstore.email_setup')}</button>
      </div>
      <div id="email-custom" hidden>
        <p class="bm-sub">${tr('domstore.email_custom_hint')}</p>
        <div id="email-mx"></div>
        <button type="button" class="dns-add" onclick="addMxRow()">${tr('domstore.email_add_mx')}</button>
        <label class="ec-label">${tr('domstore.email_spf')}</label>
        <input class="ec-input" id="ec-spf" placeholder="v=spf1 include:… ~all">
        <label class="ec-label">${tr('domstore.email_dmarc')}</label>
        <input class="ec-input" id="ec-dmarc" placeholder="v=DMARC1; p=none;">
        <label class="ec-label">${tr('domstore.email_dkim')}</label>
        <div class="ec-dkim">
          <input class="ec-input" id="ec-dkim-name" placeholder="${tr('domstore.email_dkim_name')}">
          <input class="ec-input" id="ec-dkim-val" placeholder="${tr('domstore.email_dkim_val')}">
        </div>
      </div>
      <p class="dns-dkim">${tr('domstore.email_dkim_note')}</p>
      <div id="dns-table"><p class="bm-sub">${tr('domstore.dns_loading')}</p></div>
      <button class="ghost dns-add" onclick="addDnsRow()">${tr('domstore.dns_add')}</button>
      <p class="bm-err" id="dns-err"></p>
      <div class="bm-acts">
        <button class="ghost" onclick="closeDns()">${tr('domstore.cancel')}</button>
        <button class="go" id="dns-save" onclick="saveDns(this)">${tr('domstore.dns_save')}</button>
      </div>
    </div>
  </div>

  ${siteFooter({ lang })}
  <script>
    const T = ${JSON.stringify(T)};
    function money(c){ try { return new Intl.NumberFormat(${JSON.stringify(lang)}, {style:'currency',currency:'USD'}).format(c/100); } catch(e){ return '$'+(c/100).toFixed(2); } }
    async function searchDomains() {
      const q = document.getElementById('dq').value.trim();
      if (!q) return;
      const box = document.getElementById('results');
      const btn = document.getElementById('dq-btn');
      btn.disabled = true; box.innerHTML = '<p class="note">' + T.searching + '</p>';
      try {
        const r = await fetch('/api/domains/search?q=' + encodeURIComponent(q));
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || T.err);
        box.innerHTML = '';
        if (!d.results.length) { box.innerHTML = '<p class="note">' + T.none + '</p>'; return; }
        d.results.forEach(function (res) {
          const row = document.createElement('div'); row.className = 'res';
          const left = document.createElement('div');
          const dn = document.createElement('div'); dn.className = 'd'; dn.textContent = res.domain;
          left.appendChild(dn);
          if (res.available) {
            const p = document.createElement('div'); p.className = 'p';
            p.innerHTML = '<b>' + money(res.price_cents) + '</b> ' + T.per_year;
            left.appendChild(p);
          }
          row.appendChild(left);
          if (res.available) {
            const b = document.createElement('button'); b.textContent = T.buy;
            b.onclick = function () { openBuy(res.domain); };
            row.appendChild(b);
          } else {
            const tk = document.createElement('span'); tk.className = 'taken'; tk.textContent = T.taken;
            row.appendChild(tk);
          }
          box.appendChild(row);
        });
      } catch (e) { box.innerHTML = '<p class="note">' + (e.message || T.err) + '</p>'; }
      finally { btn.disabled = false; }
    }
    let buyDomain = '';
    function openBuy(domain) {
      buyDomain = domain;
      document.getElementById('bm-domain').textContent = domain;
      document.getElementById('bm-err').textContent = '';
      document.getElementById('buy-modal').classList.add('open');
    }
    function closeBuy() { document.getElementById('buy-modal').classList.remove('open'); }
    async function startCheckout(btn) {
      const v = function (id) { return document.getElementById(id) ? document.getElementById(id).value.trim() : ''; };
      const contact = {
        first_name: v('c-first'), last_name: v('c-last'), email: v('c-email'),
        address1: v('c-address'), city: v('c-city'), state: v('c-state'),
        postal_code: v('c-postal'), country: v('c-country').toUpperCase(),
        phone: '+' + (v('c-cc') || '1') + '.' + v('c-phone').replace(/\\D/g, ''),
      };
      btn.disabled = true; btn.textContent = T.starting;
      try {
        const r = await fetch('/api/domains/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: buyDomain, contact: contact, site: v('c-site') || undefined }),
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || T.err);
        location.href = d.url;
      } catch (e) {
        document.getElementById('bm-err').textContent = e.message || T.err;
        btn.disabled = false; btn.textContent = T.continue_btn;
      }
    }
    async function loadMyDomains() {
      try {
        const r = await fetch('/api/domains/orders');
        const d = await r.json();
        if (!d.success || !d.orders.length) return;
        const wrap = document.getElementById('mydom'); wrap.hidden = false;
        const list = document.getElementById('mydom-list'); list.innerHTML = '';
        d.orders.forEach(function (o) {
          if (o.status === 'pending') return; // abandoned checkouts
          const row = document.createElement('div'); row.className = 'dom-row';
          const left = document.createElement('div');
          const dn = document.createElement('div'); dn.className = 'd'; dn.style.fontWeight = '800'; dn.textContent = o.domain;
          left.appendChild(dn);
          if (o.expires_at) {
            const ex = document.createElement('div'); ex.className = 'p'; ex.style.cssText = 'color:#718096;font-size:.85rem';
            ex.textContent = T.expires + ' ' + new Date(o.expires_at * 1000).toLocaleDateString(${JSON.stringify(lang)});
            left.appendChild(ex);
          }
          row.appendChild(left);
          const right = document.createElement('div');
          right.style.cssText = 'display:flex;align-items:center;gap:.9rem;flex-wrap:wrap';
          // Auto-renew toggle (registered domains only).
          if (o.status === 'registered') {
            const lbl = document.createElement('label');
            lbl.className = 'ar-toggle';
            lbl.title = T.autorenew_off_note;
            const cb = document.createElement('input');
            cb.type = 'checkbox'; cb.checked = !!o.auto_renew;
            cb.onchange = function () { setAutoRenew(o.id, cb); };
            const span = document.createElement('span'); span.textContent = T.autorenew;
            lbl.appendChild(cb); lbl.appendChild(span);
            right.appendChild(lbl);
          }
          if (o.status === 'registered') {
            const dns = document.createElement('button');
            dns.className = 'reconnect-btn'; dns.textContent = T.dns;
            dns.onclick = function () { openDns(o.id, o.domain); };
            right.appendChild(dns);
            const rc = document.createElement('button');
            rc.className = 'reconnect-btn'; rc.textContent = T.reconnect;
            rc.onclick = function () { reconnect(o.id, rc); };
            right.appendChild(rc);
          }
          const pill = document.createElement('span');
          pill.className = 'pill ' + (o.status === 'registered' ? 'ok' : (o.status === 'paid' || o.status === 'registering') ? 'warn' : 'bad');
          pill.textContent = o.status === 'registered' ? T.st_registered : (o.status === 'paid' || o.status === 'registering') ? T.st_working : T.st_failed;
          right.appendChild(pill);
          row.appendChild(right);
          list.appendChild(row);
        });
      } catch (e) { /* quiet */ }
    }
    // ---- DNS records manager ----
    const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];
    let dnsId = 0;
    function closeDns() { document.getElementById('dns-modal').classList.remove('open'); }
    async function openDns(id, domain) {
      dnsId = id;
      document.getElementById('dns-domain').textContent = domain;
      document.getElementById('dns-err').textContent = '';
      document.getElementById('email-provider').value = '';
      document.getElementById('email-custom').hidden = true;
      document.getElementById('email-mx').innerHTML = '';
      ['ec-spf','ec-dmarc','ec-dkim-name','ec-dkim-val'].forEach(function(i){ var el=document.getElementById(i); if(el) el.value=''; });
      document.getElementById('dns-table').innerHTML = '<p class="bm-sub">' + T.dns_loading + '</p>';
      document.getElementById('dns-modal').classList.add('open');
      try {
        const r = await fetch('/api/domains/' + id + '/dns');
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || T.err);
        renderDns(d.records);
      } catch (e) { document.getElementById('dns-table').innerHTML = '<p class="bm-err">' + (e.message || T.err) + '</p>'; }
    }
    function renderDns(records) {
      const box = document.getElementById('dns-table');
      box.innerHTML = '';
      const head = document.createElement('div'); head.className = 'dns-row dns-head';
      head.innerHTML = '<span>' + T.dns_type + '</span><span>' + T.dns_name + '</span><span>' + T.dns_value + '</span><span>' + T.dns_prio + '</span><span></span>';
      box.appendChild(head);
      if (!records.length) { const p = document.createElement('p'); p.className = 'bm-sub'; p.textContent = T.dns_empty; box.appendChild(p); }
      records.forEach(function (rec) { box.appendChild(dnsRow(rec)); });
    }
    function dnsRow(rec) {
      const row = document.createElement('div'); row.className = 'dns-row' + (rec.locked ? ' locked' : '');
      if (rec.locked) {
        row.innerHTML = '<span>' + esc(rec.type) + '</span><span>' + esc(rec.name) + '</span><span class="dns-val">' + esc(rec.address) + '</span><span>—</span><span class="dns-lock" title="' + T.dns_locked + '">🔒</span>';
        return row;
      }
      const typeSel = '<select class="d-type">' + DNS_TYPES.map(function (t) { return '<option' + (t === rec.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + (DNS_TYPES.indexOf(rec.type) < 0 && rec.type ? '<option selected>' + esc(rec.type) + '</option>' : '') + '</select>';
      row.innerHTML = typeSel +
        '<input class="d-name" value="' + esc(rec.name || '@') + '" placeholder="@">' +
        '<input class="d-addr" value="' + esc(rec.address || '') + '">' +
        '<input class="d-prio" value="' + esc(rec.mxpref || '10') + '" style="width:60px">' +
        '<button class="dns-del" title="' + T.dns_remove + '">✕</button>';
      row.querySelector('.dns-del').onclick = function () { row.remove(); };
      return row;
    }
    function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
    function addDnsRow() {
      const box = document.getElementById('dns-table');
      const empty = box.querySelector('p.bm-sub'); if (empty) empty.remove();
      box.appendChild(dnsRow({ name: '@', type: 'A', address: '', mxpref: '10' }));
    }
    function collectDns() {
      return Array.from(document.querySelectorAll('#dns-table .dns-row:not(.locked):not(.dns-head)')).map(function (row) {
        return {
          type: row.querySelector('.d-type').value,
          name: row.querySelector('.d-name').value.trim() || '@',
          address: row.querySelector('.d-addr').value.trim(),
          mxpref: row.querySelector('.d-prio').value.trim() || '10',
        };
      }).filter(function (r) { return r.address; });
    }
    async function saveDns(btn) {
      btn.disabled = true; btn.textContent = T.dns_saving;
      document.getElementById('dns-err').textContent = '';
      try {
        const r = await fetch('/api/domains/' + dnsId + '/dns', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: collectDns() }),
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || T.err);
        btn.textContent = T.dns_saved;
        setTimeout(function () { btn.disabled = false; btn.textContent = T.dns_save; }, 1500);
      } catch (e) { document.getElementById('dns-err').textContent = e.message || T.err; btn.disabled = false; btn.textContent = T.dns_save; }
    }
    function emailProviderChange() {
      var custom = document.getElementById('email-provider').value === 'custom';
      var box = document.getElementById('email-custom');
      if (box) box.hidden = !custom;
      if (custom && !document.querySelector('#email-mx .ec-mx')) addMxRow();
    }
    function addMxRow() {
      var wrap = document.getElementById('email-mx');
      var row = document.createElement('div'); row.className = 'ec-mx';
      row.innerHTML = '<input class="ec-input ec-mx-host" placeholder="' + T.email_mx_host + '">'
        + '<input class="ec-input ec-mx-prio" type="number" min="0" value="10" placeholder="' + T.email_mx_prio + '">'
        + '<button type="button" class="dns-del" onclick="this.closest(\\'.ec-mx\\').remove()">✕</button>';
      wrap.appendChild(row);
    }
    async function applyEmail(btn) {
      const provider = document.getElementById('email-provider').value;
      if (!provider) return;
      const payload = { provider: provider };
      if (provider === 'custom') {
        payload.mx = Array.from(document.querySelectorAll('#email-mx .ec-mx')).map(function (r) {
          return { host: r.querySelector('.ec-mx-host').value.trim(), priority: r.querySelector('.ec-mx-prio').value.trim() };
        }).filter(function (m) { return m.host; });
        payload.spf = document.getElementById('ec-spf').value.trim();
        payload.dmarc = document.getElementById('ec-dmarc').value.trim();
        payload.dkim = { name: document.getElementById('ec-dkim-name').value.trim(), value: document.getElementById('ec-dkim-val').value.trim() };
        if (!payload.mx.length) { document.getElementById('dns-err').textContent = T.email_need_mx; return; }
      }
      btn.disabled = true; btn.textContent = T.email_applying;
      document.getElementById('dns-err').textContent = '';
      try {
        const r = await fetch('/api/domains/' + dnsId + '/dns/email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || T.err);
        btn.textContent = T.email_done;
        const lr = await fetch('/api/domains/' + dnsId + '/dns'); const ld = await lr.json();
        if (ld.success) renderDns(ld.records);
        setTimeout(function () { btn.disabled = false; btn.textContent = T.email_setup; }, 1500);
      } catch (e) { document.getElementById('dns-err').textContent = e.message || T.err; btn.disabled = false; btn.textContent = T.email_setup; }
    }
    async function reconnect(id, btn) {
      btn.disabled = true; btn.textContent = T.reconnecting;
      try {
        const r = await fetch('/api/domains/' + id + '/reconnect', { method: 'POST' });
        const d = await r.json();
        if (!r.ok || !d.dns) throw new Error(T.reconnect_fail);
        btn.textContent = T.reconnect_ok;
      } catch (e) { btn.disabled = false; btn.textContent = T.reconnect; alert(e.message || T.reconnect_fail); }
    }
    async function setAutoRenew(id, cb) {
      const want = cb.checked;
      cb.disabled = true;
      try {
        const r = await fetch('/api/domains/' + id + '/auto-renew', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auto_renew: want }),
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || T.err);
        cb.checked = !!d.auto_renew;
      } catch (e) { cb.checked = !want; alert(e.message || T.err); }
      finally { cb.disabled = false; }
    }
    loadMyDomains();
  </script>
</body>
</html>`;
  return htmlResponse(html);
}
