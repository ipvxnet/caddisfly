// POST /api/ai-builder/:project_id/generate-preview
// Generate website preview from conversation answers

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { getAnsweredConversations } from '../../../db/ai-conversations.js';
import { createSection } from '../../../db/ai-sections.js';
import { getOrCreateWebsiteConfig, updateWebsiteConfig } from '../../../db/ai-config.js';
import { buildContext, generateSectionContent, generateColorScheme } from '../../../utils/ai-content-generator.js';
import { getFontPairing } from '../../../utils/ai-prompts.js';

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

    // Generate color scheme based on style and industry
    try {
      const colorScheme = await generateColorScheme(env, context.style, context.industry);
      if (colorScheme.primary_color && colorScheme.secondary_color) {
        config = await updateWebsiteConfig(env.DB, project.id, {
          primary_color: colorScheme.primary_color,
          secondary_color: colorScheme.secondary_color,
        });
      }
    } catch (error) {
      console.error('Failed to generate color scheme:', error);
      // Continue with default colors
    }

    // Update fonts based on style
    const fonts = getFontPairing(context.style);
    config = await updateWebsiteConfig(env.DB, project.id, {
      font_heading: fonts.heading,
      font_body: fonts.body,
      style_theme: context.style,
    });

    // Generate content for each selected section
    const sectionsToGenerate = context.selected_sections.length > 0 ? context.selected_sections : ['hero', 'about', 'services', 'contact', 'footer'];

    let sectionOrder = 0;
    const generationResults = [];

    for (const sectionType of sectionsToGenerate) {
      try {
        // Generate content using AI
        const content = await generateSectionContent(env, sectionType, context);

        // Add business name to footer if it's a footer section
        if (sectionType === 'footer') {
          content.business_name = context.business_name;
        }

        // Determine template variant based on style
        const variant = getTemplateVariant(sectionType, context.style);
        content._variant = variant;

        // Create section in database
        await createSection(env.DB, {
          ai_project_id: project.id,
          section_type: sectionType,
          section_order: sectionOrder++,
          html_template: variant,
          content_json: JSON.stringify(content),
          is_visible: 1,
        });

        generationResults.push({
          section: sectionType,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to generate ${sectionType} section:`, error);
        generationResults.push({
          section: sectionType,
          success: false,
          error: error.message,
        });
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
 * Get template variant based on section type and style
 * @param {string} sectionType - Section type
 * @param {string} style - Visual style
 * @returns {string} Template variant
 */
function getTemplateVariant(sectionType, style) {
  // Map styles to template variants
  const variantMap = {
    hero: {
      modern: 'centered',
      bold: 'split',
      classic: 'centered',
      minimal: 'centered',
    },
    about: {
      default: 'text-image',
    },
    services: {
      default: 'icon-grid',
    },
    testimonials: {
      default: 'cards',
    },
    contact: {
      default: 'form',
    },
    gallery: {
      default: 'masonry',
    },
    footer: {
      default: 'multi-column',
    },
  };

  const sectionVariants = variantMap[sectionType];
  if (!sectionVariants) return 'default';

  return sectionVariants[style] || sectionVariants.default || 'default';
}
