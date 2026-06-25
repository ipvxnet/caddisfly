-- Speed-test run log — rate-limits the PageSpeed run to 4 per rolling 24h per
-- site (protects the shared PageSpeed API quota). One row per run; the handler
-- counts rows in the last 24h before calling PSI. Bridge: ai_project_id XOR project_id.

CREATE TABLE IF NOT EXISTS speed_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,
  project_id    INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_speed_runs_ai ON speed_runs (ai_project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_speed_runs_rg ON speed_runs (project_id, created_at);
