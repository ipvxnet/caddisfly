-- 030: manual "renew now" checkout.
-- renewal_session_id holds the Stripe Checkout session id of the most recently
-- PROCESSED manual renewal. Claimed atomically (receipt page + webhook both
-- fire) so a single payment renews the domain exactly once.
ALTER TABLE domain_orders ADD COLUMN renewal_session_id TEXT;
