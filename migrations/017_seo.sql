-- Per-page + site-level SEO controls for published customer sites. Additive and
-- bridge-safe (ai_pages carries both ai_project_id and project_id). The assembler
-- falls back to business name / tagline / hero image when these are null, so
-- every site stays SEO-ready with zero input. Editable from the customize page.

ALTER TABLE ai_pages ADD COLUMN seo_title TEXT;
ALTER TABLE ai_pages ADD COLUMN seo_description TEXT;
ALTER TABLE ai_website_configs ADD COLUMN social_image TEXT;
