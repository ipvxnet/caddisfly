// GET /admin/audit — SaaS operator's full audit log across ALL users.
// Read-only, search + filter + paginate. English (operator-only surface).
// Gated by [authMiddleware, adminMiddleware] at the router.

import { htmlResponse } from '../../utils/response.js';
import { queryAuditLogs, distinctAuditActions } from '../../db/audit-logs.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(ts) {
  try { return new Date(ts * 1000).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' '); }
}

export async function handleAdminAudit(ctx) {
  const { env, query } = ctx;
  const action = (query.action || '').toString();
  const status = (query.status || '').toString();
  const q = (query.q || '').toString().slice(0, 100);
  const offset = Math.max(0, parseInt(query.offset, 10) || 0);
  const PAGE = 100;

  const [logs, actions] = await Promise.all([
    queryAuditLogs(env.DB, { action: action || undefined, status: status || undefined, q: q || undefined, limit: PAGE + 1, offset }),
    distinctAuditActions(env.DB),
  ]);
  const hasNext = logs.length > PAGE;
  const rows = logs.slice(0, PAGE);
  const qs = (over) => {
    const p = new URLSearchParams({ ...(action ? { action } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}), ...over });
    const s = p.toString(); return s ? `?${s}` : '';
  };

  const body = rows.length
    ? rows.map((r) => `
        <tr>
          <td class="t">${esc(fmt(r.created_at))}</td>
          <td>${esc(r.user_email)}</td>
          <td class="dim">${esc(r.team_owner_email)}</td>
          <td><span class="act">${esc(r.action)}</span></td>
          <td>${esc(r.resource_name || r.resource_id || '')}${r.metadata ? `<span class="meta">${esc(r.metadata)}</span>` : ''}</td>
          <td>${r.status === 'error' ? `<span class="pill bad" title="${esc(r.error || '')}">error</span>` : '<span class="pill ok">ok</span>'}</td>
          <td class="dim">${esc(r.ip || '')}</td>
        </tr>`).join('')
    : '<tr><td colspan="7" class="empty">No matching activity.</td></tr>';

  const html = `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit log — Admin</title><meta name="robots" content="noindex">
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;margin:0;color:#1a202c}
    .wrap{max-width:1200px;margin:0 auto;padding:2rem 1.4rem 4rem}
    .head{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1.2rem}
    h1{font-size:1.5rem;margin:0}.back{color:#667eea;text-decoration:none;font-weight:700}
    .filters{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.2rem}
    .filters input,.filters select{padding:.5rem .7rem;border:1.5px solid #e2e8f0;border-radius:9px;font:inherit;font-size:.88rem}
    .filters input[type=search]{flex:1;min-width:220px}
    .filters button{background:#667eea;color:#fff;border:none;border-radius:9px;padding:.5rem 1.1rem;font-weight:700;cursor:pointer}
    .filters .clear{align-self:center;color:#718096;font-size:.85rem}
    table{width:100%;border-collapse:collapse;font-size:.84rem;background:#fff;border-radius:12px;overflow:hidden}
    th{text-align:left;color:#718096;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .6rem;border-bottom:2px solid #edf1f7}
    td{padding:.5rem .6rem;border-bottom:1px solid #f1f5f9;vertical-align:top}
    td.t{white-space:nowrap;color:#718096}.dim{color:#94a3b8;font-size:.8rem}
    .act{font-family:ui-monospace,Menlo,monospace;font-size:.78rem;background:#f1f5f9;border-radius:5px;padding:.1rem .4rem;color:#334155}
    .meta{display:block;color:#94a3b8;font-size:.72rem;margin-top:.2rem;word-break:break-word;max-width:320px}
    .pill{font-size:.7rem;font-weight:800;border-radius:999px;padding:.1rem .5rem}
    .pill.ok{background:#ecfdf5;color:#065f46}.pill.bad{background:#fef2f2;color:#b91c1c}
    .empty{color:#718096;text-align:center;padding:2rem}
    .pager{display:flex;justify-content:space-between;margin-top:1.2rem}
    .pager a{border:1.5px solid #e2e8f0;border-radius:9px;padding:.45rem 1rem;font-weight:700;color:#4a5568;text-decoration:none;background:#fff}
  </style></head><body><div class="wrap">
    <div class="head"><h1>🧾 Audit log</h1><a class="back" href="/admin">← Admin</a></div>
    <form class="filters" method="GET" action="/admin/audit">
      <input type="search" name="q" value="${esc(q)}" placeholder="Search user, resource, action…">
      <select name="action"><option value="">All actions</option>
        ${actions.map((a) => `<option value="${esc(a)}" ${a === action ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
      <select name="status"><option value="">All</option>
        <option value="success" ${status === 'success' ? 'selected' : ''}>ok</option>
        <option value="error" ${status === 'error' ? 'selected' : ''}>error</option></select>
      <button type="submit">Filter</button>
      ${(action || status || q) ? '<a class="clear" href="/admin/audit">Clear</a>' : ''}
    </form>
    <table><thead><tr><th>When</th><th>User</th><th>Team</th><th>Action</th><th>Resource</th><th>Status</th><th>IP</th></tr></thead>
      <tbody>${body}</tbody></table>
    <div class="pager">
      ${offset > 0 ? `<a href="${qs({ offset: Math.max(0, offset - PAGE) })}">← Newer</a>` : '<span></span>'}
      ${hasNext ? `<a href="${qs({ offset: offset + PAGE })}">Older →</a>` : '<span></span>'}
    </div>
  </div></body></html>`;
  return htmlResponse(html);
}
