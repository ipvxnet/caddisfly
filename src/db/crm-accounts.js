// CRM Accounts data layer (Phase 1). A structured company record per project,
// holding multiple contacts. Bridge pattern (ai_project_id XOR project_id); every
// read/write is scoped by projectKey so one site can't touch another's accounts.
// See migration 062. Financials (Phase 2) will roll up by contact email.

import { keyCol } from './bridge.js';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];
const clamp = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const normPhone = (p) => String(p == null ? '' : p).replace(/[^\d+\s()\-]/g, '').trim().slice(0, 40);
const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim()) ? String(s).trim() : '');

const ACCOUNT_COLS = `id, account_name, account_owner, email, phone, cellphone, billing_address,
  description, num_employees, industry, vertical, desired_start_date, desired_end_date,
  status, created_at, updated_at`;

/** Sanitize a raw account body into safe column values. */
function cleanAccount(b) {
  let employees = null;
  if (b.num_employees != null && String(b.num_employees).trim() !== '') {
    const n = parseInt(b.num_employees, 10);
    if (Number.isFinite(n) && n >= 0) employees = Math.min(n, 100000000);
  }
  return {
    account_name: clamp(b.account_name, 200),
    account_owner: clamp(b.account_owner, 200),
    email: clamp(b.email, 200).toLowerCase(),
    phone: normPhone(b.phone),
    cellphone: normPhone(b.cellphone),
    billing_address: clamp(b.billing_address, 500),
    description: clamp(b.description, 4000),
    num_employees: employees,
    industry: clamp(b.industry, 100),
    vertical: clamp(b.vertical, 100),
    desired_start_date: isoDate(b.desired_start_date),
    desired_end_date: isoDate(b.desired_end_date),
    status: STATUSES.includes(b.status) ? b.status : 'new',
  };
}

/** All accounts for a project, newest first, with a contact count. */
export async function listAccounts(db, projectKey) {
  const k = keyCol(projectKey);
  const { results } = await db.prepare(
    `SELECT a.${ACCOUNT_COLS.replace(/\n\s*/g, ' ')},
            (SELECT COUNT(*) FROM crm_account_contacts c WHERE c.account_id = a.id) AS contact_count
       FROM crm_accounts a WHERE a.${k.col} = ? ORDER BY a.updated_at DESC`
  ).bind(k.val).all();
  return results || [];
}

/** One account + its contacts, scoped to the project (null if not found/owned). */
export async function getAccount(db, projectKey, accountId) {
  const k = keyCol(projectKey);
  const account = await db.prepare(
    `SELECT ${ACCOUNT_COLS} FROM crm_accounts WHERE id = ? AND ${k.col} = ?`
  ).bind(accountId, k.val).first();
  if (!account) return null;
  const { results } = await db.prepare(
    `SELECT id, name, title, email, phone, is_primary FROM crm_account_contacts WHERE account_id = ? ORDER BY is_primary DESC, id`
  ).bind(accountId).all();
  return { ...account, contacts: results || [] };
}

/** Create an account. Returns the new id. */
export async function createAccount(db, projectKey, body) {
  const k = keyCol(projectKey);
  const v = cleanAccount(body);
  const res = await db.prepare(
    `INSERT INTO crm_accounts (${k.col}, account_name, account_owner, email, phone, cellphone,
       billing_address, description, num_employees, industry, vertical, desired_start_date, desired_end_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(k.val, v.account_name, v.account_owner, v.email, v.phone, v.cellphone, v.billing_address,
    v.description, v.num_employees, v.industry, v.vertical, v.desired_start_date, v.desired_end_date, v.status).run();
  return res.meta.last_row_id;
}

/** Update an account (scoped). Returns true if a row changed. */
export async function updateAccount(db, projectKey, accountId, body) {
  const k = keyCol(projectKey);
  const v = cleanAccount(body);
  const res = await db.prepare(
    `UPDATE crm_accounts SET account_name=?, account_owner=?, email=?, phone=?, cellphone=?,
       billing_address=?, description=?, num_employees=?, industry=?, vertical=?,
       desired_start_date=?, desired_end_date=?, status=?, updated_at=unixepoch()
     WHERE id=? AND ${k.col}=?`
  ).bind(v.account_name, v.account_owner, v.email, v.phone, v.cellphone, v.billing_address,
    v.description, v.num_employees, v.industry, v.vertical, v.desired_start_date, v.desired_end_date,
    v.status, accountId, k.val).run();
  return res.meta.changes > 0;
}

/** Delete an account + its contacts (scoped). */
export async function deleteAccount(db, projectKey, accountId) {
  const k = keyCol(projectKey);
  const res = await db.prepare(`DELETE FROM crm_accounts WHERE id = ? AND ${k.col} = ?`).bind(accountId, k.val).run();
  if (res.meta.changes > 0) {
    await db.prepare(`DELETE FROM crm_account_contacts WHERE account_id = ?`).bind(accountId).run();
  }
  return res.meta.changes > 0;
}

/**
 * Replace an account's contacts with the given list (atomic). Each contact:
 * { name, title, email, phone, is_primary }. Empty rows (no name+email+phone) are
 * dropped. Caller must have verified the account belongs to the project first.
 */
export async function setAccountContacts(db, accountId, contacts) {
  const rows = (contacts || [])
    .map((c) => ({
      name: clamp(c.name, 200), title: clamp(c.title, 120),
      email: clamp(c.email, 200).toLowerCase(), phone: normPhone(c.phone),
      is_primary: c.is_primary ? 1 : 0,
    }))
    .filter((c) => c.name || c.email || c.phone);
  // Exactly one primary at most: keep the first flagged, else mark the first row.
  let primarySet = false;
  for (const c of rows) {
    if (c.is_primary && !primarySet) primarySet = true;
    else c.is_primary = 0;
  }
  if (rows.length && !primarySet) rows[0].is_primary = 1;

  const stmts = [db.prepare(`DELETE FROM crm_account_contacts WHERE account_id = ?`).bind(accountId)];
  for (const c of rows) {
    stmts.push(db.prepare(
      `INSERT INTO crm_account_contacts (account_id, name, title, email, phone, is_primary) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(accountId, c.name, c.title, c.email, c.phone, c.is_primary));
  }
  await db.batch(stmts);
  return rows.length;
}
