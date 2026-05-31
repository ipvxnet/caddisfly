-- Migration: Fix nullable constraints for hybrid project support
-- Makes ai_project_id nullable in ai_sections and ai_website_configs
-- so they can support either ai_project_id OR project_id

-- Unfortunately SQLite doesn't support ALTER COLUMN to modify constraints
-- We need to recreate the tables with the new schema

-- Step 1: Create backup of ai_sections
CREATE TABLE ai_sections_backup AS SELECT * FROM ai_sections;

-- Step 2: Drop old ai_sections table
DROP TABLE ai_sections;

-- Step 3: Recreate ai_sections with nullable ai_project_id
CREATE TABLE ai_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,  -- Now nullable
  project_id INTEGER,
  section_type TEXT NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  html_template TEXT NOT NULL,
  content_json TEXT,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Step 4: Restore data from backup
INSERT INTO ai_sections (id, ai_project_id, section_type, section_order, html_template, content_json, is_visible, created_at, updated_at)
SELECT id, ai_project_id, section_type, section_order, html_template, content_json, is_visible, created_at, updated_at
FROM ai_sections_backup;

-- Step 5: Drop backup
DROP TABLE ai_sections_backup;

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_ai_sections_project ON ai_sections(ai_project_id);
CREATE INDEX IF NOT EXISTS idx_ai_sections_order ON ai_sections(ai_project_id, section_order);
CREATE INDEX IF NOT EXISTS idx_ai_sections_project_id ON ai_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_sections_project_order ON ai_sections(project_id, section_order);

-- Repeat for ai_website_configs
CREATE TABLE ai_website_configs_backup AS SELECT * FROM ai_website_configs;

DROP TABLE ai_website_configs;

CREATE TABLE ai_website_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,  -- Now nullable
  project_id INTEGER,
  primary_color TEXT NOT NULL DEFAULT '#667eea',
  secondary_color TEXT NOT NULL DEFAULT '#764ba2',
  font_heading TEXT NOT NULL DEFAULT 'Inter',
  font_body TEXT NOT NULL DEFAULT 'Inter',
  style_theme TEXT NOT NULL DEFAULT 'modern',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO ai_website_configs (id, ai_project_id, primary_color, secondary_color, font_heading, font_body, style_theme, created_at, updated_at)
SELECT id, ai_project_id, primary_color, secondary_color, font_heading, font_body, style_theme, created_at, updated_at
FROM ai_website_configs_backup;

DROP TABLE ai_website_configs_backup;

CREATE INDEX IF NOT EXISTS idx_ai_configs_project_id ON ai_website_configs(project_id);
