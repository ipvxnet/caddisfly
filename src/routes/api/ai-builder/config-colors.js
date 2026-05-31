// PUT /api/ai-builder/:project_id/config/colors
// Update website color configuration

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { updateWebsiteConfig, getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId, updateWebsiteConfigById } from '../../../db/ai-config.js';

/**
 * Update website colors
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleUpdateColors(ctx) {
  const { request, env, params } = ctx;

  try {
    const { project_id } = params;

    // Try to load from ai_projects first, then regular projects
    let aiProject = await getAIProjectByProjectId(env.DB, project_id);
    let config = null;

    if (aiProject) {
      config = await getWebsiteConfigByAIProjectId(env.DB, aiProject.id);
    } else {
      const regularProject = await getProjectByPreviewId(env.DB, project_id);
      if (!regularProject) {
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
      config = await getWebsiteConfigByRegularProjectId(env.DB, regularProject.id);
    }

    if (!config) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuration not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { primary_color, secondary_color } = body;

    // Validate hex colors
    const hexRegex = /^#[0-9A-F]{6}$/i;

    if (!hexRegex.test(primary_color)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid primary color (must be hex format like #667eea)',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!hexRegex.test(secondary_color)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid secondary color (must be hex format like #764ba2)',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Update colors using config ID
    await updateWebsiteConfigById(env.DB, config.id, {
      primary_color,
      secondary_color,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Colors updated successfully',
        primary_color,
        secondary_color,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating colors:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to update colors',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
