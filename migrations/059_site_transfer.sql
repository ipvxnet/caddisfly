-- 059_site_transfer.sql
-- Website transfer to another email + per-site Manager/Builder delegate grants.
-- Ownership is the single source of all plan-gating (credits, plugins, limits all
-- key off customer_email), so a transfer = flip customer_email; a Manager is a
-- delegate whose actions still resolve to the owner. See TRANSFER_DESIGN.
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

-- A transfer of a site's ownership to another email (invite + lifecycle).
CREATE TABLE IF NOT EXISTS site_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,                              -- bridge: the site being transferred
  project_id INTEGER,
  from_email TEXT NOT NULL,                           -- current owner (lowercased)
  to_email TEXT NOT NULL,                             -- recipient (lowercased)
  keep_builder_access INTEGER NOT NULL DEFAULT 0,     -- 1 = from_email becomes a Manager after transfer
  requirements_json TEXT NOT NULL DEFAULT '{}',       -- snapshot { base, domain, plugins:[...] } the recipient must meet
  status TEXT NOT NULL DEFAULT 'pending',             -- pending | accepted | declined | cancelled | expired
  token TEXT NOT NULL,                                -- accept-link token (unguessable)
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,                        -- created_at + 7 days
  accepted_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_transfers_token ON site_transfers(token);
CREATE INDEX IF NOT EXISTS idx_site_transfers_ai ON site_transfers(ai_project_id);
CREATE INDEX IF NOT EXISTS idx_site_transfers_proj ON site_transfers(project_id);
CREATE INDEX IF NOT EXISTS idx_site_transfers_to ON site_transfers(to_email, status);

-- Per-site Manager/Builder delegate (the result of "keep builder access"). A
-- "managed" site counts toward the manager's site limit; the manager edits/
-- publishes/manages domains but all entitlement + credit checks resolve to the
-- site OWNER (so no feature inheritance). Distinct from account-level team_members.
CREATE TABLE IF NOT EXISTS site_managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,                              -- bridge: the managed site
  project_id INTEGER,
  manager_email TEXT NOT NULL,                        -- the delegate (lowercased)
  role TEXT NOT NULL DEFAULT 'manager',               -- 'manager' (full) — reserved for future roles
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_managers_ai ON site_managers(ai_project_id, manager_email) WHERE ai_project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_managers_proj ON site_managers(project_id, manager_email) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_managers_email ON site_managers(manager_email);
