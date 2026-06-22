-- 052_crm_manual_dedup.sql
-- CRM plugin: let owners ADD their own contacts (source='manual') and choose how
-- duplicates are merged (by email | phone | full name).
--
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

-- crm_contacts gains identity fields so a manually-added contact stands on its
-- own (not backed by a form/booking/order) and can be deduped by phone or name.
ALTER TABLE crm_contacts ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_contacts ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_contacts ADD COLUMN source TEXT NOT NULL DEFAULT 'aggregated'; -- aggregated | manual
ALTER TABLE crm_contacts ADD COLUMN created_at INTEGER NOT NULL DEFAULT (unixepoch());

-- Per-site choice of which field collapses duplicates in the aggregated view.
ALTER TABLE ai_website_configs ADD COLUMN crm_dedup_key TEXT NOT NULL DEFAULT 'email'; -- email | phone | name
