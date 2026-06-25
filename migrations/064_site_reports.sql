-- Site report — cached PageSpeed (Lighthouse via PSI) results. One row per
-- project (latest run); re-running upserts it. The external-dependency audit is
-- computed live from site data and is NOT stored here. Bridge: ai_project_id XOR
-- project_id.

CREATE TABLE IF NOT EXISTS site_speed_reports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,
  project_id    INTEGER,
  tested_url    TEXT NOT NULL DEFAULT '',
  data_json     TEXT NOT NULL DEFAULT '',   -- { mobile:{...}, desktop:{...} }
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ssr_ai ON site_speed_reports (ai_project_id) WHERE ai_project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ssr_rg ON site_speed_reports (project_id) WHERE project_id IS NOT NULL;
