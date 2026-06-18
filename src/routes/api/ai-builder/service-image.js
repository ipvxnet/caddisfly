// Per-item image helpers for the section editor (services tiles):
//   POST /api/ai-builder/:project_id/stock-photo   { query }  → { url, alt }
//   POST /api/ai-builder/:project_id/generate-image { prompt } → { url }
// Both are access-gated (PROJ middleware). Stock is free; AI (Flux) is gated to
// paid plans in production (like logo generation) since it costs compute.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { searchStockPhotos } from '../../../utils/stock-photos.js';
import { generateImageToR2 } from './ai-edit.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';
import { getUserTier } from '../../../utils/rate-limiter.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

async function ownerEmail(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) return ai.customer_email || '';
  const rp = await getProjectByPreviewId(env.DB, publicId);
  return rp ? (rp.customer_email || '') : null; // null = project not found
}

/** Suggest a relevant real (stock) photo for a service. */
export async function handleStockPhoto(ctx) {
  const { request, env, params } = ctx;
  try {
    const email = await ownerEmail(env, params.project_id);
    if (email === null) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const query = (body.query || '').toString().trim().slice(0, 120);
    if (!query) return json({ success: false, error: 'Missing query' }, 400);
    const results = await searchStockPhotos(env, query, 6);
    // Allow a cursor so repeated clicks cycle through options.
    const idx = Math.max(0, Math.min((parseInt(body.skip, 10) || 0), (results.length || 1) - 1));
    const pick = results[idx] || results[0];
    if (!pick || !pick.url) return json({ success: false, error: 'No photo found. Try a manual upload.' }, 404);
    return json({ success: true, url: pick.url, alt: pick.alt || query });
  } catch (error) {
    console.error('stock-photo error:', error);
    return json({ success: false, error: 'Could not fetch a photo' }, 500);
  }
}

/** Generate a brand-new image with AI (Flux) for a service tile. */
export async function handleGenerateImage(ctx) {
  const { request, env, params } = ctx;
  try {
    const email = await ownerEmail(env, params.project_id);
    if (email === null) return json({ success: false, error: 'Project not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const prompt = (body.prompt || '').toString().trim().slice(0, 200);
    if (!prompt) return json({ success: false, error: 'Missing prompt' }, 400);

    const screen = screenContent(prompt);
    if (!screen.allowed) return json(policyError(screen), 422);

    // Paid feature in production (mirrors logo generation); preview is open.
    if (env.ENVIRONMENT === 'production') {
      const tier = await getUserTier(env.DB, email);
      if (tier === 'free_trial') {
        return json({
          success: false,
          error: 'AI image generation is available on paid plans.',
          upgrade_message: 'Upgrade to Starter or higher to generate images.',
          billing_url: '/billing',
        }, 402);
      }
    }

    // Photographic style, never extreme close-up — same engineering as gallery gen.
    const styled = `professional photograph of ${prompt}, natural lighting, realistic, high detail, no text`;
    const url = await generateImageToR2(env, params.project_id, styled);
    return json({ success: true, url });
  } catch (error) {
    console.error('generate-image error:', error);
    return json({ success: false, error: 'Image generation failed. Try again.' }, 500);
  }
}
