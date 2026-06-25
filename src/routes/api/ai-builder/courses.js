// Courses plugin — JSON CRUD API for the course manager/editor.
// Mounted in index.js with [billingAuth, projectAccess, pluginGate('courses', { json: true })].
// Tree: course → sections → lessons (+ self-check quiz on quiz lessons).
// Child tables carry no bridge keys, so every section/lesson op first verifies
// the course belongs to THIS project (getOwnedCourse) — defense in depth.
import { jsonResponse } from '../../../utils/response.js';
import { resolveStoreProject } from './store.js';
import {
  createCourse, updateCourse, deleteCourse, getCourseById, uniqueCourseSlug,
  createSection, updateSection, deleteSection,
  createLesson, updateLesson, deleteLesson, getLesson,
  ensureQuiz, updateQuiz, addQuizQuestion, deleteQuizQuestion,
} from '../../../db/courses.js';

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

/** Resolve the project + a course that belongs to it, or null. */
async function getOwnedCourse(env, projectId, courseId) {
  const r = await resolveStoreProject(env, projectId);
  if (!r) return null;
  const course = await getCourseById(env.DB, r.projectKey, courseId);
  if (!course) return null;
  return { r, course };
}

// ── Courses ──────────────────────────────────────────────────────────────────

// POST /api/ai-builder/:project_id/courses
export async function handleCourseCreate(ctx) {
  const { env, params, request } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return jsonResponse({ error: 'not_found' }, 404);
  const b = await readBody(request);
  const title = String(b.title || '').trim() || 'Untitled course';
  const slug = await uniqueCourseSlug(env.DB, r.projectKey, title);
  const course = await createCourse(env.DB, r.projectKey, {
    slug, title,
    subtitle: b.subtitle, description: b.description, category: b.category,
    instructor: b.instructor, level: b.level, gen_engine: b.gen_engine,
  });
  return jsonResponse({ success: true, course });
}

// PUT /api/ai-builder/:project_id/courses/:course_id
export async function handleCourseUpdate(ctx) {
  const { env, params, request } = ctx;
  const owned = await getOwnedCourse(env, params.project_id, params.course_id);
  if (!owned) return jsonResponse({ error: 'not_found' }, 404);
  const b = await readBody(request);
  const updates = {};
  for (const f of ['title', 'subtitle', 'description', 'image', 'category', 'instructor', 'level']) {
    if (b[f] !== undefined) updates[f] = String(b[f]);
  }
  if (b.price_cents !== undefined) updates.price_cents = Math.max(0, Math.round(Number(b.price_cents)) || 0);
  if (b.status !== undefined) updates.status = b.status === 'published' ? 'published' : 'draft';
  // Keep the slug roughly in sync with a renamed title (only if title changed).
  if (updates.title) updates.slug = await uniqueCourseSlug(env.DB, owned.r.projectKey, updates.title, owned.course.id);
  const course = await updateCourse(env.DB, owned.r.projectKey, owned.course.id, updates);
  return jsonResponse({ success: true, course });
}

// DELETE /api/ai-builder/:project_id/courses/:course_id
export async function handleCourseDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return jsonResponse({ error: 'not_found' }, 404);
  const ok = await deleteCourse(env.DB, r.projectKey, params.course_id);
  return jsonResponse({ success: ok });
}

// ── Sections ─────────────────────────────────────────────────────────────────

// POST /api/ai-builder/:project_id/courses/:course_id/sections
export async function handleSectionCreate(ctx) {
  const { env, params, request } = ctx;
  const owned = await getOwnedCourse(env, params.project_id, params.course_id);
  if (!owned) return jsonResponse({ error: 'not_found' }, 404);
  const b = await readBody(request);
  const section = await createSection(env.DB, owned.course.id, { title: b.title, summary: b.summary });
  return jsonResponse({ success: true, section });
}

// PUT /api/ai-builder/:project_id/courses/:course_id/sections/:section_id
export async function handleSectionUpdate(ctx) {
  const { env, params, request } = ctx;
  const owned = await getOwnedCourse(env, params.project_id, params.course_id);
  if (!owned) return jsonResponse({ error: 'not_found' }, 404);
  const b = await readBody(request);
  const section = await updateSection(env.DB, owned.course.id, params.section_id, { title: b.title, summary: b.summary });
  return jsonResponse({ success: true, section });
}

