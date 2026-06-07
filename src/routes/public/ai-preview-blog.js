// GET /ai-preview/:project_id/blog              -> blog index preview (published posts)
// GET /ai-preview/:project_id/blog/:post_slug   -> single post preview (drafts too,
//                                                  so the manager can preview before publishing)
// Live render from the DB through the same synthetic-section pipeline deploy uses.
// Registered BEFORE the generic /ai-preview/:project_id/:page_slug route
// (the router is first-match and "blog" would otherwise be eaten by :page_slug).

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { ensurePagesForProject, getPagesByProject } from '../../db/ai-pages.js';
import { getSiteSections } from '../../db/ai-sections.js';
import { getPostsByProject, getPostBySlug } from '../../db/blog-posts.js';
import { blogNavPage, blogListSection, blogPostSection } from '../../utils/blog-render.js';
import { getProductsByProject } from '../../db/products.js';
import { shopNavPage } from '../../utils/shop-render.js';
import { assemblePage } from '../../utils/ai-page-assembler.js';

export async function handleAIPreviewBlog(ctx) {
  const { env, params } = ctx;
  try {
    const publicId = params.project_id;

    let project = await getAIProjectByProjectId(env.DB, publicId);
    let config, projectKey, language, businessName;
    if (project) {
      config = await getWebsiteConfigByAIProjectId(env.DB, project.id);
      projectKey = { aiProjectId: project.id };
      language = project.language || 'en';
      businessName = project.project_name || 'My Website';
      project = { project_id: publicId, project_name: businessName, id: project.id };
    } else {
      const regular = await getProjectByPreviewId(env.DB, publicId);
      if (!regular) return new Response('Project not found', { status: 404 });
      businessName = regular.website_url || 'My Website';
      try {
        const p = JSON.parse(regular.company_profile_json || '{}');
        if (p && p.name) businessName = p.name;
      } catch { /* keep fallback */ }
      config = await getWebsiteConfigByRegularProjectId(env.DB, regular.id);
      projectKey = { projectId: regular.id };
      language = regular.language || 'en';
      project = { project_id: publicId, project_name: businessName, id: regular.id };
    }
    if (!config) return new Response('Preview not ready yet', { status: 400 });

    await ensurePagesForProject(env.DB, projectKey);
    const pages = await getPagesByProject(env.DB, projectKey);
    const allPosts = await getPostsByProject(env.DB, projectKey);
    const published = allPosts.filter((p) => p.status === 'published');

    const siteSections = await getSiteSections(env.DB, projectKey, true);
    const header = siteSections.filter((s) => s.section_type === 'header');
    const footer = siteSections.filter((s) => s.section_type === 'footer');

    const base = `/ai-preview/${publicId}`;
    let bodySection;
    if (params.post_slug) {
      // Single post — drafts render too so they can be previewed pre-publish.
      const post = await getPostBySlug(env.DB, projectKey, params.post_slug);
      if (!post) return new Response('Post not found', { status: 404 });
      bodySection = blogPostSection(post, base, { businessName });
    } else {
      bodySection = blogListSection(published, base, language);
    }

    const navPages = pages.filter((p) => p.is_visible !== 0);
    if (allPosts.length) navPages.push(blogNavPage(language));
    const activeProducts = await getProductsByProject(env.DB, projectKey, true);
    if (activeProducts.length) navPages.push(shopNavPage(language));

    const html = assemblePage([...header, bodySection, ...footer], config, project, {
      pages: navPages,
      currentSlug: 'blog',
      previewBase: base,
      embed: true, // bare render (no Preview-Mode banner) — blog preview is linked from the manager
      preordered: true,
      lang: language,
      appOrigin: env.APP_URL || '',
    });
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('blog preview error:', e);
    return new Response('Failed to render blog preview', { status: 500 });
  }
}
