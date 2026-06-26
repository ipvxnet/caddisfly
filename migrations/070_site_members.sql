-- 070_site_members.sql
-- Members/Auth plugin v1 — per-published-site visitor accounts (NOT Caddisfly
-- dashboard users). A visitor signs in with a magic link on the merchant's site;
-- the merchant sees the member list in the dashboard. Sessions + magic-link
-- tokens are STATELESS HMAC-signed tokens (utils/signed-token.js) — no rows here.
-- This is the keystone for Courses v2 (enrollment/progress will reference member_id).
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.
-- Bridge pattern: ai_project_id XOR project_id (member scopes via its parent site).

CREATE TABLE IF NOT EXISTS site_members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,
  project_id    INTEGER,
  email         TEXT    NOT NULL,
  name          TEXT    NOT NULL DEFAULT '',
  status        TEXT    NOT NULL DEFAULT 'active',   -- active|blocked
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at INTEGER
);

-- One member row per (site, email). Partial unique indexes per owner column so
-- the same email can be a member of two different sites.
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_members_ai_email
  ON site_members (ai_project_id, email) WHERE ai_project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_members_rg_email
  ON site_members (project_id, email)    WHERE project_id    IS NOT NULL;
