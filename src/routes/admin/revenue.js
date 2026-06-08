// SaaS admin revenue panel — read-only money view (subscriptions/MRR, domain
// margin, commerce GMV, credit packs, recent payments). Gated by
// [authMiddleware, adminMiddleware]. Aggregates from D1 (src/db/admin-revenue.js).

import { htmlResponse } from '../../utils/response.js';
import { getRevenueOverview, getRecentPayments, PLAN_USD } from '../../db/admin-revenue.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function usd(cents) {
  return '$' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts * 1000).toISOString().slice(0, 10); } catch { return '—'; }
}
const KIND = { domain: '🌐 Domain', store: '🛍 Store', credit: '✨ Credits' };

export async function handleAdminRevenue(ctx) {
  const { env, user } = ctx;
  const [o, payments] = await Promise.all([getRevenueOverview(env.DB), getRecentPayments(env.DB, 40)]);

  const card = (label, value, sub = '') =>
    `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${esc(label)}</div>${sub ? `<div class="stat-s">${esc(sub)}</div>` : ''}</div>`;

  const status = (o.subscriptions.statusCounts || []).map((s) => `${esc(s.status)}: ${s.n}`).join(' · ') || '—';

  const tierRows = ['starter', 'pro', 'agency'].map((t) => {
    const n = o.subscriptions.tierRollup[t] || 0;
    return `<tr><td>${t}</td><td class="num">${usd(PLAN_USD[t] * 100)}/mo</td><td class="num">${n}</td><td class="num">${usd(n * PLAN_USD[t] * 100)}</td></tr>`;
  }).join('');

  const payRows = payments.map((p) => `
      <tr>
        <td>${fmtDate(p.created_at)}</td>
        <td>${KIND[p.kind] || esc(p.kind)}</td>
        <td class="email">${esc(p.email || '—')}</td>
        <td>${esc(p.detail || '')}</td>
        <td class="num">${usd(p.amount_cents)}</td>
      </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Revenue · Caddisfly Admin</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#1a202c}
    .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:1.4rem 2rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}
    .header h1{font-size:1.4rem}
    .header .who{font-size:.85rem;opacity:.9}
    .header a{color:#fff;font-size:.85rem;text-decoration:underline}
    .wrap{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
    h2.sec{font-size:1.05rem;margin:1.6rem 0 .7rem}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:.5rem}
    .stat{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.2rem}
    .stat-v{font-size:1.8rem;font-weight:800;color:#5a3da8}
    .stat-l{color:#4a5568;font-size:.85rem;font-weight:600;margin-top:.2rem}
    .stat-s{color:#a0aec0;font-size:.75rem;margin-top:.2rem}
    .panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.2rem 1.4rem;margin-bottom:1rem}
    .panel h2{font-size:1.05rem;margin-bottom:.3rem}
    .panel .note{color:#a0aec0;font-size:.78rem;margin-bottom:.8rem}
    table{width:100%;border-collapse:collapse;font-size:.85rem}
    th,td{text-align:left;padding:.55rem .5rem;border-bottom:1px solid #edf2f7}
    th{color:#718096;font-weight:700;font-size:.74rem;text-transform:uppercase;letter-spacing:.04em}
    td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
    td.email{font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .muted{color:#a0aec0}
  </style>
</head>
<body>
  <div class="header">
    <h1>💳 Revenue</h1>
    <div><a href="/admin" style="color:#fff;font-weight:700">← Admin</a> · <a href="https://dashboard.stripe.com" target="_blank" rel="noopener" style="color:#fff;font-weight:700">Stripe ↗</a> · <span class="who">${esc(user.email)}</span> · <a href="/logout">Sign out</a></div>
  </div>
  <div class="wrap">
    <div class="stats">
      ${card('Est. MRR', usd(o.subscriptions.mrrCents), `${o.subscriptions.activePaying} active subs`)}
      ${card('Domain margin (30d)', usd(o.domains.d30.margin), `${usd(o.domains.d30.gross)} gross`)}
      ${card('Credit packs (30d)', usd(o.credits.d30.v), `${o.credits.d30.n} purchases`)}
      ${card('Store GMV (30d)', usd(o.commerce.d30.v), `${o.commerce.merchants} merchants`)}
      ${card('Free-trial accounts', o.subscriptions.freeTrial, `${o.subscriptions.totalAccounts} total`)}
    </div>

    <h2 class="sec">Subscriptions</h2>
    <div class="panel">
      <h2>Active by plan — est. ${usd(o.subscriptions.mrrCents)}/mo</h2>
      <p class="note">Estimate from list prices (annual subs counted at monthly-equivalent). Status: ${esc(status)}${o.subscriptions.canceling ? ` · ${o.subscriptions.canceling} canceling at period end` : ''}.</p>
      <table>
        <thead><tr><th>Plan</th><th class="num">Price</th><th class="num">Active</th><th class="num">MRR</th></tr></thead>
        <tbody>${tierRows}</tbody>
      </table>
    </div>

    <h2 class="sec">Domains &amp; commerce</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Source</th><th class="num">Orders</th><th class="num">Gross / GMV</th><th class="num">Our revenue</th></tr></thead>
        <tbody>
          <tr><td>Domains (all-time)</td><td class="num">${o.domains.all.n}</td><td class="num">${usd(o.domains.all.gross)}</td><td class="num">${usd(o.domains.all.margin)} margin</td></tr>
          <tr><td>Domains (30d)</td><td class="num">${o.domains.d30.n}</td><td class="num">${usd(o.domains.d30.gross)}</td><td class="num">${usd(o.domains.d30.margin)} margin</td></tr>
          <tr><td>Store (all-time)</td><td class="num">${o.commerce.all.n}</td><td class="num">${usd(o.commerce.all.v)}</td><td class="num muted">— (no fee)</td></tr>
          <tr><td>Credit packs (all-time)</td><td class="num">${o.credits.all.n}</td><td class="num">${usd(o.credits.all.v)}</td><td class="num">${usd(o.credits.all.v)}</td></tr>
        </tbody>
      </table>
      <p class="note">Domain “our revenue” = price − wholesale (Namecheap). Store GMV is merchant volume on their connected Stripe — Caddisfly takes no platform fee today.</p>
    </div>

    <h2 class="sec">Recent payments</h2>
    <div class="panel">
      ${payments.length
        ? `<table>
            <thead><tr><th>Date</th><th>Type</th><th>Customer</th><th>Detail</th><th class="num">Amount</th></tr></thead>
            <tbody>${payRows}</tbody>
          </table>
          <p class="note">Domains, store orders, and credit packs (subscription invoices live in Stripe ↗).</p>`
        : '<p class="muted">No payments yet.</p>'}
    </div>
  </div>
</body>
</html>`;

  return htmlResponse(html);
}
