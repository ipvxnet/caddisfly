-- Migration: Phase 11 - First-party, cookieless site analytics
-- One row per pageview on a PUBLISHED customer site. No cookies, no stored IP.
-- visitor_hash is a daily, per-site pseudonymous hash (sha256 of
-- site|day|ip|user-agent) used only to count daily uniques — it cannot track a
-- visitor across days or sites and is not reversible to an IP. Additive — safe
-- on the shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/011_site_analytics.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

CREATE TABLE IF NOT EXISTS site_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL,        -- published site id (the /site/<id>)
  day TEXT NOT NULL,              -- 'YYYY-MM-DD' (UTC)
  path TEXT,                      -- page path/slug viewed
  referrer_host TEXT,             -- referring host only (no full URL/query)
  country TEXT,                   -- CF 2-letter country code
  device TEXT,                    -- desktop | mobile | tablet
  visitor_hash TEXT,              -- daily per-site pseudonymous unique key
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_site_events_site_day ON site_events(public_id, day);
CREATE INDEX IF NOT EXISTS idx_site_events_created ON site_events(created_at);
