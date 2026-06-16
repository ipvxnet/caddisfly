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
  'photos',
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
export async function enrichBusiness(env, { businessName, website, location, query: explicitQuery } = {}) {
  // A user-supplied "how to find us on Google" query wins verbatim — it's the
  // strongest signal, especially when the site is unreadable/misconfigured and
  // the domain-derived name is useless (e.g. "clinicanouva" vs "Clinica Nouva").
  let query = typeof explicitQuery === 'string' ? explicitQuery.trim() : '';
  if (!query) {
    // Otherwise build the best text query we can from what we know.
    const parts = [];
    if (businessName) parts.push(businessName);
    if (location) parts.push(location);
    // Fall back to the bare domain if we have no name.
    if (!businessName && website) {
      parts.push(domainFromUrl(website));
    }
    query = parts.join(' ').trim();
  }

  if (!query) {
    return { found: false, reason: 'no_query' };
  }

  const placeId = await findPlace(env, query);
  if (!placeId) {
    return { found: false, reason: 'no_match', query };
  }

  const details = await getPlaceDetails(env, placeId);
  const profile = normalizeDetails(details, placeId);

  // Verify the match actually corresponds to the input site. Google Places
  // frequently fuzzy-matches an UNRELATED business (e.g. searching for IPVXNet
  // returned "Modern Networks LLC" in Florida). Trusting that would stamp a
  // stranger's name, phone, and address onto the customer's site — useless and
  // a real liability. Require the matched listing's website domain to equal the
  // input domain; otherwise reject so the caller falls back to scrape-only.
  const inputDomain = domainFromUrl(website || '');
  if (inputDomain) {
    const matchDomain = domainFromUrl(profile.website || '');
    if (!matchDomain || !sameRegistrableDomain(inputDomain, matchDomain)) {
      return {
        found: false,
        reason: 'domain_mismatch',
        query,
        place_id: placeId,
        matched_name: profile.name || null,
        matched_domain: matchDomain || null,
      };
    }
    profile.verified = true;
  }
  return profile;
}

/**
 * True when two bare domains belong to the same registrable site (exact match
 * or one is a subdomain of the other). Both inputs are already www-stripped.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function sameRegistrableDomain(a, b) {
  a = (a || '').toLowerCase().replace(/\.$/, '');
  b = (b || '').toLowerCase().replace(/\.$/, '');
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith('.' + b) || b.endsWith('.' + a);
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

  // Photo resource names (e.g. "places/X/photos/Y") — fetched to R2 at gen time.
  const photos = Array.isArray(d.photos) ? d.photos.map((p) => p.name).filter(Boolean).slice(0, 8) : [];

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
    photos,
  };
}

/**
 * Fetch the raw image bytes for a Places photo resource name.
 * The media endpoint follows a redirect to the actual image.
 * @param {object} env - Environment bindings (needs GOOGLE_PLACES_API_KEY)
 * @param {string} photoName - e.g. "places/X/photos/Y"
 * @returns {Promise<{bytes: ArrayBuffer, contentType: string}>}
 */
export async function fetchPlacePhotoBytes(env, photoName) {
  if (!env.GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured');
  }
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=1200&maxWidthPx=1600`;
  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      Referer: refererFor(env),
    },
  });
  if (!response.ok) {
    throw new Error(`Places photo media failed (${response.status})`);
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const bytes = await response.arrayBuffer();
  return { bytes, contentType };
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
