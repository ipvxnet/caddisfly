-- Migration: Phase 8 - Stripe billing + magic-link customer identity
-- Adds subscription/billing state keyed by customer email, plus a passwordless
-- magic-link + session mechanism so customers can manage billing without a
-- Google admin account. All changes are ADDITIVE (CREATE TABLE / CREATE INDEX)
-- so they are safe to apply to the existing (shared preview) database.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/008_billing.sql
--   (preview); for prod use caddisfly-db-prod at cutover.
--   (use --local for local dev)

-- One billing account per customer email. Tier here is the source of truth for
-- gating (getUserTier prefers it). subscription_status mirrors Stripe.
CREATE TABLE IF NOT EXISTS billing_accounts (
  email TEXT PRIMARY KEY,                       -- lowercased customer email
  stripe_customer_id TEXT,                      -- cus_...
  stripe_subscription_id TEXT,                  -- sub_...
  pricing_tier TEXT NOT NULL DEFAULT 'free_trial', -- free_trial | starter | pro | agency
  plan_interval TEXT,                           -- month | year (null on free)
  subscription_status TEXT,                     -- active | trialing | past_due | canceled | incomplete | null
  current_period_end INTEGER,                   -- unix ts of period end (Stripe)
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  ai_credits_used INTEGER NOT NULL DEFAULT 0,   -- credits spent in current period (Phase 2 ledger)
  credits_reset_at INTEGER,                     -- unix ts when ai_credits_used next resets
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_stripe_customer ON billing_accounts(stripe_customer_id);

-- Single-use magic links (15-min TTL) that prove ownership of an email and
-- mint a billing session on click. Token is a 64-char hex string.
CREATE TABLE IF NOT EXISTS billing_magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_billing_magic_links_email ON billing_magic_links(email);

-- Cookie-backed billing sessions (separate from admin `sessions`, which FK to
-- users.google_id). Keyed by email; cookie name `cf_billing`.
CREATE TABLE IF NOT EXISTS billing_sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_billing_sessions_email ON billing_sessions(email);
