-- Migration: Phase 7 - Multi-page support (builder + preview)
-- Adds a pages model so a project can have multiple pages with their own sections.
-- All changes are ADDITIVE (CREATE TABLE / ALTER TABLE ADD COLUMN / CREATE INDEX),
-- with NO data mutation, so they are safe on the shared preview/production DB.
-- Existing single-page projects upgrade lazily in app code (ensurePagesForProject):
-- a 'home' page is created on first open and NULL-page body sections are adopted.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/007_multi_page.sql
--   (use --local for local dev)

-- Pages belong to a project via the same bridge as ai_sections:
-- ai_project_id (AI builder) XOR project_id (refactoring). Exactly one is set.
CREATE TABLE IF NOT EXISTS ai_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,                       -- AI builder flow (-> ai_projects.id)
  project_id INTEGER,                          -- refactoring flow (-> projects.id)
  slug TEXT NOT NULL,                          -- URL slug within the site, e.g. 'home', 'about'
  title TEXT,                                  -- page <title> (future SEO)
  nav_label TEXT,                              -- label shown in the nav menu
  page_order INTEGER NOT NULL DEFAULT 0,       -- nav ordering (home first)
  is_home INTEGER NOT NULL DEFAULT 0,          -- exactly one home page per project
  is_visible INTEGER NOT NULL DEFAULT 1,       -- show in nav
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Section -> page link (global ai_pages.id; needs no bridge).
-- NULL = site-level (header/footer) or legacy/unassigned (folded into home).
ALTER TABLE ai_sections ADD COLUMN page_id INTEGER;

-- Slug is unique within a project on each side of the bridge.
-- (SQLite treats multiple NULLs as distinct, so rows on the other side don't collide.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_pages_ai_slug   ON ai_pages(ai_project_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_pages_proj_slug ON ai_pages(project_id, slug);
CREATE INDEX        IF NOT EXISTS idx_ai_pages_ai_order   ON ai_pages(ai_project_id, page_order);
CREATE INDEX        IF NOT EXISTS idx_ai_pages_proj_order ON ai_pages(project_id, page_order);
CREATE INDEX        IF NOT EXISTS idx_ai_sections_page    ON ai_sections(page_id);
