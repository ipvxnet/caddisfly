// POST /api/preview/search
//
// The refactor "preview what we found" step. Runs the PAID Google Places lookup
// (+ best-effort scrape) ONCE, caches the resolved profile and photo pool on a
// project, and returns a preview the user confirms before we build. Capped at
// LOOKUP_DAILY_LIMIT per IP and per email/day (see db/lookup-attempts.js) since
// this fires before any account exists.

import { v4 as uuidv4 } from 'uuid';
import { isValidEmail, sanitizeEmail } from '../../../utils/email.js';
import { isValidUrl } from '../../../utils/scraper.js';
import { generateToken } from '../../../utils/crypto.js';
import { createProject, updateProject } from '../../../db/projects.js';
import { scrapeBestSignal } from '../../../utils/refactor-scrape.js';
import { enrichBusiness } from '../../../utils/google-places.js';
import { buildProfile, applyDetailedOverride } from '../../../utils/company-profile.js';
import { extractBrandColors } from '../../../utils/brand-colors.js';
import { coerceDetailedProfile } from '../../../utils/detailed-profile.js';
import { buildPhotoPool } from '../../../utils/template-generation.js';
import { inferIndustry } from '../../../utils/industry-style.js';
import { lookupAllowance, recordLookup, hashIp, LOOKUP_DAILY_LIMIT } from '../../../db/lookup-attempts.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';
import { translator } from '../../../i18n/index.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

function normalizeWebsiteUrl(url) {
  let n = String(url || '').trim();
  if (!/^https?:\/\//i.test(n)) n = 'https://' + n;
  return n.replace(/\/$/, '');
}

export async function handlePreviewSearch(ctx) {
  const { request, env } = ctx;
  try {
    const body = await request.json();
    const { email, website } = body;
    const acceptedTerms = body.accepted_terms === true || body.accepted_terms === 'true';
    const LANGS = ['en', 'es', 'pt'];
    const language = LANGS.includes(body.language) ? body.language : (LANGS.includes(ctx.lang) ? ctx.lang : 'en');
    const tr = translator(language);

    if (!acceptedTerms) {
      return json({ success: false, error: 'You must agree to the Terms of Service and Privacy Policy to continue.', terms_url: '/terms' }, 400);
    }
    if (!email || !isValidEmail(email)) return json({ success: false, error: 'Valid email address is required' }, 400);
    if (!website || !isValidUrl(website)) return json({ success: false, error: 'Valid website URL is required' }, 400);

    const sanitizedEmail = sanitizeEmail(email);
    const normalizedWebsite = normalizeWebsiteUrl(website);

    // Abuse cap (paid call ahead): 5/day per IP AND per email.
    const ipHash = await hashIp(request.headers.get('CF-Connecting-IP') || '');
    const allow = await lookupAllowance(env.DB, ipHash, sanitizedEmail);
    if (!allow.allowed) {
      return json({ success: false, limit_reached: true, remaining: 0, error: tr('landing.rf_limit') }, 429);
    }

    // Validate/screen user-provided details.
    const userProfile = coerceDetailedProfile(body);
    userProfile.website_url = normalizedWebsite;
    const freeText = [userProfile.business_name, userProfile.search_query, userProfile.services].filter(Boolean).join('\n');
    if (freeText) {
      const screen = screenContent(freeText);
      if (!screen.allowed) return json(policyError(screen), 422);
    }

    // Count this attempt now (so a no-match still consumes one — can't retry-spam).
    await recordLookup(env.DB, ipHash, sanitizedEmail);

    // Scrape (placeholder-aware) + paid Places lookup.
    // browser:true → allow the paid Zyte fallback; this path is capped at 5/day.
    const scrapeSignal = await scrapeBestSignal(normalizedWebsite, env, { browser: true });
    const businessName = userProfile.business_name || (scrapeSignal && (scrapeSignal.siteName || scrapeSignal.title)) || '';
    const userQuery = userProfile.search_query || userProfile.business_name || '';
    let places = { found: false };
    try {
      places = await enrichBusiness(env, { businessName, website: normalizedWebsite, query: userQuery });
    } catch (e) {
      console.error('Preview search enrichment error:', e.message);
    }

    let profile = buildProfile(scrapeSignal, places);
    profile = applyDetailedOverride(profile, userProfile);

    // Auto-detect the site's real brand colors (render + computed styles) when
    // the owner didn't supply them — so a novice's refactor keeps their branding.
    if (!profile.brand_color && env.BROWSER) {
      try {
        const renderUrl = (scrapeSignal && scrapeSignal.sourceUrl) || normalizedWebsite;
        const bc = await extractBrandColors(env, renderUrl);
        if (bc && bc.primary) {
          profile.brand_color = bc.primary;
          if (bc.accent) profile.accent_color = profile.accent_color || bc.accent;
          profile.detected_dark = !!bc.dark;
          console.log(`Auto brand colors for ${renderUrl}: primary=${bc.primary} accent=${bc.accent || '-'} dark=${bc.dark}`);
        }
      } catch (e) {
        console.error('Brand color detect error:', e.message);
      }
    }

    // Host the cached profile + R2 photos on a project so confirm-build reuses
    // them with no second paid call.
    const previewId = uuidv4();
    const token = generateToken(24);
    const project = await createProject(env.DB, {
      preview_id: previewId,
      customer_email: sanitizedEmail,
      website_url: normalizedWebsite,
      status: 'preview_search',
      use_templates: 1,
      language,
    });

    const src = profile.source || {};
    const industry = inferIndustry(
      profile.category, profile.name,
      ...(Array.isArray(src.scrape_headings) ? src.scrape_headings : []),
      src.scrape_sample || ''
    );
    let photoPool = [];
    try {
      photoPool = await buildPhotoPool(env, project, profile, industry);
    } catch (e) {
      console.error('Preview search photo pool error:', e.message);
    }

    await updateProject(env.DB, project.id, {
      template_generation_status: 'preview_search',
      enrichment_status: 'searched',
      verification_token: token,
      company_profile_json: JSON.stringify({ scrapeSignal, userProfile, profile, photoPool }),
    });

    const after = await lookupAllowance(env.DB, ipHash, sanitizedEmail);
    return json({
      success: true,
      preview_id: previewId,
      build_token: token,
      found: !!places.found,
      name: profile.name || '',
      category: profile.category || '',
      address: profile.address || '',
      phone: profile.phone || '',
      rating: profile.rating || null,
      rating_count: profile.rating_count || 0,
      sample: (src.scrape_sample || profile.description || '').slice(0, 320),
      headings: (Array.isArray(src.scrape_headings) ? src.scrape_headings : []).slice(0, 6),
      photos: photoPool.slice(0, 6).map((p) => p.url),
      reviews: (Array.isArray(profile.reviews) ? profile.reviews : []).slice(0, 2)
        .map((r) => ({ author: r.author, rating: r.rating, text: (r.text || '').slice(0, 160) })),
      remaining: after.remaining,
      limit: LOOKUP_DAILY_LIMIT,
    });
  } catch (error) {
    console.error('Preview search error:', error);
    return json({ success: false, error: 'Search failed', details: error.message }, 500);
  }
}
