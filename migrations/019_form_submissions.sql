-- Migration: Forms backend — contact-form submissions for published sites.
-- One row per submission, keyed by public_id like site_events (the sites worker
-- is DB-free; published forms POST cross-origin to the app worker's
-- /api/forms/submit, same pattern as the analytics beacon).
-- visitor_hash is the same daily per-site pseudonymous hash analytics uses
-- (sha256 of site|day|ip|ua) — used ONLY for spam rate-limiting, never
-- reversible to an IP. Additive — safe on the shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/019_form_submissions.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

CREATE TABLE IF NOT EXISTS form_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL,        -- published site id (matches /site/<id>)
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  page_path TEXT DEFAULT '',      -- page the form was submitted from
  visitor_hash TEXT,              -- daily per-site pseudonymous key (spam guard)
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_site ON form_submissions(public_id, created_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_unread ON form_submissions(public_id, is_read);
