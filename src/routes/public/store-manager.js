// GET /ai-builder/store/:project_id — the owner's store manager. Commerce v1:
// this step ships the Stripe Connect panel (connect / disconnect / status);
// the product manager + orders inbox land here in the next steps.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function handleStoreManager(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const publicId = params.project_id;

  // Resolve the project name (ai-first, like blog-manager).
  const aiProject = await getAIProjectByProjectId(env.DB, publicId);
  let name;
  if (aiProject) {
    name = aiProject.project_name || 'Your Website';
  } else {
    const rp = await getProjectByPreviewId(env.DB, publicId);
    if (!rp) return new Response('Project not found', { status: 404 });
    try {
      const p = JSON.parse(rp.company_profile_json || '{}');
      name = (p && p.name) || rp.website_url || 'Your Website';
    } catch { name = rp.website_url || 'Your Website'; }
  }

  const connectedBanner = url.searchParams.get('connected') === '1';
  const stripeError = url.searchParams.get('stripe_error') || '';

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('storem.meta_title', { name: esc(name) }), description: 'Manage your online store.', origin: url.origin })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    .awrap{max-width:860px;margin:0 auto;padding:2.5rem 1.5rem 4rem}
    .ahead{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1.4rem}
    .ahead h1{font-size:clamp(1.6rem,3.5vw,2.2rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .ahead .sub{color:var(--muted);font-size:.92rem}
    .ahead .acts{display:flex;gap:.5rem;flex-wrap:wrap}
    .panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem 1.6rem;margin-bottom:1.2rem}
    .panel h2{font-size:1.05rem;color:var(--ink);margin-bottom:.6rem}
    .muted{color:var(--muted);font-size:.88rem}
    .btn{display:inline-flex;align-items:center;gap:.3rem;background:var(--grad);color:#fff;border:none;border-radius:10px;padding:.5rem .9rem;font-size:.85rem;font-weight:700;cursor:pointer;text-decoration:none}
    .btn.ghost{background:#fff;color:var(--p2);border:1px solid var(--line)}
    .btn.ghost:hover{border-color:var(--p1)}
    .btn:disabled{opacity:.6;cursor:default}
    .pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.15rem .65rem;font-size:.74rem;font-weight:700;color:var(--p2);vertical-align:middle}
    .pill.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
    .banner{border-radius:12px;padding:.7rem 1rem;font-size:.88rem;margin-bottom:1.2rem}
    .banner.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
    .banner.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    .stripe-row{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:.8rem}
    .stripe-status{font-weight:700;color:var(--ink)}
  </style>
</head>
<body>
  ${siteHeader('', { lang })}
  <main><div class="awrap">
    <div class="ahead">
      <div>
        <h1>🛍 ${esc(name)}</h1>
        <div class="sub">${tr('storem.title_sub')}</div>
      </div>
      <div class="acts">
        <a class="btn ghost" href="/ai-builder/customize/${esc(publicId)}">${tr('storem.customize')}</a>
      </div>
    </div>

    ${connectedBanner ? `<div class="banner ok">${tr('storem.connected_ok')}</div>` : ''}
    ${stripeError ? `<div class="banner err">${tr('storem.error_prefix')} ${esc(stripeError)}</div>` : ''}

    <div class="panel">
      <h2>${tr('storem.payments_heading')}</h2>
      <p class="muted">${tr('storem.payments_intro')}</p>
      <div class="stripe-row">
        <div class="stripe-status" id="stripe-status">${tr('storem.checking')}</div>
        <div id="stripe-actions"></div>
      </div>
    </div>

    <div class="panel">
      <h2>${tr('storem.products_heading')}</h2>
      <p class="muted" id="products-note">${tr('storem.products_soon')}</p>
    </div>
  </div></main>
  ${siteFooter({ lang })}
  <script>
    var PID = ${JSON.stringify(publicId)};
    var T = {
      connected: ${JSON.stringify(tr('storem.connected_as'))},
      notConnected: ${JSON.stringify(tr('storem.not_connected'))},
      notConfigured: ${JSON.stringify(tr('storem.not_configured'))},
      connect: ${JSON.stringify(tr('storem.connect'))},
      connecting: ${JSON.stringify(tr('storem.connecting'))},
      disconnect: ${JSON.stringify(tr('storem.disconnect'))},
      disconnectConfirm: ${JSON.stringify(tr('storem.disconnect_confirm'))},
      errorPrefix: ${JSON.stringify(tr('storem.error_prefix'))},
    };
    async function api(method, path, body) {
      const r = await fetch('/api/ai-builder/' + PID + '/store' + path, {
        method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error((d && d.error) || 'Request failed');
      return d;
    }
    function renderStripe(s) {
      var status = document.getElementById('stripe-status');
      var acts = document.getElementById('stripe-actions');
      acts.innerHTML = '';
      if (!s.configured) { status.innerHTML = '<span class="pill">' + T.notConfigured + '</span>'; return; }
      if (s.connected) {
        status.innerHTML = '<span class="pill ok">✓ ' + T.connected.replace('{account}', s.account) + '</span>';
        var b = document.createElement('button');
        b.className = 'btn ghost'; b.textContent = T.disconnect;
        b.onclick = async function () {
          if (!confirm(T.disconnectConfirm)) return;
          b.disabled = true;
          try { await api('POST', '/stripe/disconnect'); loadStripe(); }
          catch (e) { alert(T.errorPrefix + ' ' + e.message); b.disabled = false; }
        };
        acts.appendChild(b);
      } else {
        status.innerHTML = '<span class="pill">' + T.notConnected + '</span>';
        var c = document.createElement('button');
        c.className = 'btn'; c.textContent = T.connect;
        c.onclick = async function () {
          c.disabled = true; c.textContent = T.connecting;
          try { var d = await api('POST', '/stripe/connect'); location.href = d.url; }
          catch (e) { alert(T.errorPrefix + ' ' + e.message); c.disabled = false; c.textContent = T.connect; }
        };
        acts.appendChild(c);
      }
    }
    async function loadStripe() {
      try { renderStripe(await api('GET', '/stripe')); }
      catch (e) { document.getElementById('stripe-status').textContent = T.errorPrefix + ' ' + e.message; }
    }
    loadStripe();
  </script>
</body>
</html>`;

  return htmlResponse(html);
}
