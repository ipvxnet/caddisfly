-- 040: owner iCal feed — a secret per-site token; GET /booking/feed/:token
-- serves a subscribable calendar of the site's bookings (read-only; calendar
-- apps poll it). Column on ai_website_configs (one table for both bridge
-- sides), unique where set.
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/040_booking_ical.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/040_booking_ical.sql

ALTER TABLE ai_website_configs ADD COLUMN booking_ical_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cfg_ical_token ON ai_website_configs(booking_ical_token) WHERE booking_ical_token IS NOT NULL;
