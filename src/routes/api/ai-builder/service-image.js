// Per-item image helpers for the section editor (services tiles):
//   POST /api/ai-builder/:project_id/stock-photo   { query }  → { url, alt }
//   POST /api/ai-builder/:project_id/generate-image { prompt } → { url }
// Both are access-gated (PROJ middleware). Stock is free; AI (Flux) is gated to
// paid plans in production (like logo generation). Both GROUND the request in the
// site's vertical so "Odontogeriatria" doesn't become a tooth-bug — Flux/stock
// get dental context, not a bare (often non-English) service word.

import { resolveStoreProject } from './store.js';
import { searchStockPhotos } from '../../../utils/stock-photos.js';
import { inferIndustry, imageKeywordsFor } from '../../../utils/industry-style.js';
import { generateImageToR2 } from './ai-edit.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';
import { getUserTier } from '../../../utils/rate-limiter.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

/** Map the project + this term to our internal industry key (for keyword grounding). */
function industryKey(r, term) {
  return inferIndustry(r.industry || '', r.businessName || '', term || '');
}

/** Suggest a relevant real (stock) photo for a service, grounded in the vertical. */
export async function handleStockPhoto(ctx) {
  const { request, env, params } = ctx;
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const query = (body.query || '').toString().trim().slice(0, 120);
    if (!query) return json({ success: false, error: 'Missing query' }, 400);

    // e.g. "Odontogeriatria" + dental keywords → relevant elderly-dental photos.
    const grounded = imageKeywordsFor(industryKey(r, query), query);
    const results = await searchStockPhotos(env, grounded, 6);
    const idx = Math.max(0, Math.min((parseInt(body.skip, 10) || 0), (results.length || 1) - 1));
    const pick = results[idx] || results[0];
    if (!pick || !pick.url) return json({ success: false, error: 'No photo found. Try a manual upload.' }, 404);
    return json({ success: true, url: pick.url, alt: pick.alt || query });
  } catch (error) {
    console.error('stock-photo error:', error);
    return json({ success: false, error: 'Could not fetch a photo' }, 500);
  }
}

/** Generate a brand-new image with AI (Flux), grounded in the vertical. */
export async function handleGenerateImage(ctx) {
  const { request, env, params } = ctx;
  try {
    const r = await resolveStoreProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const subject = (body.prompt || '').toString().trim().slice(0, 200);
    if (!subject) return json({ success: false, error: 'Missing prompt' }, 400);

    const screen = screenContent(subject);
    if (!screen.allowed) return json(policyError(screen), 422);

    // Paid feature in production (mirrors logo generation); preview is open.
    if (env.ENVIRONMENT === 'production') {
      const tier = await getUserTier(env.DB, r.email);
      if (tier === 'free_trial') {
        return json({
          success: false,
          error: 'AI image generation is available on paid plans.',
          upgrade_message: 'Upgrade to Starter or higher to generate images.',
          billing_url: '/billing',
        }, 402);
      }
    }

    // Ground the prompt in the vertical so the model doesn't free-associate on a
    // bare (often Portuguese/Spanish) service word.
    const key = industryKey(r, subject);
    const ground = imageKeywordsFor(key, '');
    const vertical = r.industry || key || 'small business';
    const styled = `Professional, realistic editorial photograph for a ${vertical} business, depicting: ${subject}. Setting/context: ${ground}. Natural lighting, true-to-life, high detail, NO text, NO words, NO logos, not an extreme close-up.`;

    const url = await generateImageToR2(env, params.project_id, styled);
    return json({ success: true, url });
  } catch (error) {
    console.error('generate-image error:', error);
    return json({ success: false, error: 'Image generation failed. Try again.' }, 500);
  }
}
