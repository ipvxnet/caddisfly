-- 053_leads.sql
-- Caddisfly's OWN outbound-sales CRM (admin area) — prospect businesses to pitch
-- the platform to. Distinct from the per-customer CRM plugin (crm_contacts).
-- Populated by the lead-gen script (Google Places + site scrape) via the ingest
-- endpoint, managed at /admin/leads.
--
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',          -- e.g. 'Orlando, FL' | 'Melbourne, FL'
  vertical TEXT NOT NULL DEFAULT '',      -- e.g. 'restaurant' | 'salon'
  place_id TEXT NOT NULL DEFAULT '',      -- Google Places id (dedup key)
  rating REAL,                            -- Places rating (social proof / fit)
  has_site INTEGER NOT NULL DEFAULT 0,    -- 1 = already has a website (lower-fit);
                                          -- 0 = NO site → the best Caddisfly target
  status TEXT NOT NULL DEFAULT 'new',     -- new|contacted|interested|won|lost
  promo_code TEXT NOT NULL DEFAULT '',    -- code sent to this lead
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'places',  -- places|manual|...
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Dedup on Google place_id (only when present — manual leads can have none).
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_place ON leads(place_id) WHERE place_id <> '';
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_area ON leads(area);
