// Recipient-facing website-transfer acceptance: the gated accept page, the
// execute-on-accept, and decline. The recipient must be signed in AS the
// recipient email and meet the site's requirements (their plan, not the
// sender's). Accepting flips ownership. See db/site-transfer.js + api/transfer.js.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getBillingAccount, countPublishedSites } from '../../db/billing.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { PUBLISH_LIMITS } from '../../utils/credits.js';
import { PLUGINS } from '../../plugins/manifest.js';
import { audit } from '../../utils/audit.js';
import { priceIdFor, createBundleCheckoutSession, isStripeConfigured, getSubscription, addSubscriptionItem } from '../../utils/stripe.js';
import { upsertAccountPlugin } from '../../db/account-plugins.js';
import { unmetRequirements, isMet } from '../api/transfer.js';
import { getTransferByToken, setTransferStatus, executeTransfer, countManagedPublishedSites } from '../../db/site-transfer.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const keyOf = (t) => (t.ai_project_id != null ? { aiProjectId: t.ai_project_id } : { projectId: t.project_id });

function shell(inner, origin) {
  return htmlResponse(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Accept a website — Caddisfly', description: 'Accept a website transfer.', origin, path: '/transfer/accept' })}<meta name="robots" content="noindex">
  <style>${baseCss()}
    main{min-height:60vh}.twrap{max-width:560px;margin:0 auto;padding:3rem 1.5rem}
    .tcard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.8rem}
    .tcard h1{font-size:1.4rem;color:var(--ink);margin:0 0 .6rem}.sub{color:var(--body);line-height:1.6}
    .req{list-style:none;padding:0;margin:1.2rem 0}
    .req li{padding:.6rem 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:.6rem;font-size:.92rem}
    .ok{color:#15803d;font-weight:800}.miss{color:#b91c1c;font-weight:700;text-decoration:none}
    .btn-full{width:100%;justify-content:center;margin-top:.6rem}.muted{color:var(--muted);font-size:.84rem}
  </style></head><body>${siteHeader('/', {})}<main><div class="twrap"><div class="tcard">${inner}</div></div></main>${siteFooter({ lang: 'en' })}</body></html>`);
}

async function siteInfo(env, projectKey) {
  if (projectKey.aiProjectId != null) {
    const p = await env.DB.prepare(`SELECT project_name AS name, status FROM ai_projects WHERE id = ?`).bind(projectKey.aiProjectId).first();
    return p ? { name: p.name || 'Website', published: p.status === 'deployed' } : null;
  }
  const p = await env.DB.prepare(`SELECT website_url AS name, status FROM projects WHERE id = ?`).bind(projectKey.projectId).first();
  return p ? { name: p.name || 'Website', published: p.status === 'deployed' } : null;
}

/** GET /transfer/accept/:token */
export async function handleTransferAcceptPage(ctx) {
  const { env, params, url } = ctx;
  const origin = url.origin;
  const t = await getTransferByToken(env.DB, params.token);
  const now = Math.floor(Date.now() / 1000);
  if (!t || t.status !== 'pending' || t.expires_at <= now) {
    return shell(`<h1>This transfer link isn't valid</h1><p class="sub">It may have been accepted, cancelled, or expired. Ask the sender to start a new transfer.</p>
      <p style="margin-top:1.2rem"><a class="btn btn-ghost" href="/dashboard">Go to dashboard</a></p>`, origin);
  }
  const site = await siteInfo(env, keyOf(t));
  const reqs = (() => { try { return JSON.parse(t.requirements_json || '{}'); } catch { return {}; } })();
  const next = `/transfer/accept/${params.token}`;

  if (!ctx.billingEmail) {
    return shell(`<h1>Accept "${esc(site ? site.name : 'this website')}"</h1>
      <p class="sub"><strong>${esc(t.from_email)}</strong> wants to transfer this website to <strong>${esc(t.to_email)}</strong>. Sign in to that email to continue.</p>
      <form method="POST" action="/api/billing/login" style="margin-top:1.2rem">
        <input type="hidden" name="email" value="${esc(t.to_email)}"><input type="hidden" name="next" value="${esc(next)}">
        <button class="btn btn-primary btn-full" type="submit">Email me a sign-in link</button>
      </form><p class="muted" style="margin-top:.8rem">A one-time link goes to ${esc(t.to_email)}.</p>`, origin);
  }
  if (String(ctx.billingEmail).toLowerCase() !== String(t.to_email).toLowerCase()) {
    return shell(`<h1>Wrong account</h1>
      <p class="sub">This transfer is for <strong>${esc(t.to_email)}</strong>, but you're signed in as <strong>${esc(ctx.billingEmail)}</strong>.</p>
      <p style="margin-top:1.2rem"><a class="btn btn-ghost" href="/billing/logout">Sign out</a>, then open the link from your email again.</p>`, origin);
  }

  const missing = await unmetRequirements(env, ctx.billingEmail, reqs);
  const met = isMet(missing);
  const subscribed = url.searchParams.get('subscribed') === '1';
  const reqRow = (label, ok) => `<li><span>${esc(label)}</span><span class="${ok ? 'ok' : 'miss'}">${ok ? '✓' : '• needed'}</span></li>`;
  let rows = '';
  if (reqs.base || reqs.domain) {
    const tierLabel = reqs.domain ? 'Starter+ (this site has a custom domain)' : 'Starter or higher';
    rows += reqRow('Paid plan — ' + tierLabel, !missing.base && !missing.domain);
  }
  for (const pk of reqs.plugins || []) rows += reqRow(`${(PLUGINS[pk] || {}).label || pk} plugin`, !missing.plugins.includes(pk));

  let roomNote = '';
  if (site && site.published) {
    const tier = await getUserTier(env.DB, ctx.billingEmail);
    const limit = PUBLISH_LIMITS[tier];
    if (limit !== Infinity) {
      const used = (await countPublishedSites(env.DB, ctx.billingEmail)) + (await countManagedPublishedSites(env.DB, ctx.billingEmail));
      if (used >= limit) roomNote = `<p class="miss" style="margin:.4rem 0">You're at your published-site limit (${used}/${limit}). Free a slot or upgrade before accepting.</p>`;
    }
  }

  let action;
  if (!met) {
    // ONE checkout for everything the recipient is missing (plan + plugins).
    action = `<form method="POST" action="/transfer/accept/${esc(params.token)}/subscribe">
        <button class="btn btn-primary btn-full" type="submit">Subscribe &amp; continue</button></form>
      <p class="muted" style="margin-top:.6rem">${subscribed
        ? 'Finishing your subscription… give it a few seconds and refresh this page.'
        : 'One checkout covers everything above. After you pay, you\'ll land back here to finish the transfer.'}</p>`;
  } else if (roomNote) {
    action = `<button class="btn btn-primary btn-full" disabled style="opacity:.5;cursor:not-allowed">Accept transfer</button>`;
  } else {
    action = `<form method="POST" action="/transfer/accept/${esc(params.token)}"><button class="btn btn-primary btn-full" type="submit">Accept transfer</button></form>`;
  }
  return shell(`<h1>Accept "${esc(site ? site.name : 'website')}"</h1>
    <p class="sub"><strong>${esc(t.from_email)}</strong> is transferring this website to you. Once you accept it's yours — billed and gated by <strong>your</strong> plan${t.keep_builder_access ? `, and ${esc(t.from_email)} keeps Builder access` : ''}.</p>
    <ul class="req">${rows || '<li><span>No special requirements</span><span class="ok">✓</span></li>'}</ul>
    ${roomNote}${action}
    <form method="POST" action="/transfer/decline/${esc(params.token)}" style="margin-top:.4rem"><button class="btn btn-ghost btn-full" type="submit">Decline</button></form>`, origin);
}

