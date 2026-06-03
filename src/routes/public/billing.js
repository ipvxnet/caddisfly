// Billing area (magic-link auth). GET /billing renders either a passwordless
// sign-in form or the account dashboard (plan, status, upgrade/manage). The
// magic-link round-trip is handled by /billing/verify/:token.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
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

const NEXT_COOKIE = 'cf_billing_next';

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

function pageShell(origin, inner, headerOpts = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Billing — Caddisfly', description: 'Manage your Caddisfly plan and billing.', origin })}
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
    @media (max-width:620px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  ${siteHeader('/pricing', headerOpts)}
  <main><div class="bwrap">${inner}</div></main>
  ${siteFooter()}
</body>
</html>`;
}

function noticeFor(query) {
  switch (query.checkout) {
    case 'success':
      return `<div class="notice ok">✓ Subscription active — thank you! It may take a few seconds to reflect below.</div>`;
    case 'cancelled':
      return `<div class="notice warn">Checkout cancelled. No charge was made.</div>`;
  }
  switch (query.credits) {
    case 'success':
      return `<div class="notice ok">✓ Credits purchased — thank you! Your balance updates below in a few seconds.</div>`;
    case 'cancelled':
      return `<div class="notice warn">Credit purchase cancelled. No charge was made.</div>`;
  }
  if (query.sent) return `<div class="notice ok">✓ Check your email for a sign-in link (expires in 15 min).</div>`;
  if (query.error) return `<div class="notice err">${escapeHtml(query.error)}</div>`;
  if (query.expired) return `<div class="notice warn">That sign-in link was invalid or expired. Request a new one below.</div>`;
  return '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function signInView(query) {
  const plan = query.plan && UPGRADE_PLANS.includes(query.plan) ? query.plan : '';
  const interval = query.interval === 'yr' ? 'yr' : 'mo';
  const next = plan ? `/billing?plan=${plan}&interval=${interval}` : '/billing';
  const intent = plan
    ? `<p class="sub">Sign in to continue to <strong>${TIERS[plan].name}</strong> checkout. We'll email you a one-time link — no password.</p>`
    : `<p class="sub">Enter your email and we'll send a one-time sign-in link — no password needed.</p>`;
  return `
    <h1>Manage billing</h1>
    ${intent}
    ${noticeFor(query)}
    <div class="panel">
      <form method="POST" action="/api/billing/login">
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" required placeholder="you@example.com" autocomplete="email">
        <input type="hidden" name="next" value="${escapeHtml(next)}">
        <button class="btn btn-primary" type="submit">Email me a sign-in link</button>
      </form>
    </div>
    <p class="muted-link">Use the same email you used to build your site so your plan applies to it.</p>`;
}

function dashboardView(email, account, creditState, query, env) {
  const tierKey = (account && account.pricing_tier) || 'free_trial';
  const tier = TIERS[tierKey] || TIERS.free_trial;
  const status = (account && account.subscription_status) || (tierKey === 'free_trial' ? 'free' : '—');
  const isPaid = tierKey !== 'free_trial';
  const configured = isStripeConfigured(env);
  const selected = query.plan && UPGRADE_PLANS.includes(query.plan) ? query.plan : '';
  const selInterval = query.interval === 'yr' ? 'yr' : 'mo';

  const periodRow =
    account && account.current_period_end
      ? `<div class="row"><span class="k">${account.cancel_at_period_end ? 'Cancels on' : 'Renews on'}</span><span class="v">${fmtDate(account.current_period_end)}</span></div>`
      : '';

  let notConfigured = configured
    ? ''
    : `<div class="notice warn">Billing isn't enabled in this environment yet. Plan changes are temporarily unavailable.</div>`;

  // "Continue to checkout" if arriving from a pricing CTA for a plan they're not already on
  let continueBlock = '';
  if (configured && selected && selected !== tierKey) {
    const t = TIERS[selected];
    const price = selInterval === 'yr' ? `$${t.yr}/yr` : `$${t.mo}/mo`;
    continueBlock = `
      <div class="cont">
        <div><strong>${t.name}</strong> — ${price} ${selInterval === 'yr' ? '(2 months free)' : ''}</div>
        <form method="POST" action="/api/billing/checkout">
          <input type="hidden" name="plan" value="${selected}">
          <input type="hidden" name="interval" value="${selInterval}">
          <button class="btn btn-primary" type="submit">Continue to checkout →</button>
        </form>
      </div>`;
  }

  let actions = '';
  if (configured && isPaid) {
    actions = `
      <div class="panel">
        <h2>Manage subscription</h2>
        <p class="sub" style="margin-bottom:1rem">Update your card, switch plans, or cancel — in the secure Stripe portal.</p>
        <form method="POST" action="/api/billing/portal">
          <button class="btn btn-ghost" type="submit">Open billing portal →</button>
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
            <button class="btn btn-primary" type="submit">Monthly</button>
          </form>
          <form method="POST" action="/api/billing/checkout">
            <input type="hidden" name="plan" value="${key}"><input type="hidden" name="interval" value="yr">
            <button class="btn btn-ghost" type="submit">Annual</button>
          </form>
        </div>`;
    };
    actions = `
      <div class="panel">
        <h2>Upgrade</h2>
        <p class="sub" style="margin-bottom:1rem">Annual = 2 months free. Cancel anytime.</p>
        <div class="grid">${UPGRADE_PLANS.map(card).join('')}</div>
      </div>`;
  }

  // One-time AI credit top-ups (purchased credits never expire). The balance
  // leads the page (hero) so it's impossible to miss; packs sit right under it.
  let creditsHero = '';
  let creditsBlock = '';
  if (configured) {
    const cs = creditState || { totalRemaining: 0, monthlyRemaining: 0, allotment: 0, purchased: 0, resetAt: null };
    const resetTxt = cs.resetAt ? ` · monthly resets ${fmtDate(cs.resetAt)}` : '';
    creditsHero = `
      <div class="credits-hero">
        <div>
          <div class="ch-label">✨ Caddi Credits</div>
          <div class="ch-bal">${cs.totalRemaining.toLocaleString()}<small>available</small></div>
          <div class="ch-sub">${cs.monthlyRemaining.toLocaleString()} of ${cs.allotment.toLocaleString()} monthly + ${cs.purchased.toLocaleString()} purchased${resetTxt}</div>
        </div>
        <a class="btn" href="#buy-credits">Buy more →</a>
      </div>`;
    const packCard = (p) => `
      <div class="pcard">
        <h3>$${p.usd}</h3>
        <div class="pr">${p.credits.toLocaleString()} credits</div>
        <form method="POST" action="/api/billing/credits/checkout">
          <input type="hidden" name="pack" value="${p.usd}">
          <button class="btn btn-ghost" type="submit">Buy</button>
        </form>
      </div>`;
    creditsBlock = `
      <div class="panel" id="buy-credits">
        <h2>Buy Caddi Credits</h2>
        <p class="sub" style="margin-bottom:1rem">A one-time top-up for when you need more AI mid-build — purchased credits never expire (flat 50 credits / $1).</p>
        <div class="grid">${CREDIT_PACKS.map(packCard).join('')}</div>
      </div>`;
  }

  return `
    <h1>Your billing</h1>
    <p class="sub">Signed in as <strong>${escapeHtml(email)}</strong> · <a class="muted-link" href="/dashboard">← Your websites &amp; team</a> · <a class="muted-link" href="/billing/logout">Sign out</a></p>
    ${noticeFor(query)}
    ${notConfigured}
    ${continueBlock}
    ${creditsHero}
    ${creditsBlock}
    <div class="panel">
      <h2>Current plan</h2>
      <div class="row"><span class="k">Plan</span><span class="v"><span class="pill">${tier.name}</span></span></div>
      <div class="row"><span class="k">Status</span><span class="v">${escapeHtml(status)}</span></div>
      ${account && account.plan_interval ? `<div class="row"><span class="k">Billing</span><span class="v">${account.plan_interval === 'year' ? 'Annual' : 'Monthly'}</span></div>` : ''}
      ${periodRow}
    </div>
    ${actions}`;
}

