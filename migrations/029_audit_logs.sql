-- 029_audit_logs.sql — append-only audit trail of significant customer actions.
-- Team admins inspect their own team's trail; the SaaS operator sees all. No
-- updates/deletes ever (append-only by convention — nothing exposes a delete).
--   user_email        who performed the action
--   team_owner_email  team context = the billing-account owner the action
--                     belongs to (a member's action is logged under the team
--                     owner so team admins can see it; own-account actions use
--                     the actor's own email). Drives team-scoped queries.
--   action            e.g. 'site.delete', 'domain.connect', 'team.invite'
--   resource_type/id/name  what was acted on (project, domain, member…)
--   status            'success' | 'error'
--   metadata          JSON blob of extra context
-- Apply:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/029_audit_logs.sql
--   (caddisfly-db-prod at ship)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  team_owner_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  resource_name TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT,
  metadata TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_audit_team ON audit_logs(team_owner_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);
