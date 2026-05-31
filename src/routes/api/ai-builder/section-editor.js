// GET /api/ai-builder/:project_id/sections/:section_id/editor
// Returns HTML for section editor modal

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getSectionById } from '../../../db/ai-sections.js';
import { generateSectionEditorModal } from '../../../components/section-editor-modal.js';

/**
 * Get section editor modal HTML
 * @param {object} ctx - Request context
 * @returns {Response} HTML response
 */
export async function handleGetSectionEditor(ctx) {
  const { env, params } = ctx;

  try {
    const { project_id, section_id } = params;

    // Get project
    const project = await getAIProjectByProjectId(env.DB, project_id);

    if (!project) {
      return new Response('Project not found', { status: 404 });
    }

    // Get section
    const section = await getSectionById(env.DB, parseInt(section_id));

    if (!section || section.ai_project_id !== project.id) {
      return new Response('Section not found', { status: 404 });
    }

    // Generate modal HTML
    const html = generateSectionEditorModal(section, project.project_id);

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error generating section editor:', error);

    return new Response('Error generating editor', {
      status: 500,
    });
  }
}
