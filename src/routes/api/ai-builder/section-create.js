// Add / delete sections on a page (AI builder + refactor projects).
//   POST   /api/ai-builder/:project_id/sections            (add)
//   DELETE /api/ai-builder/:project_id/sections/:section_id (remove)
//
// New sections are created with empty content ({}) and the type's first
// template variant — every section template renders sensible built-in defaults,
// so the section appears immediately and the user fills it in via ✨ Edit.
// Header/footer are site-level singletons and are not addable/deletable here.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { hasPlugin } from '../../../plugins/entitlements.js';
import {
  ensurePagesForProject,
  getPageBySlug,
  getHomePage,
} from '../../../db/ai-pages.js';
import {
  createSection,
  getSectionById,
  deleteSection,
  getBodySectionsForPage,
  getHomeBodySections,
} from '../../../db/ai-sections.js';
import { isSectionTypeValid, getAvailableVariants } from '../../../templates/ai-builder/registry.js';
import { sectionDefault } from '../../../templates/ai-builder/section-defaults.js';

// Body section types a user can add (header/footer are site-level singletons).
export const ADDABLE_SECTIONS = [
  { type: 'hero', emoji: '🦸', label: 'Hero' },
  { type: 'about', emoji: '📖', label: 'About' },
  { type: 'services', emoji: '🛠️', label: 'Services' },
  { type: 'features', emoji: '✨', label: 'Features' },
  { type: 'gallery', emoji: '🖼️', label: 'Gallery' },
  { type: 'testimonials', emoji: '💬', label: 'Testimonials' },
  { type: 'pricing', emoji: '💲', label: 'Pricing' },
  { type: 'products', emoji: '🛍️', label: 'Shop products' },
  { type: 'catalogue', emoji: '📒', label: 'Catalogue', plugin: 'catalogue' },
  { type: 'courses', emoji: '📚', label: 'Courses', plugin: 'courses' },
  { type: 'booking', emoji: '📅', label: 'Bookings' },
  { type: 'stats', emoji: '📊', label: 'Stats' },
  { type: 'cta', emoji: '📣', label: 'Call to action' },
  { type: 'contact', emoji: '✉️', label: 'Contact' },
];
const ADDABLE_TYPES = new Set(ADDABLE_SECTIONS.map((s) => s.type));

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Resolve a public id to both a page-helper key ({aiProjectId}|{projectId}) and
// a createSection key ({ai_project_id}|{project_id}).
async function resolveProject(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) return { projectKey: { aiProjectId: ai.id }, createKey: { ai_project_id: ai.id }, ownerId: { col: 'ai_project_id', id: ai.id }, lang: ai.language || 'en' };
  const rp = await getProjectByPreviewId(env.DB, publicId);
  if (rp) return { projectKey: { projectId: rp.id }, createKey: { project_id: rp.id }, ownerId: { col: 'project_id', id: rp.id }, lang: rp.language || 'en' };
  return null;
}

// Seed a new section's content with a localized title so it doesn't fall back to
// the template's English defaults on a non-English site (the rest is filled in
// via ✨ Edit). Sections that render only live data (products/booking) or have
// no titled default get '{}'.
function seededContent(type, lang) {
  const heading = sectionDefault(lang, type, 0);
  if (!heading) return '{}';
  const content = { heading };
  const sub = sectionDefault(lang, type, 1);
  if (sub) { content.subheading = sub; content.description = sub; }
  return JSON.stringify(content);
}

/** POST … /sections — add a new section to a page. */
export async function handleAddSection(ctx) {
  const { env, request, params } = ctx;
  const proj = await resolveProject(env, params.project_id);
  if (!proj) return json({ success: false, error: 'Project not found' }, 404);

  const body = await request.json().catch(() => ({}));
  const type = String(body.section_type || '').toLowerCase().trim();
  if (!ADDABLE_TYPES.has(type) || !isSectionTypeValid(type)) {
    return json({ success: false, error: 'Unknown or non-addable section type' }, 400);
  }

  // Plugin-gated section types require an active entitlement (server-side, §8.1).
  const addable = ADDABLE_SECTIONS.find((s) => s.type === type);
  if (addable && addable.plugin && !(await hasPlugin(env, ctx.billingEmail, addable.plugin))) {
    return json({ success: false, error: 'plugin_required', plugin: addable.plugin }, 402);
  }

  await ensurePagesForProject(env.DB, proj.projectKey);
  let page = body.page_slug ? await getPageBySlug(env.DB, proj.projectKey, body.page_slug) : null;
  if (!page) page = await getHomePage(env.DB, proj.projectKey);
  if (!page) return json({ success: false, error: 'No page to add the section to' }, 400);

  // Append after the page's existing body sections.
  const existing = page.is_home
    ? await getHomeBodySections(env.DB, proj.projectKey, page.id, false)
    : await getBodySectionsForPage(env.DB, page.id, false);
  const order = existing.reduce((m, s) => Math.max(m, (s.section_order || 0) + 1), 0);

  // Layout variant: use the requested one if valid, else the type's first.
  const allowedVariants = getAvailableVariants(type);
  const requested = String(body.variant || '').trim();
  const variant = requested && (allowedVariants.includes(requested) || requested === 'default')
    ? requested
    : (allowedVariants[0] || 'default');

  const section = await createSection(env.DB, {
    ...proj.createKey,
    page_id: page.id,
    section_type: type,
    section_order: order,
    html_template: variant,
    content_json: seededContent(type, proj.lang),
    is_visible: 1,
  });

  return json({ success: true, section, page_slug: page.slug });
}

/** DELETE … /sections/:section_id — remove a section. */
export async function handleDeleteSection(ctx) {
  const { env, params } = ctx;
  const proj = await resolveProject(env, params.project_id);
  if (!proj) return json({ success: false, error: 'Project not found' }, 404);

  const section = await getSectionById(env.DB, parseInt(params.section_id, 10));
  if (!section) return json({ success: false, error: 'Section not found' }, 404);
  if (section[proj.ownerId.col] !== proj.ownerId.id) {
    return json({ success: false, error: 'Section does not belong to this project' }, 403);
  }
  if (section.section_type === 'header' || section.section_type === 'footer') {
    return json({ success: false, error: 'The header and footer cannot be deleted.' }, 400);
  }

  await deleteSection(env.DB, section.id);
  return json({ success: true });
}