/** POST /transfer/accept/:token — execute the ownership move. */
export async function handleTransferAcceptExecute(ctx) {
  const { env, params } = ctx;
  const t = await getTransferByToken(env.DB, params.token);
  const now = Math.floor(Date.now() / 1000);
  if (!t || t.status !== 'pending' || t.expires_at <= now) return redirect('/dashboard?transfer=invalid', 303);
  if (!ctx.billingEmail || String(ctx.billingEmail).toLowerCase() !== String(t.to_email).toLowerCase()) return redirect(`/transfer/accept/${params.token}`, 303);
  const projectKey = keyOf(t);
  const reqs = (() => { try { return JSON.parse(t.requirements_json || '{}'); } catch { return {}; } })();
  const missing = await unmetRequirements(env, ctx.billingEmail, reqs);
  if (!isMet(missing)) return redirect(`/transfer/accept/${params.token}?err=requirements`, 303);
  const site = await siteInfo(env, projectKey);
  if (site && site.published) {
    const tier = await getUserTier(env.DB, ctx.billingEmail);
    const limit = PUBLISH_LIMITS[tier];
    if (limit !== Infinity) {
      const used = (await countPublishedSites(env.DB, ctx.billingEmail)) + (await countManagedPublishedSites(env.DB, ctx.billingEmail));
      if (used >= limit) return redirect(`/transfer/accept/${params.token}?err=limit`, 303);
    }
  }
  const acct = await getBillingAccount(env.DB, ctx.billingEmail);
  await executeTransfer(env.DB, projectKey, {
    fromEmail: t.from_email, toEmail: t.to_email, keepBuilder: !!t.keep_builder_access,
    recipientStripeCustomerId: acct && acct.stripe_customer_id,
  });
  await setTransferStatus(env.DB, t.id, 'accepted');
  audit(ctx, 'site.transfer.accept', { resourceType: 'project', resourceName: site ? site.name : '', metadata: { from: t.from_email, keep_builder: !!t.keep_builder_access } });
  return redirect('/dashboard?transfer=accepted', 303);
}

