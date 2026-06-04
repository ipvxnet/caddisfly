-- Migration: Phase 12 - Per-project subdomain (for *.caddisfly.app hosting)
-- Each published site gets a unique subdomain; the lean caddisfly-sites worker
-- serves it from R2 at sites/<subdomain>/<slug>.html (DB-free). Additive — safe
-- on the shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/012_subdomain.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

ALTER TABLE ai_projects ADD COLUMN subdomain TEXT;
ALTER TABLE projects ADD COLUMN subdomain TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_projects_subdomain ON ai_projects(subdomain);
CREATE INDEX IF NOT EXISTS idx_projects_subdomain ON projects(subdomain);
