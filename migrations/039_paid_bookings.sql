-- 039: paid bookings (Stripe Connect, direct charges on the merchant account).
-- Per-service "require payment at booking" toggle (Starter+); a paid booking
-- is created as a PENDING HOLD (status='pending', expires_at ~30min) that
-- blocks the slot during Stripe Checkout, then flips to confirmed on payment
-- (receipt page or Connect-webhook backstop, idempotent). Cancellations of
-- paid bookings auto-refund on the connected account.
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/039_paid_bookings.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/039_paid_bookings.sql

ALTER TABLE booking_services ADD COLUMN require_payment INTEGER NOT NULL DEFAULT 0;

ALTER TABLE bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'none';
-- none | pending | paid | refunded | refund_failed | expired
ALTER TABLE bookings ADD COLUMN stripe_session_id TEXT;
ALTER TABLE bookings ADD COLUMN payment_intent TEXT;
ALTER TABLE bookings ADD COLUMN amount_cents INTEGER;
ALTER TABLE bookings ADD COLUMN currency TEXT;
ALTER TABLE bookings ADD COLUMN expires_at INTEGER;  -- pending-hold TTL (unix)

CREATE UNIQUE INDEX IF NOT EXISTS idx_bkg_session ON bookings(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
