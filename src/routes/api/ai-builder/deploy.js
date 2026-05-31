// POST /api/ai-builder/:project_id/deploy
// Deploy AI-generated website

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { getSectionsByProjectId } from '../../../db/ai-sections.js';
import { getWebsiteConfigByProjectId } from '../../../db/ai-config.js';
import { assemblePage } from '../../../utils/ai-page-assembler.js';

/**
 * Handle website deployment
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderDeploy(ctx) {
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

    // Check if preview is ready
    if (project.status !== 'preview_ready' && project.status !== 'customizing' && project.status !== 'deployed') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Website preview not ready yet',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get sections and config
    const sections = await getSectionsByProjectId(env.DB, project.id, true);
    const config = await getWebsiteConfigByProjectId(env.DB, project.id);

    if (sections.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No sections found to deploy',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!config) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Website configuration not found',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Assemble complete HTML page
    const html = assemblePage(sections, config, project);

    // Upload to R2
    if (!env.ASSETS_BUCKET) {
      throw new Error('R2 bucket not configured');
    }

    const r2Path = `ai-projects/${project.project_id}/deployed/index.html`;
    await env.ASSETS_BUCKET.put(r2Path, html, {
      httpMetadata: {
        contentType: 'text/html; charset=utf-8',
      },
    });

    // Generate deployed URL
    const deployedUrl = `${env.R2_PUBLIC_URL || 'https://assets.caddisfly.ai'}/${r2Path}`;

    // Update project
    await updateAIProject(env.DB, project.id, {
      status: 'deployed',
      deployed_url: deployedUrl,
      deployed_at: Math.floor(Date.now() / 1000),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Website deployed successfully',
        deployed_url: deployedUrl,
        project_id: project.project_id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error deploying website:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to deploy website',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
