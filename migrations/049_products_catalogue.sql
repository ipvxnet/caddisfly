-- 049_products_catalogue.sql
-- Catalogue plugin (Phase B): extend products into rich, categorized catalogue
-- items. The base shop ignores these columns; the catalogue presentation reads
-- them. See PLUGIN_PLATFORM_DESIGN.md §10.
--
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT '';      -- catalogue section grouping
ALTER TABLE products ADD COLUMN body TEXT NOT NULL DEFAULT '';          -- md-lite rich detail (blog-style)
ALTER TABLE products ADD COLUMN media_json TEXT NOT NULL DEFAULT '';    -- {gallery:[],videos:[],files:[{name,url}],links:[{label,url}]}
ALTER TABLE products ADD COLUMN for_sale INTEGER NOT NULL DEFAULT 1;    -- 0 = info-only (no Buy now)

CREATE INDEX IF NOT EXISTS idx_products_category ON products(ai_project_id, project_id, category);
