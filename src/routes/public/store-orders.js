// Buyer purchase history (member-lite), per SITE — see roadmap design:
//   GET  /store/orders?s=<publicId>      history (valid cf_buyer cookie) or email form
//   POST /store/orders/send              { s, email } -> magic link (only if that
//                                        email actually has orders here — no
//                                        enumeration / spam-cannon vector; the
//                                        response is generic either way)
//   GET  /store/orders/auth?s=&t=        verify link token -> set signed cookie
//
// Sessions are stateless HMAC tokens (utils/signed-token.js): read-only data,
// 30-day cookie, no DB table, no revocation needed. Proving control of the
// email IS the authorization — it's the same email Stripe checkout recorded.

import { resolveStoreProject } from '../api/ai-builder/store.js';
import { getOrdersByEmail } from '../../db/store-orders.js';
import { signToken, verifyToken } from '../../utils/signed-token.js';
import { sendBuyerOrdersLinkEmail, isValidEmail, sanitizeEmail } from '../../utils/email.js';
import { setCookie } from '../../utils/crypto.js';
import { translator } from '../../i18n/index.js';

const PUBLIC_ID_RE = /^[a-f0-9-]{8,64}$/i;
const COOKIE = 'cf_buyer';
const LINK_TTL = 15 * 60; // magic link: 15 minutes
const SESSION_TTL = 30 * 24 * 3600; // cookie: 30 days

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function readCookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}

