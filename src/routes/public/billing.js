// Billing area (magic-link auth). GET /billing renders either a passwordless
// sign-in form or the account dashboard (plan, status, upgrade/manage). The
// magic-link round-trip is handled by /billing/verify/:token.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { audit } from '../../utils/audit.js';
import { setCookie, clearCookie } from '../../utils/crypto.js';
import {
  getBillingAccount,
  consumeMagicLink,
  createBillingSession,
  deleteBillingSession,
  BILLING_COOKIE,
} from '../../db/billing.js';
import { isStripeConfigured, CREDIT_PACKS } from '../../utils/stripe.js';
import { getCreditState } from '../../utils/credits.js';
import { accountLimitStatus } from '../../utils/account-limits.js';
import { overLimitBannerHtml, LIMIT_BANNER_CSS } from '../../components/limit-banner.js';
import { translator } from '../../i18n/index.js';

const NEXT_COOKIE = 'cf_billing_next';

/**
 * Is `val` a safe same-origin post-login destination? Restricts to known path
 * prefixes (no open redirect: rejects absolute URLs and protocol-relative //).
 * @param {string} val
 * @returns {boolean}
 */
function isSafeNext(val) {
  return typeof val === 'string' && !val.startsWith('//') && /^\/(billing|dashboard|ai-builder\/|transfer\/)/.test(val);
}

const TIERS = {
  free_trial: { name: 'Free', blurb: 'caddisfly.app subdomain · 1 site · 50 AI credits/mo' },
  starter: { name: 'Starter', mo: 9, yr: 90 },
  pro: { name: 'Pro', mo: 19, yr: 190 },
  agency: { name: 'Agency', mo: 49, yr: 490 },
};
const UPGRADE_PLANS = ['starter', 'pro', 'agency'];

function fmtDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function pageShell(origin, inner, headerOpts = {}, tr = (k) => k) {
  const lang = headerOpts.lang || 'en';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('bill.meta_title'), description: 'Manage your Caddisfly plan and billing.', origin, path: '/billing' })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .bwrap{max-width:760px;margin:0 auto;padding:3rem 1.5rem}
    .bwrap h1{font-size:clamp(1.8rem,4vw,2.4rem);font-weight:900;color:var(--ink);letter-spacing:-.02em;margin-bottom:.4rem}
    .sub{color:var(--body);margin-bottom:2rem}
    .panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.6rem;margin-bottom:1.2rem}
    .panel h2{font-size:1.1rem;color:var(--ink);margin-bottom:.8rem}
    .row{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.5rem 0;border-bottom:1px solid var(--line)}
    .row:last-child{border-bottom:none}
    .row .k{color:var(--muted);font-size:.9rem}
    .row .v{color:var(--ink);font-weight:700}
    .pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.15rem .7rem;font-size:.8rem;font-weight:700;color:var(--p2)}
    label{display:block;font-weight:700;color:var(--ink);margin-bottom:.4rem;font-size:.92rem}
    input[type=email]{width:100%;padding:.8rem 1rem;border:1.5px solid var(--line);border-radius:11px;font-family:inherit;font-size:1rem;margin-bottom:1rem}
    input[type=email]:focus{outline:none;border-color:var(--p1)}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem}
    .pcard{border:1px solid var(--line);border-radius:14px;padding:1.1rem;text-align:center}
    .pcard h3{font-size:1.05rem;color:var(--ink);margin-bottom:.2rem}
    .pcard .pr{color:var(--muted);font-size:.85rem;margin-bottom:.8rem}
    .pcard form{margin:.35rem 0}
    .pcard .btn{width:100%;justify-content:center;font-size:.85rem;padding:.55rem}
    .notice{border-radius:12px;padding:.9rem 1.1rem;margin-bottom:1.2rem;font-size:.92rem}
    .notice.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
    .notice.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e}
    .notice.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    .muted-link{color:var(--muted);font-size:.88rem}
    .cont{background:linear-gradient(135deg,#eef2ff,#faf5ff);border:1px solid #e0e7ff;border-radius:14px;padding:1.2rem;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .credits-hero{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;background:var(--grad);color:#fff;border-radius:18px;padding:1.6rem 1.7rem;margin-bottom:1.2rem;box-shadow:0 12px 32px rgba(118,75,162,.22)}
    .credits-hero .ch-label{font-weight:800;font-size:.95rem;opacity:.92;letter-spacing:.01em}
    .credits-hero .ch-bal{font-size:2.7rem;font-weight:900;line-height:1.05;letter-spacing:-1px}
    .credits-hero .ch-bal small{font-size:1rem;font-weight:700;opacity:.85;margin-left:.35rem}
    .credits-hero .ch-sub{font-size:.85rem;opacity:.9;margin-top:.25rem}
    .credits-hero .btn{background:#fff;color:var(--p2)}
    .credits-disclaimer{font-size:.82rem;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.55rem .8rem;margin-bottom:1rem}
    @media (max-width:620px){.grid{grid-template-columns:1fr}}
    ${LIMIT_BANNER_CSS}
  </style>
</head>
<body>
  ${siteHeader('/pricing', headerOpts)}
  <main><div class="bwrap">${inner}</div></main>
  ${siteFooter({ lang })}
</body>
</html>`;
}

function noticeFor(query, tr) {
  switch (query.checkout) {
    case 'success': return `<div class="notice ok">${tr('bill.n_checkout_ok')}</div>`;
    case 'cancelled': return `<div class="notice warn">${tr('bill.n_checkout_cancel')}</div>`;
  }
  switch (query.credits) {
    case 'success': return `<div class="notice ok">${tr('bill.n_credits_ok')}</div>`;
    case 'cancelled': return `<div class="notice warn">${tr('bill.n_credits_cancel')}</div>`;
  }
  if (query.sent) return `<div class="notice ok">${tr('bill.n_sent')}</div>`;
  if (query.error) return `<div class="notice err">${escapeHtml(query.error)}</div>`;
  if (query.expired) return `<div class="notice warn">${tr('bill.n_expired')}</div>`;
  return '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function signInView(query, tr) {
  const plan = query.plan && UPGRADE_PLANS.includes(query.plan) ? query.plan : '';
  const interval = query.interval === 'yr' ? 'yr' : 'mo';
  const next = plan
    ? `/billing?plan=${plan}&interval=${interval}`
    : isSafeNext(query.next) ? query.next : '/billing';
  const intent = plan
    ? `<p class="sub">${tr('bill.intent_plan', { plan: `<strong>${TIERS[plan].name}</strong>` })}</p>`
    : `<p class="sub">${tr('bill.intent_default')}</p>`;
  return `
    <h1>${tr('bill.manage_billing')}</h1>
    ${intent}
    ${noticeFor(query, tr)}
    <div class="panel">
      <form method="POST" action="/api/billing/login">
        <label for="email">${tr('bill.email_label')}</label>
        <input id="email" name="email" type="email" required placeholder="you@example.com" autocomplete="email">
        <input type="hidden" name="next" value="${escapeHtml(next)}">
        <button class="btn btn-primary" type="submit">${tr('bill.email_btn')}</button>
      </form>
    </div>
    <p class="muted-link">${tr('bill.same_email')}</p>`;
}

function dashboardView(email, account, creditState, query, env, tr, limitStatus = null) {
  const tierKey = (account && account.pricing_tier) || 'free_trial';
  const tier = TIERS[tierKey] || TIERS.free_trial;
  const status = (account && account.subscription_status) || (tierKey === 'free_trial' ? 'free' : '—');
  const isPaid = tierKey !== 'free_trial';
  const configured = isStripeConfigured(env);
  const selected = query.plan && UPGRADE_PLANS.includes(query.plan) ? query.plan : '';
  const selInterval = query.interval === 'yr' ? 'yr' : 'mo';

  const periodRow =
    account && account.current_period_end
      ? `<div class="row"><span class="k">${account.cancel_at_period_end ? tr('bill.cancels_on') : tr('bill.renews_on')}</span><span class="v">${fmtDate(account.current_period_end)}</span></div>`
      : '';

  let notConfigured = configured
    ? ''
    : `<div class="notice warn">${tr('bill.not_configured')}</div>`;

  // "Continue to checkout" if arriving from a pricing CTA for a plan they're not already on
  let continueBlock = '';
  if (configured && selected && selected !== tierKey) {
    const t = TIERS[selected];
    const price = selInterval === 'yr' ? `$${t.yr}/yr` : `$${t.mo}/mo`;
    continueBlock = `
      <div class="cont">
        <div><strong>${t.name}</strong> — ${price} ${selInterval === 'yr' ? tr('bill.two_months_free') : ''}</div>
        <form method="POST" action="/api/billing/checkout">
          <input type="hidden" name="plan" value="${selected}">
          <input type="hidden" name="interval" value="${selInterval}">
          <button class="btn btn-primary" type="submit">${tr('bill.continue_checkout')}</button>
        </form>
      </div>`;
  }

  let actions = '';
  if (configured && isPaid) {
    actions = `
      <div class="panel">
        <h2>${tr('bill.manage_sub')}</h2>
        <p class="sub" style="margin-bottom:1rem">${tr('bill.manage_sub_sub')}</p>
        <form method="POST" action="/api/billing/portal">
          <button class="btn btn-ghost" type="submit">${tr('bill.open_portal')}</button>
        </form>
      </div>`;
  } else if (configured && !isPaid) {
    const card = (key) => {
      const t = TIERS[key];
      return `
        <div class="pcard">
          <h3>${t.name}</h3>
          <div class="pr">$${t.mo}/mo · $${t.yr}/yr</div>
          <form method="POST" action="/api/billing/checkout">
            <input type="hidden" name="plan" value="${key}"><input type="hidden" name="interval" value="mo">
            <button class="btn btn-primary" type="submit">${tr('bill.monthly')}</button>
          </form>
          <form method="POST" action="/api/billing/checkout">
            <input type="hidden" name="plan" value="${key}"><input type="hidden" name="interval" value="yr">
            <button class="btn btn-ghost" type="submit">${tr('bill.annual')}</button>
          </form>
        </div>`;
    };
    actions = `
      <div class="panel">
        <h2>${tr('bill.upgrade')}</h2>
        <p class="sub" style="margin-bottom:1rem">${tr('bill.upgrade_sub')}</p>
        <div class="grid">${UPGRADE_PLANS.map(card).join('')}</div>
      </div>`;
  }

  // One-time AI credit top-ups (purchased credits never expire). Rendered at the
  // BOTTOM of the page — plans lead, since most visits are to upgrade.
  let creditsHero = '';
  let creditsBlock = '';
  if (configured) {
    const cs = creditState || { totalRemaining: 0, monthlyRemaining: 0, allotment: 0, purchased: 0, resetAt: null };
    const resetTxt = cs.resetAt ? tr('bill.monthly_resets', { date: fmtDate(cs.resetAt) }) : '';
    creditsHero = `
      <div class="credits-hero">
        <div>
          <div class="ch-label">${tr('bill.credits_label')}</div>
          <div class="ch-bal">${cs.totalRemaining.toLocaleString()}<small>${tr('bill.available')}</small></div>
          <div class="ch-sub">${tr('bill.credits_breakdown', { m: cs.monthlyRemaining.toLocaleString(), a: cs.allotment.toLocaleString(), p: cs.purchased.toLocaleString() })}${resetTxt}</div>
        </div>
        <a class="btn" href="#buy-credits">${tr('bill.buy_more')}</a>
      </div>`;
    const packCard = (p) => `
      <div class="pcard">
        <h3>$${p.usd}</h3>
        <div class="pr">${tr('bill.credits_unit', { n: p.credits.toLocaleString() })}</div>
        <form method="POST" action="/api/billing/credits/checkout">
          <input type="hidden" name="pack" value="${p.usd}">
          <button class="btn btn-ghost" type="submit">${tr('bill.buy')}</button>
        </form>
      </div>`;
    creditsBlock = `
      <div class="panel" id="buy-credits">
        <h2>${tr('bill.buy_credits')}</h2>
        <p class="sub" style="margin-bottom:.5rem">${tr('bill.buy_credits_sub')}</p>
        <p class="credits-disclaimer">${tr('bill.credits_disclaimer')}</p>
        <div class="grid">${CREDIT_PACKS.map(packCard).join('')}</div>
      </div>`;
  }

  // Order: plan (current + upgrade/manage) leads — most users arrive here to
  // upgrade — and the credit balance + top-ups sit at the bottom.
  return `
    <h1>${tr('bill.your_billing')}</h1>
    <p class="sub">${tr('dash.signed_in_as')} <strong>${escapeHtml(email)}</strong> · <a class="muted-link" href="/dashboard">${tr('bill.your_sites_team')}</a> · <a class="muted-link" href="/billing/logout">${tr('bill.sign_out')}</a></p>
    ${noticeFor(query, tr)}
    ${overLimitBannerHtml(limitStatus, tr)}
    ${notConfigured}
    ${continueBlock}
    <div class="panel">
      <h2>${tr('bill.current_plan')}</h2>
      <div class="row"><span class="k">${tr('bill.k_plan')}</span><span class="v"><span class="pill">${tier.name}</span></span></div>
      <div class="row"><span class="k">${tr('bill.k_status')}</span><span class="v">${escapeHtml(status)}</span></div>
      ${account && account.plan_interval ? `<div class="row"><span class="k">${tr('bill.k_billing')}</span><span class="v">${account.plan_interval === 'year' ? tr('bill.annual') : tr('bill.monthly')}</span></div>` : ''}
      ${periodRow}
    </div>
    ${actions}
    ${creditsHero}
    ${creditsBlock}`;
}

/** GET /billing */
export async function handleBilling(ctx) {
  const { env, query, url } = ctx;
  const origin = url.origin;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  if (!ctx.billingEmail) {
    return htmlResponse(pageShell(origin, signInView(query || {}, tr), { lang }, tr));
  }
  const configured = isStripeConfigured(env);
  // getCreditState ensures the account row + rolls the monthly window first.
  const creditState = configured ? await getCreditState(env.DB, ctx.billingEmail) : null;
  const account = await getBillingAccount(env.DB, ctx.billingEmail);
  const limitStatus = creditState ? await accountLimitStatus(env.DB, ctx.billingEmail, creditState.tier).catch(() => null) : null;
  const headerOpts = creditState ? { credits: creditState.totalRemaining, lang } : { lang };
  return htmlResponse(pageShell(origin, dashboardView(ctx.billingEmail, account, creditState, query || {}, env, tr, limitStatus), headerOpts, tr));
}

/** GET /billing/verify/:token — consume magic link, set session cookie. */
export async function handleBillingVerify(ctx) {
  const { env, params, request, url } = ctx;
  const email = await consumeMagicLink(env.DB, params.token);
  if (!email) {
    return redirect('/billing?expired=1', 303);
  }
  const session = await createBillingSession(env.DB, email);
  audit({ ...ctx, billingEmail: email }, 'auth.login', { teamOwner: email, resourceType: 'account', resourceId: email });

  // Honor a stored post-login destination (set at login), else /billing.
  let dest = '/billing';
  const cookies = (request.headers.get('Cookie') || '').split(';').map((c) => c.trim());
  const nextCookie = cookies.find((c) => c.startsWith(`${NEXT_COOKIE}=`));
  if (nextCookie) {
    const val = decodeURIComponent(nextCookie.slice(NEXT_COOKIE.length + 1));
    if (isSafeNext(val)) dest = val;
  }

  let res = redirect(dest, 303);
  res = setCookie(res, BILLING_COOKIE, session.token, {
    maxAge: session.maxAge,
    secure: env.ENVIRONMENT === 'production',
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
  });
  res = clearCookie(res, NEXT_COOKIE, { path: '/' });
  return res;
}

/** GET /billing/logout */
export async function handleBillingLogout(ctx) {
  const { env, request } = ctx;
  const cookies = (request.headers.get('Cookie') || '').split(';').map((c) => c.trim());
  const tok = cookies.find((c) => c.startsWith(`${BILLING_COOKIE}=`));
  if (tok) await deleteBillingSession(env.DB, tok.slice(BILLING_COOKIE.length + 1));
  let res = redirect('/billing', 303);
  res = clearCookie(res, BILLING_COOKIE, { path: '/' });
  return res;
}

export { NEXT_COOKIE, isSafeNext };
