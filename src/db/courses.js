// Courses (Training/LMS plugin) data layer — see migrations/069_courses.sql.
// Bridge-aware like products.js: projectKey is { aiProjectId } XOR { projectId }.
// Tree: courses → course_sections → course_lessons (+ a self-check quiz on
// quiz-type lessons: course_quizzes → questions → options). D1 has no cascade,
// so deletes remove children explicitly (CONVENTIONS.md). Prices are integer
// cents; currency comes from the site config (one currency per checkout), as
// with products.
import { slugify } from './blog-posts.js';

const nowSec = () => Math.floor(Date.now() / 1000);

// WHERE fragment + bind value for a project key (XOR bridge).
function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}

const LESSON_TYPES = ['video', 'text', 'pdf', 'url', 'quiz'];
const QUESTION_TYPES = ['mcq_single', 'mcq_multi', 'true_false'];

// ── Courses ────────────────────────────────────────────────────────────────

/** Unique slug within the project (appends -2, -3, … on collision). */
export async function uniqueCourseSlug(db, projectKey, title, excludeId = null) {
  const k = keyWhere(projectKey);
  const base = slugify(title) || 'course';
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const row = excludeId != null
      ? await db.prepare(`SELECT id FROM courses WHERE ${k.sql} AND slug = ? AND id != ?`).bind(k.val, slug, excludeId).first()
      : await db.prepare(`SELECT id FROM courses WHERE ${k.sql} AND slug = ?`).bind(k.val, slug).first();
    if (!row) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now() % 10000}`;
}

export async function createCourse(db, projectKey, { slug, title, subtitle, description, image, category, instructor, level, price_cents, status, gen_engine } = {}) {
  return db
    .prepare(
      `INSERT INTO courses (ai_project_id, project_id, slug, title, subtitle, description, image, category, instructor, level, price_cents, status, gen_engine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      projectKey.aiProjectId != null ? projectKey.aiProjectId : null,
      projectKey.projectId != null ? projectKey.projectId : null,
      slug,
      title || '',
      subtitle || '',
      description || '',
      image || '',
      category || '',
      instructor || '',
      level || '',
      Math.max(0, Math.round(price_cents) || 0),
      status === 'published' ? 'published' : 'draft',
      gen_engine || ''
    )
    .first();
}

export async function getCoursesByProject(db, projectKey, { publishedOnly = false } = {}) {
  const k = keyWhere(projectKey);
  const where = publishedOnly ? `${k.sql} AND status = 'published'` : k.sql;
  const { results } = await db
    .prepare(`SELECT * FROM courses WHERE ${where} ORDER BY sort_order, id`)
    .bind(k.val)
    .all();
  return results || [];
}

export async function getCourseById(db, projectKey, id) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM courses WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

export async function getCourseBySlug(db, projectKey, slug) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM courses WHERE ${k.sql} AND slug = ?`).bind(k.val, slug).first();
}

/** Distinct non-empty published categories for a project (for the section config). */
export async function getCourseCategories(db, projectKey, publishedOnly = true) {
  const k = keyWhere(projectKey);
  const where = publishedOnly ? `${k.sql} AND status = 'published'` : k.sql;
  const { results } = await db
    .prepare(`SELECT DISTINCT category FROM courses WHERE ${where} AND category <> '' ORDER BY category`)
    .bind(k.val)
    .all();
  return (results || []).map((r) => r.category);
}

const COURSE_FIELDS = ['slug', 'title', 'subtitle', 'description', 'image', 'category', 'instructor', 'level', 'price_cents', 'status', 'gen_engine', 'sort_order'];

export async function updateCourse(db, projectKey, id, updates) {
  const k = keyWhere(projectKey);
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    if (COURSE_FIELDS.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (!fields.length) return getCourseById(db, projectKey, id);
  fields.push('updated_at = ?');
  values.push(nowSec(), k.val, id);
  return db
    .prepare(`UPDATE courses SET ${fields.join(', ')} WHERE ${k.sql} AND id = ? RETURNING *`)
    .bind(...values)
    .first();
}

/** Delete a course and ALL its descendants (D1 has no cascade). Scoped by project. */
export async function deleteCourse(db, projectKey, id) {
  const k = keyWhere(projectKey);
  const course = await db.prepare(`SELECT id FROM courses WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
  if (!course) return false;
  await db.batch([
    db.prepare(`DELETE FROM course_quiz_options WHERE question_id IN (SELECT id FROM course_quiz_questions WHERE quiz_id IN (SELECT id FROM course_quizzes WHERE course_id = ?))`).bind(id),
    db.prepare(`DELETE FROM course_quiz_questions WHERE quiz_id IN (SELECT id FROM course_quizzes WHERE course_id = ?)`).bind(id),
    db.prepare('DELETE FROM course_quizzes WHERE course_id = ?').bind(id),
    db.prepare('DELETE FROM course_lessons WHERE course_id = ?').bind(id),
    db.prepare('DELETE FROM course_sections WHERE course_id = ?').bind(id),
    db.prepare(`DELETE FROM courses WHERE ${k.sql} AND id = ?`).bind(k.val, id),
  ]);
  return true;
}

