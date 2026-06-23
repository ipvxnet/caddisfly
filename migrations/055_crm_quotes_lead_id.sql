-- 055_crm_quotes_lead_id.sql
-- Extend crm_quotes for the admin Leads CRM: a quote can belong to a LEAD
-- (Caddisfly's outbound-sales prospect) instead of a project-contact. One quotes
-- engine serves both — the owner is ai_project_id XOR project_id XOR lead_id.
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

ALTER TABLE crm_quotes ADD COLUMN lead_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_crm_quotes_lead ON crm_quotes(lead_id);
