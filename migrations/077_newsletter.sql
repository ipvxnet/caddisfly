-- 077_newsletter.sql
-- Newsletter plugin ($5/mo) — capture subscribers on a published site and send
-- email campaigns to them. Sending is all-in-one via Resend from a managed
-- subdomain (news.caddisfly.app); per-customer verified domains come later.
-- Compliance: double opt-in (pending→active via a signed-token confirm link),
-- unsubscribe links, and a global suppression = any status other than 'active'.
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.
-- Bridge pattern: ai_project_id XOR project_id (scopes to the parent site).

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id   INTEGER,
  project_id      INTEGER,
  email           TEXT    NOT NULL,                    -- stored lowercased
  name            TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'pending',  -- pending|active|unsubscribed|bounced|complained
  consent_source  TEXT    NOT NULL DEFAULT 'signup_form', -- signup_form|import|checkout|manual
  confirmed_at    INTEGER,
  unsubscribed_at INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- One subscriber row per (site, email). Partial unique indexes per owner column
-- so the same email can subscribe to two different sites.
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_subs_ai_email
  ON newsletter_subscribers (ai_project_id, email) WHERE ai_project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_subs_rg_email
  ON newsletter_subscribers (project_id, email)    WHERE project_id    IS NOT NULL;

CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id   INTEGER,
  project_id      INTEGER,
  subject         TEXT    NOT NULL DEFAULT '',
  body_html       TEXT    NOT NULL DEFAULT '',
  blog_post_id    INTEGER,                             -- set when "send this blog post"
  from_name       TEXT    NOT NULL DEFAULT '',
  reply_to        TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'draft',    -- draft|sending|sent|failed
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at         INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_news_campaigns_ai ON newsletter_campaigns (ai_project_id) WHERE ai_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_campaigns_rg ON newsletter_campaigns (project_id)    WHERE project_id    IS NOT NULL;
