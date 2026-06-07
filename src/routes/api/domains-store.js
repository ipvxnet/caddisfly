// Domain reselling (Namecheap) — search, buy, register, auto-connect.
//
//   GET  /api/domains/search?q=          (billingAuth) availability + retail quotes
//   POST /api/domains/checkout           (billingAuth) ICANN contact + Stripe session
//   GET  /domains/receipt?o&sid          (billingAuth) post-payment status page;
//                                        kicks registration off the response path
//   processDomainOrder                   shared with the Stripe-webhook backstop
//
// Payment happens FIRST; registration after. The paid→registering transition
// is claimed atomically (claimOrderForRegistration) so the receipt page and
// webhook can't double-register. Registration failure after payment is NEVER
// swallowed: auto-refund + ops alert + visible status.

import { jsonResponse, htmlResponse } from '../../utils/response.js';
import {
  isNamecheapConfigured, checkDomains, getWholesalePricing, registerDomain, setDnsHosts, getDomainInfo, SELL_TLDS,
} from '../../utils/namecheap.js';
import {
  createDomainOrder, getOrderById, getOrdersByEmail, updateOrder, claimOrderForRegistration,
  getCachedPrices, upsertPrice,
} from '../../db/domain-orders.js';
import { createDomainCheckoutSession, getPlatformCheckoutSession, refundPaymentIntent } from '../../utils/stripe.js';
import { getBillingAccount } from '../../db/billing.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { createDomain, getDomainByHostname } from '../../db/custom-domains.js';
import { isSaaSConfigured, createCustomHostname, cnameTarget } from '../../utils/cloudflare-saas.js';
import { notifyOps } from '../../utils/ops-notify.js';
import { sendDomainRegisteredEmail, isValidEmail } from '../../utils/email.js';
import { t, translator } from '../../i18n/index.js';

// Retail = wholesale + flat markup (cents). Floor guards against a bad cache.
const MARKUP_CENTS = 500;
const MIN_PRICE_CENTS = 300;
const PRICE_TTL_SEC = 24 * 3600;
const SLD_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
// Namecheap phone format: +<cc>.<number>
const PHONE_RE = /^\+\d{1,3}\.\d{4,14}$/;
const SEARCH_TLDS = ['com', 'net', 'org', 'co', 'io', 'shop', 'online', 'xyz'];

function retail(wholesaleCents) {
  return Math.max(wholesaleCents + MARKUP_CENTS, wholesaleCents + 100, MIN_PRICE_CENTS);
}

/** Cached wholesale prices as {tld → row}, refreshing at most daily. */
async function pricesByTld(env) {
  let rows = await getCachedPrices(env.DB);
  const now = Math.floor(Date.now() / 1000);
  const stale = !rows.length || rows.some((r) => now - r.updated_at > PRICE_TTL_SEC);
  if (stale) {
    try {
      const fresh = await getWholesalePricing(env);
      for (const [tld, p] of Object.entries(fresh)) {
        if (p.register_cents && p.renew_cents) await upsertPrice(env.DB, tld, p.register_cents, p.renew_cents);
      }
      rows = await getCachedPrices(env.DB);
    } catch (e) {
      console.error('domain pricing refresh failed:', e.message);
      // keep serving the stale cache if we have one
    }
  }
  return new Map(rows.map((r) => [r.tld, r]));
}

/** Normalize a search query → { sld, tld|null } or null. */
function parseQuery(q) {
  let s = (q || '').toString().trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].replace(/[^a-z0-9.-]/g, '');
  if (!s) return null;
  const parts = s.split('.').filter(Boolean);
  const sld = parts[0];
  if (!SLD_RE.test(sld)) return null;
  const tld = parts.length > 1 ? parts.slice(1).join('.') : null;
  return { sld, tld: tld && SELL_TLDS.includes(tld) ? tld : null };
}

