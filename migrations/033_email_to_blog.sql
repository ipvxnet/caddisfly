-- 033: email-to-blog (P1). Per-site SECRET inbound address: a random token in
-- the address local-part (post-<token>@<INBOUND_EMAIL_DOMAIN>) routes inbound
-- mail to the owner's site. The token is the primary auth gate, so it is unique
-- and indexed for O(1) lookup in the Email Worker.
ALTER TABLE ai_projects ADD COLUMN inbound_email_token TEXT;
ALTER TABLE projects    ADD COLUMN inbound_email_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_projects_inbound_token ON ai_projects(inbound_email_token) WHERE inbound_email_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_inbound_token    ON projects(inbound_email_token)    WHERE inbound_email_token IS NOT NULL;

-- Provenance on posts: 'manual' (default) vs 'email' (created by the inbound
-- handler — surfaced in the blog manager as "pending your review"). The source
-- Message-ID lets a delivery retry be deduped so one email can't double-post.
ALTER TABLE blog_posts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE blog_posts ADD COLUMN source_message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_blog_posts_source_msgid ON blog_posts(source_message_id) WHERE source_message_id IS NOT NULL;
