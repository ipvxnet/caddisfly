-- Drive — account-level file storage for site-construction assets. Files live in
-- R2 (env.STORAGE, prefix drive/<token>); this table is the ledger (owner, size,
-- type) used for listing + quota usage. Account-level: keyed by owner_email
-- (NOT a project), so one Drive is shared across all the owner's sites.
-- Quota per plan tier lives in code (DRIVE_LIMITS in utils/credits.js).

CREATE TABLE IF NOT EXISTS drive_files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email  TEXT NOT NULL,
  token        TEXT NOT NULL UNIQUE,     -- unguessable public id for the serve URL
  name         TEXT NOT NULL DEFAULT '', -- original filename (display)
  r2_key       TEXT NOT NULL,            -- drive/<token>
  size         INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_drive_owner ON drive_files (owner_email, created_at);
