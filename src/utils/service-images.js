/**
 * Generate a small AI image per service (Flux → R2) so the services section can
 * show picture tiles instead of plain emoji icons. Best-effort per service: a
 * failure leaves image_url unset and the template falls back to the icon tile.
 */

import { generateImageToR2 } from '../routes/api/ai-builder/ai-edit.js';

/**
 * @param {object} env - bindings (needs AI + STORAGE)
 * @param {string} publicId - project_id (AI builder) or preview_id (refactor) — the R2 asset namespace
 * @param {object} content - services section content ({ services: [...] }), mutated in place
 * @param {object} context - generation context (business_type/name/industry for the prompt)
 * @returns {Promise<object>} the same content
 */
export async function attachServiceImages(env, publicId, content, context = {}) {
  if (!env || !env.AI || !content || !Array.isArray(content.services)) return content;

  const biz = context.business_type || context.industry || 'business';
  const name = context.business_name ? ` for ${context.business_name}` : '';

  for (const svc of content.services) {
    if (!svc || svc.image_url || !svc.title) continue;
    try {
      const prompt =
        `Professional, high-quality photograph representing the service "${svc.title}"${name}, a ${biz}. ` +
        `Realistic, well-lit, clean modern composition. No text, no words, no watermark, no logo.`;
      svc.image_url = await generateImageToR2(env, publicId, prompt);
    } catch (e) {
      console.error(`Service image failed for "${svc.title}" (non-fatal):`, e.message);
    }
  }
  return content;
}
