// POST /api/ai-builder/:project_id/template
// Apply a whole-site theme preset: bulk-update each section's variant + the
// config's fonts. Content, colors, order, and visibility are preserved.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getSectionsByAIProjectId, getSectionsByRegularProjectId, updateSection } from '../../../db/ai-sections.js';
import {
  getWebsiteConfigByAIProjectId,
  getWebsiteConfigByRegularProjectId,
  updateWebsiteConfigById,
} from '../../../db/ai-config.js';
import { getAvailableVariants } from '../../../templates/ai-builder/registry.js';
import { getTheme } from '../../../utils/site-themes.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Apply a whole-site template/theme.
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleApplyTemplate(ctx) {
  const { request, env, params } = ctx;

  try {
    const { project_id } = params;

    // Resolve the theme first (cheap validation before any DB work).
    const body = await request.json();
    const theme = getTheme(body.theme);
    if (!theme) {
      return json({ success: false, error: `Unknown template: ${body.theme}` }, 400);
    }

    // Resolve project: AI builder first, else the refactoring bridge.
    const aiProject = await getAIProjectByProjectId(env.DB, project_id);
    let regularProject = null;
    if (!aiProject) {
      regularProject = await getProjectByPreviewId(env.DB, project_id);
      if (!regularProject) {
        return json({ success: false, error: 'Project not found' }, 404);
      }
    }

    // Load this project's sections + config via the matching FK.
    const sections = aiProject
      ? await getSectionsByAIProjectId(env.DB, aiProject.id)
      : await getSectionsByRegularProjectId(env.DB, regularProject.id);
    const config = aiProject
      ? await getWebsiteConfigByAIProjectId(env.DB, aiProject.id)
      : await getWebsiteConfigByRegularProjectId(env.DB, regularProject.id);

    // Apply the theme's variant for each section, but only when the theme
    // defines one for that type AND the variant exists in the registry.
    let updated = 0;
    for (const section of sections) {
      const variant = theme.variants[section.section_type];
      if (!variant || variant === section.html_template) continue;
      // Never persist a variant the registry doesn't actually have for this type.
      if (!getAvailableVariants(section.section_type).includes(variant)) continue;
      await updateSection(env.DB, section.id, { html_template: variant });
      updated++;
    }

    // Fonts + remember the choice; colors are deliberately untouched.
    if (config) {
      await updateWebsiteConfigById(env.DB, config.id, {
        font_heading: theme.fonts.heading,
        font_body: theme.fonts.body,
        style_theme: theme.key,
      });
    }

    return json({ success: true, theme: theme.key, sections_updated: updated });
  } catch (error) {
    console.error('Error applying template:', error);
    return json({ success: false, error: 'Failed to apply template', details: error.message }, 500);
  }
}
