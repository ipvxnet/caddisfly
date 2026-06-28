-- 073_course_enrollments.sql
-- Courses v2 — true per-member enrollment (the payoff of the Members plugin).
-- A site_member ENROLLS in a course; the published player is gated behind an
-- active enrollment (real gate — lesson content is served on demand to enrolled
-- members, never baked into the public HTML). Free courses = free enroll after a
-- passwordless sign-in; paid courses = pay → auto-enroll (settleCoursePurchase).
-- member_id references site_members.id (migration 070); scoped to its parent site
-- via the bridge ai_project_id XOR project_id, like courses/site_members.
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.

CREATE TABLE IF NOT EXISTS course_enrollments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id     INTEGER NOT NULL,
  ai_project_id INTEGER,
  project_id    INTEGER,
  member_id     INTEGER NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'active',  -- active|refunded
  source        TEXT    NOT NULL DEFAULT 'free',    -- free|paid
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- One enrollment row per (site, course, member). Partial unique indexes per
-- owner column so the conflict target matches (gotcha: partial unique index
-- ON CONFLICT must repeat the WHERE — see site-members.js / site-transfer.js).
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_enroll_ai
  ON course_enrollments (ai_project_id, course_id, member_id) WHERE ai_project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_enroll_rg
  ON course_enrollments (project_id, course_id, member_id)    WHERE project_id    IS NOT NULL;
-- Per-course enrollment count (manager column).
CREATE INDEX IF NOT EXISTS idx_course_enroll_course ON course_enrollments (course_id);
