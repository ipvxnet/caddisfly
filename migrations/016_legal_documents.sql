-- Editable legal documents (Terms of Service, Privacy Policy) managed from the
-- SaaS admin dashboard so counsel-driven changes don't require a code deploy.
-- The public /terms and /privacy pages render the stored body when a row exists,
-- otherwise they fall back to the built-in default defined in code
-- (src/routes/public/legal-content.js). Additive — safe to apply anytime.

CREATE TABLE IF NOT EXISTS legal_documents (
  slug        TEXT PRIMARY KEY,                       -- 'terms' | 'privacy'
  body        TEXT NOT NULL,                          -- inner HTML of the legal body
  updated_by  TEXT,                                   -- admin email who last saved
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
