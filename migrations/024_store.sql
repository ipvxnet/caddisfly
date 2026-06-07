-- Migration: Commerce v1 — lean store (Stripe Connect + mini cart).
-- Strategy: Stripe Checkout (on the merchant's connected account) handles
-- payments/tax/shipping/PCI; we own catalog + storefront + an orders record.
-- Bridge-aware like blog_posts: exactly one of ai_project_id XOR project_id
-- is set (app-enforced). Published shop pages are baked static to R2; the
-- buy/cart flow POSTs cross-origin to the app worker (forms/analytics
-- pattern). Additive — safe on the shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/024_store.sql
--   (preview); caddisfly-db-prod at prod ship. (--local for local dev)

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,             -- bridge: AI-builder project (XOR project_id)
  project_id INTEGER,                -- bridge: refactor project
  slug TEXT NOT NULL,                -- unique per project (app-enforced)
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',   -- markdown-lite (rendered by md-lite.js)
  price_cents INTEGER NOT NULL DEFAULT 0, -- minor units; currency lives on the config
  image TEXT NOT NULL DEFAULT '',         -- URL (preview-asset or external)
  product_type TEXT NOT NULL DEFAULT 'physical',  -- physical | digital | service
  active INTEGER NOT NULL DEFAULT 1,      -- inactive products are hidden from the shop
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_products_ai_project ON products(ai_project_id, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_project ON products(project_id, active, sort_order);

-- One row per completed Stripe Checkout Session. Written by the Connect
-- webhook (checkout.session.completed) with a success-redirect retrieval as
-- backup — both paths are idempotent on stripe_session_id.
CREATE TABLE IF NOT EXISTS store_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,             -- bridge (XOR project_id)
  project_id INTEGER,
  public_id TEXT NOT NULL DEFAULT '',     -- published site id the buyer ordered from
  stripe_session_id TEXT NOT NULL UNIQUE, -- cs_… (idempotency key)
  amount_total INTEGER NOT NULL DEFAULT 0,  -- minor units, as charged
  currency TEXT NOT NULL DEFAULT 'usd',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  shipping_json TEXT NOT NULL DEFAULT '',   -- Stripe shipping_details, if collected
  items_json TEXT NOT NULL DEFAULT '[]',    -- [{product_id,name,qty,price_cents}]
  status TEXT NOT NULL DEFAULT 'paid',      -- paid | fulfilled
  is_read INTEGER NOT NULL DEFAULT 0,       -- orders-inbox unread badge (forms pattern)
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_store_orders_ai_project ON store_orders(ai_project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_store_orders_project ON store_orders(project_id, created_at);

-- Merchant's connected Stripe account (acct_…, via Connect Standard OAuth)
-- and the store's single checkout currency (one currency per Checkout Session).
ALTER TABLE ai_website_configs ADD COLUMN stripe_account_id TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_website_configs ADD COLUMN store_currency TEXT NOT NULL DEFAULT 'usd';
