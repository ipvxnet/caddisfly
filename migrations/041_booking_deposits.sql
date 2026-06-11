-- 041: booking deposits — per-service fixed deposit amount. When set (and
-- require_payment is on), Stripe Checkout charges the DEPOSIT instead of the
-- full price; the remainder is settled in person. Cancellation policy rides
-- the existing cutoff guard: self-cancel before the cutoff auto-refunds the
-- deposit, inside it the deposit stays (owner decides from the inbox).
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/041_booking_deposits.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/041_booking_deposits.sql

ALTER TABLE booking_services ADD COLUMN deposit_cents INTEGER;
