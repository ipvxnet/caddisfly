// AI course generator — "Generate a course from a topic". Ports the 4vrxp LMS
// courseGen prompt onto Caddisfly's Workers AI (TEXT_MODEL) + extractJSON. One
// LLM call → 4 sections × 3 text lessons + a per-section self-check quiz, then
// materialized into the DB tree via db/courses.js. The route charges
// CREDIT_COSTS.course_ai. See memory: generation-quality (extractJSON), workers-ai-model.
import { callWorkersAI, extractJSON } from './ai-content-generator.js';
import { uniqueCourseSlug, createCourse, createSection, createLesson, ensureQuiz, addQuizQuestion } from '../db/courses.js';

const LANG_NAME = { en: 'English', es: 'Spanish', pt: 'Brazilian Portuguese' };
const QUIZ_SUFFIX = { en: 'Quiz', es: 'Cuestionario', pt: 'Quiz' };

function systemPrompt(lang) {
  const langName = LANG_NAME[lang] || 'English';
  return `You are an expert instructional designer. Return a course plan as raw JSON only — no markdown, no code fences, no explanation. Output must start with { and end with }.

JSON schema (follow exactly):
{
  "title": "string",
  "subtitle": "string (one-line tagline)",
  "description": "string (2-3 sentence overview)",
  "category": "string (one or two words)",
  "sections": [
    {
      "title": "string",
      "lessons": [ { "title": "string", "body": "string (HTML lesson body, MINIMUM 150 words, multiple paragraphs)" } ],
      "quiz": [ { "question": "string ending in ?", "type": "mcq_single", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "string" } ]
    }
  ]
}

Lesson body REQUIREMENTS — every lesson MUST:
1. Open with a 2-4 sentence paragraph introducing the concept in plain language.
2. Include a <h3> sub-heading.
3. Follow with a paragraph OR a <ul>/<ol> of 3-5 items.
4. Close with a concrete example or real-world scenario.
Allowed HTML tags only: <p> <h3> <ul> <ol> <li> <strong> <em>. Never a single paragraph; never fewer than 150 words.

Constraints:
- Exactly 4 sections, ordered foundational → advanced.
- Exactly 3 lessons per section, each teaching a distinct sub-topic (no overlap).
- Exactly 3 quiz questions per section — at least 2 mcq_single (4 distinct options each), the third may be true_false.
- All JSON strings use escaped double quotes; no single quotes inside string values.
- Write ALL content (titles, lessons, questions) in ${langName}.`;
}

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

function sanitizeSection(s) {
  const r = s || {};
  return {
    title: String(r.title || 'Module').trim(),
    lessons: Array.isArray(r.lessons)
      ? r.lessons.map((l) => ({ title: String((l && l.title) || 'Lesson').trim(), body: String((l && l.body) || '<p></p>') })).filter((l) => l.title)
      : [],
    quiz: Array.isArray(r.quiz) ? r.quiz.map(sanitizeQuestion).filter((q) => q.question) : [],
  };
}

/**
 * Generate a structured course from a free-text topic. 3 attempts (the retry
 * loop handles malformed/truncated JSON). Returns
 * { title, subtitle, description, category, sections:[{title, lessons, quiz}] }.
 */
export async function generateCourseStructure(env, topic, lang = 'en') {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await callWorkersAI(env, `Design a complete course about: ${topic}`, {
        system_message: systemPrompt(lang),
        temperature: 0.4,
        max_tokens: 4000,
      });
      const parsed = extractJSON(raw);
      if (!parsed || !parsed.title || !Array.isArray(parsed.sections) || !parsed.sections.length) throw new Error('incomplete');
      const sections = parsed.sections.map(sanitizeSection).filter((s) => s.lessons.length || s.quiz.length);
      if (!sections.length) throw new Error('no_sections');
      return {
        title: String(parsed.title).trim(),
        subtitle: String(parsed.subtitle || '').trim(),
        description: String(parsed.description || '').trim(),
        category: String(parsed.category || '').trim().slice(0, 60),
        sections,
      };
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error(`course_gen_failed: ${(lastErr && lastErr.message) || 'unknown'}`);
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
    if (sec.quiz.length) {
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
