// POST /api/ai-builder/:project_id/deploy
// Publish a (multi-page) site: render each page to R2 and serve it at /site/:id.

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../../db/ai-config.js';
import { ensurePagesForProject, getPagesByProject } from '../../../db/ai-pages.js';
import { getSiteSections, getBodySectionsForPage, getHomeBodySections } from '../../../db/ai-sections.js';
import { assemblePage } from '../../../utils/ai-page-assembler.js';
import { uploadToR2 } from '../../../utils/r2-storage.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Deploy the website: write one static HTML file per page to R2 under
 * published/<publicId>/<slug>.html, served by GET /site/:id[/:slug].
 */
export async function handleAIBuilderDeploy(ctx) {
  const { env, params } = ctx;

  try {
    const publicId = params.project_id;

    // Resolve project (AI builder first, else refactoring), build the project key,
    // config, and a view object for the page <title>.
    const aiProject = await getAIProjectByProjectId(env.DB, publicId);
    let projectKey, config, projectView;

    if (aiProject) {
      projectKey = { aiProjectId: aiProject.id };
      config = await getWebsiteConfigByAIProjectId(env.DB, aiProject.id);
      projectView = { project_name: aiProject.project_name || 'My Website', project_id: publicId, id: aiProject.id };
    } else {
      const regularProject = await getProjectByPreviewId(env.DB, publicId);
      if (!regularProject) return json({ success: false, error: 'Project not found' }, 404);
      let businessName = regularProject.website_url;
      try {
        const profile = JSON.parse(regularProject.company_profile_json || '{}');
        if (profile && profile.name) businessName = profile.name;
      } catch { /* keep url */ }
      projectKey = { projectId: regularProject.id };
      config = await getWebsiteConfigByRegularProjectId(env.DB, regularProject.id);
      projectView = { project_name: businessName, project_id: publicId, id: regularProject.id };
    }

    if (!config) return json({ success: false, error: 'Website configuration not found' }, 400);

    await ensurePagesForProject(env.DB, projectKey);
    const pages = await getPagesByProject(env.DB, projectKey);
    const navPages = pages.filter((p) => p.is_visible !== 0);

    // Shared site sections (header/footer) — rendered on every page.
    const siteSections = await getSiteSections(env.DB, projectKey, true);
    const header = siteSections.filter((s) => s.section_type === 'header');
    const footer = siteSections.filter((s) => s.section_type === 'footer');

    // Clean previous output so deleted/renamed pages don't linger.
    const prefix = `published/${publicId}/`;
    try {
      const listed = await env.STORAGE.list({ prefix });
      await Promise.all((listed.objects || []).map((o) => env.STORAGE.delete(o.key)));
    } catch (e) {
      console.error('deploy: failed clearing old files (continuing):', e.message);
    }

    // Render + store each visible page.
    let pageCount = 0;
    for (const page of pages) {
      if (page.is_visible === 0) continue;
      const body = page.is_home
        ? await getHomeBodySections(env.DB, projectKey, page.id, true)
        : await getBodySectionsForPage(env.DB, page.id, true);
      const combined = [...header, ...body, ...footer];
      if (combined.length === 0) continue;

      const html = assemblePage(combined, config, projectView, {
        pages: navPages,
        currentSlug: page.slug,
        previewBase: `/site/${publicId}`,
        preordered: true,
      });
      await uploadToR2(env.STORAGE, `published/${publicId}/${page.slug}.html`, html, 'text/html; charset=utf-8');
      pageCount++;
    }

    if (pageCount === 0) return json({ success: false, error: 'Nothing to deploy' }, 400);

    const deployedUrl = `${env.APP_URL || ''}/site/${publicId}`;

    // Persist for AI-builder projects (the refactor `projects` table has no
    // deployed_url column — returned but not stored; additive column is a later nicety).
    if (aiProject) {
      await updateAIProject(env.DB, aiProject.id, {
        status: 'deployed',
        deployed_url: deployedUrl,
        deployed_at: Math.floor(Date.now() / 1000),
      });
    }

    return json({ success: true, message: 'Website published', deployed_url: deployedUrl, pages: pageCount });
  } catch (error) {
    console.error('Error deploying website:', error);
    return json({ success: false, error: 'Failed to deploy website', details: error.message }, 500);
  }
}
