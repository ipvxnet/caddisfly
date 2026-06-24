// CRM Accounts manager (Phase 1) — structured company records with multiple
// contacts, sitting alongside the auto-aggregated CRM contact list. Server-rendered
// list + edit pages; create/save/delete via small JSON fetches (gotcha #29-safe:
// handlers use `this`/event delegation, never inline string args). Gated by
// pluginGate('crm') in index.js. i18n: local AC dict (en/es/pt) by ctx.lang.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject } from '../api/ai-builder/store.js';
import { listAccounts, getAccount, createAccount, updateAccount, deleteAccount, setAccountContacts } from '../../db/crm-accounts.js';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (ts) => { if (!ts) return ''; try { return new Date(ts * 1000).toISOString().slice(0, 10); } catch { return ''; } };

const AC = {
  en: {
    meta_title: 'Accounts — CRM', title: 'Accounts', back_crm: '← Back to CRM',
    sub: 'Company records with multiple contacts and details. {count} {label}.', account_one: 'account', account_many: 'accounts',
    new_ph: 'New company / account name', create: 'Create account',
    th_name: 'Account', th_owner: 'Owner', th_industry: 'Industry', th_status: 'Status', th_contacts: 'Contacts', th_updated: 'Updated',
    empty: 'No accounts yet — create your first company record above.', acct_label: 'Account',
    f_name: 'Account / company name', f_owner: 'Account owner', f_email: 'General email', f_phone: 'General phone', f_cell: 'Cellphone',
    f_industry: 'Industry', f_vertical: 'Vertical', f_employees: 'Number of employees', f_start: 'Desired start date', f_end: 'Desired end date',
    f_billing: 'Billing address', f_desc: 'Description', f_status: 'Status',
    contacts_h: 'Contacts', c_name: 'Name', c_title: 'Title / role', c_email: 'Email', c_phone: 'Phone', c_primary: 'Primary',
    add_contact: '＋ Add contact', remove: 'Remove', save: 'Save account', saved: 'Saved', delete: 'Delete account',
    delete_confirm: 'Delete this account and its contacts? This cannot be undone.',
    fin_h: 'Purchase history & financials', fin_soon: "Purchase history and financial metrics for this account's contacts are coming next.",
    name_required: 'Enter an account name.', err: 'Something went wrong.',
    st: { new: 'New', contacted: 'Contacted', qualified: 'Qualified', won: 'Won', lost: 'Lost' },
  },
  es: {
    meta_title: 'Cuentas — CRM', title: 'Cuentas', back_crm: '← Volver al CRM',
    sub: 'Registros de empresas con múltiples contactos y detalles. {count} {label}.', account_one: 'cuenta', account_many: 'cuentas',
    new_ph: 'Nueva empresa / nombre de cuenta', create: 'Crear cuenta',
    th_name: 'Cuenta', th_owner: 'Propietario', th_industry: 'Industria', th_status: 'Estado', th_contacts: 'Contactos', th_updated: 'Actualizado',
    empty: 'No hay cuentas aún — crea tu primer registro de empresa arriba.', acct_label: 'Cuenta',
    f_name: 'Nombre de cuenta / empresa', f_owner: 'Propietario de la cuenta', f_email: 'Correo general', f_phone: 'Teléfono general', f_cell: 'Teléfono móvil',
    f_industry: 'Industria', f_vertical: 'Vertical', f_employees: 'Número de empleados', f_start: 'Fecha deseada de inicio', f_end: 'Fecha deseada de fin',
    f_billing: 'Dirección de facturación', f_desc: 'Descripción', f_status: 'Estado',
    contacts_h: 'Contactos', c_name: 'Nombre', c_title: 'Título / rol', c_email: 'Correo electrónico', c_phone: 'Teléfono', c_primary: 'Principal',
    add_contact: '＋ Añadir contacto', remove: 'Eliminar', save: 'Guardar cuenta', saved: 'Guardado', delete: 'Eliminar cuenta',
    delete_confirm: '¿Eliminar esta cuenta y sus contactos? Esto no se puede deshacer.',
    fin_h: 'Historial de compras y finanzas', fin_soon: 'El historial de compras y las métricas financieras para los contactos de esta cuenta llegarán pronto.',
    name_required: 'Ingresa un nombre de cuenta.', err: 'Algo salió mal.',
    st: { new: 'Nuevo', contacted: 'Contactado', qualified: 'Calificado', won: 'Ganado', lost: 'Perdido' },
  },
  pt: {
    meta_title: 'Contas — CRM', title: 'Contas', back_crm: '← Voltar para CRM',
    sub: 'Registros de empresas com múltiplos contatos e detalhes. {count} {label}.', account_one: 'conta', account_many: 'contas',
    new_ph: 'Nova empresa / nome da conta', create: 'Criar conta',
    th_name: 'Conta', th_owner: 'Proprietário', th_industry: 'Indústria', th_status: 'Status', th_contacts: 'Contatos', th_updated: 'Atualizado',
    empty: 'Nenhuma conta ainda — crie seu primeiro registro de empresa acima.', acct_label: 'Conta',
    f_name: 'Nome da conta / empresa', f_owner: 'Proprietário da conta', f_email: 'Email geral', f_phone: 'Telefone geral', f_cell: 'Telefone celular',
    f_industry: 'Indústria', f_vertical: 'Vertical', f_employees: 'Número de funcionários', f_start: 'Data desejada de início', f_end: 'Data desejada de término',
    f_billing: 'Endereço de cobrança', f_desc: 'Descrição', f_status: 'Status',
    contacts_h: 'Contatos', c_name: 'Nome', c_title: 'Título / cargo', c_email: 'E-mail', c_phone: 'Telefone', c_primary: 'Principal',
    add_contact: '＋ Adicionar contato', remove: 'Remover', save: 'Salvar conta', saved: 'Salvo', delete: 'Excluir conta',
    delete_confirm: 'Excluir esta conta e seus contatos? Isso não pode ser desfeito.',
    fin_h: 'Histórico de compras e finanças', fin_soon: 'O histórico de compras e as métricas financeiras para os contatos desta conta virão em breve.',
    name_required: 'Digite um nome da conta.', err: 'Algo deu errado.',
    st: { new: 'Novo', contacted: 'Contatado', qualified: 'Qualificado', won: 'Ganho', lost: 'Perdido' },
  },
};
const pick = (lang) => AC[lang] || AC.en;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function shell(T, lang, origin, inner, extraCss = '') {
  return htmlResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: 'CRM accounts.', origin, path: '/ai-builder/crm/accounts' })}<meta name="robots" content="noindex">
  <style>${baseCss()}
    main{min-height:60vh}.awrap{max-width:920px;margin:0 auto;padding:2.4rem 1.5rem}
    .ahead{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .ahead h1{font-size:clamp(1.5rem,3.5vw,2rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);margin:.3rem 0 1.4rem}
    .acreate{display:flex;gap:.5rem;margin-bottom:1.2rem;flex-wrap:wrap}
    .acreate input{flex:1;min-width:200px;padding:.6rem .8rem;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;font-size:.95rem}
    .atable{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
    .atable th{text-align:left;padding:.6rem .8rem;color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--line)}
    .atable td{padding:.6rem .8rem;border-bottom:1px solid var(--line);font-size:.9rem}
    .atable tr:last-child td{border-bottom:none}.atable a.an{font-weight:700;color:var(--p2);text-decoration:none}
    .aempty{text-align:center;color:var(--muted);border:2px dashed var(--line);border-radius:14px;padding:2.5rem 1.5rem}
    .pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.1rem .6rem;font-size:.74rem;font-weight:700;color:var(--p2)}
    .acard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem;margin-bottom:1.2rem}
    .agrid{display:grid;grid-template-columns:1fr 1fr;gap:.8rem 1rem}
    .agrid label,.afull{display:flex;flex-direction:column;gap:.3rem;font-size:.82rem;font-weight:700;color:var(--ink)}
    .afull{grid-column:1 / -1}
    .agrid input,.agrid select,.agrid textarea,.afull input,.afull textarea{padding:.5rem .65rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.9rem;font-weight:400;background:#fff}
    .agrid textarea,.afull textarea{resize:vertical;min-height:60px}
    .acrow{display:grid;grid-template-columns:1.2fr 1fr 1.3fr 1fr auto auto;gap:.5rem;align-items:center;margin-bottom:.5rem}
    .acrow input{padding:.45rem .55rem;border:1.5px solid var(--line);border-radius:8px;font-family:inherit;font-size:.85rem;min-width:0}
    .acrow .prim{display:flex;align-items:center;gap:.3rem;font-size:.78rem;font-weight:600;color:var(--muted);white-space:nowrap}
    .acrow .ac-remove{background:none;border:none;color:#b91c1c;cursor:pointer;font-size:.8rem;font-weight:600}
    .afin{background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:1rem 1.1rem;margin-bottom:1.2rem}
    .afin h3{margin:0 0 .3rem;font-size:.95rem;color:var(--ink)}.afin p{margin:0;color:var(--muted);font-size:.85rem}
    .aacts{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:.4rem}
    .btn.danger{background:#fff;color:#b91c1c;border:1.5px solid #fca5a5}
    .amsg{font-size:.85rem;color:var(--muted)}
    @media (max-width:680px){.agrid{grid-template-columns:1fr}.acrow{grid-template-columns:1fr 1fr}}
    ${extraCss}
  </style></head><body>${siteHeader('/dashboard', {})}<main><div class="awrap">${inner}</div></main>${siteFooter({ lang })}</body></html>`);
}

/** GET /ai-builder/crm/:project_id/accounts — list + create. */
export async function handleAccountsManager(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const accounts = await listAccounts(env.DB, r.projectKey);
  const base = `/ai-builder/crm/${esc(params.project_id)}`;

  const rows = accounts.map((a) => `<tr>
      <td><a class="an" href="${base}/accounts/${a.id}">${esc(a.account_name || '—')}</a> <span class="pill">#${a.id}</span></td>
      <td>${esc(a.account_owner || '—')}</td>
      <td>${esc(a.industry || '—')}</td>
      <td><span class="pill">${esc(T.st[a.status] || a.status)}</span></td>
      <td>${a.contact_count}</td>
      <td>${esc(fmtDate(a.updated_at))}</td>
    </tr>`).join('');
  const countLabel = accounts.length === 1 ? T.account_one : T.account_many;

  const inner = `
    <div class="ahead"><h1>🏢 ${T.title}</h1>
      <a class="btn ghost" href="${base}">${T.back_crm}</a></div>
    <p class="sub">${T.sub.replace('{count}', accounts.length).replace('{label}', countLabel)}</p>
    <div class="acreate">
      <input id="ac-newname" type="text" placeholder="${T.new_ph}">
      <button class="btn" type="button" onclick="createAccount(this)">${T.create}</button>
    </div>
    ${accounts.length
      ? `<table class="atable"><thead><tr><th>${T.th_name}</th><th>${T.th_owner}</th><th>${T.th_industry}</th><th>${T.th_status}</th><th>${T.th_contacts}</th><th>${T.th_updated}</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div class="aempty">${T.empty}</div>`}
    <script>
      var BASE = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/crm/accounts';
      var PAGE = ${JSON.stringify(base + '/accounts')};
      var S = ${JSON.stringify({ nameReq: T.name_required, err: T.err })};
      async function createAccount(btn){
        var input = document.getElementById('ac-newname');
        var name = (input.value||'').trim();
        if(!name){ input.focus(); return; }
        btn.disabled=true;
        try{
          var res = await fetch(BASE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account_name:name})});
          var d = await res.json();
          if(res.ok && d.success){ location.href = PAGE + '/' + d.id; return; }
          alert((d&&d.error)||S.err); btn.disabled=false;
        }catch(e){ alert(S.err); btn.disabled=false; }
      }
    </script>`;
  return shell(T, lang, url.origin, inner);
}

/** GET /ai-builder/crm/:project_id/accounts/:account_id — edit form. */
export async function handleAccountEditPage(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const id = Number(params.account_id);
  const acct = Number.isInteger(id) ? await getAccount(env.DB, r.projectKey, id) : null;
  const base = `/ai-builder/crm/${esc(params.project_id)}`;
  if (!acct) return redirect(`${base}/accounts`, 303);

  const fld = (name, label, val, type = 'text') => `<label>${label}<input id="f-${name}" type="${type}" value="${esc(val)}"></label>`;
  const statusOpts = STATUSES.map((s) => `<option value="${s}"${acct.status === s ? ' selected' : ''}>${esc(T.st[s])}</option>`).join('');

  // One contact row (template uses index for nothing — collected by class on save).
  const contactRow = (c = {}) => `<div class="acrow">
    <input class="c-name" placeholder="${T.c_name}" value="${esc(c.name || '')}">
    <input class="c-title" placeholder="${T.c_title}" value="${esc(c.title || '')}">
    <input class="c-email" type="email" placeholder="${T.c_email}" value="${esc(c.email || '')}">
    <input class="c-phone" placeholder="${T.c_phone}" value="${esc(c.phone || '')}">
    <label class="prim"><input class="c-prim" type="radio" name="ac-prim"${c.is_primary ? ' checked' : ''}> ${T.c_primary}</label>
    <button type="button" class="ac-remove">${T.remove}</button>
  </div>`;
  const contactRows = (acct.contacts.length ? acct.contacts : [{}]).map(contactRow).join('');

  const inner = `
    <div class="ahead"><h1>🏢 ${esc(acct.account_name || T.acct_label)} <span class="pill">#${acct.id}</span></h1>
      <a class="btn ghost" href="${base}/accounts">${T.back_crm.replace('CRM', T.title)}</a></div>
    <div class="acard">
      <div class="agrid">
        <label class="afull">${T.f_name}<input id="f-account_name" type="text" value="${esc(acct.account_name)}"></label>
        ${fld('account_owner', T.f_owner, acct.account_owner)}
        <label>${T.f_status}<select id="f-status">${statusOpts}</select></label>
        ${fld('email', T.f_email, acct.email, 'email')}
        ${fld('phone', T.f_phone, acct.phone, 'tel')}
        ${fld('cellphone', T.f_cell, acct.cellphone, 'tel')}
        ${fld('industry', T.f_industry, acct.industry)}
        ${fld('vertical', T.f_vertical, acct.vertical)}
        ${fld('num_employees', T.f_employees, acct.num_employees == null ? '' : acct.num_employees, 'number')}
        ${fld('desired_start_date', T.f_start, acct.desired_start_date, 'date')}
        ${fld('desired_end_date', T.f_end, acct.desired_end_date, 'date')}
        <label class="afull">${T.f_billing}<textarea id="f-billing_address">${esc(acct.billing_address)}</textarea></label>
        <label class="afull">${T.f_desc}<textarea id="f-description">${esc(acct.description)}</textarea></label>
      </div>
    </div>
    <div class="acard">
      <h3 style="margin:0 0 .8rem;color:var(--ink)">${T.contacts_h}</h3>
      <div id="ac-contacts">${contactRows}</div>
      <button type="button" class="btn ghost" id="ac-add">${T.add_contact}</button>
    </div>
    <div class="afin"><h3>${T.fin_h}</h3><p>${T.fin_soon}</p></div>
    <div class="aacts">
      <button class="btn" type="button" id="ac-save">${T.save}</button>
      <span id="ac-msg" class="amsg"></span>
      <button class="btn danger" type="button" id="ac-delete" style="margin-left:auto">${T.delete}</button>
    </div>
    <template id="ac-rowtpl">${contactRow()}</template>
    <script>
      var BASE = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/crm/accounts/' + ${JSON.stringify(String(acct.id))};
      var LIST = ${JSON.stringify(base + '/accounts')};
      var S = ${JSON.stringify({ saved: T.saved, err: T.err, delConfirm: T.delete_confirm })};
      var box = document.getElementById('ac-contacts');
      document.getElementById('ac-add').addEventListener('click', function(){
        var tpl = document.getElementById('ac-rowtpl');
        box.appendChild(tpl.content.cloneNode(true));
      });
      box.addEventListener('click', function(e){
        var b = e.target.closest('.ac-remove'); if(b){ b.closest('.acrow').remove(); }
      });
      function collect(){
        var fields = ['account_name','account_owner','email','phone','cellphone','industry','vertical','num_employees','desired_start_date','desired_end_date','billing_address','description'];
        var body = { status: document.getElementById('f-status').value };
        fields.forEach(function(f){ var el = document.getElementById('f-'+f); if(el) body[f] = el.value; });
        var contacts = [];
        box.querySelectorAll('.acrow').forEach(function(row){
          contacts.push({
            name: row.querySelector('.c-name').value, title: row.querySelector('.c-title').value,
            email: row.querySelector('.c-email').value, phone: row.querySelector('.c-phone').value,
            is_primary: row.querySelector('.c-prim').checked
          });
        });
        body.contacts = contacts;
        return body;
      }
      document.getElementById('ac-save').addEventListener('click', async function(){
        var btn = this; btn.disabled = true; var msg = document.getElementById('ac-msg');
        try{
          var res = await fetch(BASE,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(collect())});
          var d = await res.json();
          msg.textContent = (res.ok && d.success) ? S.saved+' ✓' : ((d&&d.error)||S.err);
          if(res.ok && d.success){ setTimeout(function(){ location.reload(); }, 600); }
        }catch(e){ msg.textContent = S.err; }
        btn.disabled = false;
      });
      document.getElementById('ac-delete').addEventListener('click', async function(){
        if(!confirm(S.delConfirm)) return;
        this.disabled = true;
        try{
          var res = await fetch(BASE,{method:'DELETE'});
          var d = await res.json();
          if(res.ok && d.success){ location.href = LIST; return; }
          alert((d&&d.error)||S.err); this.disabled=false;
        }catch(e){ alert(S.err); this.disabled=false; }
      });
    </script>`;
  return shell(T, lang, url.origin, inner);
}

/** POST /api/ai-builder/:project_id/crm/accounts — create. */
export async function handleAccountCreate(ctx) {
  const { env, params, request } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const body = await request.json().catch(() => ({}));
  if (!String(body.account_name || '').trim()) return json({ success: false, error: 'name_required' }, 400);
  const id = await createAccount(env.DB, r.projectKey, { account_name: body.account_name });
  return json({ success: true, id }, 201);
}

/** PUT /api/ai-builder/:project_id/crm/accounts/:account_id — save fields + contacts. */
export async function handleAccountSave(ctx) {
  const { env, params, request } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.account_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid id' }, 400);
  const body = await request.json().catch(() => ({}));
  const ok = await updateAccount(env.DB, r.projectKey, id, body);
  if (!ok) return json({ success: false, error: 'Account not found' }, 404);
  if (Array.isArray(body.contacts)) await setAccountContacts(env.DB, id, body.contacts);
  return json({ success: true });
}

/** DELETE /api/ai-builder/:project_id/crm/accounts/:account_id. */
export async function handleAccountDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.account_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid id' }, 400);
  const ok = await deleteAccount(env.DB, r.projectKey, id);
  return json({ success: ok });
}
