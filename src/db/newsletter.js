// Newsletter plugin data layer — see migrations/077_newsletter.sql. Bridge-aware
// like site-members.js/blog-posts.js: projectKey is { aiProjectId } XOR
// { projectId }. Subscribers double-opt-in (pending → active via a signed-token
// confirm link); a subscriber is mailable only while status = 'active'. Confirm/
// unsubscribe links are stateless signed tokens (utils/signed-token.js).
const nowSec = () => Math.floor(Date.now() / 1000);

// WHERE fragment + bind value for a project key (XOR bridge).
function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}
// INSERT column + value for a project key (XOR bridge).
function keyCol(projectKey) {
  return projectKey.aiProjectId != null
    ? { col: 'ai_project_id', val: projectKey.aiProjectId }
    : { col: 'project_id', val: projectKey.projectId };
}

const normEmail = (e) => String(e || '').trim().toLowerCase();

// ---- Subscribers -----------------------------------------------------------

/**
 * Add a subscriber as 'pending' (double opt-in), or return the existing row.
 * A previously-unsubscribed/bounced address that signs up again is reset to
 * 'pending' so it must re-confirm. An already-active one is left as-is.
 * ON CONFLICT repeats the partial unique index's WHERE (gotcha) so it targets
 * the right index. Returns the row.
 */
export async function addPendingSubscriber(db, projectKey, { email, name = '', consent_source = 'signup_form' } = {}) {
  const k = keyCol(projectKey);
  const e = normEmail(email);
  await db
    .prepare(
      `INSERT INTO newsletter_subscribers (${k.col}, email, name, status, consent_source, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?)
       ON CONFLICT(${k.col}, email) WHERE ${k.col} IS NOT NULL
       DO UPDATE SET
         name = CASE WHEN excluded.name != '' THEN excluded.name ELSE newsletter_subscribers.name END,
         status = CASE WHEN newsletter_subscribers.status IN ('unsubscribed','bounced','complained')
                       THEN 'pending' ELSE newsletter_subscribers.status END`
    )
    .bind(k.val, e, name, consent_source, nowSec())
    .run();
  return getSubscriberByEmail(db, projectKey, e);
}

/** Insert an already-confirmed subscriber (manual add / consented import). */
export async function addActiveSubscriber(db, projectKey, { email, name = '', consent_source = 'manual' } = {}) {
  const k = keyCol(projectKey);
  const e = normEmail(email);
  const ts = nowSec();
  await db
    .prepare(
      `INSERT INTO newsletter_subscribers (${k.col}, email, name, status, consent_source, confirmed_at, created_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)
       ON CONFLICT(${k.col}, email) WHERE ${k.col} IS NOT NULL
       DO UPDATE SET
         name = CASE WHEN excluded.name != '' THEN excluded.name ELSE newsletter_subscribers.name END,
         status = CASE WHEN newsletter_subscribers.status = 'pending' THEN 'active' ELSE newsletter_subscribers.status END,
         confirmed_at = COALESCE(newsletter_subscribers.confirmed_at, excluded.confirmed_at)`
    )
    .bind(k.val, e, name, consent_source, ts, ts)
    .run();
  return getSubscriberByEmail(db, projectKey, e);
}

/** Confirm a pending subscriber (double opt-in click) → 'active'. */
export async function confirmSubscriber(db, projectKey, email) {
  const k = keyWhere(projectKey);
  await db
    .prepare(
      `UPDATE newsletter_subscribers SET status = 'active', confirmed_at = ?
       WHERE ${k.sql} AND email = ? AND status IN ('pending','unsubscribed')`
    )
    .bind(nowSec(), k.val, normEmail(email))
    .run();
  return getSubscriberByEmail(db, projectKey, email);
}

/** Unsubscribe (from a link or the manager). */
export async function unsubscribeSubscriber(db, projectKey, email) {
  const k = keyWhere(projectKey);
  await db
    .prepare(`UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE ${k.sql} AND email = ?`)
    .bind(nowSec(), k.val, normEmail(email))
    .run();
  return getSubscriberByEmail(db, projectKey, email);
}

