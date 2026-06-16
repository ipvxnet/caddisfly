/**
 * Attach a relevant real photo to each service tile (Pexels stock, keyed to the
 * industry + service name) so the services section shows clean pictures instead
 * of plain emoji icons.
 *
 * We deliberately use stock photos rather than text-to-image generation: diffusion
 * models bake in garbled text and misread abstract service names (e.g. "Signature
 * Combo" → a hamburger). Stock photos are real, on-topic, free and fast. Falls
 * back to the emoji icon tile when no photo is found.
 */

import { searchStockPhotos } from './stock-photos.js';
import { imageKeywordsFor } from './industry-style.js';

/**
 * @param {object} env - bindings (needs PEXELS_API_KEY for stock photos)
 * @param {string} _publicId - kept for call-site compatibility (unused for stock)
 * @param {object} content - services section content ({ services: [...] }), mutated in place
 * @param {object} context - generation context (industry/business_type for relevance)
 * @returns {Promise<object>} the same content
 */
export async function attachServiceImages(env, _publicId, content, context = {}) {
  if (!env || !content || !Array.isArray(content.services)) return content;

  const industry = context.industry || '';
  const used = new Set();

  // Cap stock lookups (one search each) — a long services list (e.g. 15)
  // shouldn't fire 15 searches. The rest fall back to icons, which also keeps a
  // dense many-tile grid lighter.
  const MAX_SERVICE_IMAGES = 8;
  let attached = 0;
  for (const svc of content.services) {
    if (!svc || svc.image_url || !svc.title) continue;
    if (attached >= MAX_SERVICE_IMAGES) break;
    try {
      // Lead the query with the service name, backed by industry keywords.
      const results = await searchStockPhotos(env, imageKeywordsFor(industry, svc.title), 5);
      const pick = (results || []).find((p) => p && p.url && !used.has(p.url)) || (results && results[0]);
      if (pick && pick.url) {
        svc.image_url = pick.url;
        if (!svc.image_alt) svc.image_alt = pick.alt || svc.title;
        used.add(pick.url);
        attached++;
      }
    } catch (e) {
      console.error(`Service stock photo failed for "${svc.title}" (non-fatal):`, e.message);
    }
  }
  return content;
}
