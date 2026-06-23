// CRM plugin — Quotation & Order Management API. List/create quotes, fetch one
// with items, set quote status + order fulfillment, delete. Gated by
// pluginGate('crm', { json: true }) in index.js. Mirrors api/ai-builder/crm.js.

import { resolveStoreProject, getOrCreateConfig } from './store.js';
import { createQuote, listQuotes, getQuote, setQuoteStatus, setOrderStatus, deleteQuote,
  ensureQuoteToken, markQuoteSent, setQuoteIssuer, updateQuoteEmail, updateQuote, addQuoteReview } from '../../../db/crm-quotes.js';
import { sendQuoteEmail } from '../../../utils/email.js';
import { getQuoteTemplate, applyTemplate, saveQuoteTemplate } from '../../../db/quote-templates.js';
import { getProductsByProject } from '../../../db/products.js';

/** Build + freeze the issuer snapshot for THIS project + mint a token. Shared by
 *  Send and Preview so the document is identical either way. */
async function snapshotCustomerQuote(env, r, id) {
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  let issuer = {
    name: r.businessName,
    logo: config.logo_url || '',
    contact: [config.notify_email].filter(Boolean),
    accent: config.primary_color || '#5a3da8',
    intro: '',
    thankYou: `Thank you for considering ${r.businessName}. We look forward to working with you.`,
    terms: '',
  };
  issuer = applyTemplate(issuer, await getQuoteTemplate(env.DB, r.projectKey));
  await setQuoteIssuer(env.DB, r.projectKey, id, issuer);
  return ensureQuoteToken(env.DB, r.projectKey, id);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function money(cents, currency) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'USD').toUpperCase() }).format((cents || 0) / 100); }
  catch { return '$' + ((cents || 0) / 100).toFixed(2); }
}

/** GET /api/ai-builder/:project_id/crm/quotes?email= */
export async function handleQuoteList(ctx) {
  const { env, params, url } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const email = (url && url.searchParams.get('email')) || '';
  const quotes = await listQuotes(env.DB, r.projectKey, email);
  return json({ success: true, quotes });
}

/** POST /api/ai-builder/:project_id/crm/quotes */
export async function handleQuoteCreate(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const body = await request.json().catch(() => ({}));
  if (!body.email) return json({ success: false, error: 'A contact email is required.' }, 400);
  try {
    const id = await createQuote(env.DB, r.projectKey, {
      email: body.email, title: body.title, currency: body.currency,
      valid_until: body.valid_until, notes: body.notes, items: body.items,
    });
    return json({ success: true, id }, 201);
  } catch (e) {
    if (e.message === 'items_required') return json({ success: false, error: 'At least one line item is required.' }, 400);
    throw e;
  }
}

/** GET /api/ai-builder/:project_id/crm/quotes/:quote_id */
export async function handleQuoteGet(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.quote_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const quote = await getQuote(env.DB, r.projectKey, id);
  if (!quote) return json({ success: false, error: 'Quote not found' }, 404);
  return json({ success: true, quote });
}

/** PUT /api/ai-builder/:project_id/crm/quotes/:quote_id/status */
export async function handleQuoteStatus(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.quote_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await request.json().catch(() => ({}));
  try {
    const ok = await setQuoteStatus(env.DB, r.projectKey, id, body.status);
    if (!ok) return json({ success: false, error: 'Quote not found' }, 404);
    return json({ success: true });
  } catch (e) {
    if (e.message === 'invalid_status') return json({ success: false, error: 'Invalid status.' }, 400);
    throw e;
  }
}

/** PUT /api/ai-builder/:project_id/crm/quotes/:quote_id/order-status */
export async function handleOrderStatus(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.quote_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await request.json().catch(() => ({}));
  try {
    const ok = await setOrderStatus(env.DB, r.projectKey, id, body.fulfillment);
    if (!ok) return json({ success: false, error: 'Only accepted quotes can be fulfilled.' }, 409);
    return json({ success: true });
  } catch (e) {
    if (e.message === 'invalid_fulfillment') return json({ success: false, error: 'Invalid fulfillment status.' }, 400);
    throw e;
  }
}

/** GET /api/ai-builder/:project_id/crm/quote-products — the project's store
 *  products for the quote line-item picker. */
