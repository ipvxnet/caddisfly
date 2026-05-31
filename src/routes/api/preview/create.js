/**
 * POST /api/preview/create
 * Creates a preview by scraping website, refactoring with AI, and sending email
 */

import { v4 as uuidv4 } from 'uuid';
import { isValidEmail, sanitizeEmail, sendPreviewEmail } from '../../../utils/email.js';
import { isValidUrl, scrapeWebsite } from '../../../utils/scraper.js';
import { refactorHtml } from '../../../utils/ai-refactor.js';
import { uploadToR2, generateR2Path } from '../../../utils/r2-storage.js';
import { createProject, updateProject } from '../../../db/projects.js';
import { createScrapedPage, updateScrapedPagePaths } from '../../../db/scraped-pages.js';
import { fixResourceUrls, addCSPForResources } from '../../../utils/html-processor.js';

/**
 * Handles preview creation requests
 * @param {Object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handlePreviewCreate(ctx) {
  const { request, env } = ctx;
  let projectId = null;

  try {
    // Parse and validate request body
    const body = await request.json();
    const { email, website } = body;

    // Validate inputs
    const errors = validatePreviewRequest(email, website);
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request',
          errors: errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const sanitizedEmail = sanitizeEmail(email);
    const normalizedWebsite = normalizeWebsiteUrl(website);

    // Get page limit from environment
    const pageLimit = parseInt(env.PREVIEW_PAGE_LIMIT || '2');

    console.log(`Creating preview for ${sanitizedEmail} - ${normalizedWebsite}`);

    // Step 1: Create project record
    const previewId = uuidv4();
    const project = await createProject(env.DB, {
      preview_id: previewId,
      customer_email: sanitizedEmail,
      website_url: normalizedWebsite,
      status: 'preview_pending',
    });

    projectId = project.id;
    console.log(`Created project ${projectId} with preview_id ${previewId}`);

    // Step 2: Scrape website
    let scrapedPages;
    try {
      scrapedPages = await scrapeWebsite(normalizedWebsite, pageLimit);
      console.log(`Scraped ${scrapedPages.length} pages`);
    } catch (error) {
      // Clean up project on scraping failure
      await updateProject(env.DB, projectId, { status: 'failed' });
      throw new Error(`Scraping failed: ${error.message}`);
    }

    if (scrapedPages.length === 0) {
      await updateProject(env.DB, projectId, { status: 'failed' });
      throw new Error('No pages could be scraped');
    }

    // Step 3: Process each page (refactor + upload to R2)
    const processedPages = [];

    for (let i = 0; i < scrapedPages.length; i++) {
      const page = scrapedPages[i];
      console.log(`Processing page ${i}: ${page.url}`);

      try {
        // Create database record for this page
        const scrapedPageRecord = await createScrapedPage(env.DB, {
          project_id: projectId,
          page_url: page.url,
          page_index: i,
        });

        // Fix resource URLs in original HTML
        let fixedOriginalHtml = fixResourceUrls(page.html, page.url);
        fixedOriginalHtml = addCSPForResources(fixedOriginalHtml, page.url);

        // Refactor HTML with AI
        let refactoredHtml;
        try {
          refactoredHtml = await refactorHtml(env, fixedOriginalHtml, page.url);
          console.log(`Refactored page ${i} successfully`);
        } catch (error) {
          console.error(`AI refactoring failed for page ${i}:`, error);
          // Use fallback - the refactorHtml function already handles this
          refactoredHtml = fixedOriginalHtml; // In case of complete failure
        }

        // Generate R2 paths
        const originalPath = generateR2Path(projectId, i, 'original');
        const refactoredPath = generateR2Path(projectId, i, 'refactored');

        // Upload to R2
        try {
          await Promise.all([
            uploadToR2(env.STORAGE, originalPath, fixedOriginalHtml, 'text/html'),
            uploadToR2(env.STORAGE, refactoredPath, refactoredHtml, 'text/html'),
          ]);
          console.log(`Uploaded page ${i} to R2`);
        } catch (error) {
          console.error(`R2 upload failed for page ${i}:`, error);
          throw new Error(`Failed to store refactored pages: ${error.message}`);
        }

        // Update database with R2 paths
        await updateScrapedPagePaths(
          env.DB,
          scrapedPageRecord.id,
          originalPath,
          refactoredPath
        );

        processedPages.push({
          url: page.url,
          pageIndex: i,
          originalPath,
          refactoredPath,
        });
      } catch (error) {
        console.error(`Failed to process page ${i}:`, error);
        // Continue with other pages, but log the error
        // We'll still create a preview even if some pages fail
      }
    }

    if (processedPages.length === 0) {
      await updateProject(env.DB, projectId, { status: 'failed' });
      throw new Error('Failed to process any pages');
    }

    // Step 4: Update project status
    await updateProject(env.DB, projectId, {
      status: 'preview_ready',
    });

    console.log(`Preview ready for project ${projectId}`);

    // Step 5: Send email
    const baseUrl = getBaseUrl(request);
    const previewUrl = `${baseUrl}/preview/${previewId}`;

    let emailSent = false;
    try {
      emailSent = await sendPreviewEmail(env, sanitizedEmail, previewId, previewUrl);
    } catch (error) {
      console.error('Email sending failed:', error);
      // Don't fail the request - user can still access via URL
    }

    // Step 6: Return success response
    return new Response(
      JSON.stringify({
        success: true,
        previewId: previewId,
        previewUrl: previewUrl,
        message: emailSent
          ? 'Preview created! Check your email.'
          : 'Preview created! Email pending - save this link.',
        pagesProcessed: processedPages.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Preview creation error:', error);

    // If we created a project, mark it as failed
    if (projectId) {
      try {
        await updateProject(env.DB, projectId, { status: 'failed' });
      } catch (updateError) {
        console.error('Failed to update project status:', updateError);
      }
    }

    // Determine appropriate error message
    let errorMessage = 'Failed to create preview';
    let statusCode = 500;

    if (error.message.includes('Scraping failed')) {
      errorMessage = error.message.replace('Scraping failed: ', '');
      statusCode = 400;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Unable to reach website (timeout)';
      statusCode = 408;
    } else if (error.message.includes('DNS error') || error.message.includes('not found')) {
      errorMessage = 'Website not found';
      statusCode = 404;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error.message,
      }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Validates preview request parameters
 * @param {string} email - Email address
 * @param {string} website - Website URL
 * @returns {string[]} Array of error messages
 */
function validatePreviewRequest(email, website) {
  const errors = [];

  if (!email) {
    errors.push('Email is required');
  } else if (!isValidEmail(email)) {
    errors.push('Valid email address is required');
  }

  if (!website) {
    errors.push('Website URL is required');
  } else if (!isValidUrl(website)) {
    errors.push('Valid website URL is required (e.g., https://example.com)');
  }

  return errors;
}

/**
 * Normalizes website URL
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeWebsiteUrl(url) {
  let normalized = url.trim();

  // Add https:// if no protocol specified
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');

  return normalized;
}

/**
 * Gets base URL from request
 * @param {Request} request - HTTP request
 * @returns {string} Base URL
 */
function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
