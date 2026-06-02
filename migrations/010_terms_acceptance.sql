-- Migration: Phase 10 - Record Terms of Service / Privacy acceptance
-- Stamps when a user accepted the Terms when starting to build a site. Additive
-- (ALTER TABLE ADD COLUMN) so it's safe on the shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/010_terms_acceptance.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

ALTER TABLE ai_projects ADD COLUMN terms_accepted_at INTEGER;
ALTER TABLE projects ADD COLUMN terms_accepted_at INTEGER;
