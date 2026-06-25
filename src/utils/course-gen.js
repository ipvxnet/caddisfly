// AI course generator — "Generate a course from a topic". Ports the 4vrxp LMS
// courseGen idea onto Caddisfly's Workers AI (TEXT_MODEL) + extractJSON, but
// SPLITS the work to stay fast and reliable: one small OUTLINE call (meta +
// section/lesson titles) then ONE call PER SECTION in PARALLEL for the lesson
// bodies + quiz. A single 70B call for the whole course (~3.5k tokens) is slow
// and risks edge timeouts; small parallel calls finish in ~20s and rarely
// truncate. Each section retries and degrades gracefully (title-only lessons)
// so the user always gets a course. Materialized via db/courses.js. The route
// charges CREDIT_COSTS.course_ai. See memory: generation-quality, workers-ai-model.
import { callWorkersAI, extractJSON } from './ai-content-generator.js';
import { uniqueCourseSlug, createCourse, createSection, createLesson, ensureQuiz, addQuizQuestion } from '../db/courses.js';

const LANG_NAME = { en: 'English', es: 'Spanish', pt: 'Brazilian Portuguese' };
const QUIZ_SUFFIX = { en: 'Quiz', es: 'Cuestionario', pt: 'Quiz' };
const N_SECTIONS = 4;
const N_LESSONS = 3;

function sanitizeQuestion(q) {
  const r = q || {};
  const type = r.type === 'true_false' ? 'true_false' : r.type === 'mcq_multi' ? 'mcq_multi' : 'mcq_single';
  const options = Array.isArray(r.options) && r.options.length ? r.options.map((o) => String(o)) : ['True', 'False'];
  const ci = Number.isInteger(r.correct_index) ? r.correct_index : 0;
  return {
    question: String(r.question || '').trim(),
    type,
    options,
    correct_index: Math.min(Math.max(0, ci), options.length - 1),
    explanation: r.explanation ? String(r.explanation) : '',
  };
}

async function withRetry(fn, attempts = 2) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < attempts) await new Promise((r) => setTimeout(r, 400 * i)); }
  }
  throw last;
}

// Phase A — outline: course meta + section titles + per-section lesson titles.
// Small output (~300 tokens) → one fast, reliable call.
async function generateOutline(env, topic, lang) {
  const langName = LANG_NAME[lang] || 'English';
  const system = `You are an expert instructional designer. Return ONLY raw JSON (start with {, end with }) — no markdown, no prose.
Schema: {"title":"string","subtitle":"one-line tagline","description":"2-3 sentence overview","category":"one or two words","sections":[{"title":"string","lessons":["lesson title","lesson title","lesson title"]}]}
Rules: exactly ${N_SECTIONS} sections ordered foundational → advanced; exactly ${N_LESSONS} concise lesson titles per section, each a distinct sub-topic (no overlap). Write everything in ${langName}.`;
  const raw = await callWorkersAI(env, `Outline a course about: ${topic}`, { system_message: system, temperature: 0.4, max_tokens: 1000 });
  const p = extractJSON(raw);
  if (!p || !p.title || !Array.isArray(p.sections) || !p.sections.length) throw new Error('outline_incomplete');
  return {
    title: String(p.title).trim(),
    subtitle: String(p.subtitle || '').trim(),
    description: String(p.description || '').trim(),
    category: String(p.category || '').trim().slice(0, 60),
    sections: p.sections.slice(0, 6).map((s) => ({
      title: String((s && s.title) || 'Module').trim(),
      lessonTitles: Array.isArray(s && s.lessons) ? s.lessons.map((l) => String(l).trim()).filter(Boolean).slice(0, 5) : [],
    })).filter((s) => s.title),
  };
}

