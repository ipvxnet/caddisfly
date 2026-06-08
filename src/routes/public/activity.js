// GET /activity — the team Activity log (audit trail), read-only.
// Visible to a team OWNER (their own account) and team ADMINS (the teams they
// administer). Members can't see it. Append-only data — no edit/delete here.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { queryAuditLogs, distinctAuditActions } from '../../db/audit-logs.js';
import { getTeamsForMember } from '../../db/teams.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(ts, lang) {
  try { return new Date(ts * 1000).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' '); }
}

export async function handleActivity(ctx) {
  const { env, url, query } = ctx;
  const lang = ctx.lang || 'en';
  const tr = translator(lang);
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/activity', 303);

  // Allowed scopes: own account + teams where the viewer is an active admin.
  const memberships = await getTeamsForMember(env.DB, email).catch(() => []);
  const adminOf = memberships.filter((m) => m.role === 'admin').map((m) => m.owner_email);
  const owners = [...new Set([email, ...adminOf])];

  const action = (query.action || '').toString();
  const status = (query.status || '').toString();
  const q = (query.q || '').toString().slice(0, 100);
  const offset = Math.max(0, parseInt(query.offset, 10) || 0);
  const PAGE = 50;

  const [logs, actions] = await Promise.all([
    queryAuditLogs(env.DB, { teamOwners: owners, action: action || undefined, status: status || undefined, q: q || undefined, limit: PAGE + 1, offset }),
    distinctAuditActions(env.DB, owners.length === 1 ? owners[0] : undefined),
  ]);
  const hasNext = logs.length > PAGE;
  const rows = logs.slice(0, PAGE);

  const qs = (over) => {
    const p = new URLSearchParams({ ...(action ? { action } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}), ...over });
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const body = rows.length
    ? rows.map((r) => `
        <tr>
          <td class="t">${esc(fmt(r.created_at, lang))}</td>
          <td>${esc(r.user_email)}</td>
          <td><span class="act">${esc(r.action)}</span></td>
          <td>${esc(r.resource_name || r.resource_id || '')}${r.metadata ? `<span class="meta">${esc(r.metadata)}</span>` : ''}</td>
          <td>${r.status === 'error' ? `<span class="pill bad" title="${esc(r.error || '')}">${tr('act.error')}</span>` : `<span class="pill ok">${tr('act.ok')}</span>`}</td>
        </tr>`).join('')
    : `<tr><td colspan="5" class="empty">${tr('act.empty')}</td></tr>`;

  const inner = `
    <div class="ahead">
      <h1>${tr('act.title')}</h1>
      <div class="sub">${tr('act.sub')}</div>
    </div>
    <form class="filters" method="GET" action="/activity">
      <input type="search" name="q" value="${esc(q)}" placeholder="${tr('act.search_ph')}">
      <select name="action"><option value="">${tr('act.all_actions')}</option>
        ${actions.map((a) => `<option value="${esc(a)}" ${a === action ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
      <select name="status"><option value="">${tr('act.all_status')}</option>
        <option value="success" ${status === 'success' ? 'selected' : ''}>${tr('act.ok')}</option>
        <option value="error" ${status === 'error' ? 'selected' : ''}>${tr('act.error')}</option></select>
      <button type="submit">${tr('act.filter')}</button>
      ${(action || status || q) ? `<a class="clear" href="/activity">${tr('act.clear')}</a>` : ''}
    </form>
    <table class="alog">
      <thead><tr><th>${tr('act.when')}</th><th>${tr('act.user')}</th><th>${tr('act.action')}</th><th>${tr('act.resource')}</th><th>${tr('act.status')}</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div class="pager">
      ${offset > 0 ? `<a class="btn ghost" href="${qs({ offset: Math.max(0, offset - PAGE) })}">${tr('act.prev')}</a>` : '<span></span>'}
      ${hasNext ? `<a class="btn ghost" href="${qs({ offset: offset + PAGE })}">${tr('act.next')}</a>` : '<span></span>'}
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('act.meta_title'), description: 'Account activity log.', origin: url.origin })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    .awrap{max-width:980px;margin:0 auto;padding:2.4rem 1.4rem 4rem}
    .ahead h1{font-size:clamp(1.5rem,3vw,2rem);font-weight:900;color:var(--ink)}
    .ahead .sub{color:var(--muted);margin:.3rem 0 1.4rem}
    .filters{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.2rem}
    .filters input,.filters select{padding:.5rem .7rem;border:1.5px solid var(--line);border-radius:9px;font:inherit;font-size:.88rem}
    .filters input[type=search]{flex:1;min-width:200px}
    .filters button{background:var(--grad);color:#fff;border:none;border-radius:9px;padding:.5rem 1.1rem;font-weight:700;cursor:pointer}
    .filters .clear{align-self:center;color:var(--muted);font-size:.85rem}
    .alog{width:100%;border-collapse:collapse;font-size:.86rem}
    .alog th{text-align:left;color:#718096;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;padding:.5rem .6rem;border-bottom:2px solid var(--line)}
    .alog td{padding:.55rem .6rem;border-bottom:1px solid var(--line);vertical-align:top;color:var(--body)}
    .alog td.t{white-space:nowrap;color:var(--muted)}
    .act{font-family:ui-monospace,Menlo,monospace;font-size:.8rem;background:#f1f5f9;border-radius:5px;padding:.1rem .4rem;color:#334155}
    .meta{display:block;color:#94a3b8;font-size:.74rem;margin-top:.2rem;word-break:break-word}
    .pill{font-size:.72rem;font-weight:800;border-radius:999px;padding:.1rem .5rem}
    .pill.ok{background:#ecfdf5;color:#065f46}.pill.bad{background:#fef2f2;color:#b91c1c}
    .empty{color:var(--muted);text-align:center;padding:2rem}
    .pager{display:flex;justify-content:space-between;margin-top:1.2rem}
    .btn.ghost{border:1.5px solid var(--line);border-radius:9px;padding:.45rem 1rem;font-weight:700;color:#4a5568;text-decoration:none}
  </style>
</head>
<body>
  ${siteHeader('/activity', { lang })}
  <main><div class="awrap">${inner}</div></main>
  ${siteFooter({ lang })}
</body>
</html>`;
  return htmlResponse(html);
}
