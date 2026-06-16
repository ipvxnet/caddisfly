-- 045_lookup_attempts.sql
-- Abuse cap for the refactor "preview what we found" step, which fires a PAID
-- Google Places lookup before any account exists. We allow up to 5 lookups per
-- day counted against BOTH the visitor IP (hashed) and the email entered, so
-- switching one alone doesn't bypass the cap. See routes/api/preview/search.js.

CREATE TABLE IF NOT EXISTS lookup_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT,
  email TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lookup_ip ON lookup_attempts(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_lookup_email ON lookup_attempts(email, created_at);
