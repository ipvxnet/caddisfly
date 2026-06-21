// CRM plugin API — list aggregated contacts, set status/notes, fetch a
// contact's activity. Routes are gated by pluginGate('crm') in index.js.

import { getCrmContacts, upsertCrmContact, getContactActivity } from '../../../db/crm.js';
import { resolveStoreProject } from './store.js';

const CRM_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** GET /api/ai-builder/:project_id/crm/contacts */
export async function handleCrmContacts(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const contacts = await getCrmContacts(env.DB, r.projectKey, params.project_id);
  return json({ success: true, contacts });
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
