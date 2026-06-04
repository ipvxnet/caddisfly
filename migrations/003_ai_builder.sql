-- Migration: Phase 3 - AI Website Builder
-- Adds tables to support AI-powered website generation from scratch

-- Main AI projects table
CREATE TABLE IF NOT EXISTS ai_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  project_name TEXT,
  status TEXT NOT NULL DEFAULT 'conversation',
  conversation_step TEXT NOT NULL DEFAULT 'initial_prompt',
  pricing_tier TEXT DEFAULT 'free_trial',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deployed_at INTEGER,
  deployed_url TEXT
);

-- Conversation history
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  asked_at INTEGER NOT NULL DEFAULT (unixepoch()),
  answered_at INTEGER,
  FOREIGN KEY (ai_project_id) REFERENCES ai_projects(id) ON DELETE CASCADE
);

-- Website sections
CREATE TABLE IF NOT EXISTS ai_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER NOT NULL,
  section_type TEXT NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  html_template TEXT NOT NULL,
  content_json TEXT,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (ai_project_id) REFERENCES ai_projects(id) ON DELETE CASCADE
);

-- Uploaded assets
CREATE TABLE IF NOT EXISTS ai_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  r2_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (ai_project_id) REFERENCES ai_projects(id) ON DELETE CASCADE
);

-- Website configuration
CREATE TABLE IF NOT EXISTS ai_website_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER NOT NULL UNIQUE,
  primary_color TEXT NOT NULL DEFAULT '#667eea',
  secondary_color TEXT NOT NULL DEFAULT '#764ba2',
  font_heading TEXT NOT NULL DEFAULT 'Inter',
  font_body TEXT NOT NULL DEFAULT 'Inter',
  style_theme TEXT NOT NULL DEFAULT 'modern',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (ai_project_id) REFERENCES ai_projects(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_projects_email ON ai_projects(customer_email);
CREATE INDEX IF NOT EXISTS idx_ai_projects_status ON ai_projects(status);
CREATE INDEX IF NOT EXISTS idx_ai_projects_project_id ON ai_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_project ON ai_conversations(ai_project_id);
CREATE INDEX IF NOT EXISTS idx_ai_sections_project ON ai_sections(ai_project_id);
CREATE INDEX IF NOT EXISTS idx_ai_sections_order ON ai_sections(ai_project_id, section_order);
CREATE INDEX IF NOT EXISTS idx_ai_assets_project ON ai_assets(ai_project_id);
