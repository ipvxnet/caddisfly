/**
 * POST /api/preview/create
 * Creates a preview by scraping website, refactoring with AI, and sending email
 */

import { v4 as uuidv4 } from 'uuid';
import { isValidEmail, sanitizeEmail, sendPreviewEmail, sendVerificationEmail } from '../../../utils/email.js';
import { isValidUrl, scrapeWebsite } from '../../../utils/scraper.js';
import { generateToken } from '../../../utils/crypto.js';
import { scrapeBestSignal } from '../../../utils/refactor-scrape.js';
import { coerceDetailedProfile } from '../../../utils/detailed-profile.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';
import { scrapeWithBrowser, shouldUseBrowser, isContentThin, getContentWordCount } from '../../../utils/browser-scraper.js';
import { refactorHtml } from '../../../utils/ai-refactor.js';
import { uploadToR2, generateR2Path } from '../../../utils/r2-storage.js';
import { createProject, updateProject } from '../../../db/projects.js';
import { createScrapedPage, updateScrapedPagePaths } from '../../../db/scraped-pages.js';
import { fixResourceUrls, addCSPForResources } from '../../../utils/html-processor.js';
import { extractSectionsFromHTML, getDefaultVariant } from '../../../utils/ai-content-extractor.js';
import { createSection } from '../../../db/ai-sections.js';
import { createWebsiteConfig } from '../../../db/ai-config.js';
import { assemblePage } from '../../../utils/ai-page-assembler.js';
import { translator } from '../../../i18n/index.js';

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
    const { email, website, use_templates } = body;
    const acceptedTerms = body.accepted_terms === true || body.accepted_terms === 'true';
    const I18N_LANGS = ['en', 'es', 'pt'];
    const language = I18N_LANGS.includes(body.language) ? body.language : (I18N_LANGS.includes(ctx.lang) ? ctx.lang : 'en');

    // Require Terms/Privacy acceptance before building.
    if (!acceptedTerms) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'You must agree to the Terms of Service and Privacy Policy to start building.',
          terms_url: '/terms',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
    const useTemplates = use_templates === '1' || use_templates === true || use_templates === 1;

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
      language,
    });

    projectId = project.id;
    console.log(`Created project ${projectId} with preview_id ${previewId}`);

    // Record Terms/Privacy acceptance.
    try {
      await updateProject(env.DB, project.id, { terms_accepted_at: Math.floor(Date.now() / 1000) });
    } catch (e) {
      console.error('Failed to record terms acceptance:', e.message);
    }

    // Template-based generation is GATED behind email verification: the paid
    // Google Places enrichment only runs after the user clicks the verify link.
    // We do a cheap best-effort static fetch here only to get a business-name
    // hint for a better Places query — no browser rendering, no paid calls.
    if (useTemplates) {
      return await handleVerificationRequest(env, project, normalizedWebsite, sanitizedEmail, request, language, body);
    }

    // Step 2: Scrape website (legacy CSS-only path — unchanged)
    let scrapedPages;
    let usedBrowser = false;

    try {
      // Check if we should use browser rendering for known blockers
      if (shouldUseBrowser(normalizedWebsite)) {
        console.log('Using browser rendering for known blocker site');
        scrapedPages = await scrapeWithBrowser(env, normalizedWebsite, pageLimit);
        usedBrowser = true;
      } else {
        // Try regular scraping first
        try {
          scrapedPages = await scrapeWebsite(normalizedWebsite, pageLimit);
          console.log(`Scraped ${scrapedPages.length} pages with regular fetch`);

          // Detect JS-rendered sites: if static content is thin, the real
          // content is loaded via JavaScript and needs browser rendering
          if (scrapedPages.length > 0 && isContentThin(scrapedPages[0].html)) {
            console.log('Static content is thin (likely JS-rendered), trying browser rendering...');
            try {
              const staticWords = getContentWordCount(scrapedPages[0].html);
              const browserPages = await scrapeWithBrowser(env, normalizedWebsite, pageLimit);
              const browserWords = browserPages.length > 0 ? getContentWordCount(browserPages[0].html) : 0;

              // Use browser content if it captured meaningfully more text
              // (at least 20% more words than the static scrape)
              if (browserWords > staticWords * 1.2) {
                scrapedPages = browserPages;
                usedBrowser = true;
                console.log(`Browser rendering provided richer content (${browserWords} vs ${staticWords} words)`);
              } else {
                console.log(`Browser rendering did not improve content (${browserWords} vs ${staticWords} words), using static`);
              }
            } catch (browserError) {
              console.log('Browser fallback failed, using static content:', browserError.message);
            }
          }
        } catch (fetchError) {
          // If we get a 403 or bot detection error, fall back to browser
          if (fetchError.message.includes('403') || fetchError.message.includes('blocks') || fetchError.message.includes('automated')) {
            console.log('Regular scraping failed, trying browser rendering...');
            scrapedPages = await scrapeWithBrowser(env, normalizedWebsite, pageLimit);
            usedBrowser = true;
            console.log(`Scraped ${scrapedPages.length} pages with browser`);
          } else {
            throw fetchError;
          }
        }
      }
    } catch (error) {
      // Clean up project on scraping failure
      await updateProject(env.DB, projectId, { status: 'failed' });
      throw new Error(`Scraping failed: ${error.message}`);
    }

    if (scrapedPages.length === 0) {
      await updateProject(env.DB, projectId, { status: 'failed' });
      throw new Error('No pages could be scraped');
    }

    // Step 3: Process each page (refactor + upload to R2) - CSS-only mode
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

