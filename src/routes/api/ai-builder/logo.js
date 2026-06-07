// AI logo generator — generate icon-mark options with Flux, set/remove the
// site logo (header brand + published favicon + og:image fallback).
//   POST /api/ai-builder/:project_id/logo/generate   (batch of mark options)
//   POST /api/ai-builder/:project_id/logo            (set { url } / remove { url: '' })
//
// Diffusion models render TEXT poorly, so prompts ask for a wordless icon/mark
// only — the navbar pairs it with the typeset business name (navbar.js brand).

import { resolveStoreProject as resolveProject, getOrCreateConfig } from './store.js';
import { updateWebsiteConfigById } from '../../../db/ai-config.js';
import { getSiteSections, updateSectionContent } from '../../../db/ai-sections.js';
import { generateImageToR2 } from './ai-edit.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS } from '../../../utils/credits.js';
import { getUserTier, checkAIGenerationLimit, limitsDisabled, formatRateLimitError } from '../../../utils/rate-limiter.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Four style lenses so one batch gives genuinely different directions.
const LOGO_STYLES = [
  'minimal flat geometric logo mark, clean simple shapes, generous negative space',
  'modern abstract emblem logo mark, smooth organic curves',
  'simple line-art logo icon, elegant thin strokes, monoline',
  'bold badge-style logo mark, strong solid silhouette',
];

// Hard suffix that keeps marks usable as logos/favicons.
const LOGO_SUFFIX =
  'single centered icon on a plain solid white background, flat vector style, professional brand identity, ' +
  'high contrast, crisp edges, no text, no letters, no words, no typography, no watermark, no photo, no gradients background';

/**
 * POST /api/ai-builder/:project_id/logo/generate — generate a batch of logo
 * mark options. Body: { brief? } (free-text style notes). Charges
 * CREDIT_COSTS.logo once per batch; returns whatever options succeeded.
 */
export async function handleLogoGenerate(ctx) {
  const { request, env, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);

    let brief = '';
    try {
      const body = await request.json();
      brief = (body.brief || '').toString().trim().slice(0, 200);
    } catch { /* empty body is fine */ }

    if (brief) {
      const screen = screenContent(brief);
      if (!screen.allowed) return json(policyError(screen), 422);
    }

    // Paid feature: AI logo generation needs a paid plan (enforced in prod
    // only, like PRODUCT_LIMITS, so preview testing isn't blocked).
    if (env.ENVIRONMENT === 'production') {
      const tier = await getUserTier(env.DB, r.email);
      if (tier === 'free_trial') {
        return json({
          success: false,
          error: 'AI logo generation is available on paid plans.',
          upgrade_message: 'Upgrade to Starter or higher to generate logos.',
          billing_url: '/billing',
        }, 402);
      }
    }

    // Rate-limit the costly path (image generation), bypassed in preview/dev.
    if (!limitsDisabled(env)) {
      const tier = await getUserTier(env.DB, r.email);
      const check = await checkAIGenerationLimit(env.DB, r.email, tier);
      if (!check.allowed) return json(formatRateLimitError(check, 'generations'), 429);
    }

    const cost = CREDIT_COSTS.logo;
    const afford = await canAfford(env, env.DB, r.email, cost);
    if (!afford.ok) return json(formatCreditError(afford.state, 'logo generation'), 402);

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    const subject = `for ${r.industry ? `a ${r.industry} business` : 'a small business'} named "${r.businessName}"`;
    const accent = config.primary_color ? `, accent color ${config.primary_color}` : '';
    const notes = brief ? `, ${brief}` : '';

    const results = await Promise.all(
      LOGO_STYLES.map((style) =>
        generateImageToR2(env, params.project_id, `${style} ${subject}${accent}${notes}, ${LOGO_SUFFIX}`)
          .catch((e) => { console.error('logo option failed:', e.message); return null; })
      )
    );
    const options = results.filter(Boolean);
    if (!options.length) return json({ success: false, error: 'Logo generation failed. Try again.' }, 502);

    // Charge once per batch (after success), even if some options failed.
    await chargeCredits(env, env.DB, r.email, cost);

    return json({ success: true, options, business_name: r.businessName });
  } catch (error) {
    console.error('Error in logo generate:', error);
    return json({ success: false, error: 'Failed to generate logos', details: error.message }, 500);
  }
}

/**
 * POST /api/ai-builder/:project_id/logo — set or remove the site logo.
 * Body: { url } where url is a /preview-asset/<this project>/<file> path
 * (generated option or an upload), or '' to remove. Updates the config
 * (favicon + og fallback at publish) AND the header section's brand logo.
 */
export async function handleLogoSet(ctx) {
  const { request, env, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);

    const body = await request.json();
    const url = (body.url || '').toString().trim();

    // Only our own served assets for THIS project (or empty = remove).
    if (url) {
      const prefix = `/preview-asset/${params.project_id}/`;
      const file = url.startsWith(prefix) ? url.slice(prefix.length) : null;
      if (!file || !/^[A-Za-z0-9._-]+$/.test(file)) {
        return json({ success: false, error: 'Invalid logo URL' }, 400);
      }
    }

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    await updateWebsiteConfigById(env.DB, config.id, { logo_url: url || null });

    // Keep the header section's brand in sync (navbar renders content.logo).
    const siteSections = await getSiteSections(env.DB, r.projectKey);
    for (const section of siteSections) {
      if (section.section_type !== 'header') continue;
      let content = {};
      try { content = JSON.parse(section.content_json || '{}'); } catch { /* keep {} */ }
      content.logo = url;
      await updateSectionContent(env.DB, section.id, content);
    }

    return json({ success: true, logo_url: url || null });
  } catch (error) {
    console.error('Error in logo set:', error);
    return json({ success: false, error: 'Failed to update logo', details: error.message }, 500);
  }
}
