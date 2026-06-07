// GET /ai-preview/:project_id
// Display preview of AI-generated website

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getSiteSections, getBodySectionsForPage, getHomeBodySections } from '../../db/ai-sections.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { ensurePagesForProject, getPagesByProject, getPageBySlug, getHomePage } from '../../db/ai-pages.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { generatePreview, assemblePage } from '../../utils/ai-page-assembler.js';
import { getPostsByProject } from '../../db/blog-posts.js';
import { getProductsByProject } from '../../db/products.js';
import { blogNavPage } from '../../utils/blog-render.js';
import { shopNavPage } from '../../utils/shop-render.js';

/**
 * Handle AI preview page
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIPreview(ctx) {
  const { env, params, query } = ctx;

  try {
    const { project_id } = params;

    // Try to load from ai_projects first, then regular projects
    let project = await getAIProjectByProjectId(env.DB, project_id);
    let config, projectKey, isAIBuilder = true;

    if (project) {
      // AI Builder project - check if preview is ready
      if (project.status === 'conversation' || project.status === 'content_generation') {
      return new Response(
        `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generating Preview...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
    }
    .container {
      max-width: 600px;
      padding: 2rem;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.25rem;
      opacity: 0.9;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 2rem auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Generating Your Website</h1>
    <p>Please wait while we create your personalized website...</p>
    <p style="font-size: 1rem; margin-top: 2rem;">This usually takes 10-15 seconds.</p>
  </div>
  <script>
    // Auto-refresh every 3 seconds
    setTimeout(() => location.reload(), 3000);
  </script>
</body>
</html>
        `,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }
      );
      }

      // Config + project key for AI Builder project
      config = await getWebsiteConfigByAIProjectId(env.DB, project.id);
      projectKey = { aiProjectId: project.id };
    } else {
      // Try regular refactoring project
      const regularProject = await getProjectByPreviewId(env.DB, project_id);

      if (!regularProject) {
        return new Response('Project not found', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Check if it uses templates
      if (!regularProject.use_templates) {
        // Redirect to old preview route for CSS-only projects
        return Response.redirect(`/preview/${project_id}`, 302);
      }

      // Prefer the real business name (from the stored company profile) for the
      // page <title>; fall back to the URL only if unavailable.
      let businessName = regularProject.website_url;
      try {
        const profile = JSON.parse(regularProject.company_profile_json || '{}');
        if (profile && profile.name) businessName = profile.name;
      } catch {
        // keep URL fallback
      }

      // Convert regular project to AI project format for rendering
      project = {
        project_id: regularProject.preview_id,
        project_name: businessName,
        id: regularProject.id,
        language: regularProject.language || 'en',
      };

      config = await getWebsiteConfigByRegularProjectId(env.DB, regularProject.id);
      projectKey = { projectId: regularProject.id };
      isAIBuilder = false;
    }

    if (!config) {
      return new Response('Preview not ready yet', {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Multi-page: ensure pages exist (lazily upgrades legacy single-page projects),
    // then resolve the target page (slug param, else home; unknown slug → home).
    await ensurePagesForProject(env.DB, projectKey);
    const pages = await getPagesByProject(env.DB, projectKey);

    // Nav parity with deploy.js: published posts / active products add the
    // Blog + Shop nav entries, so the editor preview matches what publishes
    // (and clicking them renders those pages right in the preview iframe).
    const siteLang = project.language || 'en';
    const navPages = [...pages];
    const publishedPosts = await getPostsByProject(env.DB, projectKey, true);
    if (publishedPosts.length) navPages.push(blogNavPage(siteLang));
    const activeProducts = await getProductsByProject(env.DB, projectKey, true);
    if (activeProducts.length) navPages.push(shopNavPage(siteLang));
    const slug = params.page_slug;
    let page = slug ? await getPageBySlug(env.DB, projectKey, slug) : null;
    if (!page) page = await getHomePage(env.DB, projectKey);

    // A rendered page = shared header + that page's body sections + shared footer.
    const siteSections = await getSiteSections(env.DB, projectKey, true);
    const header = siteSections.filter((s) => s.section_type === 'header');
    const footer = siteSections.filter((s) => s.section_type === 'footer');
    const body = page && page.is_home
      ? await getHomeBodySections(env.DB, projectKey, page.id, true)
      : await getBodySectionsForPage(env.DB, page ? page.id : -1, true);
    const combined = [...header, ...body, ...footer];

    if (combined.length === 0) {
      return new Response('Preview not ready yet', {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Generate preview HTML. When embedded in the customize page iframe
    // (?embed=1), skip the "Preview Mode / Customize" banner so the Customize
    // link can't be re-triggered nested inside the editor.
    const embed = query && (query.embed === '1' || query.embed === 'true');
    const opts = {
      pages: navPages,
      currentSlug: page ? page.slug : 'home',
      previewBase: `/ai-preview/${project.project_id}`,
      embed,
      preordered: true,
      lang: siteLang,
      // Badge "Built with Caddisfly" links back to THIS app origin (the new
      // landing), not the hardcoded prod domain that still runs old code.
      appOrigin: env.APP_URL || '',
    };
    // Show the "Preview Mode / Customize" banner for BOTH AI-builder and
    // refactor projects (the customize page handles both); only the embedded
    // customize iframe (?embed=1) renders bare.
    const html = !embed
      ? generatePreview(combined, config, project, opts)
      : assemblePage(combined, config, project, opts);

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error displaying preview:', error);

    return new Response(
      `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f7fafc;
      color: #2d3748;
      text-align: center;
      padding: 2rem;
    }
    .error {
      max-width: 600px;
    }
    h1 {
      color: #e53e3e;
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.125rem;
      margin-bottom: 2rem;
    }
    a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="error">
    <h1>Oops! Something went wrong</h1>
    <p>We encountered an error while loading your preview.</p>
    <p><a href="/">Go back to home</a></p>
  </div>
</body>
</html>
      `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}
