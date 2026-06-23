// CRM (plugin) — contacts aggregated ON THE FLY by email from form_submissions
// (messages), bookings, and store_orders. The crm_contacts overlay (migration
// 050) holds only status + notes. Bridge pattern (ai_project_id XOR project_id);
// form_submissions is keyed by the published-site public_id.

import { keyCol } from './bridge.js';

const lc = (s) => String(s == null ? '' : s).trim().toLowerCase();
const normPhone = (p) => String(p == null ? '' : p).replace(/[^\d+]/g, '');
const normName = (n) => String(n == null ? '' : n).trim().toLowerCase().replace(/\s+/g, ' ');
export const CRM_DEDUP_KEYS = ['email', 'phone', 'name'];

// Group key for a record under the chosen dedup field. Falls back to email when
// the chosen field is empty on a record, so e.g. dedup-by-phone doesn't collapse
// every phone-less form submission into one blob.
function groupKey(rec, dedupKey) {
  if (dedupKey === 'phone') { const v = normPhone(rec.phone); if (v) return 'p:' + v; }
  else if (dedupKey === 'name') { const v = normName(rec.name); if (v) return 'n:' + v; }
  return 'e:' + lc(rec.email);
}

/**
 * Unified contact list, merged across form messages, bookings, store orders and
 * manually-added contacts. `dedupKey` (email|phone|name) chooses what collapses
 * duplicates into one row. Manual contacts (crm_contacts.source='manual') appear
 * even with no other activity.
 */
export async function getCrmContacts(db, projectKey, publicId, dedupKey = 'email') {
  const k = keyCol(projectKey);
  const dk = CRM_DEDUP_KEYS.includes(dedupKey) ? dedupKey : 'email';
  const rows = async (sql, ...bind) => ((await db.prepare(sql).bind(...bind).all()).results || []);

  const forms = publicId
    ? await rows(`SELECT lower(email) AS email, name, created_at FROM form_submissions WHERE public_id = ? AND email <> ''`, publicId)
    : [];
  const books = await rows(`SELECT lower(customer_email) AS email, customer_name AS name, created_at FROM bookings WHERE ${k.col} = ? AND customer_email <> ''`, k.val);
  const orders = await rows(`SELECT lower(customer_email) AS email, customer_name AS name, amount_total, created_at FROM store_orders WHERE ${k.col} = ? AND customer_email <> ''`, k.val);
  const overlay = await rows(`SELECT lower(email) AS email, name, phone, status, notes, source, created_at FROM crm_contacts WHERE ${k.col} = ?`, k.val);
  const ovByEmail = new Map(overlay.map((o) => [o.email, o]));

  // Flatten every source (+ manual contacts) into comparable records first, so
  // the chosen dedup key can group them however the owner wants.
  const recs = [];
  for (const f of forms) recs.push({ email: f.email, name: f.name || '', phone: '', src: 'message', ts: f.created_at, spend: 0 });
  for (const b of books) recs.push({ email: b.email, name: b.name || '', phone: '', src: 'booking', ts: b.created_at, spend: 0 });
  for (const o of orders) recs.push({ email: o.email, name: o.name || '', phone: '', src: 'order', ts: o.created_at, spend: o.amount_total || 0 });
  for (const o of overlay) {
    if (o.source === 'manual') recs.push({ email: o.email, name: o.name || '', phone: o.phone || '', src: 'manual', ts: o.created_at || 0, spend: 0 });
  }

  const map = new Map();
  for (const r of recs) {
    const key = groupKey(r, dk);
    let c = map.get(key);
    if (!c) { c = { email: '', name: '', phone: '', sources: [], msgCount: 0, bookingCount: 0, orderCount: 0, totalSpend: 0, lastActivity: 0, status: 'new', notes: '' }; map.set(key, c); }
    c.email = c.email || r.email;
    c.name = c.name || r.name;
    c.phone = c.phone || r.phone;
    if (!c.sources.includes(r.src)) c.sources.push(r.src);
    if (r.src === 'message') c.msgCount++;
    else if (r.src === 'booking') c.bookingCount++;
    else if (r.src === 'order') { c.orderCount++; c.totalSpend += r.spend; }
    c.lastActivity = Math.max(c.lastActivity, r.ts || 0);
  }
  // Overlay status/notes are keyed by email — attach by the group's resolved email.
  for (const c of map.values()) {
    const o = ovByEmail.get(lc(c.email));
    if (o) { c.status = o.status || 'new'; c.notes = o.notes || ''; if (!c.phone) c.phone = o.phone || ''; }
  }
  return Array.from(map.values()).sort((a, b) => b.lastActivity - a.lastActivity);
}

