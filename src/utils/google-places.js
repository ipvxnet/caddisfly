/**
 * Google Places client (Places API "New").
 *
 * Used to identify a real business and pull structured facts when scraping the
 * target site is blocked or thin. These calls COST money per request, so callers
 * must only invoke `enrichBusiness` after the user's email is verified.
 *
 * Cost control: every request sends an explicit `X-Goog-FieldMask` so we are only
 * billed for the fields we actually use. Keep the masks minimal.
 *
 * Requires the `GOOGLE_PLACES_API_KEY` secret (set per env via wrangler secret put).
 */

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_DETAILS_BASE = 'https://places.googleapis.com/v1/places/';

// Only request the fields we render. Adding fields here can change billing SKU.
const SEARCH_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress';
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'primaryTypeDisplayName',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'regularOpeningHours.weekdayDescriptions',
  'rating',
  'userRatingCount',
  'reviews',
  'editorialSummary',
].join(',');

const MAX_REVIEWS = 5;

/**
 * Find the best-matching place id for a text query.
 * @param {object} env - Environment bindings (needs GOOGLE_PLACES_API_KEY)
 * @param {string} query - Free-text query, e.g. "Acme Plumbing Austin TX"
 * @returns {Promise<string|null>} place_id or null if nothing matched
 */
export async function findPlace(env, query) {
  if (!env.GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured');
  }
  if (!query || !query.trim()) {
    return null;
  }

  const response = await fetch(PLACES_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
      // The API key may be referrer-restricted ("Website" application
      // restriction). Server-side fetch sends no Referer by default, so set one
      // that matches the allowed pattern (our app origin).
      Referer: refererFor(env),
    },
    body: JSON.stringify({ textQuery: query.trim(), maxResultCount: 1 }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Places searchText failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const place = data.places && data.places[0];
  return place ? place.id : null;
}

/**
 * Fetch details for a place id.
 * @param {object} env - Environment bindings
 * @param {string} placeId - Google Places place id
 * @returns {Promise<object>} Raw Place Details object
 */
export async function getPlaceDetails(env, placeId) {
  if (!env.GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured');
  }

  const url = PLACES_DETAILS_BASE + encodeURIComponent(placeId);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
      Referer: refererFor(env),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Places details failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Identify a business and return a normalized profile.
 *
 * Never throws for "not found" — returns { found: false } so the caller can
 * fall back to scrape-only generation. Throws only on misconfiguration.
 *
 * @param {object} env - Environment bindings
 * @param {object} input - { businessName, website, location }
 * @returns {Promise<object>} Normalized profile (see shape below)
 */
export async function enrichBusiness(env, { businessName, website, location } = {}) {
  // Build the best text query we can from what we know.
  const parts = [];
  if (businessName) parts.push(businessName);
  if (location) parts.push(location);
  // Fall back to the bare domain if we have no name.
  if (!businessName && website) {
    parts.push(domainFromUrl(website));
  }
  const query = parts.join(' ').trim();

  if (!query) {
    return { found: false, reason: 'no_query' };
  }

  const placeId = await findPlace(env, query);
  if (!placeId) {
    return { found: false, reason: 'no_match', query };
  }

  const details = await getPlaceDetails(env, placeId);
  return normalizeDetails(details, placeId);
}

/**
 * Normalize raw Place Details into the shape our content/template pipeline uses.
 * @param {object} d - Raw Place Details
 * @param {string} placeId - place id
 * @returns {object} Normalized profile
 */
function normalizeDetails(d, placeId) {
  const reviews = Array.isArray(d.reviews)
    ? d.reviews.slice(0, MAX_REVIEWS).map((r) => ({
        author: r.authorAttribution?.displayName || '',
        rating: r.rating || null,
        text: r.text?.text || r.originalText?.text || '',
      }))
    : [];

  return {
    found: true,
    place_id: placeId,
    name: d.displayName?.text || '',
    category: d.primaryTypeDisplayName?.text || '',
    summary: d.editorialSummary?.text || '',
    address: d.formattedAddress || '',
    phone: d.internationalPhoneNumber || d.nationalPhoneNumber || '',
    website: d.websiteUri || '',
    hours: d.regularOpeningHours?.weekdayDescriptions || [],
    rating: d.rating || null,
    rating_count: d.userRatingCount || 0,
    reviews,
  };
}

/**
 * Build a Referer value that matches the API key's allowed HTTP-referrer
 * patterns. Uses the app origin (APP_URL); falls back to the preview origin.
 * Note: for an apex prod domain (caddisfly.ai), a `*.caddisfly.ai/*` referrer
 * pattern won't match — use www.caddisfly.ai or add `caddisfly.ai/*` in GCP.
 * @param {object} env
 * @returns {string}
 */
function refererFor(env) {
  const base = (env && env.APP_URL) || 'https://caddisfly-preview.fabianodevtools.workers.dev';
  return base.endsWith('/') ? base : base + '/';
}

/**
 * Extract a bare domain (no protocol/www) from a URL for use as a search hint.
 * @param {string} url
 * @returns {string}
 */
function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