export async function handleQuoteProducts(ctx) {
  const r = await resolveStoreProject(ctx.env, ctx.params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const rows = await getProductsByProject(ctx.env.DB, r.projectKey, false);
  const items = (rows || [])
    .filter((p) => p.name)
    .map((p) => ({ name: p.name, price_cents: p.price_cents || 0 }));
  return json({ success: true, items });
}

/** GET /api/ai-builder/:project_id/crm/quote-template */
export async function handleQuoteTemplateGet(ctx) {
  const r = await resolveStoreProject(ctx.env, ctx.params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  return json({ success: true, template: await getQuoteTemplate(ctx.env.DB, r.projectKey) });
}

/** PUT /api/ai-builder/:project_id/crm/quote-template */
export async function handleQuoteTemplateSave(ctx) {
  const r = await resolveStoreProject(ctx.env, ctx.params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const body = await ctx.request.json().catch(() => ({}));
  return json({ success: true, template: await saveQuoteTemplate(ctx.env.DB, r.projectKey, body) });
}

/** POST /api/ai-builder/:project_id/crm/quotes/:quote_id/send — email the customer
 *  a link to the hosted, branded quote page (issuer = the project's business). */
export async function handleQuoteSend(ctx) {
  const { env, params, url } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.quote_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const quote = await getQuote(env.DB, r.projectKey, id);
  if (!quote) return json({ success: false, error: 'Quote not found' }, 404);
  if (!quote.contact_email) return json({ success: false, error: 'Add a customer email to the quote first.' }, 400);
  const token = await snapshotCustomerQuote(env, r, id);
  await markQuoteSent(env.DB, r.projectKey, id);
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  const viewUrl = `${url.origin}/q/${token}`;
  try {
    const sent = await sendQuoteEmail(env, {
      to: quote.contact_email, issuerName: r.businessName, quoteTitle: quote.title,
      totalLabel: money(quote.total_cents, quote.currency), viewUrl, replyTo: config.notify_email || undefined,
    });
    return json({ success: true, sent, view_url: viewUrl, ...(sent ? {} : { warning: 'Email not configured — share the link.' }) });
  } catch (e) {
    return json({ success: true, sent: false, view_url: viewUrl, warning: 'Email failed: ' + e.message });
  }
}

/** PUT /api/ai-builder/:project_id/crm/quotes/:quote_id — edit the quote content
 *  (title, currency, valid_until, notes, line items). */
export async function handleQuoteUpdate(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.quote_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await request.json().catch(() => ({}));
  try {
    const ok = await updateQuote(env.DB, r.projectKey, id, { title: body.title, currency: body.currency, valid_until: body.valid_until, notes: body.notes, items: body.items });
    if (!ok) return json({ success: false, error: 'Quote not found' }, 404);
    return json({ success: true });
  } catch (e) {
    if (e.message === 'items_required') return json({ success: false, error: 'At least one line item is required.' }, 400);
    throw e;
  }
}

/** POST /api/ai-builder/:project_id/crm/quotes/:quote_id/review — add an internal review note. */
export async function handleQuoteReviewAdd(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.quote_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await request.json().catch(() => ({}));
  try {
    const reviews = await addQuoteReview(env.DB, r.projectKey, id, body.body);
    if (reviews == null) return json({ success: false, error: 'Quote not found' }, 404);
    return json({ success: true, reviews });
  } catch (e) {
    if (e.message === 'empty_review') return json({ success: false, error: 'Comment cannot be empty.' }, 400);
    throw e;
  }
}

/** POST /api/ai-builder/:project_id/crm/quotes/:quote_id/preview — snapshot the
 *  issuer + mint a token (no Send, no email) so the owner can review the doc as
 *  the customer will see it. Returns the public view_url. */
export async function handleQuotePreview(ctx) {
  const { env, params, url } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.quote_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const quote = await getQuote(env.DB, r.projectKey, id);
  if (!quote) return json({ success: false, error: 'Quote not found' }, 404);
  const token = await snapshotCustomerQuote(env, r, id);
  return json({ success: true, view_url: `${url.origin}/q/${token}` });
}

/** PUT /api/ai-builder/:project_id/crm/quotes/:quote_id/email — edit the customer
 *  email on an existing quote (you couldn't change it after creation before). */
export async function handleQuoteEmailUpdate(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.quote_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const body = await request.json().catch(() => ({}));
  try {
    const ok = await updateQuoteEmail(env.DB, r.projectKey, id, body.email);
    if (!ok) return json({ success: false, error: 'Quote not found' }, 404);
    return json({ success: true });
  } catch (e) {
    if (e.message === 'email_required') return json({ success: false, error: 'A valid email is required.' }, 400);
    throw e;
  }
}

/** DELETE /api/ai-builder/:project_id/crm/quotes/:quote_id */
export async function handleQuoteDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const id = Number(params.quote_id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid quote id' }, 400);
  const ok = await deleteQuote(env.DB, r.projectKey, id);
  return json({ success: ok });
}
