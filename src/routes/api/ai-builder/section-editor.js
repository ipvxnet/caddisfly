// GET /api/ai-builder/:project_id/sections/:section_id/editor
// Returns HTML for section editor modal

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getSectionById, getSiteSections } from '../../../db/ai-sections.js';
import { getPagesByProject } from '../../../db/ai-pages.js';
import { generateSectionEditorModal } from '../../../components/section-editor-modal.js';

// Friendly names for in-page section anchors (page names come localized from
// nav_label). Falls back to the humanized type for anything not listed.
const SECTION_NAMES = {
  contact: 'Contact', services: 'Services', about: 'About', pricing: 'Pricing',
  gallery: 'Gallery', testimonials: 'Testimonials', features: 'Features',
  cta: 'Call to action', blog_list: 'Blog', shop_list: 'Shop', products: 'Products', stats: 'Stats',
};
const SKIP_ANCHOR_TYPES = new Set(['header', 'footer', 'hero']);

/** Build the link-picker destination list (pages, section anchors, phone/email). */
async function buildLinkData(db, projectKey) {
  const [pages, sections] = await Promise.all([
    getPagesByProject(db, projectKey).catch(() => []),
    getSiteSections(db, projectKey, true).catch(() => []),
  ]);
  const seen = new Set();
  const secOut = [];
  let phone = '', email = '';
  for (const s of sections || []) {
    let c = {};
    try { c = JSON.parse(s.content_json || '{}'); } catch { /* ignore */ }
    if (!phone && c.phone) phone = String(c.phone);
    if (!email && c.email) email = String(c.email);
    const t = s.section_type;
    if (SKIP_ANCHOR_TYPES.has(t) || seen.has(t)) continue;
    seen.add(t);
    secOut.push({ label: SECTION_NAMES[t] || (t.charAt(0).toUpperCase() + t.slice(1)), anchor: `#${t}` });
  }
  const pageOut = (pages || [])
    .filter((p) => p.is_visible !== 0)
    .map((p) => ({ label: p.nav_label || p.title || p.slug, anchor: `#${p.slug}` }));
  return { pages: pageOut, sections: secOut, phone, email };
}

/**
 * Get section editor modal HTML
 * @param {object} ctx - Request context
 * @returns {Response} HTML response
 */
export async function handleGetSectionEditor(ctx) {
  const { env, params } = ctx;

  try {
    const { project_id, section_id } = params;

    // Try to load from ai_projects first, then regular projects
    let aiProject = await getAIProjectByProjectId(env.DB, project_id);
    let projectPreviewId = project_id;
    let regularProject = null;

    if (!aiProject) {
      regularProject = await getProjectByPreviewId(env.DB, project_id);
      if (!regularProject) {
        return new Response('Project not found', { status: 404 });
      }
    }

    // Get section
    const section = await getSectionById(env.DB, parseInt(section_id));

    if (!section) {
      return new Response('Section not found', { status: 404 });
    }

    // Verify ownership
    if (aiProject && section.ai_project_id !== aiProject.id) {
      return new Response('Section does not belong to this project', { status: 403 });
    }

    // Destinations for the "Link to" picker (pages, section anchors, phone/email).
    const projectKey = aiProject ? { aiProjectId: aiProject.id } : { projectId: regularProject.id };
    const linkData = await buildLinkData(env.DB, projectKey).catch(() => null);

    // Generate modal HTML (in the viewer's UI language)
    const html = generateSectionEditorModal(section, projectPreviewId, (ctx && ctx.lang) || 'en', linkData);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating section editor:', error);

    return new Response('Error generating editor', {
      status: 500,
    });
  }
}
