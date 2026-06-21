-- 051_advanced_store.sql
-- Advanced Store plugin (#3): inventory + variants + discount codes. The base
-- store ignores these; advanced features are gated by pluginGate('advanced_store').
-- See advanced-store-plugin.md.
--
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

-- Inventory: per-product stock. NULL = untracked/unlimited; 0 = out of stock.
ALTER TABLE products ADD COLUMN stock INTEGER;

-- Variants: a flat list per product (label e.g. "Large / Red"), each with its
-- own price + stock. A product "has variants" when it has >= 1 active row.
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,                  -- bridge (XOR project_id)
  project_id INTEGER,
  product_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0, -- the variant's price (overrides product price)
  stock INTEGER,                          -- NULL = untracked
  sku TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id, active, sort_order);

-- Discount codes applied at checkout (percent or fixed minor-units).
CREATE TABLE IF NOT EXISTS store_discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,                  -- bridge (XOR project_id)
  project_id INTEGER,
  code TEXT NOT NULL,                     -- case-insensitive (stored lowercased)
  kind TEXT NOT NULL DEFAULT 'percent',  -- percent | fixed
  value INTEGER NOT NULL DEFAULT 0,      -- percent: 1-100; fixed: minor units
  active INTEGER NOT NULL DEFAULT 1,
  max_uses INTEGER,                       -- NULL = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,                     -- NULL = no expiry
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_ai_code ON store_discounts(ai_project_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_proj_code ON store_discounts(project_id, code);
