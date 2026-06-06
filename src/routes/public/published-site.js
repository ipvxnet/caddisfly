// GET /site/:project_id                       -> published home page
// GET /site/:project_id/:page_slug            -> a published page (incl. "blog"/"shop")
// GET /site/:project_id/blog/:post_slug       -> a published blog post
// GET /site/:project_id/shop/:product_slug    -> a published product page
// Serves the static HTML written to R2 at deploy time (published/<id>/<slug>.html).

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { getHomePage, getPageBySlug } from '../../db/ai-pages.js';
import { getFromR2 } from '../../utils/r2-storage.js';

function notPublished() {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not published</title>
     <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;color:#4a5568}</style>
     </head><body><div><h1 style="margin:0 0 .5rem">This site isn't published yet</h1>
     <p style="color:#718096">Once it's published it will appear here.</p></div></body></html>`,
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/**
 * Serve a published page from R2.
 */
export async function handlePublishedSite(ctx) {
  const { env, params } = ctx;
  const publicId = params.project_id;

  // Resolve to a project key just to find the requested/home slug.
  const aiProject = await getAIProjectByProjectId(env.DB, publicId);
  let projectKey = null;
  if (aiProject) {
    projectKey = { aiProjectId: aiProject.id };
  } else {
    const regularProject = await getProjectByPreviewId(env.DB, publicId);
    if (regularProject) projectKey = { projectId: regularProject.id };
  }
  if (!projectKey) return notPublished();

  // Resolve the slug: blog post / product (nested), explicit page, else home.
  let slug = params.post_slug ? `blog/${params.post_slug}`
    : params.product_slug ? `shop/${params.product_slug}`
    : params.page_slug;
  if (!slug) {
    const home = await getHomePage(env.DB, projectKey);
    slug = home ? home.slug : 'home';
  }

  const read = (s) => getFromR2(env.STORAGE, `published/${publicId}/${s}.html`);

  let html = await read(slug);
  if (!html && (params.page_slug || params.post_slug || params.product_slug)) {
    // Unknown/renamed slug → fall back to the home page.
    const home = await getHomePage(env.DB, projectKey);
    if (home) html = await read(home.slug);
  }
  if (!html) return notPublished();

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
