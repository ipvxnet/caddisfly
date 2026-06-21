-- 048_account_plugins.sql
-- Plugin platform — per-account entitlements for paid feature-module "plugins"
-- (Stripe subscription add-ons). Source of truth is Stripe; this table mirrors
-- it via the billing webhook. See PLUGIN_PLATFORM_DESIGN.md.
--
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

CREATE TABLE IF NOT EXISTS account_plugins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,                     -- billing account (billing_accounts.email)
  plugin_key TEXT NOT NULL,                -- 'catalogue' | 'crm' | 'advanced_store' | ...
  status TEXT NOT NULL DEFAULT 'active',   -- active | canceling | canceled
  stripe_item_id TEXT,                     -- si_… (the subscription item) for sync/removal
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  current_period_end INTEGER,              -- paid-through (unix ts); grace extends past this
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_plugins_uniq ON account_plugins(email, plugin_key);
CREATE INDEX IF NOT EXISTS idx_account_plugins_email ON account_plugins(email);