/** GET /api/domains/search?q= */
export async function handleDomainSearch(ctx) {
  const { env, query } = ctx;
  try {
    if (!isNamecheapConfigured(env)) return jsonResponse({ success: false, error: 'Domain purchases are not available yet.' }, 503);
    const parsed = parseQuery(query && query.q);
    if (!parsed) return jsonResponse({ success: false, error: t(ctx.lang, 'domstore.bad_query') }, 400);

    // Candidates: the exact ask first, then the spread across popular TLDs.
    const tlds = [...new Set([parsed.tld, ...SEARCH_TLDS])].filter(Boolean).slice(0, 8);
    const candidates = tlds.map((tld) => `${parsed.sld}.${tld}`);

    const [checks, prices] = await Promise.all([checkDomains(env, candidates), pricesByTld(env)]);
    const byDomain = new Map(checks.map((c) => [c.domain, c]));

    const results = candidates.map((domain) => {
      const tld = domain.slice(domain.indexOf('.') + 1);
      const check = byDomain.get(domain) || { available: false, premium: false };
      const price = prices.get(tld);
      return {
        domain,
        tld,
        // premium names have special pricing we don't handle in v1
        available: !!(check.available && !check.premium && price),
        premium: !!check.premium,
        price_cents: price ? retail(price.register_cents) : null,
        renew_cents: price ? retail(price.renew_cents) : null,
        currency: 'usd',
      };
    });
    return jsonResponse({ success: true, results });
  } catch (e) {
    console.error('domain search error:', e.message);
    return jsonResponse({ success: false, error: 'Search failed — please try again.' }, 502);
  }
}

function validContact(c) {
  if (!c || typeof c !== 'object') return null;
  const s = (v, n) => (v || '').toString().trim().slice(0, n);
  const contact = {
    first_name: s(c.first_name, 60),
    last_name: s(c.last_name, 60),
    address1: s(c.address1, 120),
    city: s(c.city, 60),
    state: s(c.state, 60),
    postal_code: s(c.postal_code, 20),
    country: s(c.country, 2).toUpperCase(),
    phone: s(c.phone, 20),
    email: s(c.email, 320),
  };
  if (!contact.first_name || !contact.last_name || !contact.address1 || !contact.city || !contact.postal_code) return null;
  if (!/^[A-Z]{2}$/.test(contact.country)) return null;
  if (!PHONE_RE.test(contact.phone)) return null;
  if (!isValidEmail(contact.email)) return null;
  return contact;
}

/** POST /api/domains/checkout — body { domain, contact, site? } */
export async function handleDomainCheckout(ctx) {
  const { env, request, url } = ctx;
  const email = ctx.billingEmail;
  if (!email) return jsonResponse({ success: false, error: 'Sign in to buy a domain.' }, 401);
  try {
    if (!isNamecheapConfigured(env)) return jsonResponse({ success: false, error: 'Domain purchases are not available yet.' }, 503);

    const body = await request.json().catch(() => ({}));
    const domain = (body.domain || '').toString().trim().toLowerCase();
    const parsed = parseQuery(domain);
    if (!parsed || !parsed.tld || domain !== `${parsed.sld}.${parsed.tld}`) {
      return jsonResponse({ success: false, error: t(ctx.lang, 'domstore.bad_query') }, 400);
    }

    const contact = validContact(body.contact);
    if (!contact) return jsonResponse({ success: false, error: t(ctx.lang, 'domstore.bad_contact') }, 400);

    // Optional site binding for auto-connect — must be the buyer's own site.
    let bind = { ai_project_id: null, project_id: null };
    if (body.site) {
      const ai = await getAIProjectByProjectId(env.DB, body.site);
      const rp = ai ? null : await getProjectByPreviewId(env.DB, body.site);
      const owner = (ai || rp || {}).customer_email;
      if (owner && owner.toLowerCase() === email.toLowerCase()) {
        bind = { ai_project_id: ai ? ai.id : null, project_id: rp ? rp.id : null };
      }
    }

    // Live availability + server-side price (never from the client).
    const [check] = await checkDomains(env, [domain]);
    if (!check || !check.available || check.premium) {
      return jsonResponse({ success: false, error: t(ctx.lang, 'domstore.taken') }, 409);
    }
    const prices = await pricesByTld(env);
    const price = prices.get(parsed.tld);
    if (!price) return jsonResponse({ success: false, error: t(ctx.lang, 'domstore.taken') }, 409);
    const amount = retail(price.register_cents);

    const order = await createDomainOrder(env.DB, {
      customer_email: email,
      ...bind,
      domain,
      years: 1,
      wholesale_cents: price.register_cents,
      price_cents: amount,
      currency: 'usd',
      registrant_json: JSON.stringify(contact),
    });

    const acct = await getBillingAccount(env.DB, email);
    const session = await createDomainCheckoutSession(env, {
      email,
      customerId: acct && acct.stripe_customer_id ? acct.stripe_customer_id : null,
      name: `Domain ${domain} — 1 year (auto-renews)`,
      amountCents: amount,
      currency: 'usd',
      successUrl: `${url.origin}/domains/receipt?o=${order.id}&sid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${url.origin}/domains?cancelled=1`,
      metadata: { type: 'domain_order', order_id: String(order.id), domain },
    });
    await updateOrder(env.DB, order.id, { stripe_session_id: session.id });

    return jsonResponse({ success: true, url: session.url });
  } catch (e) {
    console.error('domain checkout error:', e.message);
    return jsonResponse({ success: false, error: e.message.slice(0, 300) }, 502);
  }
}

