// CRM Stock — spreadsheet import (inventory Phase 2). Upload/paste a CSV (or TSV)
// of products → preview (create/update/skip per row) → apply. Reuses the shared
// upsertProductsBulk core (products.js). Products import always; the stock column
// is applied only with the advanced_store plugin. Respects the plan product cap.
// Page gated by pluginGate('crm'). i18n: local IMP dict (en/es/pt) by ctx.lang.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject } from '../api/ai-builder/store.js';
import { upsertProductsBulk, countProducts } from '../../db/products.js';
import { hasPlugin } from '../../plugins/entitlements.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { PRODUCT_LIMITS } from '../../utils/credits.js';

const MAX_ROWS = 1000;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

// Header aliases (lowercased) → canonical column. Covers en/es/pt.
const HEADER_ALIASES = {
  name: 'name', product: 'name', title: 'name', nombre: 'name', producto: 'name', nome: 'name', produto: 'name',
  price: 'price', amount: 'price', precio: 'price', preco: 'price', 'preço': 'price',
  stock: 'stock', qty: 'stock', quantity: 'stock', inventory: 'stock', existencias: 'stock', inventario: 'stock', estoque: 'stock', cantidad: 'stock', quantidade: 'stock',
  category: 'category', cat: 'category', 'categoría': 'category', categoria: 'category',
  type: 'type', tipo: 'type',
  description: 'description', desc: 'description', 'descripción': 'description', descricao: 'description', 'descrição': 'description',
};
const TYPE_ALIASES = { physical: 'physical', 'físico': 'physical', fisico: 'physical', digital: 'digital', service: 'service', servicio: 'service', 'serviço': 'service', servico: 'service' };

/** Parse CSV/TSV (auto-detect delimiter) handling quotes, escaped quotes, CRLF. */
export function parseDelimited(text) {
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!s) return [];
  const firstLine = s.slice(0, s.indexOf('\n') === -1 ? s.length : s.indexOf('\n'));
  const delim = (firstLine.includes('\t') && !firstLine.includes(',')) ? '\t' : ',';
  const grid = []; let row = []; let field = ''; let inQ = false; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); grid.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  row.push(field); grid.push(row);
  return grid.filter((r) => r.length && !(r.length === 1 && r[0].trim() === ''));
}

/** First row = headers; map remaining rows to normalized product objects. */
export function mapRows(grid) {
  if (grid.length < 2) return [];
  const headers = grid[0].map((h) => HEADER_ALIASES[String(h || '').trim().toLowerCase()] || '');
  const rows = [];
  for (let r = 1; r < grid.length; r++) {
    const obj = {}; let any = false;
    headers.forEach((key, ci) => { if (key) { const v = String(grid[r][ci] || '').trim(); obj[key] = v; if (v) any = true; } });
    if (any) {
      if (obj.type) obj.type = TYPE_ALIASES[obj.type.toLowerCase()] || obj.type;
      rows.push(obj);
    }
  }
  return rows;
}

