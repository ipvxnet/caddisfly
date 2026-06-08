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
  isNamecheapConfigured, checkDomains, getWholesalePricing, registerDomain, setDnsHosts, getDnsHosts, getDomainInfo, SELL_TLDS,
} from '../../utils/namecheap.js';
import {
  createDomainOrder, getOrderById, getOrdersByEmail, updateOrder, claimOrderForRegistration,
  getCachedPrices, upsertPrice,
} from '../../db/domain-orders.js';
import { createDomainCheckoutSession, getPlatformCheckoutSession, refundPaymentIntent } from '../../utils/stripe.js';
import { getBillingAccount } from '../../db/billing.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { createDomain, getDomainByHostname, updateDomain } from '../../db/custom-domains.js';
import { isSaaSConfigured, createCustomHostname, createWorkerRoute, getCustomHostname, isActive, cnameTarget } from '../../utils/cloudflare-saas.js';
import { uploadToR2 } from '../../utils/r2-storage.js';
import { isValidCountry } from '../../utils/countries.js';
import { notifyOps } from '../../utils/ops-notify.js';
import { audit } from '../../utils/audit.js';
import { insertAuditLog } from '../../db/audit-logs.js';
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
  if (!isValidCountry(contact.country)) return null;
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
 * Auto-connect a registered domain: point DNS at the SaaS edge (www CNAME +
 * root 301) and, when bound to a site, create the custom hostname so the
 * existing activation machinery issues SSL. Best-effort + re-runnable (used by
 * processDomainOrder and the manual /reconnect endpoint). Returns
 * { dns, hostname } booleans.
 */
