// GET /ai-builder/members/:project_id — Members plugin manager. Lists the site's
// members (visitors who signed in), with CSV export + block / remove. Gated by
// pluginGate('members') in index.js. i18n: local dict (en/es/pt) by ctx.lang.
// Member accounts are created on the published site (passwordless magic link);
// this is the merchant's roster view. See utils/member-session.js.
import { htmlResponse, redirect, jsonResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject } from '../api/ai-builder/store.js';
import { listMembers, deleteMember, setMemberStatus } from '../../db/site-members.js';

const T = {
  en: {
    meta_title: 'Members — Caddisfly', title: 'Members', back: '← Back to editor',
    sub: '{count} {label} have signed in to your site.',
    one: 'person', many: 'people',
    th_email: 'Email', th_name: 'Name', th_joined: 'Joined', th_last: 'Last sign-in', th_status: 'Status',
    block: 'Block', unblock: 'Unblock', remove: 'Remove', export: '⬇ Export CSV', never: '—',
    st_active: 'Active', st_blocked: 'Blocked',
    empty: 'No members yet. Add a “Member sign-in” section to a page so visitors can sign in.',
    confirm_remove: 'Remove this member? They can sign in again to rejoin.', err: 'Something went wrong.',
  },
  es: {
    meta_title: 'Miembros — Caddisfly', title: 'Miembros', back: '← Volver al editor',
    sub: '{count} {label} han iniciado sesión en tu sitio.',
    one: 'persona', many: 'personas',
    th_email: 'Correo', th_name: 'Nombre', th_joined: 'Se unió', th_last: 'Último acceso', th_status: 'Estado',
    block: 'Bloquear', unblock: 'Desbloquear', remove: 'Eliminar', export: '⬇ Exportar CSV', never: '—',
    st_active: 'Activo', st_blocked: 'Bloqueado',
    empty: 'Aún no hay miembros. Agrega una sección «Inicio de sesión» a una página para que los visitantes inicien sesión.',
    confirm_remove: '¿Eliminar este miembro? Puede iniciar sesión de nuevo para volver.', err: 'Algo salió mal.',
  },
  pt: {
    meta_title: 'Membros — Caddisfly', title: 'Membros', back: '← Voltar ao editor',
    sub: '{count} {label} entraram no seu site.',
    one: 'pessoa', many: 'pessoas',
    th_email: 'E-mail', th_name: 'Nome', th_joined: 'Entrou', th_last: 'Último acesso', th_status: 'Status',
    block: 'Bloquear', unblock: 'Desbloquear', remove: 'Remover', export: '⬇ Exportar CSV', never: '—',
    st_active: 'Ativo', st_blocked: 'Bloqueado',
    empty: 'Ainda não há membros. Adicione uma seção «Entrar» a uma página para que visitantes possam entrar.',
    confirm_remove: 'Remover este membro? Ele pode entrar novamente para voltar.', err: 'Algo deu errado.',
  },
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(ts, lang) {
  if (!ts) return null;
  try { return new Date(ts * 1000).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return new Date(ts * 1000).toISOString().slice(0, 10); }
}

export async function handleMembersManager(ctx) {
  const { env, params, url } = ctx;
  const origin = env.APP_URL || (url ? new URL(url).origin : '');
  const lang = (ctx && ctx.lang) || 'en';
  const t = T[lang] || T.en;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const members = await listMembers(env.DB, r.projectKey);

  const rows = members.map((m) => {
    const blocked = m.status === 'blocked';
    return `<tr data-email="${esc(m.email)}">
      <td>${esc(m.email)}</td>
      <td>${esc(m.name || t.never)}</td>
      <td>${esc(fmtDate(m.created_at, lang) || t.never)}</td>
      <td>${esc(fmtDate(m.last_login_at, lang) || t.never)}</td>
      <td><span class="mm-badge ${blocked ? 'blk' : 'act'}">${blocked ? t.st_blocked : t.st_active}</span></td>
      <td class="mm-actions">
        <button class="btn ghost sm" type="button" onclick="toggleBlock(this, ${blocked ? 0 : 1})">${blocked ? t.unblock : t.block}</button>
        <button class="btn ghost sm" type="button" onclick="removeMember(this)">${t.remove}</button>
      </td>
    </tr>`;
  }).join('');

  const countLabel = members.length === 1 ? t.one : t.many;
  const inner = `
    <div class="mm-head">
      <h1>👤 ${t.title} <span class="muted">— ${esc(r.businessName)}</span></h1>
      <a class="btn ghost" href="/ai-builder/customize/${esc(params.project_id)}">${t.back}</a>
    </div>
    <p class="sub">${t.sub.replace('{count}', members.length).replace('{label}', countLabel)}</p>
    ${members.length ? `<div class="mm-toolbar"><a class="btn ghost" href="/api/ai-builder/${esc(params.project_id)}/members.csv">${t.export}</a></div>
    <div class="mm-tablewrap"><table class="mm-table">
      <thead><tr><th>${t.th_email}</th><th>${t.th_name}</th><th>${t.th_joined}</th><th>${t.th_last}</th><th>${t.th_status}</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>` : `<div class="mm-empty">${t.empty}</div>`}
    <div id="mm-msg"></div>
    <script>
      var BASE = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/members';
      var S = ${JSON.stringify({ err: t.err, confirmRemove: t.confirm_remove })};
      async function toggleBlock(btn, block){
        var tr = btn.closest('tr'); var email = tr.getAttribute('data-email');
        btn.disabled = true;
        try {
          var res = await fetch(BASE + '/' + encodeURIComponent(email) + '/status', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: block ? 'blocked' : 'active' }) });
          if ((await res.json()).success) { location.reload(); return; }
          throw 0;
        } catch(e){ document.getElementById('mm-msg').textContent = S.err; btn.disabled = false; }
      }
      async function removeMember(btn){
        if (!confirm(S.confirmRemove)) return;
        var tr = btn.closest('tr'); var email = tr.getAttribute('data-email');
        btn.disabled = true;
        try {
          var res = await fetch(BASE + '/' + encodeURIComponent(email), { method:'DELETE' });
          if ((await res.json()).success) { tr.remove(); return; }
          throw 0;
        } catch(e){ document.getElementById('mm-msg').textContent = S.err; btn.disabled = false; }
      }
    </script>
    <style>
      .mm-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:1rem}
      .mm-head h1{font-size:1.5rem;margin:0}.sub{color:#718096;margin:.3rem 0 1.3rem}
      .mm-toolbar{margin-bottom:1rem}
      .mm-tablewrap{overflow-x:auto;border:1px solid var(--line,#e2e8f0);border-radius:12px}
      .mm-table{width:100%;border-collapse:collapse;font-size:.93rem}
      .mm-table th,.mm-table td{text-align:left;padding:.7rem .9rem;border-bottom:1px solid var(--line,#edf0f5)}
      .mm-table th{background:#f8fafc;font-weight:700;color:#475569}
      .mm-table tr:last-child td{border-bottom:none}
      .mm-badge{font-size:.74rem;font-weight:700;padding:.15rem .5rem;border-radius:999px}
      .mm-badge.act{background:#dcfce7;color:#166534}.mm-badge.blk{background:#fee2e2;color:#991b1b}
      .mm-actions{white-space:nowrap;text-align:right}
      .btn.sm{padding:.35rem .7rem;font-size:.82rem}
      .mm-empty{border:2px dashed var(--line,#e2e8f0);border-radius:14px;padding:2.5rem 1.5rem;text-align:center;color:#718096;max-width:640px}
    </style>`;

  const html = `<!DOCTYPE html><html lang="${lang}"><head>${headTags({ title: t.meta_title, description: 'Manage your site members.', origin })}<style>${baseCss()}</style></head>
    <body>${siteHeader('/dashboard', {})}<main class="container" style="max-width:980px;margin:0 auto;padding:1.5rem 1.25rem 4rem">${inner}</main>${siteFooter({ lang })}</body></html>`;
  return htmlResponse(html);
}

/** POST /api/ai-builder/:project_id/members/:email/status — block / unblock. */
export async function handleMemberSetStatus(ctx) {
  const { env, params, request } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return jsonResponse({ success: false, error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  await setMemberStatus(env.DB, r.projectKey, decodeURIComponent(params.email), body.status);
  return jsonResponse({ success: true });
}

/** DELETE /api/ai-builder/:project_id/members/:email — remove a member. */
export async function handleMemberDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return jsonResponse({ success: false, error: 'not_found' }, 404);
  await deleteMember(env.DB, r.projectKey, decodeURIComponent(params.email));
  return jsonResponse({ success: true });
}

/** GET /api/ai-builder/:project_id/members.csv — export the roster. */
export async function handleMembersCsv(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return jsonResponse({ success: false, error: 'not_found' }, 404);
  const members = await listMembers(env.DB, r.projectKey);
  const csvCell = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const iso = (ts) => (ts ? new Date(ts * 1000).toISOString() : '');
  const lines = ['email,name,status,joined,last_sign_in'];
  for (const m of members) lines.push([m.email, m.name, m.status, iso(m.created_at), iso(m.last_login_at)].map(csvCell).join(','));
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="members.csv"' },
  });
}
