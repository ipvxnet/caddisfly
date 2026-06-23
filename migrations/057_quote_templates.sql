-- 057_quote_templates.sql
-- Editable quote/proposal template: the customizable intro, thank-you, terms and
-- branding overrides used when a quote is sent. Per-project (bridge) for customer
-- CRM quotes; ONE global row (both project cols NULL) for the admin Caddisfly
-- template. Merged over the auto-resolved branding at send time.
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

CREATE TABLE IF NOT EXISTS quote_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,           -- bridge (customer); both NULL = the global admin template
  project_id INTEGER,
  intro TEXT NOT NULL DEFAULT '',
  thank_you TEXT NOT NULL DEFAULT '',
  terms TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '', -- hex override; '' = use the brand default
  logo TEXT NOT NULL DEFAULT '',   -- logo URL override; '' = use the brand default
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qtpl_ai ON quote_templates(ai_project_id) WHERE ai_project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_qtpl_proj ON quote_templates(project_id) WHERE project_id IS NOT NULL;