/**
 * Register + auto-connect a PAID order. Idempotent: exactly one caller wins
 * the claim; the loser sees a non-pending status and exits. Failure after
 * payment = auto-refund + ops alert.
 */
export async function processDomainOrder(env, orderId, paymentIntentId = null) {
  const order = await getOrderById(env.DB, orderId);
  if (!order) return;
  if (!(await claimOrderForRegistration(env.DB, order.id))) return; // someone else has it

  try {
    const contact = JSON.parse(order.registrant_json || '{}');
    let reg;
    try {
      reg = await registerDomain(env, { domain: order.domain, years: order.years || 1, contact });
    } catch (e) {
      // domains.create is NON-IDEMPOTENT: a relay/network timeout doesn't mean
      // it failed — Namecheap may have completed it. Verify before deciding;
      // getDomainInfo only succeeds for domains in OUR account.
      console.error('register threw, verifying ownership:', order.domain, e.message);
      try {
        const info = await getDomainInfo(env, order.domain);
        if (info && info.status) {
          reg = { registered: true, domain_id: null, transaction_id: null, _recovered: true };
          await notifyOps(env, `ℹ️ Domain *${order.domain}*: register call errored (${e.message.slice(0, 80)}) but it IS in our account — treating as registered.`);
        } else {
          throw e;
        }
      } catch (_) {
        throw e; // genuinely not registered → fail + refund below
      }
    }
    await updateOrder(env.DB, order.id, {
      status: 'registered',
      nc_domain_id: reg.domain_id || null,
      nc_transaction_id: reg.transaction_id || null,
      registered_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + (order.years || 1) * 365 * 86400,
      error: null,
    });

    // Auto-connect: point DNS at the SaaS edge…
    const target = cnameTarget(env) || 'sites.caddisfly.app';
    try {
      await setDnsHosts(env, order.domain, [
        { name: 'www', type: 'CNAME', address: `${target}.` },
        { name: '@', type: 'URL301', address: `https://www.${order.domain}` },
      ]);
    } catch (e) {
      console.error('domain DNS setup failed (non-fatal):', e.message);
      await notifyOps(env, `⚠️ Domain *${order.domain}* registered but DNS setup FAILED: ${e.message}`);
    }

    // …and create the custom hostname on the bound site (existing machinery
    // takes it from pending → active and writes the R2 pointer).
    if ((order.ai_project_id || order.project_id) && isSaaSConfigured(env)) {
      try {
        const hostname = `www.${order.domain}`;
        if (!(await getDomainByHostname(env.DB, hostname))) {
          const projectKey = order.ai_project_id ? { aiProjectId: order.ai_project_id } : { projectId: order.project_id };
          const proj = order.ai_project_id
            ? await env.DB.prepare('SELECT subdomain FROM ai_projects WHERE id = ?').bind(order.ai_project_id).first()
            : await env.DB.prepare('SELECT subdomain FROM projects WHERE id = ?').bind(order.project_id).first();
          if (proj && proj.subdomain) {
            const cf = await createCustomHostname(env, hostname);
            await createDomain(env.DB, projectKey, {
              hostname,
              subdomain: proj.subdomain,
              status: 'pending',
              cf_hostname_id: cf ? cf.cf_hostname_id : null,
              ssl_status: cf ? cf.ssl_status : null,
              cname_target: cf ? cf.cname_target : target,
              dcv_type: cf ? cf.dcv_type : null,
              dcv_name: cf ? cf.dcv_name : null,
              dcv_value: cf ? cf.dcv_value : null,
            });
          }
        }
      } catch (e) {
        console.error('domain auto-connect failed (non-fatal):', e.message);
        await notifyOps(env, `⚠️ Domain *${order.domain}* registered but auto-connect FAILED: ${e.message}`);
      }
    }

    await notifyOps(env, `💰 *Domain sold*: ${order.domain} → ${order.customer_email} ($${(order.price_cents / 100).toFixed(2)}, wholesale $${(order.wholesale_cents / 100).toFixed(2)})`);
    await sendDomainRegisteredEmail(env, {
      to: order.customer_email,
      domain: order.domain,
      autoConnected: !!(order.ai_project_id || order.project_id),
    }).catch((e) => console.error('domain email failed:', e.message));
  } catch (e) {
    console.error('domain registration FAILED:', order.domain, e.message);
    await updateOrder(env.DB, order.id, { status: 'failed', error: e.message.slice(0, 500) });
    let refunded = false;
    if (paymentIntentId) {
      try {
        await refundPaymentIntent(env, paymentIntentId);
        await updateOrder(env.DB, order.id, { status: 'refunded' });
        refunded = true;
      } catch (re) {
        console.error('domain refund failed:', re.message);
      }
    }
    await notifyOps(env, `🚨 *Domain registration FAILED*: ${order.domain} for ${order.customer_email} — ${e.message.slice(0, 200)}\nRefund: ${refunded ? 'issued automatically' : 'NEEDS MANUAL REFUND'} (order #${order.id})`);
  }
}

