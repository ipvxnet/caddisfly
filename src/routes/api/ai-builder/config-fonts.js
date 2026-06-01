// PUT /api/ai-builder/:project_id/config/fonts
// Update the site's fonts (heading + body) from the curated pairing list.
// Colors and style_theme are left untouched.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import {
  getWebsiteConfigByAIProjectId,
  getWebsiteConfigByRegularProjectId,
  updateWebsiteConfigById,
} from '../../../db/ai-config.js';
import { findPairing } from '../../../utils/font-pairings.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Update website fonts.
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleUpdateFonts(ctx) {
  const { request, env, params } = ctx;

  try {
    const { project_id } = params;

    // Resolve project: AI builder first, else the refactoring bridge.
    const aiProject = await getAIProjectByProjectId(env.DB, project_id);
    let config = null;
    if (aiProject) {
      config = await getWebsiteConfigByAIProjectId(env.DB, aiProject.id);
    } else {
      const regularProject = await getProjectByPreviewId(env.DB, project_id);
      if (!regularProject) {
        return json({ success: false, error: 'Project not found' }, 404);
      }
      config = await getWebsiteConfigByRegularProjectId(env.DB, regularProject.id);
    }

    if (!config) {
      return json({ success: false, error: 'Configuration not found' }, 404);
    }

    const body = await request.json();
    const { font_heading, font_body } = body;

    // Only accept a known curated pairing — never inject arbitrary font names
    // into the Google Fonts URL.
    if (!findPairing(font_heading, font_body)) {
      return json({ success: false, error: 'Unknown font pairing' }, 400);
    }

    await updateWebsiteConfigById(env.DB, config.id, { font_heading, font_body });

    return json({ success: true, font_heading, font_body });
  } catch (error) {
    console.error('Error updating fonts:', error);
    return json({ success: false, error: 'Failed to update fonts', details: error.message }, 500);
  }
}
