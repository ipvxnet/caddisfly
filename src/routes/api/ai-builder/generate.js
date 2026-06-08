// POST /api/ai-builder/:project_id/generate-preview
// Generate website preview from conversation answers

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { audit } from '../../../utils/audit.js';
import { getAnsweredConversations } from '../../../db/ai-conversations.js';
import { createSection } from '../../../db/ai-sections.js';
import { createPage } from '../../../db/ai-pages.js';
import { planPages } from '../../../utils/pages-blueprint.js';
import { getOrCreateWebsiteConfig, updateWebsiteConfig } from '../../../db/ai-config.js';
import { buildContext, generateSectionContent } from '../../../utils/ai-content-generator.js';
import { getFontPairing } from '../../../utils/ai-prompts.js';
import { checkAIGenerationLimit, getUserTier, formatRateLimitError, limitsDisabled, unlimited } from '../../../utils/rate-limiter.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS } from '../../../utils/credits.js';
import { inferIndustry, paletteFor, imageKeywordsFor } from '../../../utils/industry-style.js';
import { getRecipe, recipeVariant } from '../../../utils/industry-recipe.js';
import { searchStockPhotos } from '../../../utils/stock-photos.js';
import { attachImages, makePhotoPicker } from '../../../utils/section-images.js';

/**
 * Handle preview generation
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderGenerate(ctx) {
  const { env, params } = ctx;

  try {
    const { project_id } = params;

    // Get project
    const project = await getAIProjectByProjectId(env.DB, project_id);

    if (!project) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Project not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check AI generation rate limits (most important for cost control)
    const tier = await getUserTier(env.DB, project.customer_email);
    const limitCheck = limitsDisabled(env)
      ? unlimited(tier)
      : await checkAIGenerationLimit(env.DB, project.customer_email, tier);

    if (!limitCheck.allowed) {
      return new Response(
        JSON.stringify(formatRateLimitError(limitCheck, 'generations')),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // AI credit pre-check (enforced in production; non-blocking in preview/dev)
    const afford = await canAfford(env, env.DB, project.customer_email, CREDIT_COSTS.generate);
    if (!afford.ok) {
      return new Response(JSON.stringify(formatCreditError(afford.state, 'a website generation')), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if conversation is complete
    if (project.status === 'conversation') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Conversation not complete yet',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get conversation answers
    const conversations = await getAnsweredConversations(env.DB, project.id);

    if (conversations.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No conversation data found',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Build context from conversation
    const context = buildContext(project, conversations);

    // Get or create website config
    let config = await getOrCreateWebsiteConfig(env.DB, project.id);

    // Industry-aware styling: pick a palette + recipe that fit the business
    // instead of a generic AI-guessed blue (e.g. a restaurant gets warm colors).
    const industry = inferIndustry(context.industry, context.business_type, context.business_name);
    const recipe = getRecipe(industry);
    const palette = paletteFor(industry);
    // The user's explicit style choice wins for fonts; else the recipe's pairing.
    const fonts = context.style ? getFontPairing(context.style) : recipe.fonts;
    config = await updateWebsiteConfig(env.DB, project.id, {
      primary_color: palette.primary,
      secondary_color: palette.secondary,
      font_heading: fonts.heading,
      font_body: fonts.body,
      style_theme: context.style,
    });

    // Ground AI copy in the vertical (real services, tone).
    context.industry = industry;
    context.service_hints = recipe.serviceHints;
    if (!context.tone || context.tone === 'professional') context.tone = recipe.tone;

    // Fetch real imagery once for the whole site (graceful [] without a key).
    const stockPhotos = await searchStockPhotos(
      env,
      imageKeywordsFor(industry, context.business_name),
      8
    );
    const pickPhoto = makePhotoPicker(stockPhotos);
    console.log(`Industry=${industry}, palette=${palette.primary}, stockPhotos=${stockPhotos.length}`);

    // Generate content for each selected section. Fall back to sensible defaults
    // on failure so a selected section is never silently dropped.
    // Use the user's selected sections, else the industry recipe's line-up.
    const selected = context.selected_sections.length > 0
      ? context.selected_sections
      : recipe.sections;
    // Always lead with a brand header (text wordmark — no original logo here).
    const sectionsToGenerate = ['header', ...selected.filter((s) => s !== 'header')];

    // Multi-page: split sections across pages (deterministic blueprint; thin
    // sites collapse to a single Home page). Create the page rows up front.
    const { pages: pagePlan, assign } = planPages(sectionsToGenerate);
    const pageIdBySlug = {};
    for (const p of pagePlan) {
      const row = await createPage(env.DB, {
        ai_project_id: project.id,
        slug: p.slug,
        title: p.title,
        nav_label: p.nav_label,
        page_order: p.order,
        is_home: p.is_home,
        is_visible: 1,
      });
      pageIdBySlug[p.slug] = row.id;
    }

    const orderByPage = {}; // per-page section_order counters
    let siteOrder = 0; // header/footer order (page_id NULL)
    const generationResults = [];

    for (const sectionType of sectionsToGenerate) {
      let content;
      let usedFallback = false;
      if (sectionType === 'header') {
        content = { logo: '', business_name: context.business_name, cta_link: '#contact' };
      } else {
        try {
          content = await generateSectionContent(env, sectionType, context);
        } catch (error) {
          console.error(`AI generation failed for ${sectionType}, using default:`, error.message);
          content = defaultContent(sectionType, context);
          usedFallback = true;
        }
      }

      // Footer needs the business name; features reuse the services shape.
      if (sectionType === 'footer') {
        content.business_name = content.business_name || context.business_name;
      }
      if (sectionType === 'features' && !Array.isArray(content.features)) {
        content.features = content.services || content.items || [];
      }
      // services/features templates render a `description` subtitle; AI returns `subheading`.
      if ((sectionType === 'services' || sectionType === 'features') && !content.description && content.subheading) {
        content.description = content.subheading;
      }

      // Pick the recipe's variant for this section, then inject real images.
      const variant = recipeVariant(recipe, sectionType);
      attachImages(sectionType, content, pickPhoto);
      content._variant = variant;

      // header/footer are site-level (page_id NULL); body sections go to their page.
      let pageId = null;
      let order;
      if (sectionType === 'header' || sectionType === 'footer') {
        order = siteOrder++;
      } else {
        pageId = pageIdBySlug[assign(sectionType)] ?? pageIdBySlug.home ?? null;
        order = orderByPage[pageId] || 0;
        orderByPage[pageId] = order + 1;
      }

      try {
        await createSection(env.DB, {
          ai_project_id: project.id,
          page_id: pageId,
          section_type: sectionType,
          section_order: order,
          html_template: variant,
          content_json: JSON.stringify(content),
          is_visible: 1,
        });
        generationResults.push({ section: sectionType, success: true, fallback: usedFallback });
      } catch (error) {
        console.error(`Failed to save ${sectionType} section:`, error);
        generationResults.push({ section: sectionType, success: false, error: error.message });
      }
    }

    // Update project status
    await updateAIProject(env.DB, project.id, {
      status: 'preview_ready',
    });

    // Charge AI credits for the generation (after success)
    await chargeCredits(env, env.DB, project.customer_email, CREDIT_COSTS.generate);
    audit(ctx, 'credit.site_generate', { teamOwner: project.customer_email, resourceType: 'site', resourceId: project.project_id, resourceName: project.project_name, metadata: { credits: CREDIT_COSTS.generate } });
    audit(ctx, 'site.create', { teamOwner: project.customer_email, resourceType: 'site', resourceId: project.project_id, resourceName: project.project_name });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Preview generated successfully',
        preview_url: `/ai-preview/${project.project_id}`,
        sections_generated: generationResults.filter((r) => r.success).length,
        sections_failed: generationResults.filter((r) => !r.success).length,
        generation_results: generationResults,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating preview:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to generate preview',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Sensible default content per section type, used when an AI generation call
 * fails so a selected section is never silently dropped.
 * @param {string} sectionType
 * @param {object} context - Generation context
 * @returns {object}
 */
