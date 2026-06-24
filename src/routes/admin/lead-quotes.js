// Admin Leads CRM — Quotation & Order Management for outbound-sales prospects.
// Reuses the SAME quotes engine as the customer CRM plugin (src/db/crm-quotes.js)
// with owner = { leadId } instead of a project bridge key, so the two stay in
// sync. Admin-gated ([authMiddleware, adminMiddleware]) in index.js — NOT a plugin.

import { getLead } from '../../db/leads.js';
import { createQuote, listQuotes, getQuote, setQuoteStatus, setOrderStatus, deleteQuote,
  ensureQuoteToken, markQuoteSent, setQuoteIssuer, updateQuoteEmail, updateQuote, addQuoteReview } from '../../db/crm-quotes.js';
import { sendQuoteEmail } from '../../utils/email.js';
import { getQuoteTemplate, applyTemplate, saveQuoteTemplate } from '../../db/quote-templates.js';
import { PLANS } from '../public/pricing.js';
import { PLUGINS, BUNDLES } from '../../plugins/manifest.js';

/** Caddisfly's own sellable catalog (plans + plugins) for the admin quote picker. */
function caddisflyCatalog() {
  const items = [];
  for (const p of PLANS) {
    if (p.mo > 0) items.push({ name: `${p.name} plan — monthly`, price_cents: p.mo * 100 });
    if (p.yr > 0) items.push({ name: `${p.name} plan — annual`, price_cents: p.yr * 100 });
  }
  for (const pl of Object.values(PLUGINS)) items.push({ name: `${pl.label} plugin — monthly`, price_cents: pl.priceCents });
  for (const b of Object.values(BUNDLES)) items.push({ name: `${b.label} — monthly`, price_cents: b.priceCents });
  return items;
}

/** Build + freeze the issuer snapshot for Caddisfly + mint a token. Shared by
 *  Send and Preview so the document is identical either way. */
async function snapshotLeadQuote(env, owner, qid, origin) {
  let issuer = {
    name: 'Caddisfly',
    logo: `${origin}/og.png`,
    contact: ['caddisfly.ai', 'contact@caddisfly.ai'],
    accent: '#5a3da8',
    intro: '',
    thankYou: 'Thank you for considering Caddisfly. We would love to build and host your website.',
    terms: '',
  };
  issuer = applyTemplate(issuer, await getQuoteTemplate(env.DB, { global: true }));
  await setQuoteIssuer(env.DB, owner, qid, issuer);
  return ensureQuoteToken(env.DB, owner, qid);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function money(cents, currency) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'USD').toUpperCase() }).format((cents || 0) / 100); }
  catch { return '$' + ((cents || 0) / 100).toFixed(2); }
}

/** A lead's owner key for the shared quotes engine. */
function leadOwner(params) {
  const id = Number(params.id);
  return Number.isInteger(id) ? { leadId: id } : null;
}

