// Shared admin top-nav — one consistent bar across every /admin page so all
// sections (incl. Showcase) are reachable from anywhere. Each admin page adds
// ADMIN_NAV_CSS to its <style> and renders renderAdminNav(ctx, activePath).

import { countOpenTickets } from '../../db/tickets.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const LINKS = [
  { path: '/admin', label: 'Dashboard' },
  { path: '/admin/tickets', label: '🎫 Tickets' },
  { path: '/admin/revenue', label: '💳 Revenue' },
  { path: '/admin/audit', label: '🧾 Audit' },
  { path: '/admin/legal', label: '📄 Legal' },
  { path: '/admin/showcase', label: '📣 Showcase' },
  { path: '/admin/leads', label: '📇 Leads' },
];

/** Build the nav bar. opts: { email, openTickets, extra } (extra = page-specific HTML in the right slot). */
export function adminNav(active = '', opts = {}) {
  const ot = opts.openTickets;
  const links = LINKS.map((l) => {
    const on = l.path === active ? ' on' : '';
    const badge = l.path === '/admin/tickets' && ot ? ` <span class="anav-badge">${ot}</span>` : '';
    return `<a href="${l.path}" class="anav-link${on}">${l.label}${badge}</a>`;
  }).join('');
  return `<header class="anav">
    <a href="/admin" class="anav-brand">⚙ Admin</a>
    <nav class="anav-links">${links}</nav>
    <div class="anav-right">${opts.extra || ''}${opts.email ? `<span class="anav-who">${esc(opts.email)}</span>` : ''}<a href="/logout" class="anav-out">Sign out</a></div>
  </header>`;
}

/** Render the nav for a request context (fetches the open-ticket count once). */
export async function renderAdminNav(ctx, active = '', extra = '') {
  let openTickets = 0;
  try { openTickets = await countOpenTickets(ctx.env.DB); } catch { /* non-fatal */ }
  return adminNav(active, { email: ctx.user && ctx.user.email, openTickets, extra });
}

export const ADMIN_NAV_CSS = `
  .anav{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;background:#fff;border-bottom:1px solid #e2e8f0;padding:.6rem 1.4rem;box-shadow:0 1px 3px rgba(0,0,0,.04)}
  .anav-brand{font-weight:800;color:#5a3da8;text-decoration:none;font-size:1rem;white-space:nowrap}
  .anav-links{display:flex;gap:.25rem;flex-wrap:wrap;flex:1}
  .anav-link{font-size:.84rem;font-weight:700;color:#4a5568;text-decoration:none;padding:.35rem .7rem;border-radius:8px;white-space:nowrap}
  .anav-link:hover{background:#f1f5f9}
  .anav-link.on{background:#eef2ff;color:#3730a3}
  .anav-badge{display:inline-block;background:#fef2f2;color:#b91c1c;border-radius:999px;padding:0 .4rem;font-size:.72rem;font-weight:800}
  .anav-right{display:flex;align-items:center;gap:.7rem;font-size:.82rem;flex-wrap:wrap}
  .anav-who{color:#a0aec0;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .anav-out{color:#5a3da8;text-decoration:none;font-weight:700;white-space:nowrap}
  .anav-extra{color:#5a3da8;text-decoration:none;font-weight:700;white-space:nowrap}
`;
