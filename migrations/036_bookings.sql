-- 036: booking engine v1 (core loop). Service types + weekly hours + per-date
-- overrides + bookings. Double-booking is prevented by an ATOMIC claim
-- (INSERT … SELECT … WHERE NOT EXISTS overlap) in src/db/bookings.js — no
-- separate slots table; slots are computed from hours/overrides at read time.
-- Times are stored in the OWNER's timezone (date 'YYYY-MM-DD' + minutes from
-- midnight); the timezone itself lives with lead time / max-per-day in
-- ai_website_configs.booking_settings_json (added here, social precedent).
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/036_bookings.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/036_bookings.sql

CREATE TABLE IF NOT EXISTS booking_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,          -- XOR project_id (bridge pattern)
  project_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER NOT NULL DEFAULT 30,
  buffer_min INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER,            -- display-only in v1 (paid bookings = fast-follow)
  currency TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bsvc_ai ON booking_services(ai_project_id, active);
CREATE INDEX IF NOT EXISTS idx_bsvc_p ON booking_services(project_id, active);

-- Weekly recurring availability, owner-timezone minutes from midnight.
-- Multiple windows per weekday allowed (0=Sunday … 6=Saturday).
CREATE TABLE IF NOT EXISTS booking_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,
  project_id INTEGER,
  weekday INTEGER NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bhr_ai ON booking_hours(ai_project_id, weekday);
CREATE INDEX IF NOT EXISTS idx_bhr_p ON booking_hours(project_id, weekday);

-- Per-date exceptions: closed all day, or replace that day's weekly windows.
CREATE TABLE IF NOT EXISTS booking_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,
  project_id INTEGER,
  date TEXT NOT NULL,             -- YYYY-MM-DD (owner timezone)
  closed INTEGER NOT NULL DEFAULT 1,
  start_min INTEGER,              -- set when closed=0 (custom window)
  end_min INTEGER
);
CREATE INDEX IF NOT EXISTS idx_bovr_ai ON booking_overrides(ai_project_id, date);
CREATE INDEX IF NOT EXISTS idx_bovr_p ON booking_overrides(project_id, date);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,
  project_id INTEGER,
  service_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  note TEXT,
  date TEXT NOT NULL,             -- YYYY-MM-DD (owner timezone)
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,       -- includes the service buffer
  status TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | cancelled
  cancel_token TEXT NOT NULL UNIQUE,
  visitor_tz TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bkg_ai ON bookings(ai_project_id, date, status);
CREATE INDEX IF NOT EXISTS idx_bkg_p ON bookings(project_id, date, status);
CREATE INDEX IF NOT EXISTS idx_bkg_token ON bookings(cancel_token);

ALTER TABLE ai_website_configs ADD COLUMN booking_settings_json TEXT;
