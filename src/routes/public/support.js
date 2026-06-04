// GET /support — customer support center (magic-link auth). Lists the
// customer's tickets and lets them open a new one or reply to a thread.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getTicketsByEmail, getTicketByPublicId, getMessages } from '../../db/tickets.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(ts) {
  if (!ts) return '';
  try { return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' '); } catch { return ''; }
}
function statusPill(s, tr) {
  const cls = s === 'closed' ? '' : s === 'in_progress' ? 'warn' : 'ok';
  return `<span class="pill ${cls}">${esc(tr('sup.st_' + s))}</span>`;
}

export async function handleSupport(ctx) {
  const { env, url, query } = ctx;
  const origin = url.origin;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/support');

  // Single-ticket thread view.
  if (query && query.t) {
    const ticket = await getTicketByPublicId(env.DB, query.t);
    if (!ticket || ticket.customer_email !== email) {
      return htmlResponse(pageShell(origin, `<p class="muted">${tr('sup.not_found')} <a href="/support">${tr('sup.back')}</a></p>`, 404, lang, tr), 404);
    }
    const messages = await getMessages(env.DB, ticket.id);
    const thread = messages
      .map(
        (m) => `<div class="msg ${m.is_staff ? 'staff' : ''}">
          <div class="msg-head"><strong>${m.is_staff ? tr('sup.staff') : esc(m.author_email)}</strong> <span class="muted">${fmt(m.created_at)}</span></div>
          <div class="msg-body">${esc(m.body)}</div>
        </div>`
      )
      .join('');
    const inner = `
      <p><a class="muted-link" href="/support">${tr('sup.all_tickets')}</a></p>
      <div class="thead">
        <h1>${esc(ticket.subject)}</h1>
        <div>${statusPill(ticket.status, tr)} <span class="pill">${esc(tr('sup.ty_' + ticket.type))}</span></div>
      </div>
      <div class="thread">${thread}</div>
      ${ticket.status === 'closed'
        ? `<p class="muted">${tr('sup.closed_note')}</p>`
        : ''}
      <form class="card" method="POST" action="/api/support/ticket/${esc(ticket.public_id)}/reply">
        <label for="body">${tr('sup.add_reply')}</label>
        <textarea id="body" name="body" rows="4" required placeholder="${tr('sup.reply_ph')}"></textarea>
        <button class="btn btn-primary" type="submit">${tr('sup.send_reply')}</button>
      </form>`;
    return htmlResponse(pageShell(origin, inner, 200, lang, tr));
  }

  // List + new-ticket form.
  const tickets = await getTicketsByEmail(env.DB, email);
  const list = tickets.length
    ? tickets
        .map(
          (t) => `<a class="trow" href="/support?t=${esc(t.public_id)}">
            <div><div class="t-subj">${esc(t.subject)}</div><div class="muted t-meta">${esc(tr('sup.ty_' + t.type))} · ${tr('sup.updated', { date: fmt(t.updated_at) })}</div></div>
            ${statusPill(t.status, tr)}
          </a>`
        )
        .join('')
    : `<p class="muted">${tr('sup.no_tickets')}</p>`;

  const sentNote = query && query.sent ? `<div class="note ok">${tr('sup.sent')}</div>` : '';
  const repliedNote = query && query.replied ? `<div class="note ok">${tr('sup.replied')}</div>` : '';

  const inner = `
    <div class="shead">
      <h1>${tr('sup.title')}</h1>
      <a class="muted-link" href="/help">${tr('sup.help_docs')}</a>
    </div>
    <p class="sub">${tr('sup.signed_in', { email: `<strong>${esc(email)}</strong>` })}</p>
    ${sentNote}${repliedNote}

    <div class="card">
      <h2>${tr('sup.new_ticket')}</h2>
      <form method="POST" action="/api/support/ticket">
        <label for="subject">${tr('sup.subject')}</label>
        <input id="subject" name="subject" required placeholder="${tr('sup.subject_ph')}">
        <label for="type">${tr('sup.type')}</label>
        <select id="type" name="type">
          <option value="issue">${tr('sup.type_issue')}</option>
          <option value="request">${tr('sup.type_request')}</option>
        </select>
        <label for="body">${tr('sup.details')}</label>
        <textarea id="body" name="body" rows="5" required placeholder="${tr('sup.details_ph')}"></textarea>
        <button class="btn btn-primary" type="submit">${tr('sup.submit')}</button>
      </form>
    </div>

    <div class="card">
      <h2>${tr('sup.your_tickets')}</h2>
      <div class="tlist">${list}</div>
    </div>`;

  return htmlResponse(pageShell(origin, inner, 200, lang, tr));
}

function pageShell(origin, inner, status = 200, lang = 'en', tr = (k) => k) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('sup.meta_title'), description: 'Get help and track your support tickets.', origin, path: '/support' })}
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
  ${siteHeader('/support', { lang })}
  <main><div class="swrap">${inner}</div></main>
  ${siteFooter({ lang })}
</body>
</html>`;
}
