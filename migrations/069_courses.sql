-- 069_courses.sql
-- Courses (Training/LMS) plugin v1 — static public courses: course → sections →
-- lessons (video/text/pdf/url/quiz) + self-check quizzes + paid-access purchases.
-- Adapted from the 4vrxp LMS; learner enrollment/progress/certificates are a v2
-- (Members/Auth) concern and are intentionally NOT modelled here.
-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.
-- Bridge pattern: ai_project_id XOR project_id (children scope via their parent).

CREATE TABLE IF NOT EXISTS courses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id INTEGER,
  project_id    INTEGER,
  slug          TEXT    NOT NULL DEFAULT '',
  title         TEXT    NOT NULL DEFAULT '',
  subtitle      TEXT    NOT NULL DEFAULT '',          -- short tagline
  description   TEXT    NOT NULL DEFAULT '',          -- overview (md-lite)
  image         TEXT    NOT NULL DEFAULT '',          -- thumbnail URL / R2 key
  category      TEXT    NOT NULL DEFAULT '',
  instructor    TEXT    NOT NULL DEFAULT '',
  level         TEXT    NOT NULL DEFAULT '',          -- beginner|intermediate|advanced (free text)
  price_cents   INTEGER NOT NULL DEFAULT 0,           -- 0 = free; currency = site config currency
  status        TEXT    NOT NULL DEFAULT 'draft',     -- draft|published
  gen_engine    TEXT    NOT NULL DEFAULT '',          -- AI provenance ('' = manually authored)
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_courses_ai ON courses (ai_project_id) WHERE ai_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_courses_rg ON courses (project_id)    WHERE project_id    IS NOT NULL;

CREATE TABLE IF NOT EXISTS course_sections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id  INTEGER NOT NULL,
  title      TEXT    NOT NULL DEFAULT '',
  summary    TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_course_sections_course ON course_sections (course_id, sort_order);

CREATE TABLE IF NOT EXISTS course_lessons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id  INTEGER NOT NULL,
  section_id INTEGER NOT NULL,
  type       TEXT    NOT NULL DEFAULT 'text',   -- video|text|pdf|url|quiz
  title      TEXT    NOT NULL DEFAULT '',
  body       TEXT    NOT NULL DEFAULT '',        -- text lesson HTML/md-lite, or video caption
  media_url  TEXT    NOT NULL DEFAULT '',        -- video embed/URL, pdf URL, external url
  duration   TEXT    NOT NULL DEFAULT '',        -- display label e.g. "8 min" (free text)
  is_preview INTEGER NOT NULL DEFAULT 0,         -- free preview lesson on a paid course
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_course  ON course_lessons (course_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_section ON course_lessons (section_id, sort_order);

-- Self-check quiz (v1 = no stored attempts/grades; pass_score drives the
-- client-side "you passed" display only). One quiz per quiz-type lesson.
CREATE TABLE IF NOT EXISTS course_quizzes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id  INTEGER NOT NULL,
  lesson_id  INTEGER NOT NULL,
  title      TEXT    NOT NULL DEFAULT '',
  pass_score INTEGER NOT NULL DEFAULT 70,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_course_quizzes_lesson ON course_quizzes (lesson_id);

CREATE TABLE IF NOT EXISTS course_quiz_questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id     INTEGER NOT NULL,
  type        TEXT    NOT NULL DEFAULT 'mcq_single',  -- mcq_single|mcq_multi|true_false
  question    TEXT    NOT NULL DEFAULT '',
  explanation TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_course_quiz_questions_quiz ON course_quiz_questions (quiz_id, sort_order);

CREATE TABLE IF NOT EXISTS course_quiz_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  text        TEXT    NOT NULL DEFAULT '',
  is_correct  INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_course_quiz_options_question ON course_quiz_options (question_id, sort_order);

-- Paid-course access without visitor accounts (Phase 5): a completed purchase
-- grants an access_token (the magic link emailed to the buyer) → token-gated player.
CREATE TABLE IF NOT EXISTS course_purchases (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id         INTEGER NOT NULL,
  ai_project_id     INTEGER,
  project_id        INTEGER,
  buyer_email       TEXT    NOT NULL DEFAULT '',
  access_token      TEXT    NOT NULL DEFAULT '',
  stripe_session_id TEXT    NOT NULL DEFAULT '',
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  currency          TEXT    NOT NULL DEFAULT 'usd',
  status            TEXT    NOT NULL DEFAULT 'pending',  -- pending|completed|refunded
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_purchases_token   ON course_purchases (access_token);
CREATE INDEX IF NOT EXISTS        idx_course_purchases_session ON course_purchases (stripe_session_id);
CREATE INDEX IF NOT EXISTS        idx_course_purchases_lookup  ON course_purchases (course_id, buyer_email);
