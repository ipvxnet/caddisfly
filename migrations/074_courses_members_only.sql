-- 074_courses_members_only.sql
-- Courses v2: optional "members only" gate for the AUTO course catalog (/courses).
-- The /courses index is a synthetic baked page (no ai_pages row), so it can't use
-- the per-page members-only toggle. This flag lets the owner require sign-in to
-- browse courses: at publish the /courses page ships only the member sign-in gate
-- and the real catalog is served on demand to signed-in members (real gate, reuses
-- the Members content endpoint). Requires the Members plugin to take effect.
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

ALTER TABLE ai_website_configs ADD COLUMN courses_members_only INTEGER NOT NULL DEFAULT 0;
