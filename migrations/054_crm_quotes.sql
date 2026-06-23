-- 054_crm_quotes.sql
-- CRM plugin: Quotation & Order Management. A quote belongs to a CRM contact
-- (by email) and a project (bridge pattern: ai_project_id XOR project_id). Line
-- items live in crm_quote_items. An accepted quote becomes an "order" via the
-- fulfillment column (no separate orders table). SEPARATE from Stripe
-- store_orders (those are online-shop checkouts). See PLUGIN_PLATFORM_DESIGN.md.
--
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

CREATE TABLE IF NOT EXISTS crm_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,                       -- bridge: AI-builder project (XOR project_id)
  project_id INTEGER,                          -- bridge: refactor project
  contact_email TEXT NOT NULL,                 -- the CRM contact (lowercased)
  title TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',        -- draft | sent | accepted | rejected | expired
  fulfillment TEXT NOT NULL DEFAULT 'unfulfilled', -- unfulfilled | fulfilled | cancelled (accepted quotes)
  valid_until INTEGER,                         -- unix sec, nullable
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_crm_quotes_ai ON crm_quotes(ai_project_id, contact_email);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_proj ON crm_quotes(project_id, contact_email);

CREATE TABLE IF NOT EXISTS crm_quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_crm_quote_items_quote ON crm_quote_items(quote_id);
