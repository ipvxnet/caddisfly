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
        // AI gives alt/caption but no url — fill urls where we have photos, and
        // keep the rest as-is (the masonry template has a per-image fallback),
        // so we never blank out the gallery when there are no photos.
        content.images = existing.map((img) => {
          if (img.url) return img;
          const p = pickPhoto();
          return p ? { ...img, url: p.url } : { ...img };
        });
      } else {
        // No AI images — build a gallery from the photo pool when we have one.
        const imgs = [];
        for (let i = 0; i < 6; i++) {
          const p = pickPhoto();
          if (p) imgs.push({ url: p.url, alt: p.alt || '', caption: '' });
        }
        // Only set when we actually have photos; otherwise leave undefined so
        // the template's own defaults render instead of an empty gallery.
        if (imgs.length) content.images = imgs;
      }
      break;
    }

    default:
      // services/features (emoji icons), testimonials, contact, footer: no images.
      break;
  }
}
