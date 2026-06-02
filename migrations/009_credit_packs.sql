-- Migration: Phase 9 - One-time AI credit top-ups
-- Adds a persistent purchased-credits balance to billing accounts. These are
-- bought via one-time Stripe payments (mode=payment) and, unlike the monthly
-- subscription allotment (ai_credits_used / credits_reset_at), they do NOT
-- expire on renewal. Spending (Phase 2) draws down the monthly allotment first,
-- then this balance. Additive — safe on the shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/009_credit_packs.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

ALTER TABLE billing_accounts ADD COLUMN ai_credits_purchased INTEGER NOT NULL DEFAULT 0;
