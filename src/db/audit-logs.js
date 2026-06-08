// Audit-log data layer (see migrations/029_audit_logs.sql). Append-only:
// insert + read/filter only — no update or delete is exposed by design.

export async function insertAuditLog(db, e) {
  return db
    .prepare(
      `INSERT INTO audit_logs
         (user_email, team_owner_email, action, resource_type, resource_id, resource_name, status, error, metadata, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      e.user_email,
      e.team_owner_email,
      e.action,
      e.resource_type ?? null,
      e.resource_id ?? null,
      e.resource_name ?? null,
      e.status || 'success',
      e.error ?? null,
      e.metadata ? JSON.stringify(e.metadata) : null,
      e.ip ?? null
    )
    .run();
}

/**
 * Query logs with optional scope + filters + free-text search + paging.
 * @param {object} opts - { teamOwner?, action?, status?, q?, limit?, offset? }
 *   teamOwner omitted = ALL logs (SaaS admin); set = one team's logs.
 */
export async function queryAuditLogs(db, opts = {}) {
  const where = [];
  const binds = [];
  if (opts.teamOwner) { where.push('team_owner_email = ?'); binds.push(opts.teamOwner); }
  if (opts.action) { where.push('action = ?'); binds.push(opts.action); }
  if (opts.status) { where.push('status = ?'); binds.push(opts.status); }
  if (opts.q) {
    const like = `%${opts.q}%`;
    where.push('(user_email LIKE ? OR resource_name LIKE ? OR resource_id LIKE ? OR action LIKE ?)');
    binds.push(like, like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(200, Math.max(1, parseInt(opts.limit, 10) || 100));
  const offset = Math.max(0, parseInt(opts.offset, 10) || 0);
  const { results } = await db
    .prepare(`SELECT * FROM audit_logs ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset)
    .all();
  return results || [];
}

/** Distinct action values for filter dropdowns (optionally team-scoped). */
export async function distinctAuditActions(db, teamOwner) {
  const sql = teamOwner
    ? 'SELECT DISTINCT action FROM audit_logs WHERE team_owner_email = ? ORDER BY action'
    : 'SELECT DISTINCT action FROM audit_logs ORDER BY action';
  const stmt = db.prepare(sql);
  const { results } = await (teamOwner ? stmt.bind(teamOwner) : stmt).all();
  return (results || []).map((r) => r.action);
}
