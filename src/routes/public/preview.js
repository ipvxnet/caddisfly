/**
 * GET /preview/:preview_id
 * Displays split-screen comparison of original vs refactored pages
 */

import { getProjectByPreviewId } from '../../db/projects.js';
import { getScrapedPagesByProjectId } from '../../db/scraped-pages.js';
import { buildPreviewComparisonHtml } from '../../templates/preview-comparison.js';

/**
 * Handles preview view requests
 * @param {Object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handlePreviewView(ctx) {
  const { env, params } = ctx;

  try {
    const { preview_id } = params;

    if (!preview_id) {
      return new Response('Preview ID is required', { status: 400 });
    }

    console.log(`Fetching preview: ${preview_id}`);

    // Get project by preview_id
    const project = await getProjectByPreviewId(env.DB, preview_id);

    if (!project) {
      return renderNotFound('Preview not found');
    }

    // Check project status
    if (project.status !== 'preview_ready') {
      if (project.status === 'preview_pending') {
        return renderPending();
      } else if (project.status === 'failed') {
        return renderError('Preview generation failed');
      } else {
        return renderNotFound('Preview not available');
      }
    }

    // Get scraped pages for this project
    const scrapedPages = await getScrapedPagesByProjectId(env.DB, project.id);

    if (!scrapedPages || scrapedPages.length === 0) {
      return renderError('No pages found for this preview');
    }

    console.log(`Found ${scrapedPages.length} scraped pages`);

    // Prepare page data for template (no need to fetch HTML, iframes will load via URLs)
    const pages = scrapedPages.map(page => ({
      url: page.page_url,
      pageIndex: page.page_index,
    }));

    // Sort pages by index
    pages.sort((a, b) => a.pageIndex - b.pageIndex);

    // Build and return the comparison HTML
    const html = buildPreviewComparisonHtml({
      previewId: preview_id,
      pages: pages,
      websiteUrl: project.website_url,
      useTemplates: project.use_templates === 1,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Preview view error:', error);
    return renderError('An error occurred while loading the preview');
  }
}

/**
 * Renders a 404 not found page
 * @param {string} message - Error message
 * @returns {Response} HTML response
 */
function renderNotFound(message = 'Preview not found') {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Not Found - Caddisfly</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    .container {
      max-width: 500px;
    }
    h1 {
      font-size: 48px;
      margin-bottom: 20px;
    }
    p {
      font-size: 18px;
      margin-bottom: 30px;
      opacity: 0.9;
    }
    .btn {
      display: inline-block;
      padding: 12px 30px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>${message}</p>
    <p>This preview may have expired or the link is incorrect.</p>
    <a href="/" class="btn">Go to Homepage</a>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Renders a pending preview page
 * @returns {Response} HTML response
 */
function renderPending() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Pending - Caddisfly</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    .container {
      max-width: 500px;
    }
    h1 {
      font-size: 36px;
      margin-bottom: 20px;
    }
    p {
      font-size: 18px;
      margin-bottom: 30px;
      opacity: 0.9;
    }
    .spinner {
      border: 4px solid rgba(255,255,255,0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 30px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
  <script>
    // Auto-refresh every 5 seconds
    setTimeout(() => window.location.reload(), 5000);
  </script>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Preview Being Generated</h1>
    <p>We're working on creating your preview. This page will refresh automatically.</p>
    <p style="font-size: 14px;">This usually takes 30-60 seconds...</p>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    status: 202,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Refresh': '5', // Auto-refresh every 5 seconds
    },
  });
}

/**
 * Renders an error page
 * @param {string} message - Error message
 * @returns {Response} HTML response
 */
function renderError(message = 'An error occurred') {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Caddisfly</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    .container {
      max-width: 500px;
    }
    h1 {
      font-size: 36px;
      margin-bottom: 20px;
    }
    p {
      font-size: 18px;
      margin-bottom: 30px;
      opacity: 0.9;
    }
    .btn {
      display: inline-block;
      padding: 12px 30px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Error</h1>
    <p>${message}</p>
    <p>Please try again or contact support if the problem persists.</p>
    <a href="/" class="btn">Go to Homepage</a>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    status: 500,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
