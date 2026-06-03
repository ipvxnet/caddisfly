// Custom-domain records (see migrations/013_custom_domains.sql). Bridge-aware
// (ai_project_id XOR project_id), mirroring ai_sections / ai_pages.

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function whereKey(projectKey) {
  return projectKey.aiProjectId
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}

/** All domains for a project. */
export async function getDomainsByProject(db, projectKey) {
  const w = whereKey(projectKey);
  const res = await db
    .prepare(`SELECT * FROM custom_domains WHERE ${w.sql} ORDER BY created_at ASC`)
    .bind(w.val)
    .all();
  return res.results || [];
}

/** Count domains for a project (for the per-tier cap). */
export async function countDomainsByProject(db, projectKey) {
  const w = whereKey(projectKey);
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM custom_domains WHERE ${w.sql}`)
    .bind(w.val)
    .first();
  return (row && row.n) || 0;
}

export async function getDomainById(db, id) {
  return db.prepare('SELECT * FROM custom_domains WHERE id = ?').bind(id).first();
}

export async function getDomainByHostname(db, hostname) {
  return db.prepare('SELECT * FROM custom_domains WHERE hostname = ?').bind(hostname).first();
}

/** Create a domain record. */
export async function createDomain(db, projectKey, data) {
  const now = nowSec();
  const res = await db
    .prepare(
      `INSERT INTO custom_domains
         (ai_project_id, project_id, hostname, subdomain, status, cf_hostname_id,
          ssl_status, cname_target, dcv_type, dcv_name, dcv_value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      projectKey.aiProjectId || null,
      projectKey.projectId || null,
      data.hostname,
      data.subdomain,
      data.status || 'pending',
      data.cf_hostname_id || null,
      data.ssl_status || null,
      data.cname_target || null,
      data.dcv_type || null,
      data.dcv_name || null,
      data.dcv_value || null,
      now,
      now
    )
    .first();
  return res;
}

const UPDATABLE = ['status', 'cf_hostname_id', 'ssl_status', 'cname_target', 'dcv_type', 'dcv_name', 'dcv_value', 'last_error'];

export async function updateDomain(db, id, fields) {
  const cols = UPDATABLE.filter((c) => fields[c] !== undefined);
  if (cols.length === 0) return getDomainById(db, id);
  const set = cols.map((c) => `${c} = ?`).join(', ');
  await db
    .prepare(`UPDATE custom_domains SET ${set}, updated_at = ? WHERE id = ?`)
    .bind(...cols.map((c) => fields[c]), nowSec(), id)
    .run();
  return getDomainById(db, id);
}

export async function deleteDomain(db, id) {
  await db.prepare('DELETE FROM custom_domains WHERE id = ?').bind(id).run();
}