export async function autoConnectDomain(env, order) {
  const target = cnameTarget(env) || 'sites.caddisfly.app';
  const result = { dns: false, hostname: false };

  try {
    await setDnsHosts(env, order.domain, [
      { name: 'www', type: 'CNAME', address: `${target}.` },
      { name: '@', type: 'URL301', address: `https://www.${order.domain}` },
    ]);
    result.dns = true;
  } catch (e) {
    console.error('domain DNS setup failed (non-fatal):', e.message);
    await notifyOps(env, `⚠️ Domain *${order.domain}*: DNS setup FAILED: ${e.message}`);
  }

  if ((order.ai_project_id || order.project_id) && isSaaSConfigured(env)) {
    try {
      const hostname = `www.${order.domain}`;
      const projectKey = order.ai_project_id ? { aiProjectId: order.ai_project_id } : { projectId: order.project_id };
      const proj = order.ai_project_id
        ? await env.DB.prepare('SELECT subdomain FROM ai_projects WHERE id = ?').bind(order.ai_project_id).first()
        : await env.DB.prepare('SELECT subdomain FROM projects WHERE id = ?').bind(order.project_id).first();

      if (proj && proj.subdomain) {
        let rec = await getDomainByHostname(env.DB, hostname);
        if (!rec) {
          const cf = await createCustomHostname(env, hostname);
          rec = await createDomain(env.DB, projectKey, {
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
        // The pointer (host → subdomain) is what the sites worker resolves —
        // write it now so the site serves the instant SSL goes active. (The
        // generic flow only writes it on activation, which nobody polls here.)
        await uploadToR2(env.STORAGE, `domains/${hostname}`, proj.subdomain, 'text/plain');
        // Ensure the Worker route exists (heals domains created before the
        // route step, and any best-effort failure at create time).
        try { await createWorkerRoute(env, hostname); } catch (e) { console.error('worker route ensure failed:', e.message); }
        // Best-effort: advance our SSL status if CF has already validated.
        if (rec && rec.cf_hostname_id) {
          try {
            const state = await getCustomHostname(env, rec.cf_hostname_id);
            if (state) {
              await updateDomain(env.DB, rec.id, {
                status: isActive(state) ? 'active' : 'pending',
                ssl_status: state.ssl_status,
              });
            }
          } catch (_) { /* status poll is best-effort */ }
        }
        result.hostname = true;
      }
    } catch (e) {
      console.error('domain auto-connect failed (non-fatal):', e.message);
      await notifyOps(env, `⚠️ Domain *${order.domain}*: auto-connect FAILED: ${e.message}`);
    }
  }
  return result;
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

    await autoConnectDomain(env, order); // best-effort; alerts on failure

    await notifyOps(env, `💰 *Domain sold*: ${order.domain} → ${order.customer_email} ($${(order.price_cents / 100).toFixed(2)}, wholesale $${(order.wholesale_cents / 100).toFixed(2)})`);
    // processDomainOrder runs off-path (waitUntil) without a request ctx — log directly.
    await insertAuditLog(env.DB, { user_email: order.customer_email, team_owner_email: order.customer_email, action: 'domain.purchase', resource_type: 'domain', resource_id: order.domain, resource_name: order.domain, status: 'success', metadata: JSON.stringify({ price_cents: order.price_cents }) }).catch(() => {});
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

/** POST /api/domains/:id/auto-renew — toggle a registered domain's auto-renew.
 *  Body { auto_renew: bool }. Owner-scoped. Our renewal job reads this flag. */
export async function handleDomainAutoRenew(ctx) {
  const { env, request, params } = ctx;
  if (!ctx.billingEmail) return jsonResponse({ success: false, error: 'Sign in first.' }, 401);
  const order = await getOrderById(env.DB, parseInt(params.id, 10) || 0);
  if (!order || order.customer_email.toLowerCase() !== ctx.billingEmail.toLowerCase()) {
    return jsonResponse({ success: false, error: 'Domain not found.' }, 404);
  }
  if (order.status !== 'registered') {
    return jsonResponse({ success: false, error: 'Only registered domains can change auto-renew.' }, 409);
  }
  const body = await request.json().catch(() => ({}));
  const on = body.auto_renew ? 1 : 0;
  await updateOrder(env.DB, order.id, { auto_renew: on });
  audit(ctx, 'domain.auto_renew', { teamOwner: order.customer_email, resourceType: 'domain', resourceId: order.domain, resourceName: order.domain, metadata: { auto_renew: !!on } });
  return jsonResponse({ success: true, auto_renew: !!on });
}

// ---- DNS records manager (Caddisfly-purchased domains) -------------------
// setHosts is all-or-nothing, so editing is read-modify-write: the client
// sends its editable records, the server re-injects the LOCKED records that
// keep the site connected (www CNAME + root redirect) and writes the full set.

const DNS_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'URL', 'URL301', 'FRAME']);
const HOSTNAME_RE = /^(@|\*|[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?(\.[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?)*)$/;

/** The records WE manage so the customer's site stays reachable. */
function lockedRecords(domain) {
  const target = 'sites.caddisfly.app';
  return [
    { name: 'www', type: 'CNAME', address: `${target}.`, ttl: '1800', mxpref: '10', locked: true },
    { name: '@', type: 'URL301', address: `https://www.${domain}`, ttl: '1800', mxpref: '10', locked: true },
  ];
}
const isLockedRow = (r) => (r.name === 'www' && r.type === 'CNAME') || (r.name === '@' && (r.type === 'URL301' || r.type === 'URL' || r.type === 'FRAME'));

/** Resolve + own-check a registered domain order. → order | Response(error). */
async function ownDomainOrder(ctx, requireRegistered = true) {
  const { env, params } = ctx;
  if (!ctx.billingEmail) return jsonResponse({ success: false, error: 'Sign in first.' }, 401);
  const order = await getOrderById(env.DB, parseInt(params.id, 10) || 0);
  if (!order || order.customer_email.toLowerCase() !== ctx.billingEmail.toLowerCase()) {
    return jsonResponse({ success: false, error: 'Domain not found.' }, 404);
  }
  if (requireRegistered && order.status !== 'registered') {
    return jsonResponse({ success: false, error: 'This domain isn’t registered yet.' }, 409);
  }
  return order;
}

/** Is the domain currently connected to a site? (www custom hostname exists).
 *  The site-connection records are only "locked" while a connection exists —
 *  once disconnected, the customer can freely edit/delete them. */
async function isConnected(db, domain) {
  return !!(await getDomainByHostname(db, `www.${domain}`).catch(() => null));
}

/** GET /api/domains/:id/dns — current records (locked ones flagged). */
export async function handleDnsList(ctx) {
  const { env } = ctx;
  const order = await ownDomainOrder(ctx);
  if (order instanceof Response) return order;
  try {
    const connected = await isConnected(env.DB, order.domain);
    const hosts = await getDnsHosts(env, order.domain);
    const records = hosts.map((h) => ({ ...h, locked: connected && isLockedRow(h) }));
    return jsonResponse({ success: true, domain: order.domain, connected, records });
  } catch (e) {
    console.error('dns list error:', e.message);
    return jsonResponse({ success: false, error: 'Could not load DNS records — try again.' }, 502);
  }
}

/** Validate + normalize one editable record. → record | null */
function cleanRecord(r) {
  if (!r || typeof r !== 'object') return null;
  const type = String(r.type || '').toUpperCase().trim();
  if (!DNS_TYPES.has(type)) return null;
  let name = String(r.name || '@').trim() || '@';
  if (!HOSTNAME_RE.test(name)) return null;
  const address = String(r.address || '').trim();
  if (!address || address.length > 2048) return null;
  const ttl = String(parseInt(r.ttl, 10) || 1800);
  const out = { name, type, address, ttl, mxpref: '10' };
  if (type === 'MX') {
    const p = parseInt(r.mxpref, 10);
    out.mxpref = String(Number.isFinite(p) && p >= 0 ? p : 10);
  }
  return out;
}

/** PUT /api/domains/:id/dns — replace the editable records; we always re-add
 *  the locked site records so the customer can't disconnect themselves. */
export async function handleDnsSave(ctx) {
  const { env, request } = ctx;
  const order = await ownDomainOrder(ctx);
  if (order instanceof Response) return order;
  try {
    const connected = await isConnected(env.DB, order.domain);
    const body = await request.json().catch(() => ({}));
    const raw = Array.isArray(body.records) ? body.records.slice(0, 100) : [];
    const editable = [];
    for (const r of raw) {
      const c = cleanRecord(r);
      if (!c) return jsonResponse({ success: false, error: t(ctx.lang, 'domstore.dns_bad') }, 400);
      // While CONNECTED, drop client copies of the locked site records (we
      // re-add them so the site can't be disconnected by editing DNS). While
      // DISCONNECTED, there's nothing to protect — keep exactly what's sent.
      if (connected && isLockedRow(c)) continue;
      editable.push(c);
    }
    const full = connected
      ? [...lockedRecords(order.domain).map(({ locked, ...h }) => h), ...editable]
      : editable;
    await setDnsHosts(env, order.domain, full);
    audit(ctx, 'domain.dns_edit', { teamOwner: order.customer_email, resourceType: 'domain', resourceId: order.domain, resourceName: order.domain, metadata: { records: editable.length } });
    return jsonResponse({ success: true });
  } catch (e) {
    console.error('dns save error:', e.message);
    return jsonResponse({ success: false, error: e.message.slice(0, 200) }, 502);
  }
}

// Email presets — MX + SPF (+ DMARC skeleton). DKIM is provider-generated, so
// the customer adds that TXT themselves from the editor afterwards.
const EMAIL_PRESETS = {
  google: { mx: [['smtp.google.com', 1]], spf: 'v=spf1 include:_spf.google.com ~all' },
  microsoft: (domain) => ({ mx: [[`${domain.replace(/\./g, '-')}.mail.protection.outlook.com`, 0]], spf: 'v=spf1 include:spf.protection.outlook.com -all' }),
  zoho: { mx: [['mx.zoho.com', 10], ['mx2.zoho.com', 20]], spf: 'v=spf1 include:zoho.com ~all' },
};

const HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+\.?$/;

/** Build the added records for a CUSTOM email setup from the request body.
 *  Body: { mx:[{host,priority}], spf?, dmarc?, dkim?:{name,value} }. */
function customEmailRecords(body) {
  const added = [];
  const mx = Array.isArray(body.mx) ? body.mx.slice(0, 5) : [];
  for (const m of mx) {
    const host = String((m && m.host) || '').trim().replace(/\.$/, '');
    if (!host || !HOST_RE.test(host)) continue;
    const pref = parseInt(m && m.priority, 10);
    added.push({ name: '@', type: 'MX', address: host, mxpref: String(Number.isFinite(pref) && pref >= 0 ? pref : 10), ttl: '1800' });
  }
  if (!added.length) return null; // at least one valid MX required
  const spf = String(body.spf || '').trim();
  if (spf) added.push({ name: '@', type: 'TXT', address: spf.slice(0, 512), ttl: '1800', mxpref: '10' });
  const dmarc = String(body.dmarc || '').trim();
  if (dmarc) added.push({ name: '_dmarc', type: 'TXT', address: dmarc.slice(0, 512), ttl: '1800', mxpref: '10' });
  const dkimName = String((body.dkim && body.dkim.name) || '').trim().replace(/\.$/, '');
  const dkimVal = String((body.dkim && body.dkim.value) || '').trim();
  if (dkimName && dkimVal && /^[a-zA-Z0-9._-]+$/.test(dkimName)) {
    added.push({ name: dkimName, type: 'TXT', address: dkimVal.slice(0, 2048), ttl: '1800', mxpref: '10' });
  }
  return added;
}

/** POST /api/domains/:id/dns/email — merge an email provider's records into
 *  the current set (replaces existing MX + the records being re-set). Body:
 *  { provider } for a preset, or { provider:'custom', mx, spf, dmarc, dkim }. */
export async function handleDnsEmailSetup(ctx) {
  const { env, request } = ctx;
  const order = await ownDomainOrder(ctx);
  if (order instanceof Response) return order;
  try {
    const body = await request.json().catch(() => ({}));
    const key = String(body.provider || '').toLowerCase();

    let added;
    if (key === 'custom') {
      added = customEmailRecords(body);
      if (!added) return jsonResponse({ success: false, error: t(ctx.lang, 'domstore.email_need_mx') }, 400);
    } else {
      const presetDef = EMAIL_PRESETS[key];
      if (!presetDef) return jsonResponse({ success: false, error: 'Unknown email provider.' }, 400);
      const preset = typeof presetDef === 'function' ? presetDef(order.domain) : presetDef;
      added = [
        ...preset.mx.map(([host, pref]) => ({ name: '@', type: 'MX', address: host, mxpref: String(pref), ttl: '1800' })),
        { name: '@', type: 'TXT', address: preset.spf, ttl: '1800', mxpref: '10' },
      ];
    }

    const connected = await isConnected(env.DB, order.domain);
    const current = (await getDnsHosts(env, order.domain)).filter((h) => !(connected && isLockedRow(h)));
    // Strip existing MX + any TXT we're re-setting (match by host name), keep the rest.
    const addedTxtNames = new Set(added.filter((a) => a.type === 'TXT').map((a) => a.name));
    const addedRootSpf = added.some((a) => a.type === 'TXT' && a.name === '@' && /^v=spf1/i.test(a.address));
    const kept = current.filter((h) => {
      if (h.type === 'MX') return false;
      if (h.type === 'TXT' && addedTxtNames.has(h.name)) {
        // Only drop the root TXT if we're replacing the SPF specifically.
        if (h.name === '@') return !(addedRootSpf && /^v=spf1/i.test(h.address));
        return false;
      }
      return true;
    });
    const base = connected ? lockedRecords(order.domain).map(({ locked, ...h }) => h) : [];
    await setDnsHosts(env, order.domain, [...base, ...kept, ...added]);
    audit(ctx, 'domain.dns_edit', { teamOwner: order.customer_email, resourceType: 'domain', resourceId: order.domain, resourceName: order.domain, metadata: { email_provider: key } });
    return jsonResponse({ success: true });
  } catch (e) {
    console.error('dns email setup error:', e.message);
    return jsonResponse({ success: false, error: e.message.slice(0, 200) }, 502);
  }
}

/** POST /api/domains/:id/reconnect — re-run auto-connect (DNS + custom
 *  hostname) for a registered domain whose first attempt flaked. Owner-scoped. */
export async function handleDomainReconnect(ctx) {
  const { env, params } = ctx;
  if (!ctx.billingEmail) return jsonResponse({ success: false, error: 'Sign in first.' }, 401);
  const order = await getOrderById(env.DB, parseInt(params.id, 10) || 0);
  if (!order || order.customer_email.toLowerCase() !== ctx.billingEmail.toLowerCase()) {
    return jsonResponse({ success: false, error: 'Domain not found.' }, 404);
  }
  if (order.status !== 'registered') {
    return jsonResponse({ success: false, error: 'This domain isn’t registered yet.' }, 409);
  }
  const r = await autoConnectDomain(env, order);
  return jsonResponse({ success: r.dns, dns: r.dns, hostname: r.hostname });
}
