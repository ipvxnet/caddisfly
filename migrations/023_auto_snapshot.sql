-- Migration: per-site auto-snapshot toggle (hourly auto-save while editing).
-- Edit-driven, not cron: state-changing edit APIs trigger an 'auto' snapshot
-- at most once per hour when this flag is on (see utils/site-snapshot.js
-- maybeAutoSnapshot). Default ON — autos never evict manual saves, so the
-- worst case on low tiers is a rolling 1-2 auto backups. Additive.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/023_auto_snapshot.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

ALTER TABLE ai_website_configs ADD COLUMN auto_snapshot INTEGER NOT NULL DEFAULT 1;
