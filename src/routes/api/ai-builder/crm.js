// CRM plugin API — list aggregated contacts, set status/notes, fetch a
// contact's activity. Routes are gated by pluginGate('crm') in index.js.

import { getCrmContacts, upsertCrmContact, getContactActivity, addManualCrmContact, CRM_DEDUP_KEYS } from '../../../db/crm.js';
import { resolveStoreProject, getOrCreateConfig } from './store.js';
import { updateWebsiteConfigById } from '../../../db/ai-config.js';

const CRM_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** GET /api/ai-builder/:project_id/crm/contacts */
export async function handleCrmContacts(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  const dedupKey = CRM_DEDUP_KEYS.includes(config.crm_dedup_key) ? config.crm_dedup_key : 'email';
  const contacts = await getCrmContacts(env.DB, r.projectKey, params.project_id, dedupKey);
  return json({ success: true, contacts, dedup_key: dedupKey });
}

/** POST /api/ai-builder/:project_id/crm/contacts — add a contact by hand */
export async function handleCrmContactAdd(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const body = await request.json().catch(() => ({}));
  try {
    await addManualCrmContact(env.DB, r.projectKey, {
      email: body.email, name: body.name, phone: body.phone, status: body.status, notes: body.notes,
    });
  } catch (e) {
    if (e.message === 'email_required') return json({ success: false, error: 'A valid email is required.' }, 400);
    throw e;
  }
  return json({ success: true }, 201);
}

/** PUT /api/ai-builder/:project_id/crm/dedup-key — choose email|phone|name */
export async function handleCrmDedupKey(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const key = CRM_DEDUP_KEYS.includes(body.dedup_key) ? body.dedup_key : 'email';
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  await updateWebsiteConfigById(env.DB, config.id, { crm_dedup_key: key });
  return json({ success: true, dedup_key: key });
}

/** PUT /api/ai-builder/:project_id/crm/contacts/:email — status + notes */
export async function handleCrmContactUpdate(ctx) {
  const { env, request, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const email = decodeURIComponent(params.email || '').trim();
  if (!email) return json({ success: false, error: 'email required' }, 400);
  const body = await request.json().catch(() => ({}));
  const status = CRM_STATUSES.includes(body.status) ? body.status : 'new';
  const notes = (body.notes || '').toString().slice(0, 5000);
  await upsertCrmContact(env.DB, r.projectKey, email, status, notes);
  return json({ success: true });
}

/** GET /api/ai-builder/:project_id/crm/contacts/:email/activity */
export async function handleCrmActivity(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const email = decodeURIComponent(params.email || '').trim();
  const activity = await getContactActivity(env.DB, r.projectKey, params.project_id, email);
  return json({ success: true, activity });
}
