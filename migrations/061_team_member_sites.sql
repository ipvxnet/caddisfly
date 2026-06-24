-- Per-site team-member access scope.
--
-- A team member is account-level (team_members, keyed by owner_email) and by
-- default can access ALL of the owner's sites. This table OPTIONALLY narrows a
-- member to specific sites: if a (owner_email, member_email) pair has ANY rows
-- here, their access is limited to exactly those sites; if it has NO rows, they
-- keep full-account access (backward compatible).
--
-- Bridge pattern: each row points at ONE site via ai_project_id XOR project_id
-- (mirrors site_managers / other per-site tables).

CREATE TABLE IF NOT EXISTS team_member_sites (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email   TEXT NOT NULL,
  member_email  TEXT NOT NULL,
  ai_project_id INTEGER,
  project_id    INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tms_member ON team_member_sites (owner_email, member_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tms_ai
  ON team_member_sites (owner_email, member_email, ai_project_id) WHERE ai_project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tms_rg
  ON team_member_sites (owner_email, member_email, project_id) WHERE project_id IS NOT NULL;
