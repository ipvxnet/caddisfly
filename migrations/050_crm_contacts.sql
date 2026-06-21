-- 050_crm_contacts.sql
-- CRM plugin: a THIN overlay holding only CRM-specific fields per contact
-- (status, notes). The contact LIST is aggregated on the fly by email from
-- form_submissions + bookings + store_orders; this table is left-joined for the
-- pipeline status + notes. Bridge pattern (ai_project_id XOR project_id).
-- See PLUGIN_PLATFORM_DESIGN.md (CRM is plugin #2).
--
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

CREATE TABLE IF NOT EXISTS crm_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,                  -- bridge: AI-builder project (XOR project_id)
  project_id INTEGER,                     -- bridge: refactor project
  email TEXT NOT NULL,                    -- the contact key (lowercased)
  status TEXT NOT NULL DEFAULT 'new',     -- new | contacted | qualified | won | lost
  notes TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_ai_email ON crm_contacts(ai_project_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_proj_email ON crm_contacts(project_id, email);
