-- Migration 047: per-page opt-in to expose that page's sections as its submenu.
-- ADDITIVE (ADD COLUMN), safe on the shared preview/production DB.
--
-- show_sections_in_nav: 1 = the page's in-page sections appear as dropdown items
-- under its menu entry (Phase 2 of the configurable menu). 0 (default) = today's
-- behavior. Per-section hide/label is stored in the section content_json
-- (_nav_hidden / _nav_label) and needs no schema change.
--
-- Apply manually to BOTH databases:
--   npx wrangler d1 execute caddisfly-db      --remote --file=./migrations/047_page_sections_in_nav.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/047_page_sections_in_nav.sql

ALTER TABLE ai_pages ADD COLUMN show_sections_in_nav INTEGER NOT NULL DEFAULT 0;
