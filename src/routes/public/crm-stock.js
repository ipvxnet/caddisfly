// CRM Stock view (Phase 1) — a live inventory of the site's store products +
// variants, with low/out-of-stock highlighting and inline stock editing. Reads
// the Advanced Store's products/product_variants; editing stock requires the
// advanced_store plugin (same gate as the store). Page gated by pluginGate('crm').
// i18n: local STK dict (en/es/pt) by ctx.lang.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject, getOrCreateConfig } from '../api/ai-builder/store.js';
import { getProductsByProject, setProductStock } from '../../db/products.js';
import { getProductIdsWithVariants, listVariants, setVariantStock } from '../../db/variants.js';
import { hasPlugin } from '../../plugins/entitlements.js';

const LOW = 5; // low-stock highlight threshold (no per-store config yet)
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (cents, cur) => { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'USD').toUpperCase() }).format((cents || 0) / 100); } catch { return '$' + ((cents || 0) / 100).toFixed(2); } };

const STK = {
  en: {
    meta_title: 'Stock — CRM', title: 'Stock', back_crm: '← Back to CRM',
    sub: 'Live inventory from your store. {count} {label}.', product_one: 'product', product_many: 'products',
    need_adv: 'Stock tracking is part of the Advanced Store plugin. {enable} to edit stock levels here.', enable_link: 'Enable Advanced Store',
    th_product: 'Product', th_sku: 'SKU', th_type: 'Type', th_price: 'Price', th_stock: 'Stock', th_state: 'State',
    s_products: 'Products', s_tracked: 'Tracked', s_low: 'Low stock', s_out: 'Out of stock',
    badge_out: 'Out', badge_low: 'Low', badge_ok: 'In stock', badge_untracked: 'Untracked',
    import_btn: '⬆ Import', save_all: 'Save stock', saved: 'Saved', empty: 'No products yet — add products in your Store to track their stock here.',
    err: 'Something went wrong.', low_hint: 'Highlighted as low at {n} or fewer.', untracked_hint: 'Leave blank for untracked (unlimited).',
  },
  es: {
    meta_title: 'Inventario — CRM', title: 'Inventario', back_crm: '← Volver al CRM',
    sub: 'Inventario en vivo de tu tienda. {count} {label}.', product_one: 'producto', product_many: 'productos',
    need_adv: 'El control de inventario forma parte del plugin Tienda avanzada. {enable} para editar los niveles de inventario aquí.', enable_link: 'Habilitar Tienda avanzada',
    th_product: 'Producto', th_sku: 'SKU', th_type: 'Tipo', th_price: 'Precio', th_stock: 'Inventario', th_state: 'Estado',
    s_products: 'Productos', s_tracked: 'Seguimiento activo', s_low: 'Bajo inventario', s_out: 'Agotado',
    badge_out: 'Agotado', badge_low: 'Bajo', badge_ok: 'Disponible', badge_untracked: 'Sin seguimiento',
    import_btn: '⬆ Importar', save_all: 'Guardar inventario', saved: 'Guardado', empty: 'No hay productos aún — añade productos en tu Tienda para seguir su inventario aquí.',
    err: 'Algo salió mal.', low_hint: 'Resaltado como bajo cuando es {n} o menos.', untracked_hint: 'Dejar en blanco para sin seguimiento (ilimitado).',
  },
  pt: {
    meta_title: 'Estoque — CRM', title: 'Estoque', back_crm: '← Voltar para CRM',
    sub: 'Inventário em tempo real da sua loja. {count} {label}.', product_one: 'produto', product_many: 'produtos',
    need_adv: 'O controle de estoque faz parte do plugin Loja avançada. {enable} para editar os níveis de estoque aqui.', enable_link: 'Ativar Loja avançada',
    th_product: 'Produto', th_sku: 'SKU', th_type: 'Tipo', th_price: 'Preço', th_stock: 'Estoque', th_state: 'Estado',
    s_products: 'Produtos', s_tracked: 'Em acompanhamento', s_low: 'Estoque baixo', s_out: 'Fora de estoque',
    badge_out: 'Fora', badge_low: 'Baixo', badge_ok: 'Disponível', badge_untracked: 'Sem acompanhamento',
    import_btn: '⬆ Importar', save_all: 'Salvar estoque', saved: 'Salvo', empty: 'Ainda não há produtos — adicione produtos em sua Loja para acompanhar o estoque aqui.',
    err: 'Algo deu errado.', low_hint: 'Destacado como baixo quando é {n} ou menos.', untracked_hint: 'Deixe em branco para sem acompanhamento (ilimitado).',
  },
};
const pick = (lang) => STK[lang] || STK.en;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

