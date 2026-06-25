-- Drive Trash bin (soft-delete). deleted_at NULL = live; non-NULL ISO timestamp = in trash.
-- Trashed rows keep their R2 object (so Restore works) and still count toward quota
-- until purged ("Delete forever" / Empty trash).
ALTER TABLE drive_files ADD COLUMN deleted_at TEXT;
ALTER TABLE drive_folders ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_drive_files_deleted ON drive_files(owner_email, deleted_at);
CREATE INDEX IF NOT EXISTS idx_drive_folders_deleted ON drive_folders(owner_email, deleted_at);
