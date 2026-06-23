// GET /ai-builder/crm/:project_id/quotes — Quotation & Order Management manager.
// Server-renders the project's quotes; create/status/fulfillment/delete via small
// fetches. Gated by pluginGate('crm') in index.js. Mirrors crm-manager.js.
// i18n: local QT dict (en/es/pt), same pattern as catalogue/tiles.js (CAT_T).

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject } from '../api/ai-builder/store.js';
import { listQuotes, QUOTE_STATUSES, FULFILLMENTS } from '../../db/crm-quotes.js';

const QT = {
  en: {
    heading: 'Quotes & Orders',
    subtitle: 'Create quotes for your contacts, send them, and track accepted ones as orders.',
    one: 'quote', many: 'quotes',
    back: '← Back to CRM', newq: '＋ New quote', del: 'Delete', send: 'Send', sent: 'Sent', viewed: 'Viewed', untitled: '(untitled)',
    empty: 'No quotes yet — create one above. Accepted quotes turn into trackable orders.',
    th: { quote: 'Quote', status: 'Status', total: 'Total', items: 'Items', order: 'Order', valid: 'Valid until', created: 'Created' },
    status: { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected', expired: 'Expired' },
    fulfill: { unfulfilled: 'Unfulfilled', fulfilled: 'Fulfilled', cancelled: 'Cancelled' },
    f: { email: 'Contact email (required)', title: 'Title (e.g. Kitchen remodel)', valid: 'Valid until', desc: 'Line item description', qty: 'Qty', price: 'Unit price ($)', addLine: '＋ Add line', create: 'Create quote' },
    a: { noItems: 'Add at least one line item with a description.', delConfirm: 'Delete this quote? This cannot be undone.', delErr: 'Could not delete the quote.', createErr: 'Could not create the quote.', statusErr: 'Could not update the status.', fulfillErr: 'Could not update the order status.', sendErr: 'Could not send the quote.', sentOk: 'Quote sent ✓', noEmail: 'Add a customer email to this quote first.' },
    tpl: { btn: '✎ Template', intro: 'Intro line', thanks: 'Thank-you message', terms: 'Terms / footer', accent: 'Accent color', logo: 'Logo URL override', save: 'Save template', saved: 'Saved ✓', hint: 'Leave blank to use your site branding and defaults.' },
  },
  es: {
    heading: 'Cotizaciones y pedidos',
    subtitle: 'Crea cotizaciones para tus contactos, envíalas y haz seguimiento de las aceptadas como pedidos.',
    one: 'cotización', many: 'cotizaciones',
    back: '← Volver al CRM', newq: '＋ Nueva cotización', del: 'Eliminar', send: 'Enviar', sent: 'Enviada', viewed: 'Vista', untitled: '(sin título)',
    empty: 'Aún no hay cotizaciones — crea una arriba. Las cotizaciones aceptadas se convierten en pedidos con seguimiento.',
    th: { quote: 'Cotización', status: 'Estado', total: 'Total', items: 'Artículos', order: 'Pedido', valid: 'Válida hasta', created: 'Creada' },
    status: { draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', rejected: 'Rechazada', expired: 'Caducada' },
    fulfill: { unfulfilled: 'Pendiente', fulfilled: 'Completada', cancelled: 'Cancelada' },
    f: { email: 'Correo del contacto (obligatorio)', title: 'Título (ej. Reforma de cocina)', valid: 'Válida hasta', desc: 'Descripción del artículo', qty: 'Cant.', price: 'Precio unitario ($)', addLine: '＋ Agregar artículo', create: 'Crear cotización' },
    a: { noItems: 'Agrega al menos un artículo con una descripción.', delConfirm: '¿Eliminar esta cotización? Esta acción no se puede deshacer.', delErr: 'No se pudo eliminar la cotización.', createErr: 'No se pudo crear la cotización.', statusErr: 'No se pudo actualizar el estado.', fulfillErr: 'No se pudo actualizar el estado del pedido.', sendErr: 'No se pudo enviar la cotización.', sentOk: 'Cotización enviada ✓', noEmail: 'Agrega el correo del cliente a esta cotización primero.' },
    tpl: { btn: '✎ Plantilla', intro: 'Línea de introducción', thanks: 'Mensaje de agradecimiento', terms: 'Términos / pie', accent: 'Color de acento', logo: 'URL del logo (reemplazo)', save: 'Guardar plantilla', saved: 'Guardado ✓', hint: 'Déjalo en blanco para usar la marca y los valores de tu sitio.' },
  },
  pt: {
    heading: 'Orçamentos e pedidos',
    subtitle: 'Crie orçamentos para seus contatos, envie-os e acompanhe os aceitos como pedidos.',
    one: 'orçamento', many: 'orçamentos',
    back: '← Voltar ao CRM', newq: '＋ Novo orçamento', del: 'Excluir', send: 'Enviar', sent: 'Enviado', viewed: 'Visto', untitled: '(sem título)',
    empty: 'Ainda não há orçamentos — crie um acima. Orçamentos aceitos viram pedidos com acompanhamento.',
    th: { quote: 'Orçamento', status: 'Status', total: 'Total', items: 'Itens', order: 'Pedido', valid: 'Válido até', created: 'Criado' },
    status: { draft: 'Rascunho', sent: 'Enviado', accepted: 'Aceito', rejected: 'Recusado', expired: 'Expirado' },
    fulfill: { unfulfilled: 'Pendente', fulfilled: 'Concluído', cancelled: 'Cancelado' },
    f: { email: 'E-mail do contato (obrigatório)', title: 'Título (ex. Reforma da cozinha)', valid: 'Válido até', desc: 'Descrição do item', qty: 'Qtd.', price: 'Preço unitário ($)', addLine: '＋ Adicionar item', create: 'Criar orçamento' },
    a: { noItems: 'Adicione pelo menos um item com uma descrição.', delConfirm: 'Excluir este orçamento? Esta ação não pode ser desfeita.', delErr: 'Não foi possível excluir o orçamento.', createErr: 'Não foi possível criar o orçamento.', statusErr: 'Não foi possível atualizar o status.', fulfillErr: 'Não foi possível atualizar o status do pedido.', sendErr: 'Não foi possível enviar o orçamento.', sentOk: 'Orçamento enviado ✓', noEmail: 'Adicione o e-mail do cliente a este orçamento primeiro.' },
    tpl: { btn: '✎ Modelo', intro: 'Linha de introdução', thanks: 'Mensagem de agradecimento', terms: 'Termos / rodapé', accent: 'Cor de destaque', logo: 'URL do logo (substituição)', save: 'Salvar modelo', saved: 'Salvo ✓', hint: 'Deixe em branco para usar a marca e os padrões do seu site.' },
  },
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(ts) { if (!ts) return ''; try { return new Date(ts * 1000).toISOString().slice(0, 10); } catch { return ''; } }
function money(cents) { return '$' + ((cents || 0) / 100).toFixed(2); }

export async function handleQuotesManager(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = QT[lang] || QT.en;
  const origin = env.APP_URL || (url ? new URL(url).origin : '');
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const quotes = await listQuotes(env.DB, r.projectKey, '');

  const rows = quotes.map((q) => {
    const statusOpts = QUOTE_STATUSES.map((s) => `<option value="${s}"${q.status === s ? ' selected' : ''}>${tr.status[s]}</option>`).join('');
    const fulfillCell = q.status === 'accepted'
      ? `<select class="q-fulfill" onchange="updateFulfillment(this)">${FULFILLMENTS.map((s) => `<option value="${s}"${q.fulfillment === s ? ' selected' : ''}>${tr.fulfill[s]}</option>`).join('')}</select>`
      : '<span class="muted">—</span>';
    const sentBadge = q.viewed_at ? `<span class="q-sent">👁 ${tr.viewed}</span>` : (q.sent_at ? `<span class="q-sent">✓ ${tr.sent}</span>` : '');
    return `<tr class="quote-row" data-id="${esc(q.id)}">
      <td><div class="q-title">${esc(q.title || tr.untitled)}</div><div class="q-email">${esc(q.contact_email)}</div>${sentBadge}</td>
      <td><select class="q-status" onchange="updateStatus(this)">${statusOpts}</select></td>
      <td class="q-total">${money(q.total_cents)}</td>
      <td>${q.item_count}</td>
      <td>${fulfillCell}</td>
      <td>${fmtDate(q.valid_until)}</td>
      <td>${fmtDate(q.created_at)}</td>
      <td class="q-actions">
        <button class="btn ghost q-send" type="button" onclick="sendQuote(this)">✉ ${tr.send}</button>
        ${q.public_token ? `<a class="btn ghost" href="/q/${esc(q.public_token)}" target="_blank" rel="noopener" title="Open hosted quote">↗</a>` : ''}
        <button class="btn ghost q-del" type="button" onclick="deleteQuote(this)">${tr.del}</button>
      </td>
    </tr>`;
  }).join('');

  const countLabel = `${quotes.length} ${quotes.length === 1 ? tr.one : tr.many}`;
  const inner = `
    <div class="crm-head">
      <h1>${tr.heading} <span class="muted">— ${esc(r.businessName)}</span></h1>
      <a class="btn ghost" href="/ai-builder/crm/${esc(params.project_id)}">${tr.back}</a>
    </div>
    <p class="sub">${tr.subtitle} ${countLabel}.</p>

    <div class="crm-toolbar">
      <button class="btn" type="button" onclick="toggleAdd()">${tr.newq}</button>
      <button class="btn ghost" type="button" onclick="toggleTpl()">${tr.tpl.btn}</button>
    </div>

    <div class="crm-addform" id="q-tplform">
      <div class="q-tplgrid">
        <label>${tr.tpl.intro}<textarea id="t-intro" rows="2"></textarea></label>
        <label>${tr.tpl.thanks}<textarea id="t-thanks" rows="2"></textarea></label>
        <label>${tr.tpl.terms}<textarea id="t-terms" rows="2"></textarea></label>
        <div class="q-tplrow">
          <label>${tr.tpl.accent}<input id="t-accent" placeholder="#5a3da8"></label>
          <label>${tr.tpl.logo}<input id="t-logo" placeholder="https://…"></label>
        </div>
      </div>
      <div class="q-tplact"><button class="btn" type="button" onclick="saveTpl(this)">${tr.tpl.save}</button><span id="t-msg" class="muted"></span></div>
      <p class="muted" style="font-size:.8rem;margin:.5rem 0 0">${tr.tpl.hint}</p>
    </div>

    <div class="crm-addform" id="q-addform">
      <div class="q-addgrid">
        <input id="q-email" type="email" placeholder="${tr.f.email}">
        <input id="q-title" placeholder="${tr.f.title}">
        <select id="q-currency"><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="BRL">BRL</option></select>
        <label class="q-validlbl">${tr.f.valid} <input id="q-valid" type="date"></label>
      </div>
      <div class="q-items" id="q-items">
        <div class="q-item">
          <input class="qi-desc" placeholder="${tr.f.desc}">
          <input class="qi-qty" type="number" min="1" step="1" value="1" placeholder="${tr.f.qty}">
          <input class="qi-price" type="number" min="0" step="0.01" placeholder="${tr.f.price}">
          <button class="btn ghost qi-rm" type="button" onclick="rmItem(this)">✕</button>
        </div>
      </div>
      <div class="q-addactions">
        <button class="btn ghost" type="button" onclick="addItem()">${tr.f.addLine}</button>
        <button class="btn" type="button" onclick="submitQuote(this)">${tr.f.create}</button>
      </div>
    </div>

    ${quotes.length ? `<div class="crm-tablewrap"><table class="crm-table">
      <thead><tr><th>${tr.th.quote}</th><th>${tr.th.status}</th><th>${tr.th.total}</th><th>${tr.th.items}</th><th>${tr.th.order}</th><th>${tr.th.valid}</th><th>${tr.th.created}</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>` : `<div class="crm-empty">${tr.empty}</div>`}
    <div id="q-msg"></div>
    <script>
      var BASE = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/crm/quotes';
      var TPL_BASE = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/crm/quote-template';
      var TPLT = ${JSON.stringify(tr.tpl)}, tplLoaded = false;
      async function toggleTpl(){
        var f = document.getElementById('q-tplform');
        f.style.display = f.style.display === 'block' ? 'none' : 'block';
        if (f.style.display === 'block' && !tplLoaded) {
          tplLoaded = true;
          try {
            var r = await fetch(TPL_BASE); var d = await r.json(); var t = (d && d.template) || {};
            document.getElementById('t-intro').value = t.intro || '';
            document.getElementById('t-thanks').value = t.thank_you || '';
            document.getElementById('t-terms').value = t.terms || '';
            document.getElementById('t-accent').value = t.accent || '';
            document.getElementById('t-logo').value = t.logo || '';
          } catch(e) { tplLoaded = false; }
        }
      }
      async function saveTpl(btn){
        btn.disabled = true; var o = btn.textContent; btn.textContent = '…';
        try {
          var r = await fetch(TPL_BASE, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
            intro: document.getElementById('t-intro').value, thank_you: document.getElementById('t-thanks').value,
            terms: document.getElementById('t-terms').value, accent: document.getElementById('t-accent').value,
            logo: document.getElementById('t-logo').value }) });
          var d = await r.json();
          if (d && d.success) { var m = document.getElementById('t-msg'); m.textContent = TPLT.saved; setTimeout(function(){ m.textContent=''; }, 1600); }
          else alert((d && d.error) || 'Error');
        } catch(e){ alert('Error'); }
        btn.disabled = false; btn.textContent = o;
      }
      var T = ${JSON.stringify(tr.a)};
      var DEL_LABEL = ${JSON.stringify(tr.del)}, ITEM = ${JSON.stringify({ desc: tr.f.desc, qty: tr.f.qty, price: tr.f.price })};
      function toggleAdd(){ var f = document.getElementById('q-addform'); f.style.display = f.style.display === 'block' ? 'none' : 'block'; if (f.style.display==='block') document.getElementById('q-email').focus(); }
      function addItem(){
        var row = document.createElement('div');
        row.className = 'q-item';
        row.innerHTML = '<input class="qi-desc"><input class="qi-qty" type="number" min="1" step="1" value="1"><input class="qi-price" type="number" min="0" step="0.01"><button class="btn ghost qi-rm" type="button" onclick="rmItem(this)">✕</button>';
        row.querySelector('.qi-desc').placeholder = ITEM.desc;
        row.querySelector('.qi-qty').placeholder = ITEM.qty;
        row.querySelector('.qi-price').placeholder = ITEM.price;
        document.getElementById('q-items').appendChild(row);
      }
      function rmItem(btn){ var rows = document.querySelectorAll('.q-item'); if (rows.length > 1) btn.closest('.q-item').remove(); }
      function dateToTs(v){ if (!v) return null; var ms = Date.parse(v + 'T00:00:00Z'); return isNaN(ms) ? null : Math.floor(ms/1000); }
      async function submitQuote(btn){
        var email = document.getElementById('q-email').value.trim();
        if (!email) { document.getElementById('q-email').focus(); return; }
        var items = [];
        document.querySelectorAll('.q-item').forEach(function(row){
          var desc = row.querySelector('.qi-desc').value.trim();
          var qty = parseInt(row.querySelector('.qi-qty').value, 10);
          var price = parseFloat(row.querySelector('.qi-price').value);
          if (desc) items.push({ description: desc, qty: (qty > 0 ? qty : 1), unit_price_cents: Math.round((price > 0 ? price : 0) * 100) });
        });
        if (!items.length) { alert(T.noItems); return; }
        btn.disabled = true; var old = btn.textContent; btn.textContent = '…';
        var payload = {
          email: email, title: document.getElementById('q-title').value.trim(),
          currency: document.getElementById('q-currency').value, valid_until: dateToTs(document.getElementById('q-valid').value),
          items: items
        };
        try {
          var res = await fetch(BASE, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          var d = await res.json();
          if (d && d.success) { location.reload(); return; }
          alert((d && d.error) || T.createErr);
        } catch(e){ alert(T.createErr); }
        btn.disabled = false; btn.textContent = old;
      }
      async function updateStatus(sel){
        var id = sel.closest('.quote-row').getAttribute('data-id');
        sel.disabled = true;
        try {
          var res = await fetch(BASE + '/' + encodeURIComponent(id) + '/status', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: sel.value }) });
          var d = await res.json();
          if (d && d.success) { location.reload(); return; } // reload to show/hide the order (fulfillment) control
          alert((d && d.error) || T.statusErr); sel.disabled = false;
        } catch(e){ alert(T.statusErr); sel.disabled = false; }
      }
      async function updateFulfillment(sel){
        var id = sel.closest('.quote-row').getAttribute('data-id');
        sel.disabled = true;
        try {
          var res = await fetch(BASE + '/' + encodeURIComponent(id) + '/order-status', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fulfillment: sel.value }) });
          var d = await res.json();
          if (!d || !d.success) alert((d && d.error) || T.fulfillErr);
        } catch(e){ alert(T.fulfillErr); }
        sel.disabled = false;
      }
      async function deleteQuote(btn){
        if (!confirm(T.delConfirm)) return;
        var id = btn.closest('.quote-row').getAttribute('data-id');
        btn.disabled = true; btn.textContent = '…';
        try {
          var res = await fetch(BASE + '/' + encodeURIComponent(id), { method:'DELETE' });
          var d = await res.json();
          if (d && d.success) { location.reload(); return; }
          alert(T.delErr);
        } catch(e){ alert(T.delErr); }
        btn.disabled = false; btn.textContent = DEL_LABEL;
      }
      async function sendQuote(btn){
        var id = btn.closest('.quote-row').getAttribute('data-id');
        btn.disabled = true; var old = btn.textContent; btn.textContent = '…';
        try {
          var res = await fetch(BASE + '/' + encodeURIComponent(id) + '/send', { method:'POST', headers:{'Content-Type':'application/json'} });
          var d = await res.json();
          if (d && d.success) { alert(d.warning ? d.warning + ' ' + (d.view_url||'') : T.sentOk); location.reload(); return; }
          alert((d && d.error === 'Add a customer email to the quote first.') ? T.noEmail : ((d && d.error) || T.sendErr));
        } catch(e){ alert(T.sendErr); }
        btn.disabled = false; btn.textContent = old;
      }
    </script>`;

  const html = `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: `${tr.heading} — Caddisfly`, description: tr.subtitle, origin, path: '/ai-builder/crm/quotes' })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .cwrap{max-width:1100px;margin:0 auto;padding:2.5rem 1.5rem}
    .crm-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .crm-head h1{font-size:clamp(1.6rem,3.5vw,2.1rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);margin:.3rem 0 1.6rem}
    .crm-tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
    .crm-table{width:100%;border-collapse:collapse;font-size:.9rem}
    .crm-table th{text-align:left;padding:.7rem .8rem;color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid var(--line)}
    .crm-table td{padding:.65rem .8rem;border-bottom:1px solid var(--line);vertical-align:middle}
    .crm-table tr:last-child td{border-bottom:none}
    .q-title{font-weight:700;color:var(--ink)}
    .q-email{color:var(--muted);font-size:.82rem}
    .q-total{font-weight:700;color:var(--p2)}
    .q-status,.q-fulfill{padding:.4rem .55rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.85rem;background:#fff}
    .q-del{font-size:.8rem;padding:.4rem .7rem;white-space:nowrap}
    .q-actions{display:flex;gap:.35rem;align-items:center;white-space:nowrap}
    .q-actions .btn{font-size:.8rem;padding:.4rem .6rem}
    .q-sent{display:inline-block;margin-top:.2rem;font-size:.74rem;color:#15803d;font-weight:700}
    .crm-empty{text-align:center;color:var(--muted);border:2px dashed var(--line);border-radius:14px;padding:3rem 1.5rem}
    .crm-toolbar{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
    .crm-addform{display:none;border:1px solid var(--line);border-radius:14px;background:#fff;padding:1rem 1.1rem;margin-bottom:1.2rem}
    .q-addgrid{display:grid;grid-template-columns:1.3fr 1.3fr .8fr 1fr;gap:.6rem;align-items:center;margin-bottom:.7rem}
    .q-addgrid input,.q-addgrid select{padding:.5rem .6rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.88rem;background:#fff;min-width:0}
    .q-validlbl{color:var(--muted);font-size:.82rem;display:flex;align-items:center;gap:.4rem}
    .q-tplgrid{display:flex;flex-direction:column;gap:.6rem;max-width:620px}
    .q-tplgrid label{display:flex;flex-direction:column;gap:.25rem;font-size:.82rem;font-weight:700;color:var(--ink)}
    .q-tplgrid textarea,.q-tplgrid input{padding:.5rem .6rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.88rem;font-weight:400;resize:vertical}
    .q-tplrow{display:flex;gap:.6rem}.q-tplrow label{flex:1}
    .q-tplact{display:flex;align-items:center;gap:.7rem;margin-top:.7rem}
    .q-validlbl input{flex:1}
    .q-item{display:grid;grid-template-columns:2.2fr .6fr .9fr auto;gap:.6rem;align-items:center;margin-bottom:.5rem}
    .q-item input{padding:.5rem .6rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.88rem;background:#fff;min-width:0}
    .qi-rm{padding:.4rem .6rem}
    .q-addactions{display:flex;justify-content:space-between;gap:.6rem;margin-top:.4rem}
    @media (max-width:720px){ .q-addgrid{grid-template-columns:1fr 1fr} .q-item{grid-template-columns:1fr 1fr} }
  </style>
</head>
<body>
  ${siteHeader('/dashboard', {})}
  <main><div class="cwrap">${inner}</div></main>
  ${siteFooter({ lang })}
</body>
</html>`;

  return htmlResponse(html);
}
