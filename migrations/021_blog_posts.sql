-- Migration: Blog v1 — AI-drafted posts per site (Wix-gap Tier-1 item).
-- Bridge-aware like ai_pages: exactly one of ai_project_id XOR project_id is set
-- (app-enforced). Content is "markdown-lite" text rendered to HTML by
-- src/utils/md-lite.js. Published posts are baked to R2 at deploy time
-- (blog.html + blog/<slug>.html) alongside the site's pages. Additive — safe on
-- the shared preview DB.
--
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/021_blog_posts.sql
--   (preview); caddisfly-db-prod at cutover. (--local for local dev)

CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,          -- bridge: AI-builder project (XOR project_id)
  project_id INTEGER,             -- bridge: refactor project
  slug TEXT NOT NULL,             -- unique per project (app-enforced)
  title TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  content TEXT NOT NULL DEFAULT '',   -- markdown-lite source
  cover_image TEXT DEFAULT '',        -- URL (preview-asset or external)
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  published_at INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_ai_project ON blog_posts(ai_project_id, status, published_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_project ON blog_posts(project_id, status, published_at);
