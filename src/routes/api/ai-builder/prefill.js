// POST /api/ai-builder/:project_id/prefill
// Research the user's existing website (scrape + Google Places) and pre-fill the
// detailed form, filling BLANKS ONLY so typed values are never overwritten.
// Reuses the refactor flow's research pipeline + paid-API gating.

import { getAIProjectByProjectId, updateAIProject, claimEnrichmentBuildAI } from '../../../db/ai-projects.js';
import { scrapeWebsite, isValidUrl } from '../../../utils/scraper.js';
import { scrapeWithBrowser, isContentThin } from '../../../utils/browser-scraper.js';
import { extractScrapeSignal, buildProfile } from '../../../utils/company-profile.js';
import { enrichBusiness, fetchPlacePhotoBytes } from '../../../utils/google-places.js';
import { uploadToR2 } from '../../../utils/r2-storage.js';
import { generateToken } from '../../../utils/crypto.js';
import { coerceDetailedProfile, mergeFillingBlanks, parseDetailedProfile, SOCIAL_PLATFORMS } from '../../../utils/detailed-profile.js';
import { checkEnrichmentLimitAI, getUserTier, formatRateLimitError, limitsDisabled, unlimited } from '../../../utils/rate-limiter.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS } from '../../../utils/credits.js';
import { screenContent } from '../../../utils/content-policy.js';

const BUILD_STALE_SECONDS = 180;
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export async function handleAIBuilderPrefill(ctx) {
  const { request, env, params } = ctx;

  try {
    const { project_id } = params;
    const project = await getAIProjectByProjectId(env.DB, project_id);
    if (!project) return json({ success: false, error: 'Project not found' }, 404);

    const body = await request.json();
    const websiteUrl = (body.website_url || '').trim();
    if (!websiteUrl || !isValidUrl(websiteUrl)) {
      return json({ success: false, error: 'A valid website URL is required' }, 400);
    }
    const current = coerceDetailedProfile(body.current || parseDetailedProfile(project.detailed_profile_json));

    // Paid-API gating: shared daily quota + credit pre-check.
    const tier = await getUserTier(env.DB, project.customer_email);
    const limitCheck = limitsDisabled(env)
      ? unlimited(tier)
      : await checkEnrichmentLimitAI(env.DB, project.customer_email, tier);
    if (!limitCheck.allowed) return json(formatRateLimitError(limitCheck, 'enrichments'), 429);

    const afford = await canAfford(env, env.DB, project.customer_email, CREDIT_COSTS.enrich);
    if (!afford.ok) return json(formatCreditError(afford.state, 'business research'), 402);

    // Atomic claim — blocks concurrent prefill tabs from double-spending.
    const now = Math.floor(Date.now() / 1000);
    const claimed = await claimEnrichmentBuildAI(env.DB, project.id, now, now - BUILD_STALE_SECONDS);
    if (!claimed) return json({ success: false, error: 'Research already in progress' }, 409);

    // Scrape (HTTP, then browser fallback for JS-heavy sites).
    let html = '';
    try {
      const pages = await scrapeWebsite(websiteUrl, 2);
      html = (pages && pages[0] && pages[0].html) || '';
      if (!html || isContentThin(html)) {
        const bpages = await scrapeWithBrowser(env, websiteUrl, 1).catch(() => null);
        if (bpages && bpages[0] && bpages[0].html) html = bpages[0].html;
      }
    } catch (e) {
      console.error('prefill scrape failed (non-fatal):', e.message);
    }
    const scrapeSignal = extractScrapeSignal(html, websiteUrl);
    const socialFromScrape = extractSocialLinks(html);

    // PAID: identify the business via Google Places (graceful on missing key).
    let places = { found: false };
    try {
      places = await enrichBusiness(env, {
        businessName: current.business_name || scrapeSignal.siteName || scrapeSignal.title,
        website: websiteUrl,
        location: current.service_area.value,
      });
    } catch (e) {
      console.error('prefill Places failed (non-fatal):', e.message);
    }

    const profile = buildProfile(scrapeSignal, places);

    // Download up to 4 Places photos into R2 so generation can use real imagery.
    const pics = [];
    try {
      for (const name of (profile.photos || []).slice(0, 4)) {
        const got = await fetchPlacePhotoBytes(env, name);
        if (got && got.bytes) {
          const ext = (got.contentType || '').includes('png') ? '.png' : '.jpg';
          const filename = `${generateToken(12)}${ext}`;
          await uploadToR2(env.STORAGE, `assets/${project_id}/${filename}`, got.bytes, got.contentType || 'image/jpeg');
          pics.push(`/preview-asset/${project_id}/${filename}`);
        }
      }
    } catch (e) {
      console.error('prefill photo fetch failed (non-fatal):', e.message);
    }

    // Map the research profile into the detailed-form shape.
    const found = {
      business_name: profile.name && profile.name !== 'Your Business' ? profile.name : '',
      website_url: websiteUrl,
      history: profile.description || '',
      services: ((profile.source && profile.source.scrape_headings) || []).slice(0, 8).join(', '),
      social: socialFromScrape,
      service_area: profile.address ? { type: 'city', value: cityFromAddress(profile.address) } : { type: 'city', value: '' },
      contact: { email: '', phone: profile.phone || '', address: profile.address || '' },
      logo_url: profile.logo || '',
      picture_urls: pics,
    };

    // Screen scraped third-party text before surfacing it. On a hit, drop the
    // free-text (keep the hard facts) rather than failing the whole prefill.
    const screen = screenContent([found.history, found.services].filter(Boolean).join('\n'));
    if (!screen.allowed) {
      found.history = '';
      found.services = '';
    }

    const merged = mergeFillingBlanks(current, found);

    await updateAIProject(env.DB, project.id, {
      detailed_profile_json: JSON.stringify(merged),
      enrichment_status: 'complete',
      business_status: project.business_status || 'existing_business',
    });

    // Charge AI credits — the paid Places call ran.
    await chargeCredits(env, env.DB, project.customer_email, CREDIT_COSTS.enrich);

    return json({ success: true, found: places.found || !!html, profile: merged });
  } catch (error) {
    console.error('Error during prefill:', error);
    // Release the claim so the user can retry.
    try {
      const p = await getAIProjectByProjectId(env.DB, params.project_id);
      if (p) await updateAIProject(env.DB, p.id, { enrichment_status: 'failed' });
    } catch {}
    return json({ success: false, error: 'Research failed', details: error.message }, 500);
  }
}

/**
 * Pull the first social-profile URL per platform out of scraped HTML.
 * @param {string} html
 * @returns {object} { facebook, instagram, x, youtube, linkedin, tiktok }
 */
function extractSocialLinks(html) {
  const out = {};
  for (const p of SOCIAL_PLATFORMS) out[p] = '';
  if (!html || typeof html !== 'string') return out;

  const hosts = {
    facebook: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/i,
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i,
    x: /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^\s"'<>]+/i,
    youtube: /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>]+/i,
    linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/i,
    tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+/i,
  };
  for (const [key, re] of Object.entries(hosts)) {
    const m = html.match(re);
    if (m) out[key] = m[0].replace(/["'<>].*$/, '');
  }
  return out;
}

/** Best-effort city from a formatted address ("1 Main St, Austin, TX 78701, USA"). */
function cityFromAddress(address) {
  const parts = String(address || '').split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1] : (parts[0] || '');
}