/**
 * Add (or update) a contact the owner enters by hand. Keyed on email (the table's
 * unique key); marks source='manual' so it shows even without other activity.
 * Throws Error('email_required') when no email is given.
 */
export async function addManualCrmContact(db, projectKey, { email, name, phone, status, notes }) {
  const e = lc(email);
  if (!e) throw new Error('email_required');
  const n = (name || '').toString().trim().slice(0, 200);
  const p = (phone || '').toString().replace(/[^\d+\s()\-]/g, '').trim().slice(0, 30);
  const s = ['new', 'contacted', 'qualified', 'won', 'lost'].includes(status) ? status : 'new';
  const nt = (notes || '').toString().trim().slice(0, 5000);
  const { col, val } = keyCol(projectKey);
  await db.prepare(
    `INSERT INTO crm_contacts (${col}, email, name, phone, status, notes, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'manual', unixepoch(), unixepoch())
     ON CONFLICT(${col}, email) DO UPDATE SET
       name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE crm_contacts.name END,
       phone = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE crm_contacts.phone END,
       status = excluded.status, notes = excluded.notes, source = 'manual', updated_at = unixepoch()`
  ).bind(val, e, n, p, s, nt).run();
}

/** Set a contact's pipeline status + notes (upsert on the bridge key). */
export async function upsertCrmContact(db, projectKey, email, status, notes) {
  const e = lc(email);
  const s = status || 'new';
  const n = notes || '';
  if (projectKey.aiProjectId != null) {
    await db.prepare(
      `INSERT INTO crm_contacts (ai_project_id, email, status, notes, updated_at) VALUES (?, ?, ?, ?, unixepoch())
       ON CONFLICT(ai_project_id, email) DO UPDATE SET status = excluded.status, notes = excluded.notes, updated_at = unixepoch()`
    ).bind(projectKey.aiProjectId, e, s, n).run();
  } else {
    await db.prepare(
      `INSERT INTO crm_contacts (project_id, email, status, notes, updated_at) VALUES (?, ?, ?, ?, unixepoch())
       ON CONFLICT(project_id, email) DO UPDATE SET status = excluded.status, notes = excluded.notes, updated_at = unixepoch()`
    ).bind(projectKey.projectId, e, s, n).run();
  }
}

/** Recent activity timeline for one contact (messages + bookings + orders). */
export async function getContactActivity(db, projectKey, publicId, email) {
  const k = keyCol(projectKey);
  const e = lc(email);
  const rows = async (sql, ...bind) => ((await db.prepare(sql).bind(...bind).all()).results || []);
  const out = [];
  const forms = publicId ? await rows(`SELECT message, created_at FROM form_submissions WHERE public_id = ? AND lower(email) = ? ORDER BY created_at DESC LIMIT 50`, publicId, e) : [];
  for (const f of forms) out.push({ type: 'message', detail: f.message || '', at: f.created_at });
  const books = await rows(`SELECT created_at FROM bookings WHERE ${k.col} = ? AND lower(customer_email) = ? ORDER BY created_at DESC LIMIT 50`, k.val, e);
  for (const b of books) out.push({ type: 'booking', detail: '', at: b.created_at });
  const orders = await rows(`SELECT amount_total, currency, created_at FROM store_orders WHERE ${k.col} = ? AND lower(customer_email) = ? ORDER BY created_at DESC LIMIT 50`, k.val, e);
  for (const o of orders) out.push({ type: 'order', detail: { amount_total: o.amount_total, currency: o.currency }, at: o.created_at });
  return out.sort((a, b) => (b.at || 0) - (a.at || 0));
}
