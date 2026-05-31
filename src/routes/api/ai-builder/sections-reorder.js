// PUT /api/ai-builder/:project_id/sections/reorder
// Reorder sections

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { reorderSections } from '../../../db/ai-sections.js';

/**
 * Reorder sections
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleSectionsReorder(ctx) {
  const { request, env, params } = ctx;

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

    // Parse request body
    const body = await request.json();
    const { section_ids } = body;

    if (!Array.isArray(section_ids) || section_ids.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'section_ids must be a non-empty array',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Convert to integers
    const sectionIdsInt = section_ids.map((id) => parseInt(id));

    // Reorder sections
    await reorderSections(env.DB, project.id, sectionIdsInt);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sections reordered successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error reordering sections:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to reorder sections',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