/**
 * Gated template flow: best-effort static scrape for a name hint, store a
 * single-use verification token, send the verification email, and stop.
 * The paid Google Places enrichment + generation run later in GET /verify/:token.
 * @param {object} env - Environment bindings
 * @param {object} project - Created project row
 * @param {string} website - Normalized website URL
 * @param {string} email - Sanitized customer email
 * @param {Request} request - HTTP request (for base URL)
 * @returns {Response} HTTP response
 */
async function handleVerificationRequest(env, project, website, email, request, language = 'en', body = {}) {
  // Cheap, best-effort static fetch — bot protection may block it; that's fine.
  // If the root is an "under construction" placeholder (common when the site is
  // mid-rebuild — the very reason they're refactoring), try content paths.
  let scrapeSignal = null;
  try {
    scrapeSignal = await scrapeBestSignal(website);
    if (scrapeSignal) {
      console.log(`Captured scrape signal for ${website}: "${scrapeSignal.siteName || scrapeSignal.title || ''}" (${(scrapeSignal.images || []).length} imgs, ${(scrapeSignal.headings || []).length} headings)`);
    }
  } catch (error) {
    console.log(`Pre-verification scrape failed (continuing without signal): ${error.message}`);
  }

  // Up-front refactor questions: the user can tell us who they are (name, the
  // best Google search for them, services, contact, social, logo). This drives
  // a far better Places match + fills gaps the scrape/Places can't — essential
  // when the site is unreadable or misconfigured. Screen the free text.
  const userProfile = coerceDetailedProfile(body);
  userProfile.website_url = website;
  const freeText = [userProfile.business_name, userProfile.search_query, userProfile.services]
    .filter(Boolean).join('\n');
  if (freeText) {
    const screen = screenContent(freeText);
    if (!screen.allowed) return new Response(JSON.stringify(policyError(screen)), { status: 422, headers: { 'Content-Type': 'application/json' } });
  }

  // Single-use token; store interim scrape signal + user-provided profile for
  // use at verify time.
  const token = generateToken(32);
  const nowSeconds = Math.floor(Date.now() / 1000);

  await updateProject(env.DB, project.id, {
    status: 'awaiting_verification',
    use_templates: 1,
    template_generation_status: 'awaiting_verification',
    enrichment_status: 'pending',
    verification_token: token,
    verification_sent_at: nowSeconds,
    company_profile_json: JSON.stringify({ scrapeSignal, userProfile }),
  });

  const baseUrl = getBaseUrl(request);
  const verifyUrl = `${baseUrl}/verify/${token}`;

  // Stub email: logs the link when SEND_EMAIL is not configured.
  await sendVerificationEmail(env, email, token, verifyUrl);

  return new Response(
    JSON.stringify({
      success: true,
      previewId: project.preview_id,
      status: 'awaiting_verification',
      message: translator(language)('landing.refactor_almost'),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Handle template-based generation workflow
 * @param {object} env - Environment bindings
 * @param {object} project - Project record
 * @param {array} scrapedPages - Scraped pages
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response
 */
async function handleTemplateBasedGeneration(env, project, scrapedPages, request) {
  try {
    // Update project to use templates
    await updateProject(env.DB, project.id, {
      use_templates: 1,
      template_generation_status: 'analyzing',
    });

    // Step 1: Extract sections from first scraped page
    const firstPage = scrapedPages[0];
    console.log('Extracting sections from HTML using AI...');

    let sections;
    try {
      sections = await extractSectionsFromHTML(firstPage.html, env);
      console.log(`Extracted ${sections.length} sections:`, sections.map(s => s.type).join(', '));
    } catch (error) {
      console.error('AI section extraction failed:', error);
      // Fall back to CSS-only mode
      await updateProject(env.DB, project.id, {
        use_templates: 0,
        template_generation_status: 'failed',
      });
      throw new Error('Template extraction failed, please try again or use CSS-only mode');
    }

    // Step 2: Create website config
    console.log('Creating website config...');
    const config = await createWebsiteConfig(env.DB, {
      project_id: project.id,
      primary_color: '#667eea',
      secondary_color: '#764ba2',
      font_heading: 'Inter',
      font_body: 'Inter',
      style_theme: 'modern',
    });

    // Step 3: Create sections in database
    console.log('Creating sections in database...');
    for (const section of sections) {
      const variant = getDefaultVariant(section.type);
      await createSection(env.DB, {
        project_id: project.id,
        section_type: section.type,
        section_order: section.order,
        html_template: variant,
        content_json: JSON.stringify(section.content),
        is_visible: 1,
      });
    }

    // Step 4: Generate preview HTML using templates
    console.log('Generating template-based HTML...');
    const projectData = {
      project_name: new URL(firstPage.url).hostname,
      project_id: project.preview_id,
    };

    const previewHtml = assemblePage(sections.map((s, i) => ({
      section_type: s.type,
      section_order: s.order,
      html_template: getDefaultVariant(s.type),
      content_json: JSON.stringify(s.content),
      is_visible: 1,
    })), config, projectData);

    // Step 5: Upload to R2 (use custom path for template-based previews)
    console.log('Uploading to R2...');
    const previewPath = `projects/${project.id}/template-preview.html`;
    await uploadToR2(env.STORAGE, previewPath, previewHtml, 'text/html');

    // Step 6: Update project status
    await updateProject(env.DB, project.id, {
      status: 'preview_ready',
      template_generation_status: 'complete',
    });

    console.log(`Template-based preview ready for project ${project.id}`);

    // Step 7: Send email
    const baseUrl = getBaseUrl(request);
    const previewUrl = `${baseUrl}/ai-preview/${project.preview_id}`;

    let emailSent = false;
    try {
      emailSent = await sendPreviewEmail(env, project.customer_email, project.preview_id, previewUrl);
    } catch (error) {
      console.error('Email sending failed:', error);
    }

    // Step 8: Return success response
    return new Response(
      JSON.stringify({
        success: true,
        previewId: project.preview_id,
        previewUrl: previewUrl,
        customizeUrl: `${baseUrl}/ai-builder/customize/${project.preview_id}`,
        message: emailSent
          ? 'Template preview created! Check your email.'
          : 'Template preview created! Email pending - save this link.',
        sectionsExtracted: sections.length,
        useTemplates: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Template-based generation error:', error);

    // Update project status
    await updateProject(env.DB, project.id, {
      status: 'failed',
      template_generation_status: 'failed',
    });

    throw error;
  }
}