/** GET /billing */
export async function handleBilling(ctx) {
  const { env, query, url } = ctx;
  const origin = url.origin;
  if (!ctx.billingEmail) {
    return htmlResponse(pageShell(origin, signInView(query || {})));
  }
  const configured = isStripeConfigured(env);
  // getCreditState ensures the account row + rolls the monthly window first.
  const creditState = configured ? await getCreditState(env.DB, ctx.billingEmail) : null;
  const account = await getBillingAccount(env.DB, ctx.billingEmail);
  const headerOpts = creditState ? { credits: creditState.totalRemaining } : {};
  return htmlResponse(pageShell(origin, dashboardView(ctx.billingEmail, account, creditState, query || {}, env), headerOpts));
}

/** GET /billing/verify/:token — consume magic link, set session cookie. */
export async function handleBillingVerify(ctx) {
  const { env, params, request, url } = ctx;
  const email = await consumeMagicLink(env.DB, params.token);
  if (!email) {
    return redirect('/billing?expired=1', 303);
  }
  const session = await createBillingSession(env.DB, email);

  // Honor a stored post-login destination (set at login), else /billing.
  let dest = '/billing';
  const cookies = (request.headers.get('Cookie') || '').split(';').map((c) => c.trim());
  const nextCookie = cookies.find((c) => c.startsWith(`${NEXT_COOKIE}=`));
  if (nextCookie) {
    const val = decodeURIComponent(nextCookie.slice(NEXT_COOKIE.length + 1));
    if (val.startsWith('/billing')) dest = val;
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

export { NEXT_COOKIE };
