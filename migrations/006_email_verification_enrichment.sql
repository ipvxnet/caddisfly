-- Migration: Phase 6 - Email verification + Google Places enrichment
-- Gates paid Google Places enrichment behind email verification.
-- All changes are ADDITIVE (ALTER TABLE ADD COLUMN) so they are safe to apply
-- to the existing (shared preview/production) database without affecting rows.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/006_email_verification_enrichment.sql
--   (use --local for local dev)

-- Email verification state on the refactoring `projects` table
ALTER TABLE projects ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN verification_token TEXT;
ALTER TABLE projects ADD COLUMN verification_sent_at INTEGER;
ALTER TABLE projects ADD COLUMN verified_at INTEGER;

-- Enrichment state + cached results (so re-generation never re-calls the paid API)
ALTER TABLE projects ADD COLUMN enrichment_status TEXT;        -- pending | running | complete | failed | skipped
ALTER TABLE projects ADD COLUMN place_id TEXT;                 -- Google Places place_id (cache/debug)
ALTER TABLE projects ADD COLUMN company_profile_json TEXT;     -- merged scrape + Places profile used for generation

-- Look up a project by its single-use verification token
CREATE INDEX IF NOT EXISTS idx_projects_verification_token ON projects(verification_token);
