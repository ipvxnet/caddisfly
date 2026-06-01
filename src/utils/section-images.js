/**
 * Inject real image URLs into generated section content.
 *
 * Templates already support images (hero/fullscreen background_image,
 * hero/split + about image_url, gallery images[].url) — they just need URLs.
 * This fills those fields from a pool of photos (Pexels stock or Google Places),
 * so the same logic serves both flows.
 */

/**
 * Make a cycling photo picker over a pool. Returns null when the pool is empty.
 * @param {Array<{url: string, alt?: string}>} photos
 * @returns {() => ({url: string, alt?: string}|null)}
 */
export function makePhotoPicker(photos) {
  const pool = Array.isArray(photos) ? photos.filter((p) => p && p.url) : [];
  let i = 0;
  return () => (pool.length ? pool[i++ % pool.length] : null);
}

/**
 * Mutate `content` to include image URLs appropriate for the section type.
 * No-op for sections that don't use imagery (services use emoji icons, etc.).
 * @param {string} sectionType
 * @param {object} content - Section content object (mutated in place)
 * @param {() => ({url: string, alt?: string}|null)} pickPhoto
 */
export function attachImages(sectionType, content, pickPhoto) {
  switch (sectionType) {
    case 'hero': {
      const p = pickPhoto();
      if (p) {
        // Set both so whichever variant renders (fullscreen vs split) has an image.
        content.background_image = content.background_image || p.url;
        content.image_url = content.image_url || p.url;
      }
      break;
    }

    case 'about': {
      const p = pickPhoto();
      if (p) content.image_url = content.image_url || p.url;
      break;
    }

    case 'gallery': {
      const existing = Array.isArray(content.images) ? content.images : [];
      if (existing.length > 0) {
        // AI gives alt/caption but no url — fill urls, keep its descriptions.
        content.images = existing
          .map((img) => {
            const p = pickPhoto();
            return { ...img, url: img.url || (p && p.url) || '' };
          })
          .filter((img) => img.url);
      } else {
        // No AI images — build a gallery straight from the photo pool.
        const imgs = [];
        for (let i = 0; i < 6; i++) {
          const p = pickPhoto();
          if (p) imgs.push({ url: p.url, alt: p.alt || '', caption: '' });
        }
        content.images = imgs;
      }
      break;
    }

    default:
      // services/features (emoji icons), testimonials, contact, footer: no images.
      break;
  }
}
