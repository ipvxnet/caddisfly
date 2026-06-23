// Admin Leads CRM — Quotation & Order Management for outbound-sales prospects.
// Reuses the SAME quotes engine as the customer CRM plugin (src/db/crm-quotes.js)
// with owner = { leadId } instead of a project bridge key, so the two stay in
// sync. Admin-gated ([authMiddleware, adminMiddleware]) in index.js — NOT a plugin.

import { getLead } from '../../db/leads.js';
import { createQuote, listQuotes, getQuote, setQuoteStatus, setOrderStatus, deleteQuote,
  ensureQuoteToken, markQuoteSent, setQuoteIssuer } from '../../db/crm-quotes.js';
import { sendQuoteEmail } from '../../utils/email.js';
import { getQuoteTemplate, applyTemplate, saveQuoteTemplate } from '../../db/quote-templates.js';

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
  const token = await ensureQuoteToken(env.DB, owner, qid);
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

/** DELETE /api/admin/leads/:id/quotes/:quote_id */
export async function handleLeadQuoteDelete(ctx) {
  const owner = leadOwner(ctx.params);
  if (!owner) return json({ success: false, error: 'Invalid lead id' }, 400);
  const qid = Number(ctx.params.quote_id);
  if (!Number.isInteger(qid)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const ok = await deleteQuote(ctx.env.DB, owner, qid);
  return json({ success: ok });
}
