-- Migration: Phase 2 - Preview Workflow Updates
-- Adds new columns to support preview workflow

-- Add website_url column to projects (renaming from original_url)
ALTER TABLE projects ADD COLUMN website_url TEXT;

-- Copy data from original_url to website_url
UPDATE projects SET website_url = original_url WHERE website_url IS NULL;

-- Add updated_at column to projects
ALTER TABLE projects ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (unixepoch());

-- Add page_index column to scraped_pages
ALTER TABLE scraped_pages ADD COLUMN page_index INTEGER NOT NULL DEFAULT 0;

-- Rename r2_original_path to original_r2_path in scraped_pages
ALTER TABLE scraped_pages ADD COLUMN original_r2_path TEXT;
UPDATE scraped_pages SET original_r2_path = r2_original_path WHERE original_r2_path IS NULL;

-- Rename r2_refactored_path to refactored_r2_path in scraped_pages
ALTER TABLE scraped_pages ADD COLUMN refactored_r2_path TEXT;
UPDATE scraped_pages SET refactored_r2_path = r2_refactored_path WHERE refactored_r2_path IS NULL;

-- Add created_at and updated_at to scraped_pages
ALTER TABLE scraped_pages ADD COLUMN created_at INTEGER NOT NULL DEFAULT (unixepoch());
ALTER TABLE scraped_pages ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (unixepoch());

-- Note: SQLite doesn't support DROP COLUMN, so old columns (original_url, r2_original_path, r2_refactored_path, scraped_at) will remain
-- They should be ignored in application code