/** POST /transfer/accept/:token/subscribe — one checkout for ALL the requirements
 *  the recipient is missing (base plan + plugins), then back to the accept page. */
export async function handleTransferSubscribe(ctx) {
  const { env, params, url } = ctx;
  const t = await getTransferByToken(env.DB, params.token);
  const now = Math.floor(Date.now() / 1000);
  if (!t || t.status !== 'pending' || t.expires_at <= now) return redirect('/dashboard', 303);
  if (!ctx.billingEmail || String(ctx.billingEmail).toLowerCase() !== String(t.to_email).toLowerCase()) return redirect(`/transfer/accept/${params.token}`, 303);
  if (!isStripeConfigured(env)) return redirect(`/transfer/accept/${params.token}?err=billing`, 303);

  const reqs = (() => { try { return JSON.parse(t.requirements_json || '{}'); } catch { return {}; } })();
  const missing = await unmetRequirements(env, ctx.billingEmail, reqs);
  const pluginPrices = missing.plugins.map((pk) => env[(PLUGINS[pk] || {}).priceVar]).filter(Boolean);
  const acct = await getBillingAccount(env.DB, ctx.billingEmail);
  const backUrl = `${url.origin}/transfer/accept/${params.token}`;

  // No base plan → ONE combined checkout (Starter + every missing plugin).
  if (missing.base) {
    const planPrice = priceIdFor(env, 'starter', 'mo');
    if (!planPrice) return redirect(`${backUrl}?err=billing`, 303);
    const session = await createBundleCheckoutSession(env, {
      email: ctx.billingEmail, priceIds: [planPrice, ...pluginPrices],
      successUrl: `${backUrl}?subscribed=1`, cancelUrl: backUrl,
      customerId: acct && acct.stripe_customer_id,
    });
    return redirect(session.url, 303);
  }
  // Has a base plan but missing plugins → add them to the existing subscription.
  if (acct && acct.stripe_subscription_id && pluginPrices.length) {
    try {
      const sub = await getSubscription(env, acct.stripe_subscription_id);
      for (const pk of missing.plugins) {
        const price = env[(PLUGINS[pk] || {}).priceVar]; if (!price) continue;
        const existing = ((sub.items && sub.items.data) || []).find((it) => it.price && it.price.id === price);
        const item = existing || await addSubscriptionItem(env, acct.stripe_subscription_id, price);
        await upsertAccountPlugin(env.DB, { email: ctx.billingEmail, pluginKey: pk, status: 'active', stripeItemId: item.id, currentPeriodEnd: acct.current_period_end });
      }
    } catch (e) { return redirect(`${backUrl}?err=plugins`, 303); }
    return redirect(`${backUrl}?subscribed=1`, 303);
  }
  return redirect(backUrl, 303);
}

/** POST /transfer/decline/:token */
export async function handleTransferDecline(ctx) {
  const { env, params } = ctx;
  const t = await getTransferByToken(env.DB, params.token);
  if (t && t.status === 'pending') await setTransferStatus(env.DB, t.id, 'declined');
  return redirect('/dashboard?transfer=declined', 303);
}
