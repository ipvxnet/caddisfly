// SaaS admin support queue — list/triage/reply/close tickets. Gated by
// [authMiddleware, adminMiddleware]. Page + form-POST reply/status handlers.

import { htmlResponse, redirect } from '../../utils/response.js';
import { getAllTickets, getTicketByPublicId, getMessages, addMessage, setStatus } from '../../db/tickets.js';
import { sendTicketEmail } from '../../utils/email.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(ts) {
  if (!ts) return '';
  try { return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' '); } catch { return ''; }
}
function pill(s) {
  const cls = s === 'closed' ? '' : s === 'in_progress' ? 'warn' : 'ok';
  return `<span class="badge ${cls}">${esc(s === 'in_progress' ? 'in progress' : s)}</span>`;
}

async function formData(request) {
  try { return Object.fromEntries((await request.formData()).entries()); } catch { return {}; }
}

export async function handleAdminTickets(ctx) {
  const { env, url, query } = ctx;

  // Thread view.
  if (query && query.t) {
    const ticket = await getTicketByPublicId(env.DB, query.t);
    if (!ticket) return htmlResponse(page(`<p><a href="/admin/tickets">← Tickets</a></p><p>Not found.</p>`), 404);
    const messages = await getMessages(env.DB, ticket.id);
    const thread = messages
      .map(
        (m) => `<div class="msg ${m.is_staff ? 'staff' : ''}">
          <div class="msg-head"><strong>${m.is_staff ? 'Support (staff)' : esc(m.author_email)}</strong> <span class="muted">${fmt(m.created_at)}</span></div>
          <div class="msg-body">${esc(m.body)}</div></div>`
      )
      .join('');
    const statusForm = `<form method="POST" action="/api/admin/tickets/${esc(ticket.public_id)}/status" class="row-form">
        <select name="status">
          ${['open', 'in_progress', 'closed'].map((s) => `<option value="${s}" ${ticket.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
        </select>
        <button type="submit">Update status</button>
      </form>`;
    return htmlResponse(page(`
      <p><a href="/admin/tickets">← All tickets</a></p>
      <div class="thead"><h2><span class="tno">#${ticket.id}</span> ${esc(ticket.subject)}</h2><div>${pill(ticket.status)} <span class="badge">${esc(ticket.type)}</span></div></div>
      <p class="muted">From ${esc(ticket.customer_email)} · opened ${fmt(ticket.created_at)}</p>
      ${statusForm}
      <div class="thread">${thread}</div>
      <form method="POST" action="/api/admin/tickets/${esc(ticket.public_id)}/reply" class="card">
        <label>Reply (emails the customer)</label>
        <textarea name="body" rows="4" required placeholder="Type your reply…"></textarea>
        <button type="submit" class="primary">Send reply</button>
      </form>`));
  }

  // Queue.
  const filter = (query && query.status) || '';
  const tickets = await getAllTickets(env.DB, filter);
  const rows = tickets.length
    ? tickets
        .map(
          (t) => `<tr onclick="location.href='/admin/tickets?t=${esc(t.public_id)}'">
            <td class="muted">#${t.id}</td>
            <td>${pill(t.status)}</td>
            <td>${esc(t.type)}</td>
            <td class="subj">${esc(t.subject)}</td>
            <td class="email">${esc(t.customer_email)}</td>
            <td class="muted">${fmt(t.updated_at)}</td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="muted">No tickets.</td></tr>';
  const tabs = ['', 'open', 'in_progress', 'closed']
    .map((s) => `<a class="tab ${filter === s ? 'active' : ''}" href="/admin/tickets${s ? '?status=' + s : ''}">${s ? s.replace('_', ' ') : 'all'}</a>`)
    .join('');
  return htmlResponse(page(`
    <div class="thead"><h2>Support tickets</h2><a class="back" href="/admin">← Dashboard</a></div>
    <div class="tabs">${tabs}</div>
    <table><thead><tr><th>#</th><th>Status</th><th>Type</th><th>Subject</th><th>Customer</th><th>Updated</th></tr></thead>
      <tbody>${rows}</tbody></table>`));
}

/** POST /api/admin/tickets/:public_id/reply */
export async function handleAdminTicketReply(ctx) {
  const { env, request, params, url } = ctx;
  const ticket = await getTicketByPublicId(env.DB, params.public_id);
  if (!ticket) return redirect('/admin/tickets', 303);
  const body = await formData(request);
  const message = String(body.body || '').trim();
  if (!message) return redirect(`/admin/tickets?t=${ticket.public_id}`, 303);

  await addMessage(env.DB, ticket, { authorEmail: ctx.user.email, isStaff: true, body: message });
  await sendTicketEmail(env, {
    to: ticket.customer_email,
    subject: `Re: ${ticket.subject} [Ticket #${ticket.id}]`,
    heading: 'Caddisfly Support replied to your ticket',
    intro: `Re: "${ticket.subject}"`,
    body: message,
    linkUrl: `${url.origin}/support?t=${ticket.public_id}`,
    linkLabel: 'View & reply',
  });
  return redirect(`/admin/tickets?t=${ticket.public_id}`, 303);
}

/** POST /api/admin/tickets/:public_id/status */
export async function handleAdminTicketStatus(ctx) {
  const { env, request, params } = ctx;
  const ticket = await getTicketByPublicId(env.DB, params.public_id);
  if (!ticket) return redirect('/admin/tickets', 303);
  const body = await formData(request);
  await setStatus(env.DB, ticket.id, String(body.status || ''));
  return redirect(`/admin/tickets?t=${ticket.public_id}`, 303);
}

function page(inner) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex"><title>Tickets · Caddisfly Admin</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#1a202c}
  .wrap{max-width:1000px;margin:0 auto;padding:2rem 1.5rem}
  .thead{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap}
  h2{font-size:1.3rem}
  .back,a{color:#5a3da8;text-decoration:none}
  .muted{color:#a0aec0}
  .tabs{display:flex;gap:.4rem;margin-bottom:1rem;flex-wrap:wrap}
  .tab{font-size:.82rem;font-weight:700;padding:.3rem .8rem;border:1px solid #e2e8f0;border-radius:999px;background:#fff;text-transform:capitalize}
  .tab.active{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-size:.88rem}
  th,td{text-align:left;padding:.7rem .8rem;border-bottom:1px solid #edf2f7}
  th{color:#718096;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}
  tbody tr{cursor:pointer}
  tbody tr:hover{background:#f8fafc}
  td.subj{font-weight:700}td.email{color:#4a5568}
  .badge{display:inline-block;border-radius:999px;padding:.1rem .55rem;font-size:.72rem;font-weight:700;background:#edf2f7;color:#4a5568;text-transform:capitalize}
  .tno{color:#a0aec0;font-weight:700}
  .badge.ok{background:#ecfdf5;color:#065f46}.badge.warn{background:#fffbeb;color:#92400e}
  .row-form{display:flex;gap:.5rem;margin:1rem 0;align-items:center}
  select,textarea{font:inherit;padding:.5rem .7rem;border:1px solid #cbd5e0;border-radius:8px}
  .row-form button,.card button{font:inherit;font-weight:700;padding:.5rem .9rem;border-radius:8px;border:1px solid #cbd5e0;background:#fff;cursor:pointer}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.2rem;margin-top:1rem}
  .card label{display:block;font-weight:700;margin-bottom:.5rem}
  .card textarea{width:100%;box-sizing:border-box}
  .card button.primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;margin-top:.8rem}
  .thread{margin:1.2rem 0}
  .msg{border:1px solid #e2e8f0;border-radius:10px;padding:.8rem 1rem;margin-bottom:.7rem;background:#fff}
  .msg.staff{background:#f5f3ff;border-color:#ddd6fe}
  .msg-head{font-size:.82rem;margin-bottom:.35rem}
  .msg-body{line-height:1.6;white-space:pre-wrap;color:#2d3748}
</style></head>
<body><div class="wrap">${inner}</div></body></html>`;
}
