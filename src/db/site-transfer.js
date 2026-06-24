// Website transfer + per-site Manager delegate grants. Ownership (customer_email)
// is the single source of all plan-gating, so transfer = flip customer_email +
// re-home owner-keyed billing rows + clear owner-specific operational config.
// A Manager is a delegate: counts toward their site limit, but every entitlement/
// credit check still resolves to the OWNER. See migration 059_site_transfer.sql.

import { keyCol } from './bridge.js';

const lc = (s) => String(s == null ? '' : s).trim().toLowerCase();
function ownerTable(projectKey) {
  return projectKey.aiProjectId != null
    ? { table: 'ai_projects', id: projectKey.aiProjectId }
    : { table: 'projects', id: projectKey.projectId };
}

// ---- transfer lifecycle ----------------------------------------------------

/** Create a pending transfer. token + expiresAt come from the caller. */
export async function createTransfer(db, projectKey, { fromEmail, toEmail, keepBuilder, requirements, token, expiresAt }) {
  const k = keyCol(projectKey);
  const res = await db.prepare(
    `INSERT INTO site_transfers (${k.col}, from_email, to_email, keep_builder_access, requirements_json, status, token, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(k.val, lc(fromEmail), lc(toEmail), keepBuilder ? 1 : 0, JSON.stringify(requirements || {}), token, expiresAt).run();
  return res.meta.last_row_id;
}

/** A still-actionable pending transfer for this site (not expired), or null. */
export async function getPendingTransferForSite(db, projectKey) {
  const k = keyCol(projectKey);
  return db.prepare(
    `SELECT * FROM site_transfers WHERE ${k.col} = ? AND status = 'pending' AND expires_at > unixepoch() ORDER BY id DESC LIMIT 1`
  ).bind(k.val).first();
}

/** Lookup a transfer by its accept token (null if missing). */
export async function getTransferByToken(db, token) {
  if (!token) return null;
  return db.prepare(`SELECT * FROM site_transfers WHERE token = ?`).bind(token).first();
}

/** Cancel a pending transfer (owner-initiated). Scoped to the site + from_email. */
export async function cancelTransfer(db, projectKey, fromEmail) {
  const k = keyCol(projectKey);
  const res = await db.prepare(
    `UPDATE site_transfers SET status='cancelled' WHERE ${k.col} = ? AND from_email = ? AND status='pending'`
  ).bind(k.val, lc(fromEmail)).run();
  return res.meta.changes > 0;
}

/** Mark a transfer row's terminal status (accepted/declined/expired). */
export async function setTransferStatus(db, id, status) {
  const accepted = status === 'accepted' ? ', accepted_at = unixepoch()' : '';
  await db.prepare(`UPDATE site_transfers SET status = ?${accepted} WHERE id = ?`).bind(status, id).run();
}

// ---- the ownership move (executed on accept) -------------------------------

/**
 * Atomically re-own a site to `toEmail`:
 *  - flip customer_email on ai_projects/projects
 *  - re-home connected domain_orders (billing email + stripe customer for renewals)
 *  - CLEAR owner-specific operational config (Stripe Connect payout account, social
 *    syndication webhooks, notify email) so the new owner reconnects their own —
 *    a money-safety must (else store sales would route to the old owner's Stripe)
 *  - if keepBuilder, grant the old owner a Manager delegate
 * custom_domains, bookings, store, crm, snapshots are project-keyed → travel with
 * the site automatically. Caller handles audit + the recipient's stripe_customer_id.
 */
export async function executeTransfer(db, projectKey, { fromEmail, toEmail, keepBuilder, recipientStripeCustomerId }) {
  const o = ownerTable(projectKey);
  const k = keyCol(projectKey);
  const to = lc(toEmail);

  // Run as ONE atomic batch (D1 batch = transaction) so a mid-way failure can't
  // leave a half-transferred site.
  const stmts = [
    db.prepare(`UPDATE ${o.table} SET customer_email = ? WHERE id = ?`).bind(to, o.id),
    // Domains purchased through us bound to this site → bill the new owner.
    db.prepare(`UPDATE domain_orders SET customer_email = ?, stripe_customer_id = ? WHERE ${k.col} = ?`).bind(to, recipientStripeCustomerId || null, k.val),
    // Clear owner-specific operational config (payout/notify/syndication).
    db.prepare(`UPDATE ai_website_configs SET stripe_account_id = NULL, social_connections_json = NULL, notify_email = NULL, updated_at = unixepoch() WHERE ${k.col} = ?`).bind(k.val),
  ];
  if (keepBuilder) {
    // NOTE: the unique index is PARTIAL, so the conflict target must repeat its WHERE.
    stmts.push(db.prepare(
      `INSERT INTO site_managers (${k.col}, manager_email, role) VALUES (?, ?, 'manager')
       ON CONFLICT(${k.col}, manager_email) WHERE ${k.col} IS NOT NULL DO UPDATE SET role = excluded.role`
    ).bind(k.val, lc(fromEmail)));
  }
  await db.batch(stmts);
}

// ---- per-site Manager delegate grants --------------------------------------

export async function addSiteManager(db, projectKey, managerEmail, role = 'manager') {
  const k = keyCol(projectKey);
  await db.prepare(
    `INSERT INTO site_managers (${k.col}, manager_email, role) VALUES (?, ?, ?)
     ON CONFLICT(${k.col}, manager_email) WHERE ${k.col} IS NOT NULL DO UPDATE SET role = excluded.role`
  ).bind(k.val, lc(managerEmail), role).run();
}

export async function removeSiteManager(db, projectKey, managerEmail) {
  const k = keyCol(projectKey);
  const res = await db.prepare(`DELETE FROM site_managers WHERE ${k.col} = ? AND manager_email = ?`).bind(k.val, lc(managerEmail)).run();
  return res.meta.changes > 0;
}

/** Is `email` a Manager of this specific site? Returns the role string or null. */
export async function getSiteManagerRole(db, projectKey, email) {
  const k = keyCol(projectKey);
  const row = await db.prepare(`SELECT role FROM site_managers WHERE ${k.col} = ? AND manager_email = ?`).bind(k.val, lc(email)).first();
  return row ? row.role : null;
}

/** Everyone who manages this specific site (the Builder/Designer kept on after
 *  a transfer). Shown to the owner so they can Disconnect the relationship. */
export async function listSiteManagers(db, projectKey) {
  const k = keyCol(projectKey);
  const { results } = await db
    .prepare(`SELECT manager_email, role, created_at FROM site_managers WHERE ${k.col} = ? ORDER BY created_at`)
    .bind(k.val)
    .all();
  return results || [];
}

/** All sites `email` manages (joined to the project for display + publish state).
 *  `published` = the canonical status='deployed' (matches countPublishedSites). */
export async function listManagedSites(db, email) {
  const e = lc(email);
  const ai = await db.prepare(
    `SELECT 'ai' AS kind, p.id, p.project_id AS public_id, p.project_name AS name, p.customer_email AS owner_email,
            p.subdomain AS subdomain, p.status AS status,
            CASE WHEN p.status='deployed' THEN 1 ELSE 0 END AS published
       FROM site_managers m JOIN ai_projects p ON p.id = m.ai_project_id WHERE m.manager_email = ?`
  ).bind(e).all();
  const rg = await db.prepare(
    `SELECT 'project' AS kind, p.id, p.preview_id AS public_id, p.website_url AS name, p.customer_email AS owner_email,
            p.subdomain AS subdomain, p.status AS status,
            CASE WHEN p.status='deployed' THEN 1 ELSE 0 END AS published
       FROM site_managers m JOIN projects p ON p.id = m.project_id WHERE m.manager_email = ?`
  ).bind(e).all();
  return [...(ai.results || []), ...(rg.results || [])];
}

/** Count PUBLISHED sites `email` manages (for the owned+managed limit). */
export async function countManagedPublishedSites(db, email) {
  const e = lc(email);
  const r = await db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM site_managers m JOIN ai_projects p ON p.id=m.ai_project_id WHERE m.manager_email=? AND p.status='deployed') +
       (SELECT COUNT(*) FROM site_managers m JOIN projects p ON p.id=m.project_id WHERE m.manager_email=? AND p.status='deployed') AS n`
  ).bind(e, e).first();
  return (r && r.n) || 0;
}

