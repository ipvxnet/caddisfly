-- 072_page_members_only.sql
-- Members plugin stage 2: per-page "members only" flag. A members-only page ships
-- a sign-in gate publicly; the real body is served on demand to signed-in members
-- (/api/members/:site/content). 0 = public (default). ai_pages is migration-tracked
-- (NOT in schema.sql). Apply MANUALLY to BOTH caddisfly-db (preview) and prod.

ALTER TABLE ai_pages ADD COLUMN members_only INTEGER NOT NULL DEFAULT 0;
