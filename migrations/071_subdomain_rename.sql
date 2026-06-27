-- 071_subdomain_rename.sql
-- One-time custom subdomain rename for *.caddisfly.app sites. A user may change
-- their site address ONCE; this column records when (NULL = never renamed = still
-- allowed). Applies to both AI-builder and refactor projects (bridge pattern).
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

ALTER TABLE ai_projects ADD COLUMN subdomain_changed_at INTEGER;
ALTER TABLE projects    ADD COLUMN subdomain_changed_at INTEGER;
