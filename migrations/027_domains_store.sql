-- 027: Namecheap domain reselling — orders + wholesale price cache.
--
-- domain_orders: one row per purchase attempt. Payment happens FIRST (Stripe),
-- registration after (webhook/receipt waitUntil) — `status` tracks the gap:
--   pending → paid → registered | failed (failed = paid but not registered:
--   ops alert + refund path; never silently swallowed).
-- The Stripe customer + payment method are saved for off-session auto-renewal.
CREATE TABLE IF NOT EXISTS domain_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_email TEXT NOT NULL,
  -- optional site binding for auto-connect (bridge pattern, like products)
  ai_project_id INTEGER,
  project_id INTEGER,
  domain TEXT NOT NULL,
  years INTEGER NOT NULL DEFAULT 1,
  wholesale_cents INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | paid | registered | failed | refunded
  error TEXT,                                  -- last failure detail (ops)
  registrant_json TEXT,                        -- ICANN contact used at registration
  nc_domain_id TEXT,
  nc_transaction_id TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 1,
  registered_at INTEGER,
  expires_at INTEGER,                          -- unix; drives renewal checks
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_domain_orders_email ON domain_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_domain_orders_status ON domain_orders(status);
CREATE INDEX IF NOT EXISTS idx_domain_orders_expires ON domain_orders(expires_at);

-- Wholesale price cache (refreshed at most daily from users.getPricing — the
-- pricing call is slow/huge; search quotes read from here).
CREATE TABLE IF NOT EXISTS domain_prices (
  tld TEXT PRIMARY KEY,
  register_cents INTEGER NOT NULL,
  renew_cents INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
