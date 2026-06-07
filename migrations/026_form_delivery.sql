-- 026: contact-form delivery observability + per-site notification address.
-- email_status: 'sent' | 'failed' | 'skipped' (daily cap) | NULL (pre-feature
-- rows / no owner email). notify_email: where form notifications go (defaults
-- to the owner's account email when NULL).
ALTER TABLE form_submissions ADD COLUMN email_status TEXT;
ALTER TABLE ai_website_configs ADD COLUMN notify_email TEXT;
