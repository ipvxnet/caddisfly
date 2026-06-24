// Over-limit (downgrade) banner — shown on the dashboard + billing page when an
// account's owned+managed published sites exceed its current plan cap. Purely
// informational + a path to fix (unpublish or upgrade); the hard block lives in
// the publish gate (deploy.js). See utils/account-limits.js.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Returns the banner HTML, or '' when the account is within its cap. */
export function overLimitBannerHtml(status, tr) {
  if (!status || !status.over) return '';
  const planName = String(status.tier || '').replace('_', ' ');
  return `<div class="limit-banner" role="alert">
    <div class="lb-icon">⚠️</div>
    <div class="lb-body">
      <strong>${tr('limit.over_title', { count: status.count, limit: status.limit, plan: esc(planName) })}</strong>
      <p>${tr('limit.over_body', { overBy: status.overBy })}</p>
    </div>
    <a class="lb-cta" href="/billing">${tr('limit.over_cta')}</a>
  </div>`;
}

export const LIMIT_BANNER_CSS = `
  .limit-banner{display:flex;align-items:center;gap:.9rem;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:.85rem 1.1rem;margin:0 0 1.2rem}
  .limit-banner .lb-icon{font-size:1.3rem;line-height:1}
  .limit-banner .lb-body{flex:1;min-width:0}
  .limit-banner .lb-body strong{display:block;color:#9a3412;font-size:.95rem}
  .limit-banner .lb-body p{margin:.2rem 0 0;color:#b45309;font-size:.85rem;line-height:1.4}
  .limit-banner .lb-cta{flex-shrink:0;background:#ea580c;color:#fff;text-decoration:none;font-weight:700;font-size:.85rem;padding:.5rem .9rem;border-radius:9px;white-space:nowrap}
`;
