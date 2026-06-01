// POST /api/ai-builder/:project_id/generate-preview
// Generate website preview from conversation answers

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { getAnsweredConversations } from '../../../db/ai-conversations.js';
import { createSection } from '../../../db/ai-sections.js';
import { getOrCreateWebsiteConfig, updateWebsiteConfig } from '../../../db/ai-config.js';
import { buildContext, generateSectionContent } from '../../../utils/ai-content-generator.js';
import { getFontPairing } from '../../../utils/ai-prompts.js';
import { checkAIGenerationLimit, getUserTier, formatRateLimitError, limitsDisabled, unlimited } from '../../../utils/rate-limiter.js';
import { inferIndustry, paletteFor, variantFor, imageKeywordsFor } from '../../../utils/industry-style.js';
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

    // Industry-aware styling: pick a palette that fits the business instead of
    // a generic AI-guessed blue (e.g. a restaurant gets warm, appetizing colors).
    const industry = inferIndustry(context.industry, context.business_type, context.business_name);
    const palette = paletteFor(industry);
    const fonts = getFontPairing(context.style);
    config = await updateWebsiteConfig(env.DB, project.id, {
      primary_color: palette.primary,
      secondary_color: palette.secondary,
      font_heading: fonts.heading,
      font_body: fonts.body,
      style_theme: context.style,
    });

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
    const selected = context.selected_sections.length > 0
      ? context.selected_sections
      : ['hero', 'about', 'services', 'gallery', 'testimonials', 'contact', 'footer'];
    // Always lead with a brand header (text wordmark — no original logo here).
    const sectionsToGenerate = ['header', ...selected.filter((s) => s !== 'header')];

    let sectionOrder = 0;
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

      // Pick an image-forward variant for the industry, then inject real images.
      const variant = variantFor(industry, sectionType);
      attachImages(sectionType, content, pickPhoto);
      content._variant = variant;

      try {
        await createSection(env.DB, {
          ai_project_id: project.id,
          section_type: sectionType,
          section_order: sectionOrder++,
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

  switch (sectionType) {
    case 'hero':
      return { heading: `Welcome to ${name}`, subheading: `Your trusted ${type}`, cta_text: 'Get Started', cta_link: '#contact' };
    case 'about':
      return { heading: `About ${name}`, subheading: '', story: `${name} is dedicated to serving our community with excellence.`, values: [] };
    case 'services':
      return {
        heading: 'Our Services',
        subheading: '',
        services: [
          { title: 'Quality Service', description: 'Delivered with care and expertise.', icon: '⭐' },
          { title: 'Trusted Experience', description: 'Reliable results every time.', icon: '✅' },
          { title: 'Here For You', description: 'Friendly support when you need it.', icon: '🤝' },
        ],
      };
    case 'features':
      return {
        heading: 'Why Choose Us',
        description: '',
        features: [
          { icon: '⚡', title: 'Fast', description: 'Quick and efficient service.' },
          { icon: '🔒', title: 'Trusted', description: 'Dependable every time.' },
          { icon: '💬', title: 'Friendly', description: 'Great customer care.' },
        ],
      };
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
