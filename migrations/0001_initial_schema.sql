-- Caddisfly Database Schema
-- Phase 1: Foundation Setup

-- Users table: Admin authentication
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  google_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at INTEGER
);

CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);

-- Sessions table: Session management
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Projects table: Core entity for website refactoring projects
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preview_id TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  original_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preview_pending',
  pricing_tier TEXT,
  portfolio_included INTEGER NOT NULL DEFAULT 0,
  dns_zone_id TEXT,
  dns_status TEXT,
  github_repo_url TEXT,
  github_username TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  purchased_at INTEGER,
  activated_at INTEGER
);

CREATE INDEX idx_projects_preview_id ON projects(preview_id);
CREATE INDEX idx_projects_customer_email ON projects(customer_email);
CREATE INDEX idx_projects_status ON projects(status);

-- Scraped pages table: Track individual pages for each project
CREATE TABLE IF NOT EXISTS scraped_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  page_url TEXT NOT NULL,
  r2_original_path TEXT,
  r2_refactored_path TEXT,
  scraped_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_scraped_pages_project_id ON scraped_pages(project_id);

-- DNS records table: Track DNS configuration for custom domains
CREATE TABLE IF NOT EXISTS dns_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  record_type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  cloudflare_record_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_dns_records_project_id ON dns_records(project_id);
