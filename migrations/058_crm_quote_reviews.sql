-- 058_crm_quote_reviews.sql
-- Internal review log on a quote: a JSON array of { at, body } notes the owner
-- adds while reviewing/revising. INTERNAL ONLY — never rendered on the customer
-- hosted page or PDF. Shared engine (customer CRM + admin Leads CRM).
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

ALTER TABLE crm_quotes ADD COLUMN reviews_json TEXT;