export async function countCourses(db, projectKey) {
  const k = keyWhere(projectKey);
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM courses WHERE ${k.sql}`).bind(k.val).first();
  return (r && r.n) || 0;
}

// ── Sections ─────────────────────────────────────────────────────────────────
// Children are reached via their (already-authorized) course_id — the route
// resolves + scopes the course first, mirroring crm_account_contacts.

export async function listSections(db, courseId) {
  const { results } = await db.prepare('SELECT * FROM course_sections WHERE course_id = ? ORDER BY sort_order, id').bind(courseId).all();
  return results || [];
}

export async function createSection(db, courseId, { title, summary } = {}) {
  const order = await nextSort(db, 'course_sections', 'course_id', courseId);
  return db
    .prepare('INSERT INTO course_sections (course_id, title, summary, sort_order) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(courseId, title || '', summary || '', order)
    .first();
}

export async function updateSection(db, courseId, id, { title, summary } = {}) {
  return db
    .prepare('UPDATE course_sections SET title = COALESCE(?, title), summary = COALESCE(?, summary) WHERE id = ? AND course_id = ? RETURNING *')
    .bind(title ?? null, summary ?? null, id, courseId)
    .first();
}

/** Delete a section + its lessons (and any of those lessons' quizzes). */
export async function deleteSection(db, courseId, id) {
  await db.batch([
    db.prepare(`DELETE FROM course_quiz_options WHERE question_id IN (SELECT id FROM course_quiz_questions WHERE quiz_id IN (SELECT id FROM course_quizzes WHERE lesson_id IN (SELECT id FROM course_lessons WHERE section_id = ? AND course_id = ?)))`).bind(id, courseId),
    db.prepare(`DELETE FROM course_quiz_questions WHERE quiz_id IN (SELECT id FROM course_quizzes WHERE lesson_id IN (SELECT id FROM course_lessons WHERE section_id = ? AND course_id = ?))`).bind(id, courseId),
    db.prepare(`DELETE FROM course_quizzes WHERE lesson_id IN (SELECT id FROM course_lessons WHERE section_id = ? AND course_id = ?)`).bind(id, courseId),
    db.prepare('DELETE FROM course_lessons WHERE section_id = ? AND course_id = ?').bind(id, courseId),
    db.prepare('DELETE FROM course_sections WHERE id = ? AND course_id = ?').bind(id, courseId),
  ]);
  return true;
}

export async function reorderSections(db, courseId, orderedIds) {
  const stmts = orderedIds.map((id, i) =>
    db.prepare('UPDATE course_sections SET sort_order = ? WHERE id = ? AND course_id = ?').bind(i, id, courseId));
  if (stmts.length) await db.batch(stmts);
}

// ── Lessons ──────────────────────────────────────────────────────────────────

export async function listLessons(db, courseId) {
  const { results } = await db.prepare('SELECT * FROM course_lessons WHERE course_id = ? ORDER BY section_id, sort_order, id').bind(courseId).all();
  return results || [];
}

export async function getLesson(db, courseId, id) {
  return db.prepare('SELECT * FROM course_lessons WHERE id = ? AND course_id = ?').bind(id, courseId).first();
}

export async function createLesson(db, courseId, sectionId, { type, title, body, media_url, duration, is_preview } = {}) {
  const order = await nextSort(db, 'course_lessons', 'section_id', sectionId);
  return db
    .prepare('INSERT INTO course_lessons (course_id, section_id, type, title, body, media_url, duration, is_preview, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *')
    .bind(
      courseId,
      sectionId,
      LESSON_TYPES.includes(type) ? type : 'text',
      title || '',
      body || '',
      media_url || '',
      duration || '',
      is_preview ? 1 : 0,
      order
    )
    .first();
}

const LESSON_FIELDS = ['type', 'title', 'body', 'media_url', 'duration', 'is_preview', 'section_id', 'sort_order'];

export async function updateLesson(db, courseId, id, updates) {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!LESSON_FIELDS.includes(key)) continue;
    if (key === 'type' && !LESSON_TYPES.includes(value)) continue;
    fields.push(`${key} = ?`);
    values.push(key === 'is_preview' ? (value ? 1 : 0) : value);
  }
  if (!fields.length) return getLesson(db, courseId, id);
  values.push(id, courseId);
  return db.prepare(`UPDATE course_lessons SET ${fields.join(', ')} WHERE id = ? AND course_id = ? RETURNING *`).bind(...values).first();
}

/** Delete a lesson + its quiz (if any). */
export async function deleteLesson(db, courseId, id) {
  await db.batch([
    db.prepare(`DELETE FROM course_quiz_options WHERE question_id IN (SELECT id FROM course_quiz_questions WHERE quiz_id IN (SELECT id FROM course_quizzes WHERE lesson_id = ?))`).bind(id),
    db.prepare(`DELETE FROM course_quiz_questions WHERE quiz_id IN (SELECT id FROM course_quizzes WHERE lesson_id = ?)`).bind(id),
    db.prepare('DELETE FROM course_quizzes WHERE lesson_id = ?').bind(id),
    db.prepare('DELETE FROM course_lessons WHERE id = ? AND course_id = ?').bind(id, courseId),
  ]);
  return true;
}

export async function reorderLessons(db, sectionId, orderedIds) {
  const stmts = orderedIds.map((id, i) =>
    db.prepare('UPDATE course_lessons SET sort_order = ? WHERE id = ? AND section_id = ?').bind(i, id, sectionId));
  if (stmts.length) await db.batch(stmts);
}

// ── Quiz (self-check) ────────────────────────────────────────────────────────

export async function getQuizByLesson(db, lessonId) {
  return db.prepare('SELECT * FROM course_quizzes WHERE lesson_id = ?').bind(lessonId).first();
}

/** Create the quiz row for a quiz-type lesson if absent; returns it. */
export async function ensureQuiz(db, courseId, lessonId, { title, pass_score } = {}) {
  const existing = await getQuizByLesson(db, lessonId);
  if (existing) return existing;
  return db
    .prepare('INSERT INTO course_quizzes (course_id, lesson_id, title, pass_score) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(courseId, lessonId, title || '', clampScore(pass_score, 70))
    .first();
}

export async function updateQuiz(db, quizId, { title, pass_score } = {}) {
  return db
    .prepare('UPDATE course_quizzes SET title = COALESCE(?, title), pass_score = COALESCE(?, pass_score) WHERE id = ? RETURNING *')
    .bind(title ?? null, pass_score == null ? null : clampScore(pass_score, 70), quizId)
    .first();
}

/** Full question list (with options) for a quiz, ordered. */
export async function listQuizQuestions(db, quizId) {
  const { results: qs } = await db.prepare('SELECT * FROM course_quiz_questions WHERE quiz_id = ? ORDER BY sort_order, id').bind(quizId).all();
  const out = [];
  for (const q of qs || []) {
    const { results: opts } = await db.prepare('SELECT * FROM course_quiz_options WHERE question_id = ? ORDER BY sort_order, id').bind(q.id).all();
    out.push({ ...q, options: opts || [] });
  }
  return out;
}

/** Add a question (+ its options) to a quiz. options: [{text, is_correct}]. */
export async function addQuizQuestion(db, quizId, { type, question, explanation, options } = {}) {
  const order = await nextSort(db, 'course_quiz_questions', 'quiz_id', quizId);
  const q = await db
    .prepare('INSERT INTO course_quiz_questions (quiz_id, type, question, explanation, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING *')
    .bind(quizId, QUESTION_TYPES.includes(type) ? type : 'mcq_single', question || '', explanation || '', order)
    .first();
  const opts = Array.isArray(options) ? options : [];
  if (opts.length) {
    await db.batch(opts.map((o, i) =>
      db.prepare('INSERT INTO course_quiz_options (question_id, text, is_correct, sort_order) VALUES (?, ?, ?, ?)')
        .bind(q.id, (o && o.text) || '', o && (o.is_correct === 1 || o.is_correct === true) ? 1 : 0, i)));
  }
  return q;
}

export async function deleteQuizQuestion(db, quizId, questionId) {
  await db.batch([
    db.prepare('DELETE FROM course_quiz_options WHERE question_id = ?').bind(questionId),
    db.prepare('DELETE FROM course_quiz_questions WHERE id = ? AND quiz_id = ?').bind(questionId, quizId),
  ]);
  return true;
}

// ── Aggregate ────────────────────────────────────────────────────────────────

/**
 * The full course tree for the manager / player / AI materialization:
 * { ...course, sections: [{ ...section, lessons: [{ ...lesson, quiz? }] }] }.
 * Quiz lessons carry their quiz + questions(+options). One pass, scoped by project.
 */
export async function getCourseFull(db, projectKey, id) {
  const course = await getCourseById(db, projectKey, id);
  if (!course) return null;
  const [sections, lessons] = await Promise.all([listSections(db, id), listLessons(db, id)]);
  const bySection = new Map();
  for (const s of sections) bySection.set(s.id, { ...s, lessons: [] });
  for (const l of lessons) {
    const bucket = bySection.get(l.section_id);
    if (bucket) bucket.lessons.push(l);
  }
  // Attach quizzes to quiz-type lessons.
  for (const s of bySection.values()) {
    for (const l of s.lessons) {
      if (l.type === 'quiz') {
        const quiz = await getQuizByLesson(db, l.id);
        l.quiz = quiz ? { ...quiz, questions: await listQuizQuestions(db, quiz.id) } : null;
      }
    }
  }
  return { ...course, sections: Array.from(bySection.values()) };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function clampScore(v, dflt) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : dflt;
}

/** Next sort_order (max+1) within a parent scope. */
async function nextSort(db, table, parentCol, parentVal) {
  const r = await db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM ${table} WHERE ${parentCol} = ?`).bind(parentVal).first();
  return ((r && r.m) ?? -1) + 1;
}
