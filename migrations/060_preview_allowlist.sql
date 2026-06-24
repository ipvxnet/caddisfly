-- 060_preview_allowlist.sql
-- Allowlist that gates PUBLISHING on the PREVIEW worker only (ENVIRONMENT=preview).
-- An entry is a full email OR a domain ('@live.com' or 'live.com'). NO effect on
-- production (the gate is env-guarded). Manage via /admin/preview-access.
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

CREATE TABLE IF NOT EXISTS preview_allowlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry TEXT NOT NULL UNIQUE,            -- lowercased: full email OR domain (leading @ optional)
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO preview_allowlist (entry) VALUES
  ('fabianof.oliveira@gmail.com'),
  ('@live.com'),
  ('fernando4vr@gmail.com'),
  ('webdesigner@caddisfly.ai');
