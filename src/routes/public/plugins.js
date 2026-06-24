// GET /plugins — the plugin marketplace. Browse/subscribe/manage $5/mo feature
// add-ons. Calls POST /api/plugins/:key/{subscribe,cancel} (A2). See
// PLUGIN_PLATFORM_DESIGN.md §9. i18n: local PL dict (en/es/pt), by ctx.lang.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getBillingAccount } from '../../db/billing.js';
import { getAccountPlugins, isEntitlementValid, PLUGIN_GRACE_SECONDS } from '../../db/account-plugins.js';
import { hasBasePlan } from '../../plugins/entitlements.js';
import { PLUGINS, BUNDLES, pluginLabel, pluginSummary } from '../../plugins/manifest.js';
import { isStripeConfigured } from '../../utils/stripe.js';

const PL = {
  en: {
    meta_title: 'Plugins — Caddisfly', meta_desc: 'Add optional features to your sites.',
    h1: 'Plugins', sub: 'Add powerful, optional features to your sites — $5/mo each, cancel anytime.',
    signin_banner: 'Please {signin} to manage plugins.', signin: 'sign in',
    billing_unavail: 'Billing is temporarily unavailable.',
    need_plan: 'Plugins are add-ons to a paid plan. {upgrade} to add them.', upgrade_link: 'Upgrade your plan',
    included: 'Included', part_bundle: 'Part of your All-Access bundle',
    active: 'Active', cancel: 'Cancel', ends: 'Ends {date}', resubscribe: 'Resubscribe',
    add_price: 'Add — {price}/mo', requires_plan: 'Requires a paid plan',
    get_all: 'Get all plugins — {price}/mo', bundle_suffix: '— every plugin', save_line: 'Save {amt}/mo vs buying separately.',
    grace: 'Canceled plugins keep working for a 7-day grace period, then their sections are hidden on your live site. Your content is kept and restored if you resubscribe.',
    err_base: 'A paid plan is required for plugins.', err_not_avail: "This plugin isn't available yet — check back soon.",
    err_no_sub: 'No active subscription to attach to.', err_generic: 'Something went wrong ({e}).', err_net: 'Network error. Please try again.',
  },
  es: {
    meta_title: 'Plugins — Caddisfly', meta_desc: 'Añade funciones opcionales a tus sitios.',
    h1: 'Plugins', sub: 'Añade funciones poderosas y opcionales a tus sitios — $5/mes cada uno, cancela cuando quieras.',
    signin_banner: 'Por favor {signin} para gestionar los plugins.', signin: 'inicia sesión',
    billing_unavail: 'El cobro está temporalmente no disponible.',
    need_plan: 'Los plugins son complementos de un plan de pago. {upgrade} para agregarlos.', upgrade_link: 'Mejora tu plan',
    included: 'Incluido', part_bundle: 'Parte de tu paquete Acceso total',
    active: 'Activo', cancel: 'Cancelar', ends: 'Finaliza {date}', resubscribe: 'Volver a suscribirse',
    add_price: 'Añadir — {price}/mes', requires_plan: 'Requiere un plan de pago',
    get_all: 'Obtén todos los plugins — {price}/mes', bundle_suffix: '— todos los plugins', save_line: 'Ahorra {amt}/mes frente a comprarlos por separado.',
    grace: 'Los plugins cancelados siguen funcionando durante un período de gracia de 7 días, después sus secciones se ocultan en tu sitio publicado. Tu contenido se conserva y se restaura si vuelves a suscribirte.',
    err_base: 'Se requiere un plan de pago para los plugins.', err_not_avail: 'Este plugin aún no está disponible — vuelve pronto.',
    err_no_sub: 'No hay una suscripción activa a la que añadirlo.', err_generic: 'Algo salió mal ({e}).', err_net: 'Error de red. Inténtalo de nuevo.',
  },
  pt: {
    meta_title: 'Plugins — Caddisfly', meta_desc: 'Adicione funcionalidades opcionais aos seus sites.',
    h1: 'Plugins', sub: 'Adicione funcionalidades poderosas e opcionais aos seus sites — $5/mês cada um, cancele quando quiser.',
    signin_banner: 'Por favor {signin} para gerenciar os plugins.', signin: 'entre',
    billing_unavail: 'A cobrança está temporariamente indisponível.',
    need_plan: 'Plugins são complementos de um plano pago. {upgrade} para adicioná-los.', upgrade_link: 'Faça upgrade do seu plano',
    included: 'Incluído', part_bundle: 'Parte do seu pacote Acesso total',
    active: 'Ativo', cancel: 'Cancelar', ends: 'Encerra em {date}', resubscribe: 'Assinar novamente',
    add_price: 'Adicionar — {price}/mês', requires_plan: 'Requer um plano pago',
    get_all: 'Obtenha todos os plugins — {price}/mês', bundle_suffix: '— todos os plugins', save_line: 'Economize {amt}/mês em vez de comprar separadamente.',
    grace: 'Plugins cancelados continuam funcionando por um período de carência de 7 dias, depois suas seções ficam ocultas no seu site publicado. Seu conteúdo é mantido e restaurado se você assinar novamente.',
    err_base: 'Um plano pago é necessário para os plugins.', err_not_avail: 'Este plugin ainda não está disponível — volte em breve.',
    err_no_sub: 'Nenhuma assinatura ativa para anexar.', err_generic: 'Algo deu errado ({e}).', err_net: 'Erro de rede. Tente novamente.',
  },
};

