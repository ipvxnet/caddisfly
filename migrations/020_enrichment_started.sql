-- Migration: enrichment build claim timestamp (refactor-flow wedge fix).
-- The verify-time build used to run via ctx.waitUntil, which Cloudflare cancels
-- ~30s after the response — long builds died mid-flight and left
-- enrichment_status='running' forever (infinite "building" page). The build now
-- runs inside a live POST /api/preview/run-build/:token request; this column
-- records when a build claimed the job so a stale 'running' (dead build) can be
-- re-claimed after a timeout. Additive — safe on the shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/020_enrichment_started.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

ALTER TABLE projects ADD COLUMN enrichment_started_at INTEGER;
