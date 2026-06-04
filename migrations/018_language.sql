-- Site language (what the AI writes the generated copy in, and the published
-- page's <html lang>). Additive, bridge-safe. Defaults to English; set from the
-- user's UI language (or the start-form selector) at project creation.

ALTER TABLE ai_projects ADD COLUMN language TEXT DEFAULT 'en';
ALTER TABLE projects ADD COLUMN language TEXT DEFAULT 'en';
