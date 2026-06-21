// CRM (plugin) — contacts aggregated ON THE FLY by email from form_submissions
// (messages), bookings, and store_orders. The crm_contacts overlay (migration
// 050) holds only status + notes. Bridge pattern (ai_project_id XOR project_id);
// form_submissions is keyed by the published-site public_id.

function keyCol(projectKey) {
  return projectKey.aiProjectId != null
    ? { col: 'ai_project_id', val: projectKey.aiProjectId }
    : { col: 'project_id', val: projectKey.projectId };
}

const lc = (s) => String(s == null ? '' : s).trim().toLowerCase();

/** Unified contact list: one row per email, merged across all three sources. */
export async function getCrmContacts(db, projectKey, publicId) {
  const k = keyCol(projectKey);
  const rows = async (sql, ...bind) => ((await db.prepare(sql).bind(...bind).all()).results || []);

  const forms = publicId
    ? await rows(`SELECT lower(email) AS email, name, created_at FROM form_submissions WHERE public_id = ? AND email <> ''`, publicId)
    : [];
  const books = await rows(`SELECT lower(customer_email) AS email, customer_name AS name, created_at FROM bookings WHERE ${k.col} = ? AND customer_email <> ''`, k.val);
  const orders = await rows(`SELECT lower(customer_email) AS email, amount_total, created_at FROM store_orders WHERE ${k.col} = ? AND customer_email <> ''`, k.val);
  const overlay = await rows(`SELECT lower(email) AS email, status, notes FROM crm_contacts WHERE ${k.col} = ?`, k.val);
  const ov = new Map(overlay.map((o) => [o.email, o]));

  const map = new Map();
  const get = (email) => {
    if (!map.has(email)) {
      const o = ov.get(email);
      map.set(email, { email, name: '', sources: [], msgCount: 0, bookingCount: 0, orderCount: 0, totalSpend: 0, lastActivity: 0, status: (o && o.status) || 'new', notes: (o && o.notes) || '' });
    }
    return map.get(email);
  };
  const touch = (c, src, ts) => { if (!c.sources.includes(src)) c.sources.push(src); c.lastActivity = Math.max(c.lastActivity, ts || 0); };

  for (const f of forms) { const c = get(f.email); c.name = c.name || f.name; c.msgCount++; touch(c, 'message', f.created_at); }
  for (const b of books) { const c = get(b.email); c.name = c.name || b.name; c.bookingCount++; touch(c, 'booking', b.created_at); }
  for (const o of orders) { const c = get(o.email); c.orderCount++; c.totalSpend += o.amount_total || 0; touch(c, 'order', o.created_at); }

  return Array.from(map.values()).sort((a, b) => b.lastActivity - a.lastActivity);
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