/** GET /api/admin/leads/:id/quotes */
export async function handleLeadQuoteList(ctx) {
  const owner = leadOwner(ctx.params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const quotes = await listQuotes(ctx.env.DB, owner, '');
  return json({ success: true, quotes });
}

/** POST /api/admin/leads/:id/quotes — contact_email defaults to the lead's email */
export async function handleLeadQuoteCreate(ctx) {
  const owner = leadOwner(ctx.params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const lead = await getLead(ctx.env.DB, owner.leadId);
  if (!lead) return json({ success: false, error: 'Lead not found' }, 404);
  const body = await ctx.request.json().catch(() => ({}));
  try {
    const id = await createQuote(ctx.env.DB, owner, {
      email: body.email || lead.email || '', title: body.title, currency: body.currency,
      valid_until: body.valid_until, notes: body.notes, items: body.items,
    });
    return json({ success: true, id }, 201);
  } catch (e) {
    if (e.message === 'items_required') return json({ success: false, error: 'At least one line item is required.' }, 400);
    throw e;
  }
}

/** GET /api/admin/leads/:id/quotes/:quote_id */
export async function handleLeadQuoteGet(ctx) {
  const owner = leadOwner(ctx.params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(ctx.params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const quote = await getQuote(ctx.env.DB, owner, qid);
  if (!quote) return json({ success: false, error: 'Quote not found' }, 404);
  return json({ success: true, quote });
}

/** PUT /api/admin/leads/:id/quotes/:quote_id/status */
export async function handleLeadQuoteStatus(ctx) {
  const owner = leadOwner(ctx.params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(ctx.params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await ctx.request.json().catch(() => ({}));
  try {
    const ok = await setQuoteStatus(ctx.env.DB, owner, qid, body.status);
    if (!ok) return json({ success: false, error: 'Quote not found' }, 404);
    return json({ success: true });
  } catch (e) {
    if (e.message === 'invalid_status') return json({ success: false, error: 'Invalid status.' }, 400);
    throw e;
  }
}

/** PUT /api/admin/leads/:id/quotes/:quote_id/order-status */
export async function handleLeadOrderStatus(ctx) {
  const owner = leadOwner(ctx.params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(ctx.params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await ctx.request.json().catch(() => ({}));
  try {
    const ok = await setOrderStatus(ctx.env.DB, owner, qid, body.fulfillment);
    if (!ok) return json({ success: false, error: 'Only accepted quotes can be fulfilled.' }, 409);
    return json({ success: true });
  } catch (e) {
    if (e.message === 'invalid_fulfillment') return json({ success: false, error: 'Invalid fulfillment status.' }, 400);
    throw e;
  }
}

/** GET /api/admin/leads/quote-catalog — Caddisfly plans + plugins for the picker. */
export async function handleLeadQuoteCatalog() {
  return json({ success: true, items: caddisflyCatalog() });
}

/** GET /api/admin/leads/quote-template — the global Caddisfly quote template. */
export async function handleLeadQuoteTemplateGet(ctx) {
  return json({ success: true, template: await getQuoteTemplate(ctx.env.DB, { global: true }) });
}

/** PUT /api/admin/leads/quote-template */
export async function handleLeadQuoteTemplateSave(ctx) {
  const body = await ctx.request.json().catch(() => ({}));
  return json({ success: true, template: await saveQuoteTemplate(ctx.env.DB, { global: true }, body) });
}

/** POST /api/admin/leads/:id/quotes/:quote_id/send — email the lead a link to the
 *  hosted, Caddisfly-branded quote page. */
export async function handleLeadQuoteSend(ctx) {
  const { env, params, url } = ctx;
  const owner = leadOwner(params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const quote = await getQuote(env.DB, owner, qid);
  if (!quote) return json({ success: false, error: 'Quote not found' }, 404);
  if (!quote.contact_email) return json({ success: false, error: 'This quote has no customer email — add one first.' }, 400);
  const origin = url.origin;
  const token = await snapshotLeadQuote(env, owner, qid, origin);
  await markQuoteSent(env.DB, owner, qid);
  const viewUrl = `${origin}/q/${token}`;
  try {
    const sent = await sendQuoteEmail(env, {
      to: quote.contact_email, issuerName: 'Caddisfly', quoteTitle: quote.title,
      totalLabel: money(quote.total_cents, quote.currency), viewUrl,
    });
    return json({ success: true, sent, view_url: viewUrl, ...(sent ? {} : { warning: 'Email not configured — share the link.' }) });
  } catch (e) {
    return json({ success: true, sent: false, view_url: viewUrl, warning: 'Email failed: ' + e.message });
  }
}

/** PUT /api/admin/leads/:id/quotes/:quote_id — edit the quote content. */
export async function handleLeadQuoteUpdate(ctx) {
  const { env, request, params } = ctx;
  const owner = leadOwner(params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await request.json().catch(() => ({}));
  try {
    const ok = await updateQuote(env.DB, owner, qid, { title: body.title, currency: body.currency, valid_until: body.valid_until, notes: body.notes, items: body.items });
    if (!ok) return json({ success: false, error: 'Quote not found' }, 404);
    return json({ success: true });
  } catch (e) {
    if (e.message === 'items_required') return json({ success: false, error: 'At least one line item is required.' }, 400);
    throw e;
  }
}

/** POST /api/admin/leads/:id/quotes/:quote_id/review — add an internal review note. */
export async function handleLeadQuoteReviewAdd(ctx) {
  const { env, request, params } = ctx;
  const owner = leadOwner(params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await request.json().catch(() => ({}));
  try {
    const reviews = await addQuoteReview(env.DB, owner, qid, body.body);
    if (reviews == null) return json({ success: false, error: 'Quote not found' }, 404);
    return json({ success: true, reviews });
  } catch (e) {
    if (e.message === 'empty_review') return json({ success: false, error: 'Comment cannot be empty.' }, 400);
    throw e;
  }
}

/** POST /api/admin/leads/:id/quotes/:quote_id/preview — snapshot the issuer +
 *  mint a token (no Send, no email) so the operator can review the doc. */
export async function handleLeadQuotePreview(ctx) {
  const { env, params, url } = ctx;
  const owner = leadOwner(params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const quote = await getQuote(env.DB, owner, qid);
  if (!quote) return json({ success: false, error: 'Quote not found' }, 404);
  const token = await snapshotLeadQuote(env, owner, qid, url.origin);
  return json({ success: true, view_url: `${url.origin}/q/${token}` });
}

/** PUT /api/admin/leads/:id/quotes/:quote_id/email — edit the customer email
 *  on an existing quote. */
export async function handleLeadQuoteEmailUpdate(ctx) {
  const { env, request, params } = ctx;
  const owner = leadOwner(params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await request.json().catch(() => ({}));
  try {
    const ok = await updateQuoteEmail(env.DB, owner, qid, body.email);
    if (!ok) return json({ success: false, error: 'Quote not found' }, 404);
    return json({ success: true });
  } catch (e) {
    if (e.message === 'email_required') return json({ success: false, error: 'A valid email is required.' }, 400);
    throw e;
  }
}

/** DELETE /api/admin/leads/:id/quotes/:quote_id */
export async function handleLeadQuoteDelete(ctx) {
  const owner = leadOwner(ctx.params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(ctx.params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const ok = await deleteQuote(ctx.env.DB, owner, qid);
  return json({ success: ok });
}
