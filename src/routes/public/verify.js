/**
 * GET /verify/:token
 *
 * The email-verification gate. Clicking this link confirms the user's email and
 * triggers the PAID Google Places enrichment + site generation. This is the only
 * place paid Google calls happen for the refactoring flow.
 *
 * State machine (projects.enrichment_status):
 *   pending  -> first click: verify, enrich, generate
 *   running  -> in progress (double-click): show building page
 *   complete -> redirect to the finished preview (idempotent)
 *   no_match -> Places found nothing: show manual-entry page
 *   failed   -> show retryable error
 */

import { getProjectByVerificationToken, updateProject } from '../../db/projects.js';
import { getUserTier, checkEnrichmentLimit, formatRateLimitError } from '../../utils/rate-limiter.js';
import { enrichBusiness } from '../../utils/google-places.js';
import { buildProfile } from '../../utils/company-profile.js';
import { generateSectionsFromProfile, buildAndStorePreview } from '../../utils/template-generation.js';
import { sendPreviewEmail } from '../../utils/email.js';
import { htmlResponse, redirect, badRequest } from '../../utils/response.js';

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

export async function handleVerify(ctx) {
  const { env, params, request } = ctx;
  const token = params.token;

  if (!token) {
    return badRequest('Invalid verification link.');
  }

  const project = await getProjectByVerificationToken(env.DB, token);
  if (!project) {
    return htmlResponse(statusPage('Link not found', 'This verification link is invalid or has already been used.'), 404);
  }

  // Idempotent terminal/intermediate states.
  if (project.enrichment_status === 'complete') {
    return redirect(`/ai-preview/${project.preview_id}`);
  }
  if (project.enrichment_status === 'no_match') {
    return htmlResponse(manualEntryPage(token, project));
  }
  if (project.enrichment_status === 'running') {
    return htmlResponse(buildingPage(project.preview_id));
  }

  // Expiry only applies before the first verification.
  const now = Math.floor(Date.now() / 1000);
  if (!project.email_verified && project.verification_sent_at && now - project.verification_sent_at > TOKEN_TTL_SECONDS) {
    return htmlResponse(statusPage('Link expired', 'This link has expired. Please request a new preview from the homepage.'), 410);
  }

  // Cost control: per-email daily enrichment cap.
  const tier = await getUserTier(env.DB, project.customer_email);
  const limit = await checkEnrichmentLimit(env.DB, project.customer_email, tier);
  if (!limit.allowed) {
    const msg = formatRateLimitError(limit, 'enrichments').error;
    return htmlResponse(statusPage('Daily limit reached', msg), 429);
  }

  // Mark verified + running BEFORE the paid call so the attempt is counted and
  // a quick double-click lands on the "building" page instead of paying twice.
  await updateProject(env.DB, project.id, {
    email_verified: 1,
    verified_at: now,
    status: 'enriching',
    enrichment_status: 'running',
  });

  // Recover the interim scrape signal stored at create time.
  let scrapeSignal = null;
  try {
    scrapeSignal = JSON.parse(project.company_profile_json || '{}').scrapeSignal || null;
  } catch {
    scrapeSignal = null;
  }
  const businessName = (scrapeSignal && (scrapeSignal.siteName || scrapeSignal.title)) || '';

  // PAID: identify the business via Google Places.
  let places;
  try {
    places = await enrichBusiness(env, { businessName, website: project.website_url });
  } catch (error) {
    console.error('Places enrichment error:', error);
    await updateProject(env.DB, project.id, { enrichment_status: 'failed' });
    return htmlResponse(
      statusPage('Something went wrong', 'We had trouble identifying your business right now. Please try again later.'),
      500
    );
  }

  if (!places.found) {
    await updateProject(env.DB, project.id, { enrichment_status: 'no_match' });
    return htmlResponse(manualEntryPage(token, project));
  }

  // Build the site from the merged profile using the shared template pipeline.
  const profile = buildProfile(scrapeSignal, places);
  try {
    const sections = await generateSectionsFromProfile(env, profile);
    await buildAndStorePreview(env, project, sections, {
      project_name: profile.name,
      project_id: project.preview_id,
    });
  } catch (error) {
    console.error('Profile-based generation error:', error);
    await updateProject(env.DB, project.id, { enrichment_status: 'failed' });
    return htmlResponse(
      statusPage('Almost there', 'We found your business but hit a snag building the site. Please try again in a moment.'),
      500
    );
  }

  await updateProject(env.DB, project.id, {
    status: 'preview_ready',
    enrichment_status: 'complete',
    template_generation_status: 'complete',
    place_id: places.place_id,
    company_profile_json: JSON.stringify(profile),
  });

  // Best-effort preview email (no-op until SEND_EMAIL is wired).
  try {
    const base = new URL(request.url).origin;
    await sendPreviewEmail(env, project.customer_email, project.preview_id, `${base}/ai-preview/${project.preview_id}`);
  } catch (error) {
    console.error('Preview email failed (non-fatal):', error);
  }

  return redirect(`/ai-preview/${project.preview_id}`);
}

// ---- branded pages ----

function pageShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · Caddisfly</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; }
  .card { background: #fff; border-radius: 16px; padding: 40px; max-width: 480px; width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
  h1 { font-size: 22px; margin: 0 0 12px; color: #1a1a2e; }
  p { color: #555; line-height: 1.6; }
  label { display: block; font-size: 13px; font-weight: 600; color: #333; margin: 14px 0 6px; }
  input, textarea { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 1px solid #d8dae5;
          border-radius: 8px; font-size: 14px; font-family: inherit; }
  button { margin-top: 20px; width: 100%; padding: 14px; border: none; border-radius: 8px; cursor: pointer;
          font-size: 15px; font-weight: 600; color: #fff;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
  a { color: #667eea; }
  .muted { color: #888; font-size: 13px; }
</style>
</head>
<body><div class="card">${bodyHtml}</div></body>
</html>`;
}

function statusPage(title, message) {
  return pageShell(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/">Back to homepage</a></p>`);
}

function buildingPage(previewId) {
  return pageShell(
    'Building your preview',
    `<h1>Building your preview…</h1>
     <p>We're identifying your business and assembling your new site. This page will refresh automatically.</p>
     <p class="muted">If it doesn't, <a href="/ai-preview/${escapeHtml(previewId)}">click here</a>.</p>
     <script>setTimeout(function(){ location.href='/ai-preview/${escapeHtml(previewId)}'; }, 6000);</script>`
  );
}

function manualEntryPage(token, project) {
  const hint = safeHostname(project.website_url);
  return pageShell(
    'Tell us about your business',
    `<h1>We couldn't find your business on Google</h1>
     <p>No problem — add a few details and we'll build your site from those.</p>
     <form method="POST" action="/api/preview/manual/${escapeHtml(token)}">
       <label for="name">Business name</label>
       <input id="name" name="name" required placeholder="${escapeHtml(hint)}">
       <label for="category">What you do</label>
       <input id="category" name="category" placeholder="e.g. Plumbing, Bakery, Law firm">
       <label for="description">Short description</label>
       <textarea id="description" name="description" rows="3" placeholder="One or two sentences about your business"></textarea>
       <label for="phone">Phone (optional)</label>
       <input id="phone" name="phone" placeholder="(555) 123-4567">
       <label for="address">Address (optional)</label>
       <input id="address" name="address" placeholder="123 Main St, City, ST">
       <button type="submit">Build my preview</button>
     </form>`
  );
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
