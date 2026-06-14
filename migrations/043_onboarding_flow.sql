-- 043: onboarding redesign — branching flow + detailed-profile collection.
-- Q1 (business_status: new_business | existing_business) and Q2
-- (data_mode: detailed | ai_generated) branch the wizard; flow_path records the
-- resolved path ('regular' | 'detailed'). detailed_profile_json holds the rich
-- business info collected on the single-page detailed form (and later pre-filled
-- by research) — one JSON blob rather than many sparse columns.
-- Apply manually:
--   npx wrangler d1 execute caddisfly-db --remote --file=./migrations/043_onboarding_flow.sql
--   npx wrangler d1 execute caddisfly-db-prod --remote --file=./migrations/043_onboarding_flow.sql

ALTER TABLE ai_projects ADD COLUMN flow_path TEXT;
ALTER TABLE ai_projects ADD COLUMN business_status TEXT;
ALTER TABLE ai_projects ADD COLUMN data_mode TEXT;
ALTER TABLE ai_projects ADD COLUMN detailed_profile_json TEXT;
-- Research prefill (Phase 4): atomic-claim columns mirroring the refactor
-- `projects` flow, so wizard prefill can't double-spend the paid Places call.
ALTER TABLE ai_projects ADD COLUMN enrichment_status TEXT;
ALTER TABLE ai_projects ADD COLUMN enrichment_started_at INTEGER;