const IMP = {
  en: {
    meta_title: 'Import inventory — CRM', title: 'Import inventory', back_stock: '← Back to stock',
    intro: 'Bulk add or update products from a spreadsheet. Export your sheet as CSV, then choose the file or paste the rows below.',
    cols_h: 'Columns (first row = headers, any order)',
    col_name: 'name — product name (required)', col_price: 'price — e.g. 19.99', col_stock: 'stock — whole number; blank = untracked',
    col_category: 'category — optional grouping', col_type: 'type — physical, digital or service', col_desc: 'description — optional',
    template: '⬇ Download template', file_label: 'Choose CSV file', or_paste: '…or paste CSV rows here',
    preview_btn: 'Preview', apply_btn: 'Apply changes',
    match_note: 'Products are matched by name: an existing product is updated, a new name is created.',
    no_adv: 'Stock values need the Advanced Store plugin — without it, products import but the stock column is skipped.',
    empty_csv: 'Paste CSV or choose a file first.', truncated: 'Only the first {n} rows were read.',
    th_row: 'Row', th_name: 'Name', th_action: 'Action', th_price: 'Price', th_stock: 'Stock', th_note: 'Note',
    a_create: 'Create', a_update: 'Update', a_error: 'Error', a_skipped: 'Skipped',
    sum_preview: '{create} to create · {update} to update · {error} error(s) · {skip} skipped',
    sum_done: 'Imported: {create} created · {update} updated · {error} error(s) · {skip} skipped',
    err_limit: 'Product limit reached for your plan.', err_name: 'Missing product name.', err: 'Something went wrong.',
  },
  es: {
    meta_title: 'Importar inventario — CRM', title: 'Importar inventario', back_stock: '← Volver al inventario',
    intro: 'Agrega o actualiza productos en masa desde una hoja de cálculo. Exporta tu hoja como CSV, luego elige el archivo o pega las filas a continuación.',
    cols_h: 'Columnas (primera fila = encabezados, cualquier orden)',
    col_name: 'name — nombre del producto (obligatorio)', col_price: 'price — p. ej. 19.99', col_stock: 'stock — número entero; vacío = no rastreado',
    col_category: 'category — agrupación opcional', col_type: 'type — physical, digital o service', col_desc: 'description — opcional',
    template: '⬇ Descargar plantilla', file_label: 'Elige archivo CSV', or_paste: '…o pega filas CSV aquí',
    preview_btn: 'Vista previa', apply_btn: 'Aplicar cambios',
    match_note: 'Los productos se asocian por nombre: un producto existente se actualiza, un nombre nuevo se crea.',
    no_adv: 'Los valores de stock requieren el plugin Tienda avanzada — sin él, los productos se importan pero la columna de stock se omite.',
    empty_csv: 'Pega CSV o elige un archivo primero.', truncated: 'Solo se leyeron las primeras {n} filas.',
    th_row: 'Fila', th_name: 'Nombre', th_action: 'Acción', th_price: 'Precio', th_stock: 'Stock', th_note: 'Nota',
    a_create: 'Crear', a_update: 'Actualizar', a_error: 'Error', a_skipped: 'Omitido',
    sum_preview: '{create} para crear · {update} para actualizar · {error} error(es) · {skip} omitido(s)',
    sum_done: 'Importado: {create} creados · {update} actualizados · {error} error(es) · {skip} omitido(s)',
    err_limit: 'Se alcanzó el límite de productos para tu plan.', err_name: 'Falta el nombre del producto.', err: 'Algo salió mal.',
  },
  pt: {
    meta_title: 'Importar estoque — CRM', title: 'Importar estoque', back_stock: '← Voltar para estoque',
    intro: 'Adicione ou atualize produtos em massa a partir de uma planilha. Exporte sua planilha como CSV, depois escolha o arquivo ou cole as linhas abaixo.',
    cols_h: 'Colunas (primeira linha = cabeçalhos, qualquer ordem)',
    col_name: 'name — nome do produto (obrigatório)', col_price: 'price — ex. 19.99', col_stock: 'stock — número inteiro; vazio = não rastreado',
    col_category: 'category — agrupamento opcional', col_type: 'type — physical, digital ou service', col_desc: 'description — opcional',
    template: '⬇ Baixar modelo', file_label: 'Escolher arquivo CSV', or_paste: '…ou cole as linhas CSV aqui',
    preview_btn: 'Pré-visualizar', apply_btn: 'Aplicar alterações',
    match_note: 'Produtos são associados pelo nome: um produto existente é atualizado, um nome novo é criado.',
    no_adv: 'Os valores de estoque exigem o plugin Loja avançada — sem ele, os produtos são importados, mas a coluna de estoque é ignorada.',
    empty_csv: 'Cole o CSV ou escolha um arquivo primeiro.', truncated: 'Apenas as primeiras {n} linhas foram lidas.',
    th_row: 'Linha', th_name: 'Nome', th_action: 'Ação', th_price: 'Preço', th_stock: 'Estoque', th_note: 'Nota',
    a_create: 'Criar', a_update: 'Atualizar', a_error: 'Erro', a_skipped: 'Ignorado',
    sum_preview: '{create} para criar · {update} para atualizar · {error} erro(s) · {skip} ignorado(s)',
    sum_done: 'Importado: {create} criados · {update} atualizados · {error} erro(s) · {skip} ignorado(s)',
    err_limit: 'Limite de produtos atingido para seu plano.', err_name: 'Nome do produto ausente.', err: 'Algo deu errado.',
  },
};
const pick = (lang) => IMP[lang] || IMP.en;

/** GET /ai-builder/crm/:project_id/stock/import/template — sample CSV. */
export function handleStockImportTemplate() {
  const csv = 'name,price,stock,category,type,description\n'
    + 'Sample Widget,19.99,25,Parts,physical,A sample product\n'
    + 'Consulting Hour,150,,Services,service,Billed per hour\n';
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="inventory-template.csv"' } });
}