/** GET /domains/receipt?o&sid — post-payment status page (auto-refreshes). */
export async function handleDomainReceipt(ctx) {
  const { env, query, url } = ctx;
  const email = ctx.billingEmail;
  const lang = ctx.lang || 'en';
  const tr = translator(lang);
  if (!email) return Response.redirect(`${url.origin}/billing?next=${encodeURIComponent(url.pathname + url.search)}`, 302);

  const order = await getOrderById(env.DB, parseInt(query.o, 10) || 0);
  if (!order || order.customer_email.toLowerCase() !== email.toLowerCase() || order.stripe_session_id !== (query.sid || '')) {
    return htmlResponse(receiptShell(tr('domstore.r_notfound'), `<p>${tr('domstore.r_notfound')}</p>`), 404);
  }

  // First arrivals: confirm payment with Stripe, then register off-path.
  if (order.status === 'pending' || order.status === 'paid') {
    try {
      const session = await getPlatformCheckoutSession(env, order.stripe_session_id);
      if (session.payment_status === 'paid') {
        if (session.customer) await updateOrder(env.DB, order.id, { stripe_customer_id: session.customer });
        if (ctx.ctx && ctx.ctx.waitUntil) {
          ctx.ctx.waitUntil(processDomainOrder(env, order.id, session.payment_intent || null));
        } else {
          await processDomainOrder(env, order.id, session.payment_intent || null);
        }
      }
    } catch (e) {
      console.error('domain receipt session check failed:', e.message);
    }
  }

  const fresh = await getOrderById(env.DB, order.id);
  const st = fresh.status;
  const working = st === 'pending' || st === 'paid' || st === 'registering';
  const body = working
    ? `<div class="spin"></div><h1>${tr('domstore.r_working')}</h1><p>${tr('domstore.r_working_sub', { domain: fresh.domain })}</p>`
    : st === 'registered'
      ? `<div class="ok">✓</div><h1>${tr('domstore.r_done')}</h1>
         <p>${tr('domstore.r_done_sub', { domain: fresh.domain })}</p>
         <p>${tr('domstore.r_connect_note')}</p>
         <p style="margin-top:1.4rem"><a class="btn" href="/dashboard">${tr('domstore.r_dashboard')}</a></p>`
      : `<div class="bad">✕</div><h1>${tr('domstore.r_failed')}</h1>
         <p>${st === 'refunded' ? tr('domstore.r_refunded') : tr('domstore.r_failed_sub')}</p>
         <p><a class="btn" href="/support">${tr('domstore.r_support')}</a></p>`;

  return htmlResponse(receiptShell(tr('domstore.r_title'), body, working));
}

function receiptShell(title, inner, refresh = false) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${refresh ? '<meta http-equiv="refresh" content="4">' : ''}
  <title>${title}</title>
  <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem}
  .card{background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.08);padding:2.6rem;max-width:480px;text-align:center}
  h1{font-size:1.4rem;color:#1a202c;margin:.8rem 0 .6rem}p{color:#4a5568;line-height:1.6;margin:.4rem 0}
  .ok,.bad{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.7rem;margin:0 auto;color:#fff}
  .ok{background:#10b981}.bad{background:#ef4444}
  .spin{width:44px;height:44px;border:4px solid #e2e8f0;border-top-color:#667eea;border-radius:50%;margin:0 auto;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}
  .btn{display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:.7rem 1.6rem;border-radius:10px;font-weight:700}</style>
  </head><body><div class="card">${inner}</div></body></html>`;
}

/** GET /api/domains/orders — the signed-in user's domain orders. */
export async function handleDomainOrders(ctx) {
  const { env } = ctx;
  if (!ctx.billingEmail) return jsonResponse({ success: false, error: 'Sign in first.' }, 401);
  const orders = await getOrdersByEmail(env.DB, ctx.billingEmail);
  return jsonResponse({
    success: true,
    orders: orders.map((o) => ({
      id: o.id, domain: o.domain, status: o.status, price_cents: o.price_cents,
      auto_renew: !!o.auto_renew, registered_at: o.registered_at, expires_at: o.expires_at,
    })),
  });
}
