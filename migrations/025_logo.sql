-- 025: AI logo generator — site-level brand logo.
-- logo_url holds a served asset URL (/preview-asset/<id>/<file>) chosen or
-- uploaded in the customize editor's Logo panel. Used as the header logo,
-- published favicon, and og:image fallback.
ALTER TABLE ai_website_configs ADD COLUMN logo_url TEXT;
