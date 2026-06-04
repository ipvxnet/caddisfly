// SEO editor API — save per-page SEO (title/description) + the site-level social
// image. PUT /api/ai-builder/:project_id/seo  { pageId, seo_title, seo_description, social_image }
// Gated by the PROJ chain (billingAuth + projectAccess); SEO is content editing.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getPageById, updatePage } from '../../../db/ai-pages.js';
import {
  getWebsiteConfigByAIProjectId,
  getWebsiteConfigByRegularProjectId,
  updateWebsiteConfigById,
} from '../../../db/ai-config.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const clean = (v, max) => {
  const s = (typeof v === 'string' ? v : '').trim();
  return s ? s.slice(0, max) : null;
};

/** PUT /api/ai-builder/:project_id/seo */
export async function handleUpdateSeo(ctx) {
  const { env, request, params } = ctx;
  const publicId = params.project_id;
  const body = await request.json().catch(() => ({}));

  // Resolve the project + its config, and capture the owning key for a page check.
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  let config = null;
  let owns = null; // (page) => boolean
  if (ai) {
    config = await getWebsiteConfigByAIProjectId(env.DB, ai.id);
    owns = (p) => p && p.ai_project_id === ai.id;
  } else {
    const rp = await getProjectByPreviewId(env.DB, publicId);
    if (!rp) return json({ success: false, error: 'Project not found' }, 404);
    config = await getWebsiteConfigByRegularProjectId(env.DB, rp.id);
    owns = (p) => p && p.project_id === rp.id;
  }

  // Per-page SEO overrides (only for a page belonging to this project).
  if (body.pageId) {
    const page = await getPageById(env.DB, parseInt(body.pageId, 10));
    if (!page || !owns(page)) return json({ success: false, error: 'Page not found for this project.' }, 404);
    await updatePage(env.DB, page.id, {
      seo_title: clean(body.seo_title, 120),
      seo_description: clean(body.seo_description, 320),
    });
  }

  // Site-level social (OG) image override.
  if (config && typeof body.social_image === 'string') {
    await updateWebsiteConfigById(env.DB, config.id, { social_image: clean(body.social_image, 600) });
  }

  return json({ success: true });
}
