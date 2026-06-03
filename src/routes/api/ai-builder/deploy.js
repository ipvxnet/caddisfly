// POST /api/ai-builder/:project_id/deploy
// Publish a (multi-page) site: render each page to R2 and serve it at /site/:id.

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { getProjectByPreviewId, updateProject } from '../../../db/projects.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../../db/ai-config.js';
import { ensurePagesForProject, getPagesByProject } from '../../../db/ai-pages.js';
import { getSiteSections, getBodySectionsForPage, getHomeBodySections } from '../../../db/ai-sections.js';
import { assemblePage } from '../../../utils/ai-page-assembler.js';
import { uploadToR2 } from '../../../utils/r2-storage.js';
import { getUserTier } from '../../../utils/rate-limiter.js';
import { countPublishedSites } from '../../../db/billing.js';
import { PUBLISH_LIMITS } from '../../../utils/credits.js';
import { ensureUniqueSubdomain } from '../../../db/subdomains.js';

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
    let projectKey, config, projectView, email, regularProjectRow = null;

    if (aiProject) {
      projectKey = { aiProjectId: aiProject.id };
      config = await getWebsiteConfigByAIProjectId(env.DB, aiProject.id);
      projectView = { project_name: aiProject.project_name || 'My Website', project_id: publicId, id: aiProject.id };
      email = aiProject.customer_email;
    } else {
      const regularProject = await getProjectByPreviewId(env.DB, publicId);
      if (!regularProject) return json({ success: false, error: 'Project not found' }, 404);
      regularProjectRow = regularProject;
      let businessName = regularProject.website_url;
      try {
        const profile = JSON.parse(regularProject.company_profile_json || '{}');
        if (profile && profile.name) businessName = profile.name;
      } catch { /* keep url */ }
      projectKey = { projectId: regularProject.id };
      config = await getWebsiteConfigByRegularProjectId(env.DB, regularProject.id);
      projectView = { project_name: businessName, project_id: publicId, id: regularProject.id };
      email = regularProject.customer_email;
    }

    if (!config) return json({ success: false, error: 'Website configuration not found' }, 400);

    // Tier drives the publish-count cap + the "Built with Caddisfly" badge.
    const tier = await getUserTier(env.DB, email);
    const publishLimit = PUBLISH_LIMITS[tier] != null ? PUBLISH_LIMITS[tier] : 1;

    // Publish-count gate (enforced in production only; this site is excluded
    // from the count so re-publishing an already-live site is always allowed).
    if (env.ENVIRONMENT === 'production' && Number.isFinite(publishLimit)) {
      const alreadyPublished = await countPublishedSites(env.DB, email, publicId);
      if (alreadyPublished >= publishLimit) {
        return json(
          {
            success: false,
            error: `You've reached your plan's published-site limit (${publishLimit} on ${tier.replace('_', ' ')}). Upgrade to publish more.`,
            published: alreadyPublished,
            limit: publishLimit,
            billing_url: '/billing',
          },
          402
        );
      }
    }

    await ensurePagesForProject(env.DB, projectKey);
    const pages = await getPagesByProject(env.DB, projectKey);
    const navPages = pages.filter((p) => p.is_visible !== 0);

    // Shared site sections (header/footer) — rendered on every page.
    const siteSections = await getSiteSections(env.DB, projectKey, true);
    const header = siteSections.filter((s) => s.section_type === 'header');
    const footer = siteSections.filter((s) => s.section_type === 'footer');

    // Assign a unique subdomain for *.caddisfly.app hosting (idempotent).
    const existingSub = aiProject ? aiProject.subdomain : regularProjectRow && regularProjectRow.subdomain;
    const subdomain = await ensureUniqueSubdomain(env.DB, projectKey, projectView.project_name, existingSub);

    // Clean previous output (both the /site/:id copy and the subdomain copy) so
    // deleted/renamed pages don't linger.
    for (const prefix of [`published/${publicId}/`, `sites/${subdomain}/`]) {
      try {
        const listed = await env.STORAGE.list({ prefix });
        await Promise.all((listed.objects || []).map((o) => env.STORAGE.delete(o.key)));
      } catch (e) {
        console.error('deploy: failed clearing old files (continuing):', e.message);
      }
    }

    const appOrigin = env.APP_URL || '';

    // Render + store each visible page TWICE: once for /site/:id (nav rooted at
    // /site/<id>) and once for the subdomain (nav rooted at /). Analytics beacon
    // always posts to the app origin (the sites worker is DB-free).
    let pageCount = 0;
    for (const page of pages) {
      if (page.is_visible === 0) continue;
      const body = page.is_home
        ? await getHomeBodySections(env.DB, projectKey, page.id, true)
        : await getBodySectionsForPage(env.DB, page.id, true);
      const combined = [...header, ...body, ...footer];
      if (combined.length === 0) continue;

      const common = {
        pages: navPages,
        currentSlug: page.slug,
        preordered: true,
        hideBadge: tier !== 'free_trial', // paid plans remove "Built with Caddisfly"
        trackId: publicId, // cookieless analytics beacon on published pages
        appOrigin, // absolute beacon target (works on both serving surfaces)
      };

      // /site/:id copy (app worker).
      const idHtml = assemblePage(combined, config, projectView, { ...common, previewBase: `/site/${publicId}` });
      await uploadToR2(env.STORAGE, `published/${publicId}/${page.slug}.html`, idHtml, 'text/html; charset=utf-8');

      // Subdomain copy (caddisfly-sites worker) — nav rooted at /.
      const subHtml = assemblePage(combined, config, projectView, { ...common, previewBase: '' });
      await uploadToR2(env.STORAGE, `sites/${subdomain}/${page.slug}.html`, subHtml, 'text/html; charset=utf-8');
      // Home also written as index.html so the worker serves "/" DB-free.
      if (page.is_home) {
        await uploadToR2(env.STORAGE, `sites/${subdomain}/index.html`, subHtml, 'text/html; charset=utf-8');
      }

      pageCount++;
    }

    if (pageCount === 0) return json({ success: false, error: 'Nothing to deploy' }, 400);

    // Canonical URL: the subdomain on the sites domain. The sites worker serves
    // *.caddisfly.app in BOTH preview and prod, so default to caddisfly.app when
    // SITES_BASE is unset (matches the customize page's domains panel).
    const sitesBase = env.SITES_BASE || 'caddisfly.app';
    const subdomainUrl = `https://${subdomain}.${sitesBase}`;
    const siteUrl = `${appOrigin}/site/${publicId}`;
    const deployedUrl = subdomainUrl || siteUrl;

    // Persist for AI-builder projects (the refactor `projects` table has no
    // deployed_url column — returned but not stored; additive column is a later nicety).
    if (aiProject) {
      await updateAIProject(env.DB, aiProject.id, {
        status: 'deployed',
        deployed_url: deployedUrl,
        deployed_at: Math.floor(Date.now() / 1000),
      });
    } else if (regularProjectRow) {
      // Mark refactor projects deployed too so the publish-count cap is consistent.
      await updateProject(env.DB, regularProjectRow.id, { status: 'deployed' });
    }

    return json({
      success: true,
      message: 'Website published',
      deployed_url: deployedUrl,
      subdomain,
      subdomain_url: subdomainUrl || null,
      site_url: siteUrl,
      pages: pageCount,
    });
  } catch (error) {
    console.error('Error deploying website:', error);
    return json({ success: false, error: 'Failed to deploy website', details: error.message }, 500);
  }
}
