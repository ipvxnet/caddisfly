/**
 * GET /preview/:preview_id/html/:page_index/:type
 * Serves HTML content directly from R2 for iframe embedding
 */

import { getProjectByPreviewId } from '../../db/projects.js';
import { getScrapedPagesByProjectId } from '../../db/scraped-pages.js';
import { getFromR2 } from '../../utils/r2-storage.js';

/**
 * Serves HTML content from R2
 * @param {Object} ctx - Request context
 * @returns {Response} HTML response
 */
export async function handlePreviewHtml(ctx) {
  const { env, params } = ctx;

  try {
    const { preview_id, page_index, type } = params;

    if (!preview_id || !page_index || !type) {
      return new Response('Invalid parameters', { status: 400 });
    }

    if (type !== 'original' && type !== 'refactored') {
      return new Response('Type must be "original" or "refactored"', { status: 400 });
    }

    const pageIdx = parseInt(page_index);
    if (isNaN(pageIdx)) {
      return new Response('Invalid page index', { status: 400 });
    }

    // Get project
    const project = await getProjectByPreviewId(env.DB, preview_id);
    if (!project) {
      return new Response('Preview not found', { status: 404 });
    }

    // Get scraped pages
    const scrapedPages = await getScrapedPagesByProjectId(env.DB, project.id);
    const page = scrapedPages.find(p => p.page_index === pageIdx);

    if (!page) {
      return new Response('Page not found', { status: 404 });
    }

    // Get HTML from R2
    const r2Path = type === 'original' ? page.original_r2_path : page.refactored_r2_path;
    const html = await getFromR2(env.STORAGE, r2Path);

    if (!html) {
      return new Response('HTML not found in storage', { status: 404 });
    }

    // Serve HTML with proper headers
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Frame-Options': 'SAMEORIGIN', // Allow framing from same origin
        'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
      },
    });
  } catch (error) {
    console.error('Preview HTML error:', error);
    return new Response('Error loading HTML', { status: 500 });
  }
}
