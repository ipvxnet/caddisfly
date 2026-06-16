// POST /api/ai-builder/:project_id/deploy
// Publish a (multi-page) site: render each page to R2 and serve it at /site/:id.

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { audit } from '../../../utils/audit.js';
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
import { canDeploy } from '../../../middleware/project-access.js';
import { getPostsByProject } from '../../../db/blog-posts.js';
import { autoSyndicateOnDeploy } from './social.js';
import { blogNavPage, blogListSection, blogPostSection } from '../../../utils/blog-render.js';
import { getProductsByProject } from '../../../db/products.js';
import { getServices } from '../../../db/bookings.js';
import { parseHolidaySettings } from '../../../utils/holiday-themes.js';
import { shopNavPage, shopListSection, shopProductSection } from '../../../utils/shop-render.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Deploy the website: write one static HTML file per page to R2 under
 * published/<publicId>/<slug>.html, served by GET /site/:id[/:slug].
 */
export async function handleAIBuilderDeploy(ctx) {
  const { env, params } = ctx;

  // Role gate: publishing requires a VERIFIED session (owner/admin/publisher).
  // A signed-out drafter must verify their email first — signal auth_required so
  // the UI opens the magic-link sign-in; a signed-in member just lacks the role.
  if (ctx.projectRole && !canDeploy(ctx.projectRole)) {
    if (!ctx.billingEmail) {
      return json({ success: false, auth_required: true, error: 'Verify your email to publish this site.' }, 401);
    }
    return json({ success: false, error: 'Only the owner, admins, and publishers can publish this site.' }, 403);
  }

  try {
    const publicId = params.project_id;

    // Resolve project (AI builder first, else refactoring), build the project key,
    // config, and a view object for the page <title>.
    const aiProject = await getAIProjectByProjectId(env.DB, publicId);
    let projectKey, config, projectView, email, regularProjectRow = null;
    let business = {}; // SEO/JSON-LD identity: name + (refactor) Places contact data

    if (aiProject) {
      projectKey = { aiProjectId: aiProject.id };
      config = await getWebsiteConfigByAIProjectId(env.DB, aiProject.id);
      projectView = { project_name: aiProject.project_name || 'My Website', project_id: publicId, id: aiProject.id };
      email = aiProject.customer_email;
      business = { name: projectView.project_name };
    } else {
      const regularProject = await getProjectByPreviewId(env.DB, publicId);
      if (!regularProject) return json({ success: false, error: 'Project not found' }, 404);
      regularProjectRow = regularProject;
      let businessName = regularProject.website_url;
      try {
        const profile = JSON.parse(regularProject.company_profile_json || '{}');
        if (profile && profile.name) businessName = profile.name;
        business = {
          name: profile.name || businessName,
          description: profile.description || '',
          address: profile.address || profile.location || '',
          phone: profile.phone || '',
          logo: profile.logo || '',
        };
      } catch { business = { name: businessName }; }
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

    // Blog: published posts become /blog + /blog/<slug> pages, and a Blog nav
    // link appears on every page (synthetic nav entry; see utils/blog-render.js).
    const siteLang = (aiProject && aiProject.language) || (regularProjectRow && regularProjectRow.language) || 'en';
    const publishedPosts = await getPostsByProject(env.DB, projectKey, true);
    if (publishedPosts.length) navPages.push(blogNavPage(siteLang));

    // Shop: active products become /shop + /shop/<slug> pages with a Shop nav
    // link (synthetic, like the blog; see utils/shop-render.js).
    const activeProducts = await getProductsByProject(env.DB, projectKey, true);
    const storeCurrency = config.store_currency || 'usd';
    if (activeProducts.length) navPages.push(shopNavPage(siteLang));

    // 📅 booking section: active services render live; slots come via the API.
    const bookingServices = await getServices(env.DB, projectKey, { activeOnly: true });

    // 🎄 holiday decor: baked only while a skin is applied (and decor is on).
    const holSettings = parseHolidaySettings(config);
    const activeHolidayDecor = holSettings.applied && holSettings.decor ? holSettings.applied.holiday : null;

    // Shared site sections (header/footer) — rendered on every page.
    const siteSections = await getSiteSections(env.DB, projectKey, true);
    const header = siteSections.filter((s) => s.section_type === 'header');
    const footer = siteSections.filter((s) => s.section_type === 'footer');

    // Assign a unique subdomain for *.caddisfly.app hosting (idempotent).
    const existingSub = aiProject ? aiProject.subdomain : regularProjectRow && regularProjectRow.subdomain;
    const subdomain = await ensureUniqueSubdomain(env.DB, projectKey, projectView.project_name, existingSub);

    // Canonical base for SEO tags: the site's subdomain on the sites domain. The
    // sites worker rewrites this host → a custom domain when one is connected, so
    // each public host self-canonicalizes. In the preview env the public host
    // carries the -preview suffix (`<sub>-preview.caddisfly.app`, route owned by
    // the preview sites worker) — bake it so preview canonicals match reality.
    const sitesBaseDomain = env.SITES_BASE || 'caddisfly.app';
    const hostLabel = `${subdomain}${env.SITES_PREVIEW_SUFFIX || ''}`;
    const subdomainBase = `https://${hostLabel}.${sitesBaseDomain}`;

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
    let heroImage = null; // og:image last-resort fallback (first hero photo found)
    for (const page of pages) {
      if (page.is_visible === 0) continue;
      const body = page.is_home
        ? await getHomeBodySections(env.DB, projectKey, page.id, true)
        : await getBodySectionsForPage(env.DB, page.id, true);
      const combined = [...header, ...body, ...footer];
      if (combined.length === 0) continue;

      if (!heroImage) {
        const hero = body.find((s) => s.section_type === 'hero');
        try {
          const hc = hero ? JSON.parse(hero.content_json || '{}') : {};
          heroImage = hc.background_image || hc.image_url || null;
        } catch { /* ignore */ }
      }

      // Canonical points at the subdomain for every copy (consolidates ranking;
      // the sites worker swaps the host for custom domains at serve time).
      const canonicalUrl = subdomainBase + (page.is_home ? '/' : `/${page.slug}`);

      const common = {
        pages: navPages,
        currentSlug: page.slug,
        preordered: true,
        hideBadge: tier !== 'free_trial', // paid plans remove "Built with Caddisfly"
        trackId: publicId, // cookieless analytics beacon on published pages
        appOrigin, // absolute beacon target (works on both serving surfaces)
        lang: siteLang,
        products: activeProducts, // 🛍 featured-products section (live data)
        bookingServices, // 📅 booking section (live data)
        holiday: activeHolidayDecor, // 🎄 flyby overlay while a skin is applied
        // SEO: per-page overrides + site social image + business identity.
        seoTitle: page.seo_title || null,
        seoDescription: page.seo_description || null,
        socialImage: config.social_image || null,
        heroImage, // og:image fallback when no social image / logo is set
        canonicalUrl,
        pageTitle: page.title || null,
        business,
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

    // Bake the blog: index + one page per published post, in BOTH copies
    // (/site/:id and the subdomain). Drafts never publish.
    if (publishedPosts.length) {
      const blogCommon = {
        pages: navPages,
        currentSlug: 'blog',
        preordered: true,
        hideBadge: tier !== 'free_trial',
        trackId: publicId,
        appOrigin,
        lang: siteLang,
        business,
      };
      const writeBlogPage = async (slugPath, sectionFor, seo) => {
        // /site/:id copy
        const idSections = [...header, sectionFor(`/site/${publicId}`), ...footer];
        const idHtml = assemblePage(idSections, config, projectView, { ...blogCommon, ...seo, previewBase: `/site/${publicId}` });
        await uploadToR2(env.STORAGE, `published/${publicId}/${slugPath}.html`, idHtml, 'text/html; charset=utf-8');
        // Subdomain copy (nav rooted at /)
        const subSections = [...header, sectionFor(''), ...footer];
        const subHtml = assemblePage(subSections, config, projectView, { ...blogCommon, ...seo, previewBase: '' });
        await uploadToR2(env.STORAGE, `sites/${subdomain}/${slugPath}.html`, subHtml, 'text/html; charset=utf-8');
      };

      await writeBlogPage(
        'blog',
        (base) => blogListSection(publishedPosts, base, siteLang),
        { canonicalUrl: `${subdomainBase}/blog`, pageTitle: 'Blog' }
      );
      for (const post of publishedPosts) {
        await writeBlogPage(
          `blog/${post.slug}`,
          (base) => blogPostSection(post, base, { canonicalUrl: `${subdomainBase}/blog/${post.slug}`, businessName: business.name || '' }),
          {
            canonicalUrl: `${subdomainBase}/blog/${post.slug}`,
            pageTitle: post.title,
            seoTitle: post.seo_title || null,
            seoDescription: post.seo_description || post.excerpt || null,
            // og:image must be absolute for crawlers; covers are stored as
            // relative /preview-asset/ URLs.
            socialImage: post.cover_image
              ? (post.cover_image.startsWith('/') ? `${subdomainBase}${post.cover_image}` : post.cover_image)
              : config.social_image || null,
          }
        );
      }
    }

    // Bake the shop: index + one page per active product, in BOTH copies
    // (/site/:id and the subdomain). Hidden products never publish. The cart
    // JS inside the shop templates POSTs to the app origin (forms pattern);
    // checkout requires the merchant's connected Stripe account at call time.
    if (activeProducts.length) {
      const shopCommon = {
        pages: navPages,
        currentSlug: 'shop',
        preordered: true,
        hideBadge: tier !== 'free_trial',
        trackId: publicId,
        appOrigin,
        lang: siteLang,
        business,
      };
      const writeShopPage = async (slugPath, sectionFor, seo) => {
        // /site/:id copy
        const idSections = [...header, sectionFor(`/site/${publicId}`), ...footer];
        const idHtml = assemblePage(idSections, config, projectView, { ...shopCommon, ...seo, previewBase: `/site/${publicId}` });
        await uploadToR2(env.STORAGE, `published/${publicId}/${slugPath}.html`, idHtml, 'text/html; charset=utf-8');
        // Subdomain copy (nav rooted at /)
        const subSections = [...header, sectionFor(''), ...footer];
        const subHtml = assemblePage(subSections, config, projectView, { ...shopCommon, ...seo, previewBase: '' });
        await uploadToR2(env.STORAGE, `sites/${subdomain}/${slugPath}.html`, subHtml, 'text/html; charset=utf-8');
      };

      await writeShopPage(
        'shop',
        (base) => shopListSection(activeProducts, base, storeCurrency, siteLang),
        { canonicalUrl: `${subdomainBase}/shop`, pageTitle: 'Shop' }
      );
      for (const product of activeProducts) {
        await writeShopPage(
          `shop/${product.slug}`,
          (base) => shopProductSection(product, base, storeCurrency),
          {
            canonicalUrl: `${subdomainBase}/shop/${product.slug}`,
            pageTitle: product.name,
            seoDescription: (product.description || '').replace(/\s+/g, ' ').trim().slice(0, 160) || null,
            socialImage: product.image
              ? (product.image.startsWith('/') ? `${subdomainBase}${product.image}` : product.image)
              : config.social_image || null,
          }
        );
      }
    }

    // Canonical URL: the subdomain on the sites domain. The sites worker serves
    // *.caddisfly.app in BOTH preview and prod, so default to caddisfly.app when
    // SITES_BASE is unset (matches the customize page's domains panel).
    const sitesBase = env.SITES_BASE || 'caddisfly.app';
    const subdomainUrl = `https://${hostLabel}.${sitesBase}`;
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

    audit(ctx, 'site.publish', { teamOwner: email, resourceType: 'site', resourceId: publicId, resourceName: projectView.project_name, metadata: { subdomain } });

    // Auto-share newly-live blog posts to connected socials (best-effort, off
    // the response path). No-op unless the site has a platform connected. `site`
    // lets the announcement copy be AI-written (credits, silent fallback).
    if (ctx.ctx && ctx.ctx.waitUntil) {
      let industry = (aiProject && aiProject.industry) || '';
      if (!industry && regularProjectRow) {
        try { industry = JSON.parse(regularProjectRow.company_profile_json || '{}').category || ''; } catch { /* ignore */ }
      }
      const site = {
        email,
        name: projectView.project_name || 'My Website',
        industry,
        language: (aiProject && aiProject.language) || (regularProjectRow && regularProjectRow.language) || 'en',
        projectId: publicId,
      };
      ctx.ctx.waitUntil(autoSyndicateOnDeploy(env, { projectKey, subdomain, site, ctx }).catch((e) => console.error('social syndicate:', e.message)));
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
