-- Separate favicon (browser tab / bookmark icon). When NULL the favicon falls
-- back to the site logo (logo_url), preserving prior behavior. Set from the
-- Logo & Brand panel (upload or pick from Drive).
ALTER TABLE ai_website_configs ADD COLUMN favicon_url TEXT;
