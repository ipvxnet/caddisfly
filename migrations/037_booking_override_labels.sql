-- 037: booking v1.1 — label on date overrides so the one-click holiday
-- presets read as "2026-12-25 — Christmas" instead of a bare date.
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/037_booking_override_labels.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/037_booking_override_labels.sql

ALTER TABLE booking_overrides ADD COLUMN label TEXT;
