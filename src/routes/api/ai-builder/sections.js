// PUT /api/ai-builder/:project_id/sections/:section_id
// Update a section's content

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getSectionById, updateSectionContent, updateSection } from '../../../db/ai-sections.js';

/**
 * Handle section update
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderSectionUpdate(ctx) {
  const { request, env, params } = ctx;

  try {
    const { project_id, section_id } = params;

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

    // Get section
    const section = await getSectionById(env.DB, parseInt(section_id));

    if (!section || section.ai_project_id !== project.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Section not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { content, is_visible, section_order } = body;

    // Update content if provided
    if (content !== undefined) {
      await updateSectionContent(env.DB, section.id, content);
    }

    // Update other fields if provided
    const updates = {};
    if (is_visible !== undefined) {
      updates.is_visible = is_visible ? 1 : 0;
    }
    if (section_order !== undefined) {
      updates.section_order = parseInt(section_order);
    }

    if (Object.keys(updates).length > 0) {
      await updateSection(env.DB, section.id, updates);
    }

    // Get updated section
    const updatedSection = await getSectionById(env.DB, section.id);

    return new Response(
      JSON.stringify({
        success: true,
        section: {
          id: updatedSection.id,
          section_type: updatedSection.section_type,
          section_order: updatedSection.section_order,
          is_visible: updatedSection.is_visible === 1,
          content: JSON.parse(updatedSection.content_json),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating section:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to update section',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
