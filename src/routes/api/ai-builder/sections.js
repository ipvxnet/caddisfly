// PUT /api/ai-builder/:project_id/sections/:section_id
// Update a section's content

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
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

    // Try to load from ai_projects first, then regular projects
    let aiProject = await getAIProjectByProjectId(env.DB, project_id);
    let regularProject = null;

    if (!aiProject) {
      regularProject = await getProjectByPreviewId(env.DB, project_id);
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
    }

    // Get section
    const section = await getSectionById(env.DB, parseInt(section_id));

    // Verify ownership
    if (!section) {
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

    // Check ownership based on project type
    if (aiProject && section.ai_project_id !== aiProject.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Section does not belong to this project',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (regularProject && section.project_id !== regularProject.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Section does not belong to this project',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { content, is_visible, section_order, html_template, page_id } = body;

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
    if (html_template !== undefined) {
      updates.html_template = html_template;
    }
    if (page_id !== undefined) {
      // Move the section to another page (page_id is a global ai_pages.id).
      updates.page_id = page_id;
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
