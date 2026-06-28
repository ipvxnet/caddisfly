// Course rendering glue: course rows -> SYNTHETIC section objects that flow
// through the normal assemblePage pipeline (header + synthetic body + footer).
// Used by deploy.js (baking static R2 copies) and the /ai-preview course routes.
// Mirrors shop-render.js / blog-render.js. Lesson `body` is trusted owner/AI
// HTML (constrained tags), rendered as-is by the player; the course description
// is md-lite. See utils/courses... db/courses.js getCourseFull for the tree shape.
import { mdLiteToHtml } from './md-lite.js';

const NAV_TITLE = { en: 'Courses', es: 'Cursos', pt: 'Cursos' };

/** Synthetic nav entry so the navbar shows a Courses link (slug drives the href). */
export function courseNavPage(lang = 'en') {
  return { slug: 'courses', title: NAV_TITLE[lang] || NAV_TITLE.en, is_visible: 1, is_home: 0 };
}

/** Synthetic course_list section for the /courses index page. `courses` rows may
 *  carry a `lessonCount` for the card meta. */
export function courseListSection(courses, base, currency, lang = 'en') {
  const data = {
    base, currency, lang,
    courses: (courses || []).map((c) => ({
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle || '',
      image: c.image || '',
      price_cents: c.price_cents || 0,
      category: c.category || '',
      lessons: c.lessonCount || 0,
    })),
  };
  return { section_type: 'course_list', html_template: 'default', content_json: JSON.stringify(data), is_visible: 1, id: null, section_order: 1 };
}

/** Synthetic course_player section for one course page. `course` = getCourseFull
 *  result (course + sections[] each with lessons[], quiz lessons carry .quiz).
 *  `unlocked` (token access / owner preview) opens every lesson on a paid course;
 *  on a published paid course it's false → the player paywalls non-preview lessons. */
export function coursePlayerSection(course, base, currency, lang = 'en', unlocked = false) {
  const data = {
    base, currency, lang, unlocked: !!unlocked,
    course: {
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle || '',
      description_html: mdLiteToHtml(course.description || ''),
      image: course.image || '',
      instructor: course.instructor || '',
      level: course.level || '',
      price_cents: course.price_cents || 0,
      is_paid: (course.price_cents || 0) > 0,
      sections: (course.sections || []).map((s) => ({
        title: s.title,
        summary: s.summary || '',
        lessons: (s.lessons || []).map((l) => ({
          id: l.id,
          type: l.type,
          title: l.title,
          duration: l.duration || '',
          is_preview: !!l.is_preview,
          body_html: l.type === 'text' ? (l.body || '') : '',
          media_url: l.media_url || '',
          quiz: (l.type === 'quiz' && l.quiz)
            ? {
              pass_score: l.quiz.pass_score,
              questions: (l.quiz.questions || []).map((q) => ({
                question: q.question,
                type: q.type,
                explanation: q.explanation || '',
                options: (q.options || []).map((o) => ({ text: o.text, is_correct: o.is_correct ? 1 : 0 })),
              })),
            }
            : null,
        })),
      })),
    },
  };
  return { section_type: 'course_player', html_template: 'default', content_json: JSON.stringify(data), is_visible: 1, id: null, section_order: 1 };
}

/** Synthetic course_gate section (Courses v2): replaces the baked player on a
 *  PUBLISHED course with an enrollment gate. Carries only the title-level data the
 *  gate shows (hero + curriculum outline, NO lesson content) — the real player is
 *  fetched on demand from /api/courses/:site/player for enrolled members. */
export function coursePlayerGateSection(course, currency, lang = 'en') {
  const data = {
    currency, lang,
    course: {
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle || '',
      image: course.image || '',
      price_cents: course.price_cents || 0,
      sections: (course.sections || []).map((s) => ({
        title: s.title,
        lessons: (s.lessons || []).map((l) => ({ title: l.title, type: l.type, duration: l.duration || '' })),
      })),
    },
  };
  return { section_type: 'course_gate', html_template: 'default', content_json: JSON.stringify(data), is_visible: 1, id: null, section_order: 1 };
}
