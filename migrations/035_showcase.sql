-- 035: public showroom (/showcase). Admin-curated list of example sites built on
-- the platform. Each entry points at a published project by its PUBLIC id (used
-- for the /ai-preview/<id>?embed=1 thumbnail) + a denormalized subdomain for the
-- "visit site" link. featured=1 entries rotate in the top carousel.
CREATE TABLE IF NOT EXISTS showcase_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_public_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'ai',        -- 'ai' | 'refactor' (for reference)
  subdomain TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  blurb TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_showcase_order ON showcase_entries(enabled, sort_order, id);
