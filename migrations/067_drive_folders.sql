-- Drive folders — account-level, nestable (parent_id). Files gain a folder_id
-- (NULL = root). Move = update folder_id; copy = duplicate the R2 object + a new
-- ledger row. All drive mutations are audit-logged. See db/drive.js.

CREATE TABLE IF NOT EXISTS drive_folders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  parent_id   INTEGER,                    -- NULL = root
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_drive_folders_owner ON drive_folders (owner_email, parent_id);

ALTER TABLE drive_files ADD COLUMN folder_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON drive_files (owner_email, folder_id);
