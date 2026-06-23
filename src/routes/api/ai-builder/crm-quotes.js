// CRM plugin — Quotation & Order Management API. List/create quotes, fetch one
// with items, set quote status + order fulfillment, delete. Gated by
// pluginGate('crm', { json: true }) in index.js. Mirrors api/ai-builder/crm.js.

import { resolveStoreProject } from './store.js';
import { createQuote, listQuotes, getQuote, setQuoteStatus, setOrderStatus, deleteQuote } from '../../../db/crm-quotes.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
