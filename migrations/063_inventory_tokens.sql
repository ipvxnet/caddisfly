-- Inventory REST API tokens (inventory Phase 3). One token per project authorizes
-- the public /api/inventory/* endpoints (Authorization: Bearer <token>) — no
-- session needed, the token resolves to the project. Generated/rotated/revoked by
-- the owner from the Import page. Bridge: ai_project_id XOR project_id.

CREATE TABLE IF NOT EXISTS inventory_tokens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,
  project_id    INTEGER,
  token         TEXT NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at  INTEGER
);

-- One token per project (rotation upserts this single row).
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_token_ai ON inventory_tokens (ai_project_id) WHERE ai_project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_token_rg ON inventory_tokens (project_id) WHERE project_id IS NOT NULL;
