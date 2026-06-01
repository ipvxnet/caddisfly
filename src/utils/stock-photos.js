/**
 * Stock photo lookup via the Pexels API.
 *
 * Used by the AI-generate flow (no real business) to give generated sites real,
 * appetizing imagery instead of empty placeholders. Returned URLs are Pexels
 * CDN links (hotlinkable, no key in the URL), so they can go straight into
 * <img src>/background-image.
 *
 * Requires the PEXELS_API_KEY secret. Degrades gracefully: returns [] when the
 * key is missing or the request fails, so generation never breaks.
 */

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';

/**
 * Search stock photos.
 * @param {object} env - Environment bindings (needs PEXELS_API_KEY)
 * @param {string} query - Search query, e.g. "mexican restaurant food"
 * @param {number} count - How many photos to return (default 6)
 * @returns {Promise<Array<{url: string, alt: string}>>} Photos (or [] on failure)
 */
export async function searchStockPhotos(env, query, count = 6) {
  if (!env.PEXELS_API_KEY) {
    console.warn('PEXELS_API_KEY not configured — skipping stock photos');
    return [];
  }
  if (!query || !query.trim()) {
    return [];
  }

  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query.trim())}&per_page=${count}&orientation=landscape`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: env.PEXELS_API_KEY },
    });

    if (!response.ok) {
      console.error(`Pexels search failed (${response.status}) for "${query}"`);
      return [];
    }

    const data = await response.json();
    const photos = Array.isArray(data.photos) ? data.photos : [];
    return photos
      .map((p) => ({
        // src.landscape is a well-cropped ~1200x627; fall back to large.
        url: (p.src && (p.src.landscape || p.src.large || p.src.medium)) || '',
        alt: p.alt || query,
      }))
      .filter((p) => p.url);
  } catch (error) {
    console.error('Pexels search error:', error.message);
    return [];
  }
}
