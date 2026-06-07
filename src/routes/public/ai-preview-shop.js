// GET /ai-preview/:project_id/shop                 -> shop index preview (active products)
// GET /ai-preview/:project_id/shop/:product_slug   -> single product preview (inactive
//                                                     too, so the manager can preview)
// Live render from the DB through the same synthetic-section pipeline deploy uses.
// Registered BEFORE the generic /ai-preview/:project_id/:page_slug route
// (the router is first-match and "shop" would otherwise be eaten by :page_slug).

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { ensurePagesForProject, getPagesByProject } from '../../db/ai-pages.js';
import { getSiteSections } from '../../db/ai-sections.js';
import { getProductsByProject } from '../../db/products.js';
import { shopNavPage, shopListSection, shopProductSection } from '../../utils/shop-render.js';
import { assemblePage } from '../../utils/ai-page-assembler.js';

export async function handleAIPreviewShop(ctx) {
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
    const allProducts = await getProductsByProject(env.DB, projectKey);
    const active = allProducts.filter((p) => p.active);
    const currency = config.store_currency || 'usd';

    const siteSections = await getSiteSections(env.DB, projectKey, true);
    const header = siteSections.filter((s) => s.section_type === 'header');
    const footer = siteSections.filter((s) => s.section_type === 'footer');

    const base = `/ai-preview/${publicId}`;
    let bodySection;
    if (params.product_slug) {
      // Single product — hidden ones render too so they can be previewed.
      const product = allProducts.find((p) => p.slug === params.product_slug);
      if (!product) return new Response('Product not found', { status: 404 });
      bodySection = shopProductSection(product, base, currency);
    } else {
      bodySection = shopListSection(active, base, currency, language);
    }

    const navPages = pages.filter((p) => p.is_visible !== 0);
    if (allProducts.length) navPages.push(shopNavPage(language));

    const html = assemblePage([...header, bodySection, ...footer], config, project, {
      pages: navPages,
      currentSlug: 'shop',
      previewBase: base,
      embed: true, // bare render (no Preview-Mode banner) — linked from the store manager
      preordered: true,
      lang: language,
      appOrigin: env.APP_URL || '',
    });
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('shop preview error:', e);
    return new Response('Failed to render shop preview', { status: 500 });
  }
}
