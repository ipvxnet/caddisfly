-- Migration: Site version snapshots (roadmap item, spec decided 2026-06-01).
-- One row per saved version; the actual state lives in R2 as a FULL JSON blob
-- (snapshots/<publicId>/<ts>.json — pages + sections + config; NOT diffs, and
-- deliberately NOT blog posts, which have their own lifecycle). Bridge-aware
-- like ai_pages. Retention is enforced per tier at create time (prune oldest).
-- Additive — safe on the shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/022_snapshots.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

CREATE TABLE IF NOT EXISTS ai_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,          -- bridge: AI-builder project (XOR project_id)
  project_id INTEGER,             -- bridge: refactor project
  label TEXT DEFAULT '',          -- user-given name ('' = unnamed)
  trigger_type TEXT NOT NULL DEFAULT 'manual',  -- manual | pre_restore
  r2_path TEXT NOT NULL,          -- snapshots/<publicId>/<ts>.json
  size_bytes INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ai_snapshots_ai_project ON ai_snapshots(ai_project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_project ON ai_snapshots(project_id, created_at);
