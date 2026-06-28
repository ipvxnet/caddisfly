// Members/Auth plugin data layer — see migrations/070_site_members.sql.
// Bridge-aware like courses.js/products.js: projectKey is { aiProjectId } XOR
// { projectId }. A "member" is a visitor account on the merchant's published
// site (NOT a Caddisfly dashboard user). Sessions/magic-links are stateless
// signed tokens (utils/member-session.js); this table is just the roster.
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

/**
 * Upsert a member by (site, email) and stamp last_login_at. Returns the row.
 * Called on a successful magic-link login. ON CONFLICT names the partial unique
 * index's WHERE so it matches the right index (gotcha: PARTIAL unique index
 * conflict targets must repeat the WHERE — see site-transfer.js).
 */
export async function upsertMember(db, projectKey, { email, name = '' } = {}) {
  const k = keyCol(projectKey);
  const e = normEmail(email);
  const ts = nowSec();
  await db
    .prepare(
      `INSERT INTO site_members (${k.col}, email, name, status, created_at, last_login_at)
       VALUES (?, ?, ?, 'active', ?, ?)
       ON CONFLICT(${k.col}, email) WHERE ${k.col} IS NOT NULL
       DO UPDATE SET last_login_at = excluded.last_login_at,
                     name = CASE WHEN excluded.name != '' THEN excluded.name ELSE site_members.name END`
    )
    .bind(k.val, e, name, ts, ts)
    .run();
  return getMemberByEmail(db, projectKey, e);
}

/** A single member by email (or null). */
export async function getMemberByEmail(db, projectKey, email) {
  const k = keyWhere(projectKey);
  return db
    .prepare(`SELECT * FROM site_members WHERE ${k.sql} AND email = ?`)
    .bind(k.val, normEmail(email))
    .first();
}

/** All members for a site, newest signup first. */
export async function listMembers(db, projectKey, { limit = 1000 } = {}) {
  const k = keyWhere(projectKey);
  const res = await db
    .prepare(`SELECT * FROM site_members WHERE ${k.sql} ORDER BY created_at DESC LIMIT ?`)
    .bind(k.val, limit)
    .all();
  return res.results || [];
}

/** Member count for a site (for the dashboard badge). */
export async function countMembers(db, projectKey) {
  const k = keyWhere(projectKey);
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM site_members WHERE ${k.sql}`)
    .bind(k.val)
    .first();
  return (row && row.n) || 0;
}

/** Block / unblock a member (merchant moderation). */
export async function setMemberStatus(db, projectKey, email, status) {
  const k = keyWhere(projectKey);
  const s = status === 'blocked' ? 'blocked' : 'active';
  await db
    .prepare(`UPDATE site_members SET status = ? WHERE ${k.sql} AND email = ?`)
    .bind(s, k.val, normEmail(email))
    .run();
}

/** Remove a member entirely. */
export async function deleteMember(db, projectKey, email) {
  const k = keyWhere(projectKey);
  await db
    .prepare(`DELETE FROM site_members WHERE ${k.sql} AND email = ?`)
    .bind(k.val, normEmail(email))
    .run();
}
