-- 042: scheduled holiday/seasonal themes (user-requested 2026-06-08).
-- Per-site opt-in JSON: { enabled, holidays: ['christmas',…], applied:
-- { holiday, prev_primary, prev_secondary } | null }. The daily cron applies
-- a holiday COLOR SKIN when a selected holiday's window opens (saving the
-- prior colors), reverts when it closes, and republishes the site each way.
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/042_holiday_themes.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/042_holiday_themes.sql

ALTER TABLE ai_website_configs ADD COLUMN holiday_themes_json TEXT;