function defaultContent(sectionType, context) {
  const name = context.business_name || 'Our Business';
  const type = context.business_type || 'business';
  // Real vertical services from the recipe (via context.service_hints) instead
  // of "Service 1" placeholders.
  const serviceItems = hintsToItems(context.service_hints);
  const fallbackItems = serviceItems.length
    ? serviceItems
    : [
        { title: 'Quality Service', description: 'Delivered with care and expertise.', icon: '⭐' },
        { title: 'Trusted Experience', description: 'Reliable results every time.', icon: '✅' },
        { title: 'Here For You', description: 'Friendly support when you need it.', icon: '🤝' },
      ];

  switch (sectionType) {
    case 'hero':
      return { heading: `Welcome to ${name}`, subheading: `Your trusted ${type}`, cta_text: 'Get Started', cta_link: '#contact' };
    case 'about':
      return { heading: `About ${name}`, subheading: '', story: `${name} is dedicated to serving our community with excellence.`, values: [] };
    case 'services':
      return { heading: 'Our Services', subheading: '', services: fallbackItems };
    case 'features':
      return { heading: 'Why Choose Us', description: '', features: fallbackItems };
    case 'gallery':
      return { heading: 'Gallery', subheading: '', images: [] };
    case 'testimonials':
      return { heading: 'What Our Customers Say', testimonials: [{ quote: 'A wonderful experience!', author: 'Happy Customer', role: '' }] };
    case 'contact':
      return { heading: 'Get In Touch', subheading: "We'd love to hear from you", button_text: 'Send Message' };
    case 'footer':
      return { company_name: name, business_name: name, description: '', links: [], social_links: [] };
    default:
      return { heading: name };
  }
}

/** Turn a "A, B, C" service-hint string into [{title, description, icon}] items. */
function hintsToItems(hints) {
  if (!hints || typeof hints !== 'string') return [];
  return hints
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((title) => ({ title, description: '', icon: '✓' }));
}