// DELETE /api/ai-builder/:project_id/courses/:course_id/sections/:section_id
export async function handleSectionDelete(ctx) {
  const { env, params } = ctx;
  const owned = await getOwnedCourse(env, params.project_id, params.course_id);
  if (!owned) return jsonResponse({ error: 'not_found' }, 404);
  await deleteSection(env.DB, owned.course.id, params.section_id);
  return jsonResponse({ success: true });
}

// ── Lessons ──────────────────────────────────────────────────────────────────

// POST /api/ai-builder/:project_id/courses/:course_id/sections/:section_id/lessons
export async function handleLessonCreate(ctx) {
  const { env, params, request } = ctx;
  const owned = await getOwnedCourse(env, params.project_id, params.course_id);
  if (!owned) return jsonResponse({ error: 'not_found' }, 404);
  const b = await readBody(request);
  const lesson = await createLesson(env.DB, owned.course.id, params.section_id, {
    type: b.type, title: b.title, body: b.body, media_url: b.media_url,
    duration: b.duration, is_preview: b.is_preview,
  });
  if (lesson && lesson.type === 'quiz') await ensureQuiz(env.DB, owned.course.id, lesson.id, { title: lesson.title });
  return jsonResponse({ success: true, lesson });
}

// PUT /api/ai-builder/:project_id/courses/:course_id/lessons/:lesson_id
export async function handleLessonUpdate(ctx) {
  const { env, params, request } = ctx;
  const owned = await getOwnedCourse(env, params.project_id, params.course_id);
  if (!owned) return jsonResponse({ error: 'not_found' }, 404);
  const b = await readBody(request);
  const updates = {};
  for (const f of ['type', 'title', 'body', 'media_url', 'duration']) if (b[f] !== undefined) updates[f] = String(b[f]);
  if (b.is_preview !== undefined) updates.is_preview = b.is_preview ? 1 : 0;
  const lesson = await updateLesson(env.DB, owned.course.id, params.lesson_id, updates);
  if (lesson && lesson.type === 'quiz') await ensureQuiz(env.DB, owned.course.id, lesson.id, { title: lesson.title });
  return jsonResponse({ success: true, lesson });
}

// DELETE /api/ai-builder/:project_id/courses/:course_id/lessons/:lesson_id
export async function handleLessonDelete(ctx) {
  const { env, params } = ctx;
  const owned = await getOwnedCourse(env, params.project_id, params.course_id);
  if (!owned) return jsonResponse({ error: 'not_found' }, 404);
  await deleteLesson(env.DB, owned.course.id, params.lesson_id);
  return jsonResponse({ success: true });
}

// ── Quiz (self-check) questions ──────────────────────────────────────────────

// POST /api/ai-builder/:project_id/courses/:course_id/lessons/:lesson_id/questions
export async function handleQuestionCreate(ctx) {
  const { env, params, request } = ctx;
  const owned = await getOwnedCourse(env, params.project_id, params.course_id);
  if (!owned) return jsonResponse({ error: 'not_found' }, 404);
  const lesson = await getLesson(env.DB, owned.course.id, params.lesson_id);
  if (!lesson || lesson.type !== 'quiz') return jsonResponse({ error: 'not_a_quiz' }, 400);
  const b = await readBody(request);
  const quiz = await ensureQuiz(env.DB, owned.course.id, lesson.id, { title: lesson.title });
  if (b.pass_score !== undefined) await updateQuiz(env.DB, quiz.id, { pass_score: b.pass_score });
  const question = await addQuizQuestion(env.DB, quiz.id, {
    type: b.type, question: b.question, explanation: b.explanation, options: b.options,
  });
  return jsonResponse({ success: true, quiz_id: quiz.id, question });
}

// DELETE /api/ai-builder/:project_id/courses/:course_id/quiz/:quiz_id/questions/:question_id
export async function handleQuestionDelete(ctx) {
  const { env, params } = ctx;
  const owned = await getOwnedCourse(env, params.project_id, params.course_id);
  if (!owned) return jsonResponse({ error: 'not_found' }, 404);
  await deleteQuizQuestion(env.DB, params.quiz_id, params.question_id);
  return jsonResponse({ success: true });
}
