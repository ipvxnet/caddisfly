-- Migration: Phase 13 - Custom domains (Cloudflare for SaaS)
-- Lets paid customers point their own domain at a published site. The lean
-- caddisfly-sites worker resolves a custom Host via an R2 pointer
-- (domains/<hostname> -> subdomain), so it stays DB-free; this table is the
-- app-side record + Cloudflare custom-hostname state. Additive — safe on the
-- shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/013_custom_domains.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

CREATE TABLE IF NOT EXISTS custom_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,                 -- bridge: AI builder XOR
  project_id INTEGER,                    --         refactor project
  hostname TEXT NOT NULL UNIQUE,         -- e.g. www.acme.com (lowercased)
  subdomain TEXT NOT NULL,               -- the site's *.caddisfly.app subdomain it maps to
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | error | deleting
  cf_hostname_id TEXT,                   -- Cloudflare custom_hostname id
  ssl_status TEXT,                       -- pending_validation | active | …
  -- DNS records the customer must add (CNAME to point + optional TXT for DCV/ownership)
  cname_target TEXT,
  dcv_type TEXT,
  dcv_name TEXT,
  dcv_value TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_hostname ON custom_domains(hostname);
CREATE INDEX IF NOT EXISTS idx_custom_domains_ai_project ON custom_domains(ai_project_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_project ON custom_domains(project_id);
