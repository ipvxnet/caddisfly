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

// ---- ✨ AI SEO review (paid) ----

import { getBodySectionsForPage, getHomeBodySections } from '../../../db/ai-sections.js';
import { generatePageSeo, extractContentText } from '../../../utils/seo-generate.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS } from '../../../utils/credits.js';
import { audit } from '../../../utils/audit.js';

/**
 * POST /api/ai-builder/:project_id/seo/ai-review  { pageId }
 * Reads the page's real content and proposes an improved title + meta
 * description (site language). Charges CREDIT_COSTS.seo_review on success.
 * Returns the proposal WITHOUT saving — the panel fills the fields and the
 * user reviews + hits the normal Save. Also the upgrade path for older sites
 * generated before auto-SEO existed.
 */
export async function handleSeoAiReview(ctx) {
  const { env, request, params } = ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = params.project_id;

    const ai = await getAIProjectByProjectId(env.DB, publicId);
    let site = null;
    let projectKey = null;
    let owns = null;
    if (ai) {
      site = { email: ai.customer_email, businessName: ai.project_name || 'My Website', industry: ai.industry || '', language: ai.language || 'en', description: '' };
      projectKey = { aiProjectId: ai.id };
      owns = (p) => p && p.ai_project_id === ai.id;
    } else {
      const rp = await getProjectByPreviewId(env.DB, publicId);
      if (!rp) return json({ success: false, error: 'Project not found' }, 404);
      let name = rp.website_url || 'My Website';
      let industry = '';
      let description = '';
      try {
        const prof = JSON.parse(rp.company_profile_json || '{}');
        if (prof && prof.name) name = prof.name;
        if (prof && prof.category) industry = prof.category;
        if (prof && prof.description) description = prof.description;
      } catch { /* ignore */ }
      site = { email: rp.customer_email, businessName: name, industry, language: rp.language || 'en', description };
      projectKey = { projectId: rp.id };
      owns = (p) => p && p.project_id === rp.id;
    }

    const page = await getPageById(env.DB, parseInt(body.pageId, 10));
    if (!page || !owns(page)) return json({ success: false, error: 'Page not found for this project.' }, 404);

    const afford = await canAfford(env, env.DB, site.email, CREDIT_COSTS.seo_review);
    if (!afford.ok) return json({ success: false, ...formatCreditError(afford.state, 'SEO review') }, 402);

    const sections = page.is_home
      ? await getHomeBodySections(env.DB, projectKey, page.id, true)
      : await getBodySectionsForPage(env.DB, page.id, true);
    const contentText = sections
      .map((s) => { try { return extractContentText(JSON.parse(s.content_json || '{}')); } catch { return ''; } })
      .filter(Boolean).join(' · ').slice(0, 600);

    const seo = await generatePageSeo(env, site, {
      pageId: page.id, slug: page.slug, title: page.title || page.nav_label, contentText,
    });
    if (!seo) return json({ success: false, error: 'The AI came back malformed — please try again (you were not charged).' }, 502);

    await chargeCredits(env, env.DB, site.email, CREDIT_COSTS.seo_review);
    audit(ctx, 'credit.seo_review', {
      teamOwner: site.email, resourceType: 'site', resourceId: publicId,
      metadata: { credits: CREDIT_COSTS.seo_review, page_id: page.id },
    });
    return json({ success: true, seo });
  } catch (e) {
    console.error('seo ai-review error:', e);
    return json({ success: false, error: 'SEO review failed — please try again.' }, 500);
  }
}
