// GET /ai-builder/crm/:project_id — CRM plugin manager. Server-renders the
// aggregated contact list (status + notes editable via a small fetch). Gated by
// pluginGate('crm') in index.js. i18n: local CRM dict (en/es/pt), by ctx.lang.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject, getOrCreateConfig } from '../api/ai-builder/store.js';
import { getCrmContacts, CRM_DEDUP_KEYS } from '../../db/crm.js';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

const CRM = {
  en: {
    meta_title: 'CRM — Caddisfly', meta_desc: 'Your leads and contacts.', title: 'CRM', back: '← Back to editor',
    sub: "Everyone who has messaged, booked, bought from — or that you've added to — your site. {count} {label}.",
    contact_one: 'contact', contact_many: 'contacts',
    add_contact: '＋ Add contact', quotes_link: '📄 Quotes &amp; Orders', accounts_link: '🏢 Accounts', stock_link: '📦 Stock', merge_by: 'Merge duplicates by',
    ph_email: 'Email (required)', ph_name: 'Name', ph_phone: 'Phone', add: 'Add',
    th_contact: 'Contact', th_sources: 'Sources', th_interactions: 'Interactions', th_spent: 'Spent', th_last: 'Last seen', th_status: 'Status', th_notes: 'Notes',
    notes_ph: 'notes…', save: 'Save', saved: '✓ Saved', error: 'Error',
    empty: "No contacts yet — add one above, or they'll appear when someone uses your contact form, booking, or store.",
    add_err: 'Could not add the contact.', dedup_err: 'Could not change the setting.',
    st: { new: 'New', contacted: 'Contacted', qualified: 'Qualified', won: 'Won', lost: 'Lost' },
    dd: { email: 'Email', phone: 'Phone', name: 'Full name' },
  },
  es: {
    meta_title: 'CRM — Caddisfly', meta_desc: 'Tus leads y contactos.', title: 'CRM', back: '← Volver al editor',
    sub: 'Todo aquel que ha contactado, reservado, comprado en — o que has añadido a — tu sitio. {count} {label}.',
    contact_one: 'contacto', contact_many: 'contactos',
    add_contact: '＋ Añadir contacto', quotes_link: '📄 Cotizaciones y pedidos', accounts_link: '🏢 Cuentas', stock_link: '📦 Inventario', merge_by: 'Unir duplicados por',
    ph_email: 'Correo electrónico (obligatorio)', ph_name: 'Nombre', ph_phone: 'Teléfono', add: 'Añadir',
    th_contact: 'Contacto', th_sources: 'Fuentes', th_interactions: 'Interacciones', th_spent: 'Gastado', th_last: 'Última vez', th_status: 'Estado', th_notes: 'Notas',
    notes_ph: 'notas…', save: 'Guardar', saved: '✓ Guardado', error: 'Error',
    empty: 'No hay contactos aún — añade uno arriba, o aparecerán cuando alguien use tu formulario de contacto, reservas o tienda.',
    add_err: 'No se pudo añadir el contacto.', dedup_err: 'No se pudo cambiar la configuración.',
    st: { new: 'Nuevo', contacted: 'Contactado', qualified: 'Calificado', won: 'Ganado', lost: 'Perdido' },
    dd: { email: 'Correo electrónico', phone: 'Teléfono', name: 'Nombre completo' },
  },
  pt: {
    meta_title: 'CRM — Caddisfly', meta_desc: 'Seus leads e contatos.', title: 'CRM', back: '← Voltar ao editor',
    sub: 'Todo aquele que enviou uma mensagem, reservou, comprou em — ou que você adicionou ao — seu site. {count} {label}.',
    contact_one: 'contato', contact_many: 'contatos',
    add_contact: '＋ Adicionar contato', quotes_link: '📄 Orçamentos e pedidos', accounts_link: '🏢 Contas', stock_link: '📦 Estoque', merge_by: 'Mesclar duplicatas por',
    ph_email: 'Email (obrigatório)', ph_name: 'Nome', ph_phone: 'Telefone', add: 'Adicionar',
    th_contact: 'Contato', th_sources: 'Fontes', th_interactions: 'Interações', th_spent: 'Gasto', th_last: 'Última vez', th_status: 'Status', th_notes: 'Notas',
    notes_ph: 'notas…', save: 'Salvar', saved: '✓ Salvo', error: 'Erro',
    empty: 'Ainda não há contatos — adicione um acima, ou eles aparecerão quando alguém usar seu formulário de contato, reserva ou loja.',
    add_err: 'Não foi possível adicionar o contato.', dedup_err: 'Não foi possível alterar a configuração.',
    st: { new: 'Novo', contacted: 'Contatado', qualified: 'Qualificado', won: 'Ganho', lost: 'Perdido' },
    dd: { email: 'Email', phone: 'Telefone', name: 'Nome completo' },
  },
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(ts) { if (!ts) return ''; try { return new Date(ts * 1000).toISOString().slice(0, 10); } catch { return ''; } }
function money(cents) { return '$' + ((cents || 0) / 100).toFixed(2); }
function badges(sources) {
  const m = { message: '📨', booking: '📅', order: '🛍', manual: '✋' };
  return sources.map((s) => `<span title="${s}">${m[s] || ''}</span>`).join(' ');
}

export async function handleCrmManager(ctx) {
  const { env, params, url } = ctx;
  const origin = env.APP_URL || (url ? new URL(url).origin : '');
  const lang = (ctx && ctx.lang) || 'en';
  const T = CRM[lang] || CRM.en;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  const dedupKey = CRM_DEDUP_KEYS.includes(config.crm_dedup_key) ? config.crm_dedup_key : 'email';
  const contacts = await getCrmContacts(env.DB, r.projectKey, params.project_id, dedupKey);

  const rows = contacts.map((c) => {
    const interactions = c.msgCount + c.bookingCount + c.orderCount;
    const statusOpts = STATUSES.map((s) => `<option value="${s}"${c.status === s ? ' selected' : ''}>${T.st[s]}</option>`).join('');
    return `<tr class="crm-row" data-email="${esc(c.email)}">
      <td><div class="crm-name">${esc(c.name || '—')}</div><div class="crm-email">${esc(c.email)}</div>${c.phone ? `<div class="crm-email">${esc(c.phone)}</div>` : ''}</td>
      <td class="crm-src">${badges(c.sources)}</td>
      <td>${interactions}</td>
      <td>${c.orderCount ? money(c.totalSpend) : '—'}</td>
      <td>${fmtDate(c.lastActivity)}</td>
      <td><select class="crm-status">${statusOpts}</select></td>
      <td><input class="crm-notes" value="${esc(c.notes)}" placeholder="${T.notes_ph}"></td>
      <td><button class="btn ghost crm-save" type="button" onclick="saveContact(this)">${T.save}</button></td>
    </tr>`;
  }).join('');

  const dedupOpts = CRM_DEDUP_KEYS.map((k) => `<option value="${k}"${k === dedupKey ? ' selected' : ''}>${T.dd[k]}</option>`).join('');
  const countLabel = contacts.length === 1 ? T.contact_one : T.contact_many;

  const inner = `
    <div class="crm-head">
      <h1>${T.title} <span class="muted">— ${esc(r.businessName)}</span></h1>
      <a class="btn ghost" href="/ai-builder/customize/${esc(params.project_id)}">${T.back}</a>
    </div>
    <p class="sub">${T.sub.replace('{count}', contacts.length).replace('{label}', countLabel)}</p>

    <div class="crm-toolbar">
      <button class="btn" type="button" onclick="toggleAdd()">${T.add_contact}</button>
      <a class="btn ghost" href="/ai-builder/crm/${esc(params.project_id)}/quotes">${T.quotes_link}</a>
      <a class="btn ghost" href="/ai-builder/crm/${esc(params.project_id)}/accounts">${T.accounts_link}</a>
      <a class="btn ghost" href="/ai-builder/crm/${esc(params.project_id)}/stock">${T.stock_link}</a>
      <label class="crm-dedup">${T.merge_by}
        <select id="crm-dedupkey" onchange="setDedup(this.value)">${dedupOpts}</select>
      </label>
    </div>

    <div class="crm-addform" id="crm-addform">
      <div class="crm-addgrid">
        <input id="ac-email" type="email" placeholder="${T.ph_email}">
        <input id="ac-name" placeholder="${T.ph_name}">
        <input id="ac-phone" placeholder="${T.ph_phone}">
        <select id="ac-status">${STATUSES.map((s) => `<option value="${s}">${T.st[s]}</option>`).join('')}</select>
        <button class="btn" type="button" onclick="addContact(this)">${T.add}</button>
      </div>
    </div>

    ${contacts.length ? `<div class="crm-tablewrap"><table class="crm-table">
      <thead><tr><th>${T.th_contact}</th><th>${T.th_sources}</th><th>${T.th_interactions}</th><th>${T.th_spent}</th><th>${T.th_last}</th><th>${T.th_status}</th><th>${T.th_notes}</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>` : `<div class="crm-empty">${T.empty}</div>`}
    <div id="crm-msg"></div>
    <script>
      var BASE = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/crm';
      var S = ${JSON.stringify({ saved: T.saved, error: T.error, addErr: T.add_err, dedupErr: T.dedup_err })};
      function toggleAdd(){ var f = document.getElementById('crm-addform'); f.style.display = f.style.display === 'block' ? 'none' : 'block'; if (f.style.display==='block') document.getElementById('ac-email').focus(); }
      async function saveContact(btn){
        var row = btn.closest('.crm-row');
        var email = row.getAttribute('data-email');
        var status = row.querySelector('.crm-status').value;
        var notes = row.querySelector('.crm-notes').value;
        btn.disabled = true; var old = btn.textContent; btn.textContent = '…';
        try {
          var res = await fetch(BASE + '/contacts/' + encodeURIComponent(email), { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: status, notes: notes }) });
          var d = await res.json();
          btn.textContent = d && d.success ? S.saved : S.error;
        } catch(e){ btn.textContent = S.error; }
        setTimeout(function(){ btn.disabled = false; btn.textContent = old; }, 1400);
      }
      async function addContact(btn){
        var email = document.getElementById('ac-email').value.trim();
        if (!email) { document.getElementById('ac-email').focus(); return; }
        btn.disabled = true; var old = btn.textContent; btn.textContent = '…';
        try {
          var res = await fetch(BASE + '/contacts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
            email: email, name: document.getElementById('ac-name').value.trim(),
            phone: document.getElementById('ac-phone').value.trim(), status: document.getElementById('ac-status').value }) });
          var d = await res.json();
          if (d && d.success) { location.reload(); return; }
          alert((d && d.error) || S.addErr);
        } catch(e){ alert(S.addErr); }
        btn.disabled = false; btn.textContent = old;
      }
      async function setDedup(key){
        try { await fetch(BASE + '/dedup-key', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ dedup_key: key }) }); location.reload(); }
        catch(e){ alert(S.dedupErr); }
      }
    </script>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: T.meta_desc, origin, path: '/ai-builder/crm' })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .cwrap{max-width:1080px;margin:0 auto;padding:2.5rem 1.5rem}
    .crm-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .crm-head h1{font-size:clamp(1.6rem,3.5vw,2.1rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);margin:.3rem 0 1.6rem}
    .crm-tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
    .crm-table{width:100%;border-collapse:collapse;font-size:.9rem}
    .crm-table th{text-align:left;padding:.7rem .8rem;color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid var(--line)}
    .crm-table td{padding:.65rem .8rem;border-bottom:1px solid var(--line);vertical-align:middle}
    .crm-table tr:last-child td{border-bottom:none}
    .crm-name{font-weight:700;color:var(--ink)}
    .crm-email{color:var(--muted);font-size:.82rem}
    .crm-src{font-size:1.05rem;white-space:nowrap}
    .crm-status,.crm-notes{padding:.4rem .55rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.85rem;background:#fff}
    .crm-notes{width:100%;min-width:160px}
    .crm-save{font-size:.8rem;padding:.4rem .7rem;white-space:nowrap}
    .crm-empty{text-align:center;color:var(--muted);border:2px dashed var(--line);border-radius:14px;padding:3rem 1.5rem}
    .crm-toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
    .crm-dedup{color:var(--body);font-size:.85rem;display:flex;align-items:center;gap:.5rem}
    .crm-dedup select{padding:.4rem .55rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.85rem;background:#fff}
    .crm-addform{display:none;border:1px solid var(--line);border-radius:14px;background:#fff;padding:1rem 1.1rem;margin-bottom:1.2rem}
    .crm-addgrid{display:grid;grid-template-columns:1.4fr 1.2fr 1fr .9fr auto;gap:.6rem;align-items:center}
    .crm-addgrid input,.crm-addgrid select{padding:.5rem .6rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.88rem;background:#fff;min-width:0}
    @media (max-width:720px){ .crm-addgrid{grid-template-columns:1fr 1fr} }
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
