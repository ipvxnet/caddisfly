// POST /api/ai-builder/:project_id/upload
// Upload assets for AI project

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { createAsset } from '../../../db/ai-assets.js';
import { generateToken } from '../../../utils/crypto.js';
import { uploadToR2 } from '../../../utils/r2-storage.js';

// Allowed file types → extension. Images + short MP4/WebM video (hero video bg).
const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB

/**
 * Handle asset upload
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderUpload(ctx) {
  const { request, env, params } = ctx;

  try {
    const { project_id } = params;

    // Resolve project: AI builder first, else the refactoring bridge.
    const aiProject = await getAIProjectByProjectId(env.DB, project_id);
    if (!aiProject) {
      const regularProject = await getProjectByPreviewId(env.DB, project_id);
      if (!regularProject) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
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

    // Validate file size (videos allowed to be larger than images).
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Store under assets/<project_id>/<file> and serve via /preview-asset/...,
    // consistent with how generated/Places/stock images are served.
    const extension = ALLOWED_MIME_TYPES[file.type];
    const filename = `${generateToken(12)}${extension}`;
    const r2Path = `assets/${project_id}/${filename}`;

    const fileBuffer = await file.arrayBuffer();
    await uploadToR2(env.STORAGE, r2Path, fileBuffer, file.type);

    // Best-effort asset record (AI-builder projects only; the table is keyed to them).
    let assetId = null;
    if (aiProject) {
      try {
        const asset = await createAsset(env.DB, {
          ai_project_id: aiProject.id,
          asset_type: assetType,
          original_filename: file.name,
          r2_path: r2Path,
          file_size: file.size,
          mime_type: file.type,
        });
        assetId = asset && asset.id;
      } catch (e) {
        console.error('createAsset failed (non-fatal):', e.message);
      }
    }

    const publicUrl = `/preview-asset/${project_id}/${filename}`;

    return new Response(
      JSON.stringify({
        success: true,
        asset_id: assetId,
        url: publicUrl,
        filename,
        original_filename: file.name,
        size: file.size,
        type: file.type,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
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
