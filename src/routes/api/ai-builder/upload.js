// POST /api/ai-builder/:project_id/upload
// Upload assets for AI project

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { createAsset } from '../../../db/ai-assets.js';
import { generateToken } from '../../../utils/crypto.js';

// Allowed file types
const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Handle asset upload
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderUpload(ctx) {
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

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    const assetType = formData.get('asset_type') || 'general';

    if (!file) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No file provided',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES[file.type]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP, SVG',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate unique filename
    const extension = ALLOWED_MIME_TYPES[file.type];
    const uniqueId = generateToken(12);
    const filename = `${uniqueId}${extension}`;
    const r2Path = `ai-projects/${project.project_id}/assets/${assetType}/${filename}`;

    // Upload to R2
    if (!env.ASSETS_BUCKET) {
      throw new Error('R2 bucket not configured');
    }

    const fileBuffer = await file.arrayBuffer();
    await env.ASSETS_BUCKET.put(r2Path, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Create asset record
    const asset = await createAsset(env.DB, {
      ai_project_id: project.id,
      asset_type: assetType,
      original_filename: file.name,
      r2_path: r2Path,
      file_size: file.size,
      mime_type: file.type,
    });

    // Generate public URL
    const publicUrl = `${env.R2_PUBLIC_URL || 'https://assets.caddisfly.ai'}/${r2Path}`;

    return new Response(
      JSON.stringify({
        success: true,
        asset_id: asset.id,
        url: publicUrl,
        filename: filename,
        original_filename: file.name,
        size: file.size,
        type: file.type,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error uploading asset:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to upload asset',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
