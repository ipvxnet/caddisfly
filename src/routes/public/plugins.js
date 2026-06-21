// GET /plugins — the plugin marketplace. Browse/subscribe/manage $5/mo feature
// add-ons. Calls POST /api/plugins/:key/{subscribe,cancel} (A2). See
// PLUGIN_PLATFORM_DESIGN.md §9.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getBillingAccount } from '../../db/billing.js';
import { getAccountPlugins, isEntitlementValid, PLUGIN_GRACE_SECONDS } from '../../db/account-plugins.js';
import { hasBasePlan } from '../../plugins/entitlements.js';
import { PLUGINS } from '../../plugins/manifest.js';
import { isStripeConfigured } from '../../utils/stripe.js';

function fmtDate(ts) {
  if (!ts) return '';
  try { return new Date(ts * 1000).toISOString().slice(0, 10); } catch { return ''; }
}
const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function handlePluginsMarketplace(ctx) {
  const { env, billingEmail, url } = ctx;
  const origin = env.APP_URL || (url ? new URL(url).origin : '');
  const acct = billingEmail ? await getBillingAccount(env.DB, billingEmail) : null;
  const basePlan = hasBasePlan(acct);
  const ownedRows = billingEmail ? await getAccountPlugins(env.DB, billingEmail) : [];
  const owned = new Map(ownedRows.map((r) => [r.plugin_key, r]));
  const now = Math.floor(Date.now() / 1000);

  let banner = '';
  if (!billingEmail) {
    banner = `<div class="notice warn">Please <a href="/billing">sign in</a> to manage plugins.</div>`;
  } else if (!isStripeConfigured(env)) {
    banner = `<div class="notice warn">Billing is temporarily unavailable.</div>`;
  } else if (!basePlan) {
    banner = `<div class="notice warn">Plugins are add-ons to a paid plan. <a href="/billing">Upgrade your plan</a> to add them.</div>`;
  }

  const cards = Object.values(PLUGINS).map((p) => {
    const row = owned.get(p.key);
    const valid = isEntitlementValid(row, now);
    let state, action;
    if (row && row.status === 'active') {
      state = `<span class="pill ok">Active</span>`;
      action = `<button class="btn btn-ghost cf-plug" data-act="cancel" data-key="${p.key}">Cancel</button>`;
    } else if (row && valid) {
      // canceling/canceled but still in grace
      const until = fmtDate((row.current_period_end || now) + PLUGIN_GRACE_SECONDS);
      state = `<span class="pill warn">Ends ${until}</span>`;
      action = `<button class="btn btn-primary cf-plug" data-act="subscribe" data-key="${p.key}">Resubscribe</button>`;
    } else {
      state = `<span class="pill">${money(p.priceCents)}/mo</span>`;
      action = basePlan
        ? `<button class="btn btn-primary cf-plug" data-act="subscribe" data-key="${p.key}">Add — ${money(p.priceCents)}/mo</button>`
        : `<a class="btn btn-ghost" href="/billing">Requires a paid plan</a>`;
    }
    return `<div class="pl-card">
      <div class="pl-head"><h3>${esc(p.label)}</h3>${state}</div>
      <p class="pl-sum">${esc(p.summary)}</p>
      <div class="pl-action">${action}</div>
    </div>`;
  }).join('');

  const inner = `
    <h1>Plugins</h1>
    <p class="sub">Add powerful, optional features to your sites — $5/mo each, cancel anytime.</p>
    ${banner}
    <div id="pl-msg"></div>
    <div class="pl-grid">${cards}</div>
    <p class="muted-link" style="margin-top:1.4rem">Canceled plugins keep working for a 7-day grace period, then their sections are hidden on your live site. Your content is kept and restored if you resubscribe.</p>
    <script>
      (function(){
        document.querySelectorAll('.cf-plug').forEach(function(b){
          b.addEventListener('click', async function(){
            var key=b.dataset.key, act=b.dataset.act;
            b.disabled=true; var old=b.textContent; b.textContent='…';
            var msg=document.getElementById('pl-msg');
            try{
              var res=await fetch('/api/plugins/'+key+'/'+act,{method:'POST',headers:{'Content-Type':'application/json'}});
              var data=await res.json();
              if(data.ok){ location.reload(); return; }
              msg.innerHTML='<div class="notice err">'+ (data.error==='base_plan_required'?'A paid plan is required for plugins.':data.error==='plugin_not_configured'?'This plugin isn\\'t available yet — check back soon.':data.error==='no_subscription'?'No active subscription to attach to.':'Something went wrong ('+(data.error||res.status)+').') +'</div>';
            }catch(e){ msg.innerHTML='<div class="notice err">Network error. Please try again.</div>'; }
            b.disabled=false; b.textContent=old;
          });
        });
      })();
    </script>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Plugins — Caddisfly', description: 'Add optional features to your sites.', origin, path: '/plugins' })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .bwrap{max-width:820px;margin:0 auto;padding:3rem 1.5rem}
    .bwrap h1{font-size:clamp(1.8rem,4vw,2.4rem);font-weight:900;color:var(--ink);letter-spacing:-.02em;margin-bottom:.4rem}
    .sub{color:var(--body);margin-bottom:1.6rem}
    .pl-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}
    .pl-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem;display:flex;flex-direction:column;gap:.6rem}
    .pl-head{display:flex;justify-content:space-between;align-items:center;gap:.6rem}
    .pl-head h3{font-size:1.15rem;color:var(--ink);margin:0}
    .pl-sum{color:var(--body);font-size:.92rem;flex:1}
    .pl-action{margin-top:.3rem}
    .pl-action .btn{width:100%;justify-content:center}
    .pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.15rem .7rem;font-size:.78rem;font-weight:700;color:var(--p2);white-space:nowrap}
    .pill.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
    .pill.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
    .notice{border-radius:12px;padding:.9rem 1.1rem;margin-bottom:1.2rem;font-size:.92rem}
    .notice.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e}
    .notice.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    .muted-link{color:var(--muted);font-size:.85rem}
    @media (max-width:620px){.pl-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  ${siteHeader('/pricing', {})}
  <main><div class="bwrap">${inner}</div></main>
  ${siteFooter({ lang: 'en' })}
</body>
</html>`;

  return htmlResponse(html);
}
