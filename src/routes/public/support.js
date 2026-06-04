// GET /support — customer support center (magic-link auth). Lists the
// customer's tickets and lets them open a new one or reply to a thread.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getTicketsByEmail, getTicketByPublicId, getMessages } from '../../db/tickets.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(ts) {
  if (!ts) return '';
  try { return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' '); } catch { return ''; }
}
function statusPill(s) {
  const cls = s === 'closed' ? '' : s === 'in_progress' ? 'warn' : 'ok';
  const label = s === 'in_progress' ? 'in progress' : s;
  return `<span class="pill ${cls}">${esc(label)}</span>`;
}

export async function handleSupport(ctx) {
  const { env, url, query } = ctx;
  const origin = url.origin;
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/support');

  // Single-ticket thread view.
  if (query && query.t) {
    const ticket = await getTicketByPublicId(env.DB, query.t);
    if (!ticket || ticket.customer_email !== email) {
      return htmlResponse(pageShell(origin, `<p class="muted">Ticket not found. <a href="/support">Back to support</a></p>`), 404);
    }
    const messages = await getMessages(env.DB, ticket.id);
    const thread = messages
      .map(
        (m) => `<div class="msg ${m.is_staff ? 'staff' : ''}">
          <div class="msg-head"><strong>${m.is_staff ? 'Caddisfly Support' : esc(m.author_email)}</strong> <span class="muted">${fmt(m.created_at)}</span></div>
          <div class="msg-body">${esc(m.body)}</div>
        </div>`
      )
      .join('');
    const inner = `
      <p><a class="muted-link" href="/support">← All tickets</a></p>
      <div class="thead">
        <h1>${esc(ticket.subject)}</h1>
        <div>${statusPill(ticket.status)} <span class="pill">${esc(ticket.type)}</span></div>
      </div>
      <div class="thread">${thread}</div>
      ${ticket.status === 'closed'
        ? `<p class="muted">This ticket is closed. Replying will re-open it.</p>`
        : ''}
      <form class="card" method="POST" action="/api/support/ticket/${esc(ticket.public_id)}/reply">
        <label for="body">Add a reply</label>
        <textarea id="body" name="body" rows="4" required placeholder="Type your reply…"></textarea>
        <button class="btn btn-primary" type="submit">Send reply</button>
      </form>`;
    return htmlResponse(pageShell(origin, inner));
  }

  // List + new-ticket form.
  const tickets = await getTicketsByEmail(env.DB, email);
  const list = tickets.length
    ? tickets
        .map(
          (t) => `<a class="trow" href="/support?t=${esc(t.public_id)}">
            <div><div class="t-subj">${esc(t.subject)}</div><div class="muted t-meta">${esc(t.type)} · updated ${fmt(t.updated_at)}</div></div>
            ${statusPill(t.status)}
          </a>`
        )
        .join('')
    : '<p class="muted">You have no tickets yet.</p>';

  const sentNote = query && query.sent ? '<div class="note ok">✓ Your ticket was submitted — we\'ll reply by email.</div>' : '';
  const repliedNote = query && query.replied ? '<div class="note ok">✓ Reply sent.</div>' : '';

  const inner = `
    <div class="shead">
      <h1>Support</h1>
      <a class="muted-link" href="/help">Help &amp; docs →</a>
    </div>
    <p class="sub">Signed in as <strong>${esc(email)}</strong>. Open a ticket and we'll reply by email.</p>
    ${sentNote}${repliedNote}

    <div class="card">
      <h2>Open a new ticket</h2>
      <form method="POST" action="/api/support/ticket">
        <label for="subject">Subject</label>
        <input id="subject" name="subject" required placeholder="Briefly, what's going on?">
        <label for="type">Type</label>
        <select id="type" name="type">
          <option value="issue">Issue / bug</option>
          <option value="request">Feature request</option>
        </select>
        <label for="body">Details</label>
        <textarea id="body" name="body" rows="5" required placeholder="Describe the issue or request. Include the site name / URL if relevant."></textarea>
        <button class="btn btn-primary" type="submit">Submit ticket</button>
      </form>
    </div>

    <div class="card">
      <h2>Your tickets</h2>
      <div class="tlist">${list}</div>
    </div>`;

  return htmlResponse(pageShell(origin, inner));
}

function pageShell(origin, inner, status = 200) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Support — Caddisfly', description: 'Get help and track your support tickets.', origin })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .swrap{max-width:760px;margin:0 auto;padding:3rem 1.5rem}
    .shead,.thead{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .shead h1,.thead h1{font-size:clamp(1.7rem,4vw,2.3rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .sub{color:var(--body);margin:.3rem 0 1.4rem}
    .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem 1.6rem;margin-bottom:1.2rem}
    .card h2{font-size:1.1rem;color:var(--ink);margin-bottom:.8rem}
    label{display:block;font-weight:700;color:var(--ink);margin:.8rem 0 .35rem;font-size:.92rem}
    input,select,textarea{width:100%;box-sizing:border-box;padding:.7rem .9rem;border:1.5px solid var(--line);border-radius:11px;font-family:inherit;font-size:.97rem}
    input:focus,select:focus,textarea:focus{outline:none;border-color:var(--p1)}
    .btn{display:inline-flex;align-items:center;background:var(--grad);color:#fff;border:none;border-radius:11px;padding:.7rem 1.2rem;font-size:.95rem;font-weight:700;cursor:pointer;text-decoration:none;margin-top:1rem}
    .muted{color:var(--muted)}.muted-link{color:var(--muted);font-size:.9rem}
    .pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.12rem .6rem;font-size:.74rem;font-weight:700;color:var(--p2)}
    .pill.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
    .pill.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
    .tlist{display:flex;flex-direction:column}
    .trow{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.85rem 0;border-bottom:1px solid var(--line);text-decoration:none}
    .trow:last-child{border-bottom:none}
    .t-subj{font-weight:700;color:var(--ink)}.t-meta{font-size:.8rem}
    .note{border-radius:12px;padding:.8rem 1rem;margin-bottom:1.2rem;font-size:.92rem}
    .note.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
    .thread{margin:1rem 0}
    .msg{border:1px solid var(--line);border-radius:12px;padding:.9rem 1.1rem;margin-bottom:.8rem;background:#fff}
    .msg.staff{background:#f5f3ff;border-color:#ddd6fe}
    .msg-head{font-size:.85rem;margin-bottom:.4rem}
    .msg-body{color:var(--body);line-height:1.6;white-space:pre-wrap}
  </style>
</head>
<body>
  ${siteHeader('/support')}
  <main><div class="swrap">${inner}</div></main>
  ${siteFooter()}
</body>
</html>`;
}