// Phase B — one section: HTML lesson bodies for the given titles + a self-check quiz.
async function generateSectionContent(env, courseTitle, sectionTitle, lessonTitles, lang) {
  const langName = LANG_NAME[lang] || 'English';
  const titles = (lessonTitles.length ? lessonTitles : ['Overview']);
  const list = titles.map((l, i) => `${i + 1}. ${l}`).join('\n');
  const system = `You are an expert instructional designer. Return ONLY raw JSON (start with {, end with }) — no markdown, no prose.
Schema: {"lessons":[{"title":"string","body":"HTML string"}],"quiz":[{"question":"string ending in ?","type":"mcq_single","options":["A","B","C","D"],"correct_index":0,"explanation":"string"}]}
Each lesson body: open with a <p> intro paragraph, include a <h3> sub-heading, then a <p> or a <ul>/<ol> of 3-5 <li>, and close with a <p> giving a concrete example. Allowed tags ONLY: <p> <h3> <ul> <ol> <li> <strong> <em>. 120-180 words per lesson.
Rules: write a body for EACH lesson title below, keeping the SAME titles in the SAME order; then exactly 3 quiz questions (at least 2 mcq_single with 4 distinct options, plus 1 true_false). Write everything in ${langName}.`;
  const user = `Course: "${courseTitle}"\nSection: "${sectionTitle}"\nLesson titles:\n${list}\n\nWrite each lesson's HTML body and the section quiz.`;
  const raw = await callWorkersAI(env, user, { system_message: system, temperature: 0.4, max_tokens: 2000 });
  const p = extractJSON(raw) || {};
  const bodies = Array.isArray(p.lessons) ? p.lessons : [];
  const lessons = titles.map((title, i) => {
    const byIndex = bodies[i] && bodies[i].body;
    const byTitle = (bodies.find((b) => b && String(b.title || '').trim().toLowerCase() === title.toLowerCase()) || {}).body;
    return { title, body: String(byIndex || byTitle || `<p>${title}</p>`) };
  });
  const quiz = Array.isArray(p.quiz) ? p.quiz.map(sanitizeQuestion).filter((q) => q.question) : [];
  return { title: sectionTitle, lessons, quiz };
}

/**
 * Generate a structured course from a free-text topic: outline → parallel
 * per-section content. Returns { title, subtitle, description, category,
 * sections:[{title, lessons:[{title,body}], quiz:[...]}] }. Per-section failures
 * degrade to title-only lessons rather than failing the whole course.
 */
export async function generateCourseStructure(env, topic, lang = 'en') {
  const outline = await withRetry(() => generateOutline(env, topic, lang), 2);
  const sections = await Promise.all(outline.sections.map((s) =>
    withRetry(() => generateSectionContent(env, outline.title, s.title, s.lessonTitles, lang), 2)
      .catch(() => ({
        title: s.title,
        lessons: (s.lessonTitles.length ? s.lessonTitles : ['Overview']).map((t) => ({ title: t, body: `<p>${t}</p>` })),
        quiz: [],
      }))
  ));
  return {
    title: outline.title,
    subtitle: outline.subtitle,
    description: outline.description,
    category: outline.category,
    sections,
  };
}

/**
 * Write a generated structure into the DB tree (course → sections → text lessons
 * + a per-section quiz lesson with questions). Returns the new course id (draft).
 */
export async function materializeCourse(db, projectKey, gen, lang = 'en') {
  const slug = await uniqueCourseSlug(db, projectKey, gen.title);
  const course = await createCourse(db, projectKey, {
    slug, title: gen.title, subtitle: gen.subtitle, description: gen.description,
    category: gen.category, gen_engine: 'workers-ai',
  });
  const quizSuffix = QUIZ_SUFFIX[lang] || QUIZ_SUFFIX.en;
  for (const sec of gen.sections) {
    const section = await createSection(db, course.id, { title: sec.title });
    for (const les of sec.lessons) {
      await createLesson(db, course.id, section.id, { type: 'text', title: les.title, body: les.body });
    }
    if (sec.quiz && sec.quiz.length) {
      const quizLesson = await createLesson(db, course.id, section.id, { type: 'quiz', title: `${sec.title} — ${quizSuffix}` });
      const quiz = await ensureQuiz(db, course.id, quizLesson.id, { title: quizLesson.title });
      for (const q of sec.quiz) {
        const options = q.options.map((text, i) => ({ text, is_correct: i === q.correct_index ? 1 : 0 }));
        await addQuizQuestion(db, quiz.id, { type: q.type, question: q.question, explanation: q.explanation, options });
      }
    }
  }
  return course.id;
}
