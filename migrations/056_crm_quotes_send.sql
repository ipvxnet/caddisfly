-- 056_crm_quotes_send.sql
-- Sendable quotes: a public token for the hosted quote page (/q/<token>) plus
-- sent/viewed tracking. Shared engine — applies to customer + admin lead quotes.
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

ALTER TABLE crm_quotes ADD COLUMN public_token TEXT;
ALTER TABLE crm_quotes ADD COLUMN sent_at INTEGER;
ALTER TABLE crm_quotes ADD COLUMN viewed_at INTEGER;
-- Branding snapshot (issuer name/logo/contact/accent/thankYou/terms) frozen at
-- send time, so the public page/PDF render without re-resolving the project.
ALTER TABLE crm_quotes ADD COLUMN issuer_json TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_quotes_token ON crm_quotes(public_token) WHERE public_token IS NOT NULL;