function shell(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${esc(title)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#1a202c;line-height:1.6;padding:2.5rem 1rem}
    .card{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:2.2rem 2rem;box-shadow:0 10px 40px rgba(0,0,0,.08)}
    h1{font-size:1.35rem;margin-bottom:.3rem}
    .sub{color:#4a5568;margin-bottom:1.2rem;font-size:.95rem}
    input{width:100%;box-sizing:border-box;padding:.75rem .9rem;border:1.5px solid #e9ecf5;border-radius:11px;font:inherit;font-size:.95rem;margin:.3rem 0 .8rem}
    input:focus{outline:none;border-color:#667eea}
    .btn{display:inline-flex;align-items:center;border-radius:11px;padding:.7rem 1.2rem;font-weight:700;font-size:.92rem;cursor:pointer;text-decoration:none;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}
    .btn:disabled{opacity:.6}
    .note{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:.7rem .9rem;font-size:.88rem;margin-bottom:1rem}
    .note.err{background:#fef2f2;border-color:#fecaca;color:#991b1b}
    .ord{display:flex;justify-content:space-between;align-items:center;gap:.8rem;padding:.8rem 0;border-bottom:1px solid #edf2f7;flex-wrap:wrap}
    .ord:last-child{border-bottom:none}
    .ord b{display:block;font-size:.92rem}
    .ord .meta{color:#718096;font-size:.84rem}
    .ord .amt{font-weight:800}
    .ord a{color:#667eea;font-weight:600;text-decoration:none;font-size:.88rem;white-space:nowrap}
    .muted{color:#718096;font-size:.9rem}
  </style>
</head>
<body>${body}</body>
</html>`;
}

function page(html, extraHeaders = {}) {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

/** GET /store/orders?s=<publicId> — history (signed cookie) or email form. */
export async function handleBuyerOrders(ctx) {
  const { env, request, url } = ctx;
  const publicId = url.searchParams.get('s') || '';
  if (!PUBLIC_ID_RE.test(publicId)) return new Response('Not found', { status: 404 });
  const r = await resolveStoreProject(env, publicId);
  if (!r) return new Response('Not found', { status: 404 });
  const lang = r.language || 'en';
  const tr = translator(lang);

  // Valid session for THIS site? -> history.
  const cookie = readCookie(request, COOKIE);
  const session = cookie ? await verifyToken(env.STRIPE_SECRET_KEY, 'buyer', decodeURIComponent(cookie)) : null;
  if (session && session.s === publicId && session.e) {
    const orders = await getOrdersByEmail(env.DB, r.projectKey, session.e);
    const money = (cents, cur) => {
      try { return new Intl.NumberFormat(lang, { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format(cents / 100); }
      catch { return `${(cents / 100).toFixed(2)} ${(cur || 'usd').toUpperCase()}`; }
    };
    const rows = orders.map((o) => {
      let items = [];
      try { items = JSON.parse(o.items_json || '[]'); } catch { /* ignore */ }
      const summary = items.map((i) => `${i.name} × ${i.qty}`).join(', ');
      const when = o.created_at ? new Date(o.created_at * 1000).toLocaleDateString(lang, { dateStyle: 'medium' }) : '';
      const ref = (o.stripe_session_id || '').slice(-8).toUpperCase();
      return `<div class="ord">
        <div><b>#${esc(ref)}</b><span class="meta">${esc(when)} · ${esc(summary)}</span></div>
        <span class="amt">${money(o.amount_total, o.currency)}</span>
        <a href="/store/receipt?s=${esc(publicId)}&sid=${esc(o.stripe_session_id)}">${tr('rcpt.view_receipt')} →</a>
      </div>`;
    }).join('');
    const body = `<div class="card">
      <h1>${tr('rcpt.orders_at', { name: esc(r.businessName) })}</h1>
      <p class="sub">${esc(session.e)}</p>
      ${orders.length ? rows : `<p class="muted">${tr('rcpt.no_orders_yet')}</p>`}
    </div>`;
    return page(shell(tr('rcpt.my_orders'), body));
  }

  // No session -> email form (+ sent / expired notices).
  const sent = url.searchParams.get('sent') === '1';
  const expired = url.searchParams.get('expired') === '1';
  const body = `<div class="card">
    <h1>${tr('rcpt.orders_at', { name: esc(r.businessName) })}</h1>
    <p class="sub">${tr('rcpt.orders_intro')}</p>
    ${sent ? `<div class="note">${tr('rcpt.sent')}</div>` : ''}
    ${expired ? `<div class="note err">${tr('rcpt.link_expired')}</div>` : ''}
    <form method="POST" action="/store/orders/send">
      <input type="hidden" name="s" value="${esc(publicId)}">
      <input type="email" name="email" required maxlength="320" placeholder="${tr('rcpt.email_ph')}" autocomplete="email">
      <button class="btn" type="submit">${tr('rcpt.send_link')}</button>
    </form>
  </div>`;
  return page(shell(tr('rcpt.my_orders'), body));
}

/** POST /store/orders/send — form or JSON; generic response either way. */
export async function handleBuyerOrdersSend(ctx) {
  const { env, request, url } = ctx;
  try {
    let s = '', email = '';
    const ct = request.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
      const b = await request.json().catch(() => ({}));
      s = (b.s || '').toString();
      email = (b.email || '').toString();
    } else {
      const form = await request.formData();
      s = (form.get('s') || '').toString();
      email = (form.get('email') || '').toString();
    }
    if (!PUBLIC_ID_RE.test(s)) return json({ success: false, error: 'Unknown site' }, 404);
    const r = await resolveStoreProject(env, s);
    if (!r || !isValidEmail(email)) return json({ success: false, error: 'Invalid request' }, 400);
    email = sanitizeEmail(email);

    // Only send when the email actually has orders here — keeps us from being
    // a spam vector and the generic redirect leaks nothing either way.
    const orders = await getOrdersByEmail(env.DB, r.projectKey, email, 1);
    if (orders.length) {
      const lang = r.language || 'en';
      const tr = translator(lang);
      const token = await signToken(env.STRIPE_SECRET_KEY, 'buyer-link', { e: email, s }, LINK_TTL);
      const linkUrl = `${url.origin}/store/orders/auth?s=${s}&t=${encodeURIComponent(token)}`;
      await sendBuyerOrdersLinkEmail(env, {
        to: email,
        businessName: r.businessName,
        linkUrl,
        labels: {
          subject: tr('rcpt.link_subject', { name: r.businessName }),
          heading: tr('rcpt.link_heading'),
          intro: tr('rcpt.link_intro', { name: r.businessName }),
          button: tr('rcpt.my_orders'),
          expiry: tr('rcpt.link_expiry'),
        },
      });
    }
    return Response.redirect(`${url.origin}/store/orders?s=${s}&sent=1`, 303);
  } catch (e) {
    console.error('buyer orders send error:', e);
    return json({ success: false, error: 'Something went wrong — please try again.' }, 500);
  }
}

/** GET /store/orders/auth?s=&t= — verify the link, set the session cookie. */
export async function handleBuyerOrdersAuth(ctx) {
  const { env, url } = ctx;
  const s = url.searchParams.get('s') || '';
  const t = url.searchParams.get('t') || '';
  if (!PUBLIC_ID_RE.test(s)) return new Response('Not found', { status: 404 });
  const payload = await verifyToken(env.STRIPE_SECRET_KEY, 'buyer-link', t);
  const base = `${url.origin}/store/orders?s=${s}`;
  if (!payload || payload.s !== s || !payload.e) {
    return Response.redirect(`${base}&expired=1`, 302);
  }
  const session = await signToken(env.STRIPE_SECRET_KEY, 'buyer', { e: payload.e, s }, SESSION_TTL);
  const res = new Response(null, { status: 302, headers: { Location: base } });
  return setCookie(res, COOKIE, encodeURIComponent(session), { maxAge: SESSION_TTL, sameSite: 'Lax' });
}