/** GET /ai-builder/crm/:project_id/stock/import — the import page. */
export async function handleStockImportPage(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const hasAdv = await hasPlugin(env, r.email, 'advanced_store');
  const base = `/ai-builder/crm/${esc(params.project_id)}`;

  const inner = `
    <div class="ahead"><h1>⬆ ${T.title}</h1><a class="btn ghost" href="${base}/stock">${T.back_stock}</a></div>
    <p class="sub">${T.intro}</p>
    ${hasAdv ? '' : `<div class="inotice">${T.no_adv}</div>`}
    <div class="icard">
      <p class="icols-h">${T.cols_h}</p>
      <ul class="icols"><li>${T.col_name}</li><li>${T.col_price}</li><li>${T.col_stock}</li><li>${T.col_category}</li><li>${T.col_type}</li><li>${T.col_desc}</li></ul>
      <a class="btn ghost" href="${base}/stock/import/template">${T.template}</a>
    </div>
    <div class="icard">
      <label class="ifile">${T.file_label}<input id="imp-file" type="file" accept=".csv,.tsv,text/csv,text/plain"></label>
      <textarea id="imp-csv" rows="7" placeholder="${T.or_paste}"></textarea>
      <p class="imatch">${T.match_note}</p>
      <div class="iacts">
        <button class="btn" type="button" id="imp-preview">${T.preview_btn}</button>
        <button class="btn primary" type="button" id="imp-apply" style="display:none">${T.apply_btn}</button>
        <span id="imp-sum" class="imsg"></span>
      </div>
    </div>
    <div id="imp-result"></div>
    <script>
      var BASE = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/crm/stock/import';
      var T = ${JSON.stringify({ empty: T.empty_csv, err: T.err, sumPreview: T.sum_preview, sumDone: T.sum_done, truncated: T.truncated,
        thRow: T.th_row, thName: T.th_name, thAction: T.th_action, thPrice: T.th_price, thStock: T.th_stock, thNote: T.th_note,
        aCreate: T.a_create, aUpdate: T.a_update, aError: T.a_error, aSkipped: T.a_skipped, errLimit: T.err_limit, errName: T.err_name })};
      var fileEl = document.getElementById('imp-file'), csvEl = document.getElementById('imp-csv');
      var previewBtn = document.getElementById('imp-preview'), applyBtn = document.getElementById('imp-apply');
      fileEl.addEventListener('change', function(){ var f=this.files[0]; if(!f) return; var rd=new FileReader(); rd.onload=function(){ csvEl.value=rd.result; }; rd.readAsText(f); });
      function fmtSum(tpl, d){ return tpl.replace('{create}', d.created).replace('{update}', d.updated).replace('{error}', d.errors).replace('{skip}', d.skipped); }
      function noteFor(rec){ if(rec.error==='limit_reached') return T.errLimit; if(rec.error==='missing_name') return T.errName; return rec.error||''; }
      function actLabel(a){ return a==='create'?T.aCreate:a==='update'?T.aUpdate:a==='skipped'?T.aSkipped:T.aError; }
      function renderRows(d){
        var rowsH = d.rows.map(function(r){
          return '<tr class="ir-'+r.action+'"><td>'+r.rowNum+'</td><td>'+(r.name? r.name.replace(/[&<>]/g,''):'')+'</td>'+
            '<td><span class="ibadge '+r.action+'">'+actLabel(r.action)+'</span></td>'+
            '<td>'+(r.price_cents!=null? '$'+(r.price_cents/100).toFixed(2):'—')+'</td>'+
            '<td>'+(r.stock==null?'∞':r.stock)+'</td><td class="muted">'+noteFor(r)+'</td></tr>';
        }).join('');
        return '<div class="itwrap"><table class="itable"><thead><tr><th>'+T.thRow+'</th><th>'+T.thName+'</th><th>'+T.thAction+'</th><th>'+T.thPrice+'</th><th>'+T.thStock+'</th><th>'+T.thNote+'</th></tr></thead><tbody>'+rowsH+'</tbody></table></div>';
      }
      async function run(mode){
        var csv = csvEl.value.trim();
        var sum = document.getElementById('imp-sum');
        if(!csv){ sum.textContent = T.empty; return; }
        var btn = mode==='apply'?applyBtn:previewBtn; btn.disabled = true;
        try{
          var res = await fetch(BASE, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ csv: csv, mode: mode }) });
          var d = await res.json();
          if(!res.ok || !d.success){ sum.textContent = (d&&d.error)||T.err; btn.disabled=false; return; }
          document.getElementById('imp-result').innerHTML = renderRows(d);
          sum.textContent = (mode==='apply'? fmtSum(T.sumDone, d): fmtSum(T.sumPreview, d)) + (d.truncated? ' · '+T.truncated.replace('{n}', d.read):'');
          applyBtn.style.display = (mode==='apply') ? 'none' : ((d.created+d.updated)>0 ? 'inline-flex' : 'none');
          if(mode==='apply'){ applyBtn.style.display='none'; }
        }catch(e){ sum.textContent = T.err; }
        btn.disabled = false;
      }
      previewBtn.addEventListener('click', function(){ run('preview'); });
      applyBtn.addEventListener('click', function(){ run('apply'); });
    </script>`;

  return htmlResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: 'Bulk import inventory.', origin: url.origin, path: '/ai-builder/crm/stock/import' })}<meta name="robots" content="noindex">
  <style>${baseCss()}
    main{min-height:60vh}.awrap{max-width:920px;margin:0 auto;padding:2.4rem 1.5rem}
    .ahead{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .ahead h1{font-size:clamp(1.5rem,3.5vw,2rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);margin:.3rem 0 1.2rem}.muted{color:var(--muted)}
    .inotice{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:.8rem 1rem;margin-bottom:1.2rem;font-size:.9rem}
    .icard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.3rem;margin-bottom:1.2rem}
    .icols-h{font-weight:700;color:var(--ink);margin:0 0 .4rem}
    .icols{margin:0 0 1rem;padding-left:1.1rem;color:var(--body);font-size:.88rem;line-height:1.7}
    .ifile{display:block;font-weight:700;color:var(--ink);font-size:.9rem;margin-bottom:.7rem}
    .ifile input{display:block;margin-top:.35rem;font-family:inherit}
    #imp-csv{width:100%;padding:.6rem .8rem;border:1.5px solid var(--line);border-radius:10px;font-family:ui-monospace,Menlo,monospace;font-size:.85rem;resize:vertical}
    .imatch{color:var(--muted);font-size:.8rem;margin:.6rem 0 .8rem}
    .iacts{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap}
    .btn.primary{background:var(--grad);color:#fff}
    .imsg{font-size:.85rem;color:var(--body)}
    .itwrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#fff;margin-top:.4rem}
    .itable{width:100%;border-collapse:collapse;font-size:.85rem}
    .itable th{text-align:left;padding:.5rem .7rem;color:var(--muted);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--line)}
    .itable td{padding:.45rem .7rem;border-bottom:1px solid var(--line)}.itable tr:last-child td{border-bottom:none}
    .ibadge{display:inline-block;border-radius:999px;padding:.1rem .55rem;font-size:.72rem;font-weight:700}
    .ibadge.create{background:#ecfdf5;color:#065f46}.ibadge.update{background:#eff6ff;color:#1e40af}.ibadge.skipped{background:#fffbeb;color:#92400e}.ibadge.error{background:#fef2f2;color:#991b1b}
  </style></head><body>${siteHeader('/dashboard', {})}<main><div class="awrap">${inner}</div></main>${siteFooter({ lang })}</body></html>`);
}

/** POST /api/ai-builder/:project_id/crm/stock/import — { csv, mode:'preview'|'apply' }. */
export async function handleStockImport(ctx) {
  const { env, params, request } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const body = await request.json().catch(() => ({}));
  let rows = mapRows(parseDelimited(body.csv));
  if (!rows.length) return json({ success: false, error: 'No product rows found — check your headers (name, price, stock…).' }, 400);
  const truncated = rows.length > MAX_ROWS;
  if (truncated) rows = rows.slice(0, MAX_ROWS);

  const hasAdv = await hasPlugin(env, r.email, 'advanced_store');
  const tier = await getUserTier(env.DB, r.email);
  const limit = PRODUCT_LIMITS[tier] != null ? PRODUCT_LIMITS[tier] : PRODUCT_LIMITS.free_trial;
  const current = await countProducts(env.DB, r.projectKey);
  const maxCreate = limit === Infinity ? Infinity : Math.max(0, limit - current);
  const dryRun = body.mode !== 'apply';

  const res = await upsertProductsBulk(env.DB, r.projectKey, rows, { setStock: hasAdv, dryRun, maxCreate });
  return json({ success: true, hasAdv, dryRun, truncated, read: MAX_ROWS, ...res });
}