function fmtDate(ts) {
  if (!ts) return '';
  try { return new Date(ts * 1000).toISOString().slice(0, 10); } catch { return ''; }
}
const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function handlePluginsMarketplace(ctx) {
  const { env, billingEmail, url } = ctx;
  const origin = env.APP_URL || (url ? new URL(url).origin : '');
  const lang = (ctx && ctx.lang) || 'en';
  const T = PL[lang] || PL.en;
  const acct = billingEmail ? await getBillingAccount(env.DB, billingEmail) : null;
  const basePlan = hasBasePlan(acct);
  const ownedRows = billingEmail ? await getAccountPlugins(env.DB, billingEmail) : [];
  const owned = new Map(ownedRows.map((r) => [r.plugin_key, r]));
  const now = Math.floor(Date.now() / 1000);

  let banner = '';
  if (!billingEmail) {
    banner = `<div class="notice warn">${T.signin_banner.replace('{signin}', `<a href="/billing">${T.signin}</a>`)}</div>`;
  } else if (!isStripeConfigured(env)) {
    banner = `<div class="notice warn">${T.billing_unavail}</div>`;
  } else if (!basePlan) {
    banner = `<div class="notice warn">${T.need_plan.replace('{upgrade}', `<a href="/billing">${T.upgrade_link}</a>`)}</div>`;
  }

  // The All-Access bundle entitles all its member plugins via one row.
  const bundle = BUNDLES.all_access;
  const bundleConfigured = bundle && env[bundle.priceVar];
  const bundleActive = bundle ? isEntitlementValid(owned.get(bundle.key), now) : false;

  const cards = Object.values(PLUGINS).map((p) => {
    const row = owned.get(p.key);
    const valid = isEntitlementValid(row, now);
    const coveredByBundle = bundleActive && bundle.plugins.includes(p.key);
    let state, action;
    if (coveredByBundle) {
      // The bundle owns this plugin — manage it from the bundle card.
      state = `<span class="pill ok">${T.included}</span>`;
      action = `<span class="muted-link">${T.part_bundle}</span>`;
    } else if (row && row.status === 'active') {
      state = `<span class="pill ok">${T.active}</span>`;
      action = `<button class="btn btn-ghost cf-plug" data-act="cancel" data-key="${p.key}">${T.cancel}</button>`;
    } else if (row && valid) {
      // canceling/canceled but still in grace
      const until = fmtDate((row.current_period_end || now) + PLUGIN_GRACE_SECONDS);
      state = `<span class="pill warn">${T.ends.replace('{date}', until)}</span>`;
      action = `<button class="btn btn-primary cf-plug" data-act="subscribe" data-key="${p.key}">${T.resubscribe}</button>`;
    } else {
      state = `<span class="pill">${money(p.priceCents)}/mo</span>`;
      action = basePlan
        ? `<button class="btn btn-primary cf-plug" data-act="subscribe" data-key="${p.key}">${T.add_price.replace('{price}', money(p.priceCents))}</button>`
        : `<a class="btn btn-ghost" href="/billing">${T.requires_plan}</a>`;
    }
    return `<div class="pl-card">
      <div class="pl-head"><h3>${esc(pluginLabel(p.key, lang))}</h3>${state}</div>
      <p class="pl-sum">${esc(pluginSummary(p.key, lang))}</p>
      <div class="pl-action">${action}</div>
    </div>`;
  }).join('');

  // Bundle banner-card (only when a Stripe price is configured for it).
  let bundleCard = '';
  if (bundleConfigured) {
    const brow = owned.get(bundle.key);
    const sumIndividual = bundle.plugins.reduce((s, k) => s + ((PLUGINS[k] && PLUGINS[k].priceCents) || 0), 0);
    const savings = Math.max(0, sumIndividual - bundle.priceCents);
    let bstate, baction;
    if (brow && brow.status === 'active') {
      bstate = `<span class="pill ok">${T.active}</span>`;
      baction = `<button class="btn btn-ghost cf-plug" data-act="cancel" data-key="${bundle.key}">${T.cancel}</button>`;
    } else if (isEntitlementValid(brow, now)) {
      const until = fmtDate((brow.current_period_end || now) + PLUGIN_GRACE_SECONDS);
      bstate = `<span class="pill warn">${T.ends.replace('{date}', until)}</span>`;
      baction = `<button class="btn btn-primary cf-plug" data-act="subscribe" data-key="${bundle.key}">${T.resubscribe}</button>`;
    } else {
      bstate = `<span class="pill">${money(bundle.priceCents)}/mo</span>`;
      baction = basePlan
        ? `<button class="btn btn-primary cf-plug" data-act="subscribe" data-key="${bundle.key}">${T.get_all.replace('{price}', money(bundle.priceCents))}</button>`
        : `<a class="btn btn-ghost" href="/billing">${T.requires_plan}</a>`;
    }
    const saveLine = savings > 0 ? ` <strong>${T.save_line.replace('{amt}', money(savings))}</strong>` : '';
    bundleCard = `<div class="pl-bundle">
      <div class="pl-head"><h3>✨ ${esc(pluginLabel(bundle.key, lang))} ${T.bundle_suffix}</h3>${bstate}</div>
      <p class="pl-sum">${esc(pluginSummary(bundle.key, lang))}${saveLine}</p>
      <div class="pl-action">${baction}</div>
    </div>`;
  }

  const inner = `
    <h1>${T.h1}</h1>
    <p class="sub">${T.sub}</p>
    ${banner}
    <div id="pl-msg"></div>
    ${bundleCard}
    <div class="pl-grid">${cards}</div>
    <p class="muted-link" style="margin-top:1.4rem">${T.grace}</p>
    <script>
      (function(){
        var S = ${JSON.stringify({ base: T.err_base, notAvail: T.err_not_avail, noSub: T.err_no_sub, generic: T.err_generic, net: T.err_net })};
        document.querySelectorAll('.cf-plug').forEach(function(b){
          b.addEventListener('click', async function(){
            var key=b.dataset.key, act=b.dataset.act;
            b.disabled=true; var old=b.textContent; b.textContent='…';
            var msg=document.getElementById('pl-msg');
            try{
              var res=await fetch('/api/plugins/'+key+'/'+act,{method:'POST',headers:{'Content-Type':'application/json'}});
              var data=await res.json();
              if(data.ok){ location.reload(); return; }
              var m = data.error==='base_plan_required'?S.base:data.error==='plugin_not_configured'?S.notAvail:data.error==='no_subscription'?S.noSub:S.generic.replace('{e}', (data.error||res.status));
              msg.innerHTML='<div class="notice err">'+m+'</div>';
            }catch(e){ msg.innerHTML='<div class="notice err">'+S.net+'</div>'; }
            b.disabled=false; b.textContent=old;
          });
        });
      })();
    </script>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: T.meta_desc, origin, path: '/plugins' })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .bwrap{max-width:820px;margin:0 auto;padding:3rem 1.5rem}
    .bwrap h1{font-size:clamp(1.8rem,4vw,2.4rem);font-weight:900;color:var(--ink);letter-spacing:-.02em;margin-bottom:.4rem}
    .sub{color:var(--body);margin-bottom:1.6rem}
    .pl-bundle{background:linear-gradient(135deg,#faf5ff,#eff6ff);border:1.5px solid var(--p2);border-radius:16px;padding:1.4rem 1.5rem;margin-bottom:1.2rem;display:flex;flex-direction:column;gap:.6rem}
    .pl-bundle .pl-head h3{font-size:1.2rem}
    .pl-bundle .pl-action .btn{width:auto}
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
  ${siteFooter({ lang })}
</body>
</html>`;

  return htmlResponse(html);
}