// State for a stock value: null=untracked, 0=out, <=LOW=low, else ok.
function stateOf(stock) {
  if (stock == null) return 'untracked';
  if (stock <= 0) return 'out';
  if (stock <= LOW) return 'low';
  return 'ok';
}

/** GET /ai-builder/crm/:project_id/stock */
export async function handleStockView(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  const currency = config.store_currency || 'usd';
  const hasAdv = await hasPlugin(env, r.email, 'advanced_store');

  const products = await getProductsByProject(env.DB, r.projectKey, false);
  const withVariants = new Set(await getProductIdsWithVariants(env.DB, r.projectKey));
  const dis = hasAdv ? '' : ' disabled';

  // Build rows + tally summary over the editable "units" (variant-less products + variants).
  let summary = { products: products.length, tracked: 0, low: 0, out: 0 };
  const tally = (stock) => { const s = stateOf(stock); if (s !== 'untracked') summary.tracked++; if (s === 'low') summary.low++; if (s === 'out') summary.out++; };
  const badge = (st) => `<span class="sbadge ${st}">${st === 'out' ? T.badge_out : st === 'low' ? T.badge_low : st === 'untracked' ? T.badge_untracked : T.badge_ok}</span>`;
  const stockInput = (kind, id, stock) => `<input class="stk-in" type="number" min="0" data-kind="${kind}" data-id="${id}" value="${stock == null ? '' : stock}" placeholder="∞"${dis}>`;
  const typeLabel = (t) => esc(t || 'physical');

  const rowsHtml = [];
  for (const p of products) {
    if (withVariants.has(p.id)) {
      rowsHtml.push(`<tr class="prow"><td><strong>${esc(p.name)}</strong></td><td class="muted">—</td><td>${typeLabel(p.product_type)}</td><td>${money(p.price_cents, currency)}</td><td class="muted">—</td><td></td></tr>`);
      const variants = await listVariants(env.DB, r.projectKey, p.id);
      for (const v of variants) {
        tally(v.stock);
        rowsHtml.push(`<tr class="vrow"><td><span class="vlabel">↳ ${esc(v.label)}</span></td><td>${esc(v.sku || '—')}</td><td class="muted">${T.th_product.toLowerCase()}</td><td>${money(v.price_cents || p.price_cents, currency)}</td><td>${stockInput('variant', v.id, v.stock)}</td><td>${badge(stateOf(v.stock))}</td></tr>`);
      }
    } else {
      tally(p.stock);
      rowsHtml.push(`<tr><td><strong>${esc(p.name)}</strong></td><td>—</td><td>${typeLabel(p.product_type)}</td><td>${money(p.price_cents, currency)}</td><td>${stockInput('product', p.id, p.stock)}</td><td>${badge(stateOf(p.stock))}</td></tr>`);
    }
  }

  const base = `/ai-builder/crm/${esc(params.project_id)}`;
  const countLabel = products.length === 1 ? T.product_one : T.product_many;
  const advBanner = hasAdv ? '' : `<div class="snotice">${T.need_adv.replace('{enable}', `<a href="/plugins">${T.enable_link}</a>`)}</div>`;
  const stat = (k, v, cls = '') => `<div class="sstat ${cls}"><div class="sk">${k}</div><div class="sv">${v}</div></div>`;

  const inner = `
    <div class="ahead"><h1>📦 ${T.title}</h1><div style="display:flex;gap:.5rem;flex-wrap:wrap"><a class="btn ghost" href="${base}/stock/import">${T.import_btn}</a><a class="btn ghost" href="${base}">${T.back_crm}</a></div></div>
    <p class="sub">${T.sub.replace('{count}', products.length).replace('{label}', countLabel)}</p>
    ${advBanner}
    ${products.length ? `
      <div class="sstats">
        ${stat(T.s_products, summary.products)}
        ${stat(T.s_tracked, summary.tracked)}
        ${stat(T.s_low, summary.low, summary.low ? 'warn' : '')}
        ${stat(T.s_out, summary.out, summary.out ? 'bad' : '')}
      </div>
      <div class="stwrap"><table class="stable">
        <thead><tr><th>${T.th_product}</th><th>${T.th_sku}</th><th>${T.th_type}</th><th>${T.th_price}</th><th>${T.th_stock}</th><th>${T.th_state}</th></tr></thead>
        <tbody>${rowsHtml.join('')}</tbody>
      </table></div>
      <p class="shint">${T.low_hint.replace('{n}', LOW)} ${hasAdv ? T.untracked_hint : ''}</p>
      ${hasAdv ? `<div class="saveline"><button class="btn" type="button" id="stk-save">${T.save_all}</button><span id="stk-msg" class="muted"></span></div>` : ''}
    ` : `<div class="aempty">${T.empty}</div>`}
    <script>
      var BASE = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/crm/stock';
      var S = ${JSON.stringify({ saved: T.saved, err: T.err })};
      function restate(inp){
        var v = inp.value.trim()==='' ? null : Math.max(0, parseInt(inp.value,10) || 0);
        var cell = inp.closest('tr').querySelector('.sbadge'); if(!cell) return;
        var st = v==null ? 'untracked' : v<=0 ? 'out' : v<=${LOW} ? 'low' : 'ok';
        cell.className = 'sbadge ' + st;
      }
      document.querySelectorAll('.stk-in').forEach(function(i){ i.addEventListener('input', function(){ restate(i); }); });
      var saveBtn = document.getElementById('stk-save');
      if(saveBtn) saveBtn.addEventListener('click', async function(){
        var updates = [];
        document.querySelectorAll('.stk-in').forEach(function(i){
          updates.push({ kind: i.dataset.kind, id: Number(i.dataset.id), stock: i.value.trim()==='' ? null : Number(i.value) });
        });
        saveBtn.disabled = true; var msg = document.getElementById('stk-msg');
        try{
          var res = await fetch(BASE, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ updates: updates }) });
          var d = await res.json();
          msg.textContent = (res.ok && d.success) ? S.saved+' ✓' : ((d&&d.error)||S.err);
        }catch(e){ msg.textContent = S.err; }
        saveBtn.disabled = false;
      });
    </script>`;

  return htmlResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: 'Store inventory.', origin: url.origin, path: '/ai-builder/crm/stock' })}<meta name="robots" content="noindex">
  <style>${baseCss()}
    main{min-height:60vh}.awrap{max-width:980px;margin:0 auto;padding:2.4rem 1.5rem}
    .ahead{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .ahead h1{font-size:clamp(1.5rem,3.5vw,2rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);margin:.3rem 0 1.2rem}.muted{color:var(--muted)}
    .snotice{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:.8rem 1rem;margin-bottom:1.2rem;font-size:.9rem}
    .sstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.7rem;margin-bottom:1.1rem}
    .sstat{background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:.65rem .8rem}
    .sstat.warn{background:#fffbeb;border-color:#fde68a}.sstat.bad{background:#fef2f2;border-color:#fecaca}
    .sk{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}.sv{font-size:1.3rem;font-weight:800;color:var(--ink)}
    .stwrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
    .stable{width:100%;border-collapse:collapse;font-size:.9rem}
    .stable th{text-align:left;padding:.6rem .8rem;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid var(--line)}
    .stable td{padding:.55rem .8rem;border-bottom:1px solid var(--line);vertical-align:middle}
    .stable tr:last-child td{border-bottom:none}.stable .vrow td{background:#fafbfc}.stable .vlabel{color:var(--p2);font-weight:600}
    .stk-in{width:90px;padding:.4rem .5rem;border:1.5px solid var(--line);border-radius:8px;font-family:inherit;font-size:.88rem}
    .stk-in:disabled{background:#f1f5f9;color:#94a3b8}
    .sbadge{display:inline-block;border-radius:999px;padding:.1rem .6rem;font-size:.72rem;font-weight:700}
    .sbadge.ok{background:#ecfdf5;color:#065f46}.sbadge.low{background:#fffbeb;color:#92400e}.sbadge.out{background:#fef2f2;color:#991b1b}.sbadge.untracked{background:#f1f5f9;color:#64748b}
    .shint{color:var(--muted);font-size:.78rem;margin:.7rem 0 0}
    .saveline{display:flex;align-items:center;gap:.8rem;margin-top:1rem}
    .aempty{text-align:center;color:var(--muted);border:2px dashed var(--line);border-radius:14px;padding:2.5rem 1.5rem}
  </style></head><body>${siteHeader('/dashboard', {})}<main><div class="awrap">${inner}</div></main>${siteFooter({ lang })}</body></html>`);
}

/** PUT /api/ai-builder/:project_id/crm/stock — bulk inline stock update (advanced_store gated). */
export async function handleStockUpdate(ctx) {
  const { env, params, request } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  if (!(await hasPlugin(env, r.email, 'advanced_store'))) {
    return json({ success: false, error: 'Stock editing requires the Advanced Store plugin.' }, 402);
  }
  const body = await request.json().catch(() => ({}));
  const updates = Array.isArray(body.updates) ? body.updates : [];
  let updated = 0;
  for (const u of updates) {
    const id = Number(u.id);
    if (!Number.isInteger(id)) continue;
    const stock = u.stock == null || u.stock === '' ? null : u.stock;
    if (u.kind === 'variant') { if (await setVariantStock(env.DB, r.projectKey, id, stock)) updated++; }
    else if (u.kind === 'product') { if (await setProductStock(env.DB, r.projectKey, id, stock)) updated++; }
  }
  return json({ success: true, updated });
}
