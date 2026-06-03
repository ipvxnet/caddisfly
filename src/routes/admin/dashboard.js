// SaaS admin dashboard — platform-owner view of all customers, subscriptions,
// and site status. Gated by [authMiddleware, adminMiddleware] (role 'admin' AND
// the ADMIN_EMAILS allowlist). Read-only aggregates from src/db/admin-stats.js.

import { htmlResponse } from '../../utils/response.js';
import { getPlatformMetrics, getCustomerRows } from '../../db/admin-stats.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts * 1000).toISOString().slice(0, 10); } catch { return '—'; }
}
function tierBadge(t) {
  const tier = t || 'free_trial';
  return `<span class="badge t-${esc(tier)}">${esc(tier.replace('_', ' '))}</span>`;
}
function statusBadge(s) {
  if (!s) return '<span class="badge">—</span>';
  const ok = s === 'active';
  return `<span class="badge ${ok ? 'ok' : 'warn'}">${esc(s)}</span>`;
}

export async function handleAdminDashboard(ctx) {
  const { env, user } = ctx;
  const [m, rows] = await Promise.all([getPlatformMetrics(env.DB), getCustomerRows(env.DB)]);

  const card = (label, value, sub = '') =>
    `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${esc(label)}</div>${sub ? `<div class="stat-s">${esc(sub)}</div>` : ''}</div>`;

  const tierLine = ['free_trial', 'starter', 'pro', 'agency']
    .map((t) => `${t.replace('_', ' ')}: ${m.byTier[t] || 0}`)
    .join(' · ');

  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td class="email">${esc(r.email)}</td>
        <td>${tierBadge(r.pricing_tier)}</td>
        <td>${statusBadge(r.subscription_status)}</td>
        <td>${r.plan_interval ? esc(r.plan_interval === 'year' ? 'annual' : 'monthly') : '—'}</td>
        <td>${fmtDate(r.current_period_end)}</td>
        <td class="num">${r.sites}</td>
        <td class="num">${r.deployed}</td>
        <td class="num">${r.team_size}</td>
        <td class="num">${r.ai_credits_used || 0}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Admin · Caddisfly</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#1a202c}
    .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:1.4rem 2rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}
    .header h1{font-size:1.4rem}
    .header .who{font-size:.85rem;opacity:.9}
    .header a{color:#fff;font-size:.85rem;text-decoration:underline}
    .wrap{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1rem}
    .stat{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.2rem}
    .stat-v{font-size:1.9rem;font-weight:800;color:#5a3da8}
    .stat-l{color:#4a5568;font-size:.85rem;font-weight:600;margin-top:.2rem}
    .stat-s{color:#a0aec0;font-size:.75rem;margin-top:.2rem}
    .tierline{color:#718096;font-size:.85rem;margin:.2rem 0 1.4rem}
    .panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.2rem 1.4rem}
    .panel h2{font-size:1.05rem;margin-bottom:.8rem}
    table{width:100%;border-collapse:collapse;font-size:.85rem}
    th,td{text-align:left;padding:.6rem .5rem;border-bottom:1px solid #edf2f7}
    th{color:#718096;font-weight:700;font-size:.74rem;text-transform:uppercase;letter-spacing:.04em}
    td.num{text-align:right;font-variant-numeric:tabular-nums}
    td.email{font-weight:600;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .badge{display:inline-block;border-radius:999px;padding:.1rem .55rem;font-size:.72rem;font-weight:700;background:#edf2f7;color:#4a5568}
    .badge.ok{background:#ecfdf5;color:#065f46}
    .badge.warn{background:#fffbeb;color:#92400e}
    .badge.t-pro{background:#eef2ff;color:#3730a3}
    .badge.t-agency{background:#faf5ff;color:#6b21a8}
    .badge.t-starter{background:#f0fdfa;color:#115e59}
    .muted{color:#a0aec0}
  </style>
</head>
<body>
  <div class="header">
    <h1>Caddisfly Admin</h1>
    <div><span class="who">${esc(user.email)}</span> · <a href="/logout">Sign out</a></div>
  </div>
  <div class="wrap">
    <div class="stats">
      ${card('Customers', m.customers)}
      ${card('Active subscriptions', m.activeSubs)}
      ${card('Sites', m.totalSites, `${m.deployedSites} deployed`)}
      ${card('Custom domains', m.activeDomains, 'active')}
      ${card('Pageviews (30d)', m.views30d)}
    </div>
    <div class="tierline">By tier — ${esc(tierLine)}</div>

    <div class="panel">
      <h2>Customers (${rows.length})</h2>
      ${rows.length
        ? `<table>
            <thead><tr>
              <th>Email</th><th>Tier</th><th>Status</th><th>Interval</th><th>Renews</th>
              <th class="num">Sites</th><th class="num">Deployed</th><th class="num">Team</th><th class="num">Credits used</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>`
        : '<p class="muted">No customers yet.</p>'}
    </div>
  </div>
</body>
</html>`;

  return htmlResponse(html);
}