/** Suppress an address after a bounce/complaint (Resend webhook). */
export async function setSubscriberStatus(db, projectKey, email, status) {
  const allowed = ['pending', 'active', 'unsubscribed', 'bounced', 'complained'];
  if (!allowed.includes(status)) return null;
  const k = keyWhere(projectKey);
  await db
    .prepare(`UPDATE newsletter_subscribers SET status = ? WHERE ${k.sql} AND email = ?`)
    .bind(status, k.val, normEmail(email))
    .run();
  return getSubscriberByEmail(db, projectKey, email);
}

/** A single subscriber by email (or null). */
export async function getSubscriberByEmail(db, projectKey, email) {
  const k = keyWhere(projectKey);
  return db
    .prepare(`SELECT * FROM newsletter_subscribers WHERE ${k.sql} AND email = ?`)
    .bind(k.val, normEmail(email))
    .first();
}

/** Subscribers for a site (optionally filtered by status), newest first. */
export async function listSubscribers(db, projectKey, { status = null, limit = 1000 } = {}) {
  const k = keyWhere(projectKey);
  const where = status ? `${k.sql} AND status = ?` : k.sql;
  const binds = status ? [k.val, status, limit] : [k.val, limit];
  const { results } = await db
    .prepare(`SELECT * FROM newsletter_subscribers WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .bind(...binds)
    .all();
  return results || [];
}

/** Counts per status: { active, pending, unsubscribed, bounced, complained, total }. */
export async function countSubscribersByStatus(db, projectKey) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(`SELECT status, COUNT(*) AS n FROM newsletter_subscribers WHERE ${k.sql} GROUP BY status`)
    .bind(k.val)
    .all();
  const out = { active: 0, pending: 0, unsubscribed: 0, bounced: 0, complained: 0, total: 0 };
  for (const r of results || []) { out[r.status] = r.n; out.total += r.n; }
  return out;
}

/** Mailable subscribers (status = 'active') — the send audience. */
export async function getActiveSubscribers(db, projectKey, { limit = 5000, offset = 0 } = {}) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(`SELECT id, email, name FROM newsletter_subscribers WHERE ${k.sql} AND status = 'active' ORDER BY id ASC LIMIT ? OFFSET ?`)
    .bind(k.val, limit, offset)
    .all();
  return results || [];
}

// ---- Campaigns -------------------------------------------------------------

export async function createCampaign(db, projectKey, { subject = '', body_html = '', blog_post_id = null, from_name = '', reply_to = '' } = {}) {
  const k = keyCol(projectKey);
  return db
    .prepare(
      `INSERT INTO newsletter_campaigns (${k.col}, subject, body_html, blog_post_id, from_name, reply_to, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?) RETURNING *`
    )
    .bind(k.val, subject, body_html, blog_post_id, from_name, reply_to, nowSec())
    .first();
}

export async function getCampaignById(db, projectKey, id) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM newsletter_campaigns WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

export async function listCampaigns(db, projectKey, { limit = 100 } = {}) {
  const k = keyWhere(projectKey);
  const { results } = await db
    .prepare(`SELECT * FROM newsletter_campaigns WHERE ${k.sql} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .bind(k.val, limit)
    .all();
  return results || [];
}

const CAMPAIGN_FIELDS = ['subject', 'body_html', 'blog_post_id', 'from_name', 'reply_to', 'status', 'recipient_count', 'sent_at'];

export async function updateCampaign(db, projectKey, id, updates) {
  const k = keyWhere(projectKey);
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    if (CAMPAIGN_FIELDS.includes(key)) { fields.push(`${key} = ?`); values.push(value); }
  }
  if (!fields.length) return getCampaignById(db, projectKey, id);
  values.push(k.val, id);
  return db
    .prepare(`UPDATE newsletter_campaigns SET ${fields.join(', ')} WHERE ${k.sql} AND id = ? RETURNING *`)
    .bind(...values)
    .first();
}
