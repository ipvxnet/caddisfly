// GET /ai-builder/store/:project_id — the owner's store manager. Commerce v1:
// this step ships the Stripe Connect panel (connect / disconnect / status);
// the product manager + orders inbox land here in the next steps.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { hasPlugin } from '../../plugins/entitlements.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function handleStoreManager(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const publicId = params.project_id;
  // Advanced Store plugin → show the inventory (stock) field when entitled.
  const hasAdvStore = await hasPlugin(env, ctx.billingEmail, 'advanced_store');

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
    label{display:block;font-size:.8rem;font-weight:700;color:var(--ink);margin:.8rem 0 .3rem;text-transform:uppercase;letter-spacing:.03em}
    label .hint{font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted)}
    input,textarea,select{width:100%;box-sizing:border-box;padding:.7rem .9rem;border:1.5px solid var(--line);border-radius:11px;font-family:inherit;font-size:.95rem;background:#fff}
    input:focus,textarea:focus,select:focus{outline:none;border-color:var(--p1)}
    textarea{resize:vertical;line-height:1.55}
    .pill.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
    .prod{padding:1rem 0;border-bottom:1px solid var(--line)}
    .prod:last-child{border-bottom:none}
    .prod-top{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}
    .prod-thumb{width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:var(--soft)}
    .prod-thumb.ph{display:flex;align-items:center;justify-content:center;font-size:1.4rem}
    .prod-main{flex:1;min-width:180px}
    .prod-name{font-weight:800;color:var(--ink)}
    .prod-price{color:var(--muted);font-size:.9rem;margin-top:.15rem;font-weight:700}
    .prod-actions{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}
    .prod-edit{background:var(--soft,#f8f9fc);border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem 1.2rem;margin-top:.9rem}
    .row2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
    .row3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:1rem}
    .edit-actions{display:flex;gap:.6rem;margin-top:1rem;align-items:center}
    .desc-row{display:flex;gap:.6rem;align-items:flex-start}
    .desc-row textarea{flex:1}
    .link-btn{background:none;border:none;color:var(--p2);cursor:pointer;font-size:.85rem;font-weight:600;padding:0 .3rem}
    .link-btn.danger{color:#b91c1c}
    .addform{display:none;background:var(--soft,#f8f9fc);border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem 1.2rem;margin-top:.9rem}
    @media (max-width:640px){.row2,.row3{grid-template-columns:1fr}}
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
        <a class="btn" href="/ai-preview/${esc(publicId)}/shop" target="_blank" rel="noopener">${tr('storem.view_shop')}</a>
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
      <h2>${tr('storem.orders_heading')} <span class="muted" id="ord-count"></span></h2>
      <div id="orders-list"><p class="muted">${tr('storem.loading')}</p></div>
    </div>

    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
        <h2 style="margin-bottom:0">${tr('storem.products_heading')} <span class="muted" id="prod-count"></span></h2>
        <button class="btn" id="add-toggle" onclick="toggleAdd()">${tr('storem.add_product')}</button>
      </div>
      <p class="muted" id="limit-note" style="margin-top:.4rem"></p>

      <div class="addform" id="addform">
        <div class="row3">
          <div><label>${tr('storem.name_label')}</label><input id="np-name" maxlength="140" placeholder="${tr('storem.name_ph')}"></div>
          <div><label>${tr('storem.price_label')}</label><input id="np-price" inputmode="decimal" placeholder="29.99"></div>
          <div><label>${tr('storem.type_label')}</label>
            <select id="np-type">
              <option value="physical">${tr('storem.type_physical')}</option>
              <option value="digital">${tr('storem.type_digital')}</option>
              <option value="service">${tr('storem.type_service')}</option>
            </select>
          </div>
        </div>
        <label>${tr('storem.desc_label')} <span class="hint">${tr('storem.desc_hint')}</span></label>
        <div class="desc-row">
          <textarea id="np-desc" rows="4"></textarea>
          <button class="btn ghost" onclick="aiDescribe('np-name','np-desc',this)">${tr('storem.ai_desc')}</button>
        </div>
        <label>${tr('storem.image_label')} <span class="hint">${tr('storem.image_hint')}</span></label>
        <input id="np-image" maxlength="500" placeholder="https://…">
        <label>${tr('storem.category_label')} <span class="hint">${tr('storem.category_hint')}</span></label>
        <input id="np-category" maxlength="80" placeholder="Parts, Tools…">
        <label style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem;font-weight:600"><input type="checkbox" id="np-forsale" checked style="width:auto"> ${tr('storem.forsale_label')}</label>
        ${hasAdvStore ? `<label>${tr('storem.stock_label')} <span class="hint">${tr('storem.stock_hint')}</span></label><input id="np-stock" type="number" min="0" placeholder="∞">` : ''}
        <details style="margin-top:.8rem"><summary style="cursor:pointer;font-weight:600">${tr('storem.media_label')}</summary>
          <label>${tr('storem.media_gallery')} <span class="hint">${tr('storem.media_perline')}</span></label>
          <textarea id="np-gallery" rows="2" placeholder="https://…/photo1.jpg"></textarea>
          <label>${tr('storem.media_videos')} <span class="hint">${tr('storem.media_perline')}</span></label>
          <textarea id="np-videos" rows="2" placeholder="https://youtu.be/…"></textarea>
          <label>${tr('storem.media_files')} <span class="hint">Name | URL</span></label>
          <textarea id="np-files" rows="2" placeholder="Datasheet | https://…/spec.pdf"></textarea>
          <button type="button" class="btn ghost" style="margin-top:.3rem" onclick="uploadPdf(this, this.previousElementSibling)">${tr('storem.upload_pdf')}</button>
          <label>${tr('storem.media_links')} <span class="hint">Label | URL</span></label>
          <textarea id="np-links" rows="2" placeholder="Manufacturer | https://…"></textarea>
        </details>
        <div class="edit-actions">
          <button class="btn" onclick="createProduct(this)">${tr('storem.create_btn')}</button>
          <button class="btn ghost" onclick="toggleAdd()">${tr('storem.cancel')}</button>
          <span class="muted">${tr('storem.ai_credits_note')}</span>
        </div>
      </div>

      <div id="products-list"><p class="muted">${tr('storem.loading')}</p></div>
    </div>
  </div></main>
  ${siteFooter({ lang })}
  <script>
    var PID = ${JSON.stringify(publicId)};
    var ADV = ${hasAdvStore ? 'true' : 'false'};
    var T = {
      connected: ${JSON.stringify(tr('storem.connected_as'))},
      notConnected: ${JSON.stringify(tr('storem.not_connected'))},
      notConfigured: ${JSON.stringify(tr('storem.not_configured'))},
      connect: ${JSON.stringify(tr('storem.connect'))},
      connecting: ${JSON.stringify(tr('storem.connecting'))},
      disconnect: ${JSON.stringify(tr('storem.disconnect'))},
      disconnectConfirm: ${JSON.stringify(tr('storem.disconnect_confirm'))},
      errorPrefix: ${JSON.stringify(tr('storem.error_prefix'))},
      noProducts: ${JSON.stringify(tr('storem.no_products'))},
      limitNote: ${JSON.stringify(tr('storem.limit_note'))},
      limitReached: ${JSON.stringify(tr('storem.limit_reached'))},
      edit: ${JSON.stringify(tr('storem.edit'))},
      save: ${JSON.stringify(tr('storem.save'))},
      saving: ${JSON.stringify(tr('storem.saving'))},
      cancel: ${JSON.stringify(tr('storem.cancel'))},
      del: ${JSON.stringify(tr('storem.delete'))},
      delConfirm: ${JSON.stringify(tr('storem.delete_confirm'))},
      hide: ${JSON.stringify(tr('storem.hide'))},
      show: ${JSON.stringify(tr('storem.show'))},
      visible: ${JSON.stringify(tr('storem.visible_pill'))},
      hidden: ${JSON.stringify(tr('storem.hidden_pill'))},
      genImage: ${JSON.stringify(tr('storem.gen_image'))},
      genImageBusy: ${JSON.stringify(tr('storem.gen_image_busy'))},
      aiDesc: ${JSON.stringify(tr('storem.ai_desc'))},
      aiDescBusy: ${JSON.stringify(tr('storem.ai_desc_busy'))},
      adding: ${JSON.stringify(tr('storem.creating'))},
      addProduct: ${JSON.stringify(tr('storem.create_btn'))},
      nameLabel: ${JSON.stringify(tr('storem.name_label'))},
      priceLabel: ${JSON.stringify(tr('storem.price_label'))},
      typeLabel: ${JSON.stringify(tr('storem.type_label'))},
      descLabel: ${JSON.stringify(tr('storem.desc_label'))},
      imageLabel: ${JSON.stringify(tr('storem.image_label'))},
      categoryLabel: ${JSON.stringify(tr('storem.category_label'))},
      forsaleLabel: ${JSON.stringify(tr('storem.forsale_label'))},
      mediaLabel: ${JSON.stringify(tr('storem.media_label'))},
      mediaGallery: ${JSON.stringify(tr('storem.media_gallery'))},
      mediaVideos: ${JSON.stringify(tr('storem.media_videos'))},
      mediaFiles: ${JSON.stringify(tr('storem.media_files'))},
      mediaLinks: ${JSON.stringify(tr('storem.media_links'))},
      mediaPerline: ${JSON.stringify(tr('storem.media_perline'))},
      uploadPdf: ${JSON.stringify(tr('storem.upload_pdf'))},
      stockLabel: ${JSON.stringify(tr('storem.stock_label'))},
      stockHint: ${JSON.stringify(tr('storem.stock_hint'))},
      types: {
        physical: ${JSON.stringify(tr('storem.type_physical'))},
        digital: ${JSON.stringify(tr('storem.type_digital'))},
        service: ${JSON.stringify(tr('storem.type_service'))},
      },
      badPrice: ${JSON.stringify(tr('storem.bad_price'))},
      noOrders: ${JSON.stringify(tr('storem.no_orders'))},
      ordPaid: ${JSON.stringify(tr('storem.ord_paid'))},
      ordNew: ${JSON.stringify(tr('storem.ord_new'))},
      importStripe: ${JSON.stringify(tr('storem.import_stripe'))},
      importing: ${JSON.stringify(tr('storem.importing'))},
      importDone: ${JSON.stringify(tr('storem.import_done'))},
      importSkips: ${JSON.stringify(tr('storem.import_skips'))},
      importNone: ${JSON.stringify(tr('storem.import_none'))},
      skipReasons: {
        recurring: ${JSON.stringify(tr('storem.skip_recurring'))},
        exists: ${JSON.stringify(tr('storem.skip_exists'))},
        currency: ${JSON.stringify(tr('storem.skip_currency'))},
        no_price: ${JSON.stringify(tr('storem.skip_no_price'))},
        limit: ${JSON.stringify(tr('storem.skip_limit'))},
        policy: ${JSON.stringify(tr('storem.skip_policy'))},
        price_range: ${JSON.stringify(tr('storem.skip_price_range'))},
      },
    };
    var LANG = ${JSON.stringify(lang)};
    var CUR = 'usd';
    var LIMIT = null, ENFORCED = false, COUNT = 0;
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
        var imp = document.createElement('button');
        imp.className = 'btn ghost'; imp.textContent = T.importStripe;
        imp.onclick = function () { importProducts(imp); };
        acts.appendChild(imp);
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

    // ---- products -----------------------------------------------------------
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function money(cents) {
      try { return new Intl.NumberFormat(LANG, { style: 'currency', currency: CUR.toUpperCase() }).format(cents / 100); }
      catch (e) { return (cents / 100).toFixed(2) + ' ' + CUR.toUpperCase(); }
    }
    function parsePrice(v) {
      var n = parseFloat(String(v).replace(',', '.'));
      if (!isFinite(n)) return null;
      return Math.round(n * 100);
    }
    function atCap() { return ENFORCED && LIMIT != null && COUNT >= LIMIT; }

    function toggleAdd() {
      var f = document.getElementById('addform');
      f.style.display = f.style.display === 'block' ? 'none' : 'block';
      if (f.style.display === 'block') document.getElementById('np-name').focus();
    }

    function prodCard(p) {
      var mt = mediaText(p.media_json || '');
      var thumb = p.image
        ? '<img class="prod-thumb" src="' + esc(p.image) + '" alt="" loading="lazy">'
        : '<div class="prod-thumb ph">📦</div>';
      return '<div class="prod" data-id="' + p.id + '">' +
        '<div class="prod-top">' + thumb +
        '<div class="prod-main"><div class="prod-name">' + esc(p.name) +
        ' <span class="pill ' + (p.active ? 'ok' : 'warn') + '">' + (p.active ? T.visible : T.hidden) + '</span>' +
        ' <span class="pill">' + (T.types[p.product_type] || p.product_type) + '</span></div>' +
        '<div class="prod-price">' + money(p.price_cents) + '</div></div>' +
        '<div class="prod-actions">' +
        '<button class="btn ghost" onclick="toggleEdit(' + p.id + ')">' + T.edit + '</button>' +
        '<button class="btn ghost" onclick="genImage(' + p.id + ', this)">' + T.genImage + '</button>' +
        '<button class="btn ghost" onclick="toggleActive(' + p.id + ', ' + (p.active ? 'false' : 'true') + ')">' + (p.active ? T.hide : T.show) + '</button>' +
        '<button class="link-btn danger" onclick="delProduct(' + p.id + ')">' + T.del + '</button>' +
        '</div></div>' +
        '<div class="prod-edit" id="edit-' + p.id + '" style="display:none">' +
        '<div class="row3">' +
        '<div><label>' + T.nameLabel + '</label><input class="f-name" maxlength="140" value="' + esc(p.name) + '"></div>' +
        '<div><label>' + T.priceLabel + '</label><input class="f-price" inputmode="decimal" value="' + (p.price_cents / 100).toFixed(2) + '"></div>' +
        '<div><label>' + T.typeLabel + '</label><select class="f-type">' +
        ['physical', 'digital', 'service'].map(function (t) {
          return '<option value="' + t + '"' + (p.product_type === t ? ' selected' : '') + '>' + T.types[t] + '</option>';
        }).join('') + '</select></div></div>' +
        '<label>' + T.descLabel + '</label>' +
        '<div class="desc-row"><textarea class="f-desc" rows="4">' + esc(p.description || '') + '</textarea>' +
        '<button class="btn ghost" onclick="aiDescribeEdit(' + p.id + ', this)">' + T.aiDesc + '</button></div>' +
        '<label>' + T.imageLabel + '</label><input class="f-image" maxlength="500" value="' + esc(p.image || '') + '">' +
        '<label>' + T.categoryLabel + '</label><input class="f-category" maxlength="80" value="' + esc(p.category || '') + '">' +
        '<label style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem;font-weight:600"><input type="checkbox" class="f-forsale"' + (p.for_sale === 0 ? '' : ' checked') + ' style="width:auto"> ' + T.forsaleLabel + '</label>' +
        (ADV ? '<label>' + T.stockLabel + ' <span class="hint">' + T.stockHint + '</span></label><input class="f-stock" type="number" min="0" value="' + (p.stock == null ? '' : p.stock) + '">' : '') +
        '<details style="margin-top:.8rem"><summary style="cursor:pointer;font-weight:600">' + T.mediaLabel + '</summary>' +
        '<label>' + T.mediaGallery + ' <span class="hint">' + T.mediaPerline + '</span></label><textarea class="m-gallery" rows="2">' + esc(mt.gallery) + '</textarea>' +
        '<label>' + T.mediaVideos + ' <span class="hint">' + T.mediaPerline + '</span></label><textarea class="m-videos" rows="2">' + esc(mt.videos) + '</textarea>' +
        '<label>' + T.mediaFiles + ' <span class="hint">Name | URL</span></label><textarea class="m-files" rows="2">' + esc(mt.files) + '</textarea>' +
        '<button type="button" class="btn ghost" style="margin-top:.3rem" onclick="uploadPdf(this, this.previousElementSibling)">' + T.uploadPdf + '</button>' +
        '<label>' + T.mediaLinks + ' <span class="hint">Label | URL</span></label><textarea class="m-links" rows="2">' + esc(mt.links) + '</textarea>' +
        '</details>' +
        '<div class="edit-actions">' +
        '<button class="btn" onclick="saveProduct(' + p.id + ', this)">' + T.save + '</button>' +
        '<button class="btn ghost" onclick="toggleEdit(' + p.id + ')">' + T.cancel + '</button>' +
        '</div></div></div>';
    }

    function renderProducts(d) {
      CUR = d.currency || 'usd';
      LIMIT = d.limit; ENFORCED = !!d.enforced; COUNT = d.products.length;
      document.getElementById('prod-count').textContent = '(' + COUNT + (LIMIT != null ? '/' + LIMIT : '') + ')';
      var note = document.getElementById('limit-note');
      if (atCap()) { note.textContent = T.limitReached; note.style.color = '#92400e'; }
      else if (LIMIT != null) { note.textContent = T.limitNote.replace('{n}', COUNT).replace('{limit}', LIMIT); note.style.color = ''; }
      else { note.textContent = ''; }
      document.getElementById('add-toggle').disabled = atCap();
      var list = document.getElementById('products-list');
      list.innerHTML = COUNT ? d.products.map(prodCard).join('') : '<p class="muted">' + T.noProducts + '</p>';
    }

    async function loadProducts() {
      try { renderProducts(await api('GET', '/products')); }
      catch (e) { document.getElementById('products-list').innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
    }

    // ---- catalogue media (one-per-line text → media_json) ----
    function linesToArr(s){ return (s||'').split('\\n').map(function(x){return x.trim();}).filter(Boolean); }
    function linesToPairs(s, keyName){ return linesToArr(s).map(function(line){ var i=line.indexOf('|'); var a=i<0?line:line.slice(0,i).trim(); var b=i<0?line:line.slice(i+1).trim(); var o={url:b}; o[keyName]=a; return o; }).filter(function(o){return o.url;}); }
    function mediaFrom(g,v,f,l){ return { gallery: linesToArr(g), videos: linesToArr(v), files: linesToPairs(f,'name'), links: linesToPairs(l,'label') }; }
    function mediaText(raw){ var m={}; try{ m=raw?JSON.parse(raw):{}; }catch(e){ m={}; } var arr=function(x){return Array.isArray(x)?x:[];}; return { gallery: arr(m.gallery).join('\\n'), videos: arr(m.videos).join('\\n'), files: arr(m.files).map(function(f){return (f.name||'')+' | '+(f.url||'');}).join('\\n'), links: arr(m.links).map(function(l){return (l.label||'')+' | '+(l.url||'');}).join('\\n') }; }

    // Upload a PDF → R2, append "name | url" to the given files textarea.
    function uploadPdf(btn, ta) {
      if (!ta) return;
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/pdf';
      inp.onchange = async function(){
        var f = inp.files && inp.files[0]; if (!f) return;
        btn.disabled = true; var old = btn.textContent; btn.textContent = '…';
        try {
          var fd = new FormData(); fd.append('file', f);
          var res = await fetch('/api/ai-builder/' + PID + '/upload', { method: 'POST', body: fd });
          var d = await res.json();
          if (d && d.success && d.url) { var line = f.name + ' | ' + d.url; ta.value = ta.value ? (ta.value + '\\n' + line) : line; }
          else { alert((d && d.error) || T.errorPrefix); }
        } catch(e) { alert(T.errorPrefix); }
        btn.disabled = false; btn.textContent = old;
      };
      inp.click();
    }

    async function createProduct(btn) {
      var name = document.getElementById('np-name').value.trim();
      var forsale = document.getElementById('np-forsale').checked;
      var cents = parsePrice(document.getElementById('np-price').value);
      if (!name) { document.getElementById('np-name').focus(); return; }
      if (forsale && (cents == null || cents < 50)) { alert(T.badPrice); return; }
      if (!forsale) cents = 0;
      btn.disabled = true; btn.textContent = T.adding;
      try {
        await api('POST', '/products', {
          name: name,
          price_cents: cents,
          product_type: document.getElementById('np-type').value,
          description: document.getElementById('np-desc').value,
          image: document.getElementById('np-image').value.trim(),
          category: document.getElementById('np-category').value.trim(),
          for_sale: forsale ? 1 : 0,
          media: mediaFrom(document.getElementById('np-gallery').value, document.getElementById('np-videos').value, document.getElementById('np-files').value, document.getElementById('np-links').value),
          stock: document.getElementById('np-stock') ? document.getElementById('np-stock').value : '',
        });
        document.getElementById('np-name').value = '';
        document.getElementById('np-price').value = '';
        document.getElementById('np-desc').value = '';
        document.getElementById('np-image').value = '';
        document.getElementById('np-category').value = '';
        document.getElementById('np-forsale').checked = true;
        ['np-gallery','np-videos','np-files','np-links'].forEach(function(id){ document.getElementById(id).value = ''; });
        toggleAdd();
        await loadProducts();
      } catch (e) { alert(e.message); }
      btn.disabled = false; btn.textContent = T.addProduct;
    }

    function toggleEdit(id) {
      var el = document.getElementById('edit-' + id);
      el.style.display = el.style.display === 'block' ? 'none' : 'block';
    }

    async function saveProduct(id, btn) {
      var box = document.getElementById('edit-' + id);
      var forsale = box.querySelector('.f-forsale').checked;
      var cents = parsePrice(box.querySelector('.f-price').value);
      if (forsale && (cents == null || cents < 50)) { alert(T.badPrice); return; }
      if (!forsale) cents = 0;
      btn.disabled = true; btn.textContent = T.saving;
      try {
        await api('PUT', '/products/' + id, {
          name: box.querySelector('.f-name').value.trim(),
          price_cents: cents,
          product_type: box.querySelector('.f-type').value,
          description: box.querySelector('.f-desc').value,
          image: box.querySelector('.f-image').value.trim(),
          category: box.querySelector('.f-category').value.trim(),
          for_sale: forsale ? 1 : 0,
          media: mediaFrom(box.querySelector('.m-gallery').value, box.querySelector('.m-videos').value, box.querySelector('.m-files').value, box.querySelector('.m-links').value),
          stock: box.querySelector('.f-stock') ? box.querySelector('.f-stock').value : '',
        });
        await loadProducts();
      } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = T.save; }
    }

    async function toggleActive(id, active) {
      try { await api('PUT', '/products/' + id, { active: active }); await loadProducts(); }
      catch (e) { alert(e.message); }
    }

    async function delProduct(id) {
      if (!confirm(T.delConfirm)) return;
      try { await api('DELETE', '/products/' + id); await loadProducts(); }
      catch (e) { alert(e.message); }
    }

    async function genImage(id, btn) {
      btn.disabled = true; btn.textContent = T.genImageBusy;
      try { await api('POST', '/products/' + id + '/image'); await loadProducts(); }
      catch (e) { alert(e.message); btn.disabled = false; btn.textContent = T.genImage; }
    }

    async function aiDescribe(nameId, descId, btn) {
      var name = document.getElementById(nameId).value.trim();
      var descEl = document.getElementById(descId);
      if (!name) { document.getElementById(nameId).focus(); return; }
      btn.disabled = true; btn.textContent = T.aiDescBusy;
      try {
        var d = await api('POST', '/products/ai-describe', { name: name, notes: descEl.value.trim() });
        descEl.value = d.description;
      } catch (e) { alert(e.message); }
      btn.disabled = false; btn.textContent = T.aiDesc;
    }

    async function importProducts(btn) {
      btn.disabled = true; btn.textContent = T.importing;
      try {
        var d = await api('POST', '/import');
        if (!d.found) { alert(T.importNone); }
        else {
          var skips = '';
          if (d.skipped && d.skipped.length) {
            var byReason = {};
            d.skipped.forEach(function (s) {
              var r = T.skipReasons[s.reason] || s.reason;
              (byReason[r] = byReason[r] || []).push(s.name);
            });
            var list = Object.keys(byReason).map(function (r) { return byReason[r].length + ' × ' + r; }).join(', ');
            skips = T.importSkips.replace('{list}', list);
          }
          alert(T.importDone.replace('{n}', d.imported).replace('{found}', d.found).replace('{skips}', skips));
        }
        await loadProducts();
      } catch (e) { alert(T.errorPrefix + ' ' + e.message); }
      btn.disabled = false; btn.textContent = T.importStripe;
    }

    async function aiDescribeEdit(id, btn) {
      var box = document.getElementById('edit-' + id);
      var name = box.querySelector('.f-name').value.trim();
      var descEl = box.querySelector('.f-desc');
      if (!name) return;
      btn.disabled = true; btn.textContent = T.aiDescBusy;
      try {
        var d = await api('POST', '/products/ai-describe', { name: name, notes: descEl.value.trim() });
        descEl.value = d.description;
      } catch (e) { alert(e.message); }
      btn.disabled = false; btn.textContent = T.aiDesc;
    }

    loadProducts();

    // ---- orders -------------------------------------------------------------
    function orderRow(o) {
      var items = [];
      try { items = JSON.parse(o.items_json || '[]'); } catch (e) {}
      var summary = items.map(function (i) { return i.name + ' × ' + i.qty; }).join(', ');
      var when = o.created_at ? new Date(o.created_at * 1000).toLocaleString(LANG, { dateStyle: 'medium', timeStyle: 'short' }) : '';
      var total = (function () {
        try { return new Intl.NumberFormat(LANG, { style: 'currency', currency: (o.currency || 'usd').toUpperCase() }).format(o.amount_total / 100); }
        catch (e) { return (o.amount_total / 100).toFixed(2); }
      })();
      var div = document.createElement('div');
      div.className = 'prod';
      div.innerHTML = '<div class="prod-top"><div class="prod-main">' +
        '<div class="prod-name"><span class="o-ref"></span> ' +
        (o.is_read ? '' : '<span class="pill warn">' + T.ordNew + '</span> ') +
        '<span class="pill ok">' + T.ordPaid + '</span></div>' +
        '<div class="prod-price"><span class="o-total"></span> · <span class="o-buyer"></span></div>' +
        '<div class="post-meta muted" style="font-size:.85rem;margin-top:.2rem"><span class="o-items"></span> · <span class="o-when"></span></div>' +
        '</div></div>';
      div.querySelector('.o-ref').textContent = '#' + (o.stripe_session_id || '').slice(-8).toUpperCase();
      div.querySelector('.o-total').textContent = total;
      div.querySelector('.o-buyer').textContent = (o.customer_name ? o.customer_name + ' · ' : '') + (o.customer_email || '');
      div.querySelector('.o-items').textContent = summary;
      div.querySelector('.o-when').textContent = when;
      return div;
    }
    async function loadOrders() {
      var list = document.getElementById('orders-list');
      try {
        var d = await api('GET', '/orders');
        document.getElementById('ord-count').textContent = '(' + d.orders.length + ')';
        list.innerHTML = '';
        if (!d.orders.length) { list.innerHTML = '<p class="muted">' + T.noOrders + '</p>'; return; }
        d.orders.forEach(function (o) { list.appendChild(orderRow(o)); });
      } catch (e) { list.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
    }
    loadOrders();
  </script>
</body>
</html>`;

  return htmlResponse(html);
}