// ---- requirement detection (what the recipient must hold to accept) --------

/**
 * Inspect a site and return what the recipient's account must satisfy:
 *  { base: true, domain: bool, plugins: ['catalogue'|'crm'|'advanced_store'] }
 * The owner confirms/edits this before sending, so over/under-detection is safe.
 */
export async function computeSiteRequirements(db, projectKey) {
  const k = keyCol(projectKey);
  const one = async (sql) => ((await db.prepare(sql).bind(k.val).first()) || {}).n || 0;

  const domains = await one(`SELECT COUNT(*) AS n FROM custom_domains WHERE ${k.col} = ?`)
    + await one(`SELECT COUNT(*) AS n FROM domain_orders WHERE ${k.col} = ? AND status IN ('registered','paid','registering')`);
  const catalogue = await one(`SELECT COUNT(*) AS n FROM ai_sections WHERE ${k.col} = ? AND section_type = 'catalogue'`);
  const crm = await one(`SELECT COUNT(*) AS n FROM crm_contacts WHERE ${k.col} = ?`)
    + await one(`SELECT COUNT(*) AS n FROM crm_quotes WHERE ${k.col} = ?`);
  const advStore = await one(`SELECT COUNT(*) AS n FROM store_discounts WHERE ${k.col} = ?`);

  const plugins = [];
  if (catalogue) plugins.push('catalogue');
  if (crm) plugins.push('crm');
  if (advStore) plugins.push('advanced_store');
  return { base: true, domain: domains > 0, plugins };
}
