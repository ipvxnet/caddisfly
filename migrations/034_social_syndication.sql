-- 034: social syndication (P3, webhook-tier). Auto/manual-share a published
-- blog post to the owner's connected Discord/Slack webhooks.
--
-- Connections live as JSON on the site config (like notify_email/stripe) —
-- { "discord": { "webhook": "https://…" }, "slack": { "webhook": "https://…" } }.
ALTER TABLE ai_website_configs ADD COLUMN social_connections_json TEXT;

-- Per-post "already syndicated" timestamp: powers the "Shared ✓" marker, blocks
-- accidental double-posts, and lets auto-share-on-deploy only fire for posts not
-- yet shared (back-catalog is baselined when an account is first connected).
ALTER TABLE blog_posts ADD COLUMN social_shared_at INTEGER;
