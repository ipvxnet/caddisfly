// GET /store/receipt?s=<publicId>&sid=<cs_…> — buyer-facing order confirmation.
// Stripe's success_url lands here; we retrieve the session from the merchant's
// connected account (server truth — nothing trusted from the query besides the
// unguessable session id), render a print-friendly receipt in the SITE's
// language, and record the order + send the emails off the response path.

import { getOrCreateConfig, resolveStoreProject, recordStoreOrder, sessionItems } from '../api/ai-builder/store.js';
import { getStoreCheckoutSession } from '../../utils/stripe.js';
import { translator } from '../../i18n/index.js';

const PUBLIC_ID_RE = /^[a-f0-9-]{8,64}$/i;
const SESSION_ID_RE = /^cs_[a-zA-Z0-9_]{10,250}$/;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
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
    .ok-badge{width:56px;height:56px;border-radius:50%;background:#ecfdf5;color:#059669;display:flex;align-items:center;justify-content:center;font-size:1.7rem;margin:0 auto 1rem}
    h1{font-size:1.45rem;text-align:center}
    .sub{text-align:center;color:#4a5568;margin:.3rem 0 1.4rem}
    .meta{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;color:#4a5568;font-size:.88rem;border-top:1px solid #e9ecf5;padding-top:1rem}
    .meta b{color:#1a202c}
    table{width:100%;border-collapse:collapse;margin:1.1rem 0}
    td{padding:.5rem 0;border-bottom:1px solid #edf2f7;color:#4a5568;font-size:.95rem}
    td:last-child{text-align:right}
    tr.total td{border-bottom:none;font-weight:800;color:#1a202c;padding-top:.8rem}
    .note{color:#718096;font-size:.85rem;margin-top:.6rem}
    .ship{background:#f7f8fc;border:1px solid #e9ecf5;border-radius:10px;padding:.7rem .9rem;font-size:.88rem;color:#4a5568;margin-top:.8rem}
    .acts{display:flex;gap:.7rem;justify-content:center;margin-top:1.6rem;flex-wrap:wrap}
    .btn{display:inline-flex;align-items:center;gap:.35rem;border-radius:11px;padding:.7rem 1.2rem;font-weight:700;font-size:.92rem;cursor:pointer;text-decoration:none;border:none}
    .btn-p{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}
    .btn-g{background:#fff;color:#1a202c;border:1.5px solid #e9ecf5}
    @media print{body{background:#fff;padding:0}.card{box-shadow:none;max-width:none}.acts{display:none}}
  </style>
</head>
<body>${body}</body>
</html>`;
}

export async function handleStoreReceipt(ctx) {
  const { env, url } = ctx;
  const publicId = url.searchParams.get('s') || '';
  const sid = url.searchParams.get('sid') || '';
  const plain = (msg) => page(shell('Receipt', `<div class="card"><h1>${esc(msg)}</h1></div>`), 404);

  try {
    if (!PUBLIC_ID_RE.test(publicId) || !SESSION_ID_RE.test(sid)) return plain('Not found');
    const r = await resolveStoreProject(env, publicId);
    if (!r) return plain('Not found');
    const tr = translator(r.language || 'en');
    const lang = r.language || 'en';

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    if (!config.stripe_account_id) return plain(tr('rcpt.not_found'));

    let session;
    try {
      session = await getStoreCheckoutSession(env, config.stripe_account_id, sid);
    } catch {
      return plain(tr('rcpt.not_found'));
    }
    // Bind the session to this site — a session id from another store 404s.
    if (!session.metadata || session.metadata.site !== publicId) return plain(tr('rcpt.not_found'));

    const paid = session.payment_status === 'paid';
    if (paid && ctx.ctx && typeof ctx.ctx.waitUntil === 'function') {
      // Record + emails off the response path (idempotent with the webhook).
      ctx.ctx.waitUntil(recordStoreOrder(env, publicId, session).catch((e) => console.error('receipt record error:', e)));
    }

    const money = (cents) => {
      try { return new Intl.NumberFormat(lang, { style: 'currency', currency: (session.currency || 'usd').toUpperCase() }).format(cents / 100); }
      catch { return `${((cents || 0) / 100).toFixed(2)} ${(session.currency || 'usd').toUpperCase()}`; }
    };
    const items = sessionItems(session);
    const details = session.customer_details || {};
    const shipping = session.shipping_details || (session.collected_information && session.collected_information.shipping_details) || null;
    const orderRef = session.id.slice(-8).toUpperCase();
    const when = session.created ? new Date(session.created * 1000).toLocaleDateString(lang, { dateStyle: 'medium' }) : '';

    // Back link: only the value WE put in metadata at session creation.
    const back = session.metadata.back && /^https?:\/\/[\w.-]+(:\d+)?\/[\w/-]*$/.test(session.metadata.back)
      ? session.metadata.back
      : '';

    const shipBlock = shipping && shipping.address
      ? `<div class="ship"><b>${tr('rcpt.shipping_to')}:</b> ${esc(shipping.name || '')} — ${esc([shipping.address.line1, shipping.address.line2, shipping.address.city, shipping.address.state, shipping.address.postal_code, shipping.address.country].filter(Boolean).join(', '))}</div>`
      : '';

    const body = `
  <div class="card">
    <div class="ok-badge">✓</div>
    <h1>${tr(paid ? 'rcpt.thanks' : 'rcpt.title')}</h1>
    <p class="sub">${paid ? tr('rcpt.paid_to', { name: esc(r.businessName) }) : tr('rcpt.pending')}</p>
    <div class="meta">
      <span>${tr('rcpt.order_ref')}: <b>${esc(orderRef)}</b></span>
      ${when ? `<span>${tr('rcpt.date')}: <b>${esc(when)}</b></span>` : ''}
    </div>
    <table>
      ${items.map((i) => `<tr><td>${esc(i.name)} × ${i.qty}</td><td>${money(i.amount)}</td></tr>`).join('')}
      <tr class="total"><td>${tr('rcpt.total')}</td><td>${money(session.amount_total || 0)}</td></tr>
    </table>
    ${details.email ? `<p class="note">${tr('rcpt.receipt_to')}: <b>${esc(details.email)}</b></p>` : ''}
    ${shipBlock}
    <div class="acts">
      <button class="btn btn-p" onclick="window.print()">${tr('rcpt.print')}</button>
      ${back ? `<a class="btn btn-g" href="${esc(`${back}?paid=1`)}">${tr('rcpt.back')}</a>` : ''}
      <a class="btn btn-g" href="/store/orders?s=${esc(publicId)}">${tr('rcpt.my_orders')}</a>
    </div>
  </div>`;

    return page(shell(`${tr('rcpt.title')} · ${r.businessName}`, body));
  } catch (e) {
    console.error('store receipt error:', e);
    return plain('Not found');
  }
}
