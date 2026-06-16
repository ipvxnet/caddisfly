-- 044_build_grants.sql
-- Per-browser "draft editing" capability for the no-account build flow.
--
-- The builder URL holds only the public project_id (not a secret), so link
-- possession alone must NOT grant edit access. On anonymous create we set a
-- first-party httpOnly cookie (cf_build) holding a random per-browser token and
-- record its hash here against the project. project-access.js grants the
-- 'draft' role only when the request carries a token whose hash matches a row
-- for that project. Publishing/destructive actions still require a verified
-- billing session (owner/team) — drafts can edit but not publish.

CREATE TABLE IF NOT EXISTS build_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,   -- public id (ai_projects.project_id or projects.preview_id)
  token_hash TEXT NOT NULL,   -- sha-256 hex of the cf_build cookie token
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_build_grants_lookup ON build_grants(project_id, token_hash);
