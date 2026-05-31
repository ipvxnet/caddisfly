-- Migration: Phase 4 - Bridge Refactoring and AI Builder
-- Allows regular projects to use AI builder templates and customization

-- Add AI builder fields to existing projects table
ALTER TABLE projects ADD COLUMN use_templates INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN template_generation_status TEXT;
ALTER TABLE projects ADD COLUMN config_id INTEGER;

-- Allow ai_sections to link to regular projects (not just ai_projects)
ALTER TABLE ai_sections ADD COLUMN project_id INTEGER;

-- Allow ai_website_configs to link to regular projects (not just ai_projects)
ALTER TABLE ai_website_configs ADD COLUMN project_id INTEGER;

-- Add foreign key constraints (note: SQLite requires recreation for true FK constraints)
-- For now, we use soft foreign keys and handle validation in application code

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_sections_project_id ON ai_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_sections_project_order ON ai_sections(project_id, section_order);
CREATE INDEX IF NOT EXISTS idx_ai_configs_project_id ON ai_website_configs(project_id);

-- Note: Existing ai_sections.ai_project_id and ai_website_configs.ai_project_id remain
-- This creates a hybrid system where sections/configs can belong to either:
-- - ai_projects (via ai_project_id) for AI Builder workflow
-- - projects (via project_id) for URL refactoring with templates
