-- Migration 046: Page hierarchy for nested / dropdown navigation menus.
-- ADDITIVE only (ADD COLUMN), safe on the shared preview/production DB.
--
-- parent_id: a page can nest under another page (ONE level — parent → children).
--            NULL = top-level. Drives dropdown submenus in the navbar.
-- is_group:  1 = a label-only menu group (a dropdown header with no page of its
--            own); its children are the dropdown items. 0 = a normal page.
--
-- Apply manually to BOTH databases:
--   npx wrangler d1 execute caddisfly-db      --remote --file=./migrations/046_page_hierarchy.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/046_page_hierarchy.sql

ALTER TABLE ai_pages ADD COLUMN parent_id INTEGER;          -- -> ai_pages.id (NULL = top-level)
ALTER TABLE ai_pages ADD COLUMN is_group  INTEGER NOT NULL DEFAULT 0; -- 1 = label-only dropdown header

CREATE INDEX IF NOT EXISTS idx_ai_pages_parent ON ai_pages(parent_id);
