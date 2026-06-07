-- 028: domain auto-renewal tracking.
-- renewal_attempts: consecutive failed charge attempts (dunning backoff; reset
--   to 0 on a successful renewal).
-- renewal_last_at: unix ts of the last cron action for this order (charge
--   attempt OR expiry reminder) — daily dedup so one run per day per domain.
ALTER TABLE domain_orders ADD COLUMN renewal_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE domain_orders ADD COLUMN renewal_last_at INTEGER;
