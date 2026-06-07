// GET /domains — the domain store: search, buy, and see your domains.
// billingAuth-gated (purchases are account-bound; renewal cards are saved).
// When Namecheap isn't configured the page renders a "coming soon" note so
// the UI can ship ahead of the secrets (email-stub degradation pattern).

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { isNamecheapConfigured } from '../../utils/namecheap.js';
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
        <div><label>${tr('domstore.f_country')}</label><input id="c-country" maxlength="2" placeholder="US" style="text-transform:uppercase"></div>
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
          const pill = document.createElement('span');
          pill.className = 'pill ' + (o.status === 'registered' ? 'ok' : (o.status === 'paid' || o.status === 'registering') ? 'warn' : 'bad');
          pill.textContent = o.status === 'registered' ? T.st_registered : (o.status === 'paid' || o.status === 'registering') ? T.st_working : T.st_failed;
          row.appendChild(pill);
          list.appendChild(row);
        });
      } catch (e) { /* quiet */ }
    }
    loadMyDomains();
  </script>
</body>
</html>`;
  return htmlResponse(html);
}
