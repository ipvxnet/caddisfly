-- 038: booking reminder cron — reminded_at marks a visitor reminder as sent
-- (atomic claim: UPDATE … WHERE reminded_at IS NULL, so the hourly cron can
-- never double-send even if runs overlap).
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/038_booking_reminders.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/038_booking_reminders.sql

ALTER TABLE bookings ADD COLUMN reminded_at INTEGER;
