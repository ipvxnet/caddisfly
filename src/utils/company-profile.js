/**
 * Company profile: merge a best-effort scrape signal with Google Places facts
 * into one canonical object that drives content + template generation.
 *
 * The scrape is no longer load-bearing (target sites are often bot-protected),
 * so Places data takes precedence for hard facts; the scrape only fills gaps.
 *
 * Pure functions, no I/O, no global state.
 */

/**
 * Extract a lightweight signal from scraped HTML without any dependencies.
 * Safe to call on thin/app-shell HTML — missing pieces come back empty.
 * @param {string} html - Scraped HTML (may be thin)
 * @param {string} url - Page URL
 * @returns {object} { title, description, siteName, headings, sampleText }
 */
export function extractScrapeSignal(html, url) {
  const signal = {
    title: '',
    description: '',
    siteName: '',
    headings: [],
    sampleText: '',
    domain: domainFromUrl(url),
  };

  if (!html || typeof html !== 'string') {
    return signal;
  }

  signal.title = matchFirst(html, /<title[^>]*>([^<]+)<\/title>/i);
  signal.description = metaContent(html, 'name', 'description');
  signal.siteName = metaContent(html, 'property', 'og:site_name');

  // Collect up to 8 heading texts (h1-h3) as topic hints.
  const headingMatches = html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
  for (const m of headingMatches) {
    const text = stripTags(m[1]);
    if (text && signal.headings.length < 8) signal.headings.push(text);
  }

  // A small sample of visible body text for additional context.
  signal.sampleText = visibleText(html).slice(0, 1500);

  return signal;
}

/**
 * Merge scrape signal + Places data into a canonical company profile.
 * Places wins for facts; scrape fills descriptive gaps.
 * @param {object} scrapeSignal - From extractScrapeSignal (may be empty)
 * @param {object} placesData - From enrichBusiness ({found:false} if none)
 * @returns {object} Canonical profile
 */
export function buildProfile(scrapeSignal = {}, placesData = {}) {
  const places = placesData && placesData.found ? placesData : {};

  const name =
    places.name ||
    scrapeSignal.siteName ||
    cleanTitle(scrapeSignal.title) ||
    scrapeSignal.domain ||
    'Your Business';

  return {
    name,
    category: places.category || '',
    description: places.summary || scrapeSignal.description || '',
    address: places.address || '',
    phone: places.phone || '',
    website: places.website || (scrapeSignal.domain ? `https://${scrapeSignal.domain}` : ''),
    hours: places.hours || [],
    rating: places.rating || null,
    rating_count: places.rating_count || 0,
    reviews: Array.isArray(places.reviews) ? places.reviews : [],
    // Provenance + raw hints kept for prompt-building and debugging.
    source: {
      places_found: !!places.name,
      place_id: places.place_id || null,
      scrape_headings: scrapeSignal.headings || [],
      scrape_sample: scrapeSignal.sampleText || '',
    },
  };
}

/**
 * Map a profile to the `context` object the AI content generator expects
 * (see ai-content-generator.js buildContext / ai-prompts.js getContentPrompt).
 * @param {object} profile - Canonical profile
 * @returns {object} Generation context
 */
export function profileToContext(profile) {
  return {
    business_name: profile.name,
    business_type: profile.category || 'business',
    industry: profile.category || 'general',
    audience: 'customers',
    tone: 'professional',
    style: 'modern',
    content_source: 'google_places',
    // Extra facts the prompts can weave in (description, location, reviews).
    description: profile.description,
    location: profile.address,
    selected_sections: [],
  };
}

/**
 * Derive section content straight from hard facts (no AI, no hallucination).
 * Returns a map of section_type -> content for the sections we can fill
 * confidently from Places. The caller merges these over AI-generated content.
 * @param {object} profile - Canonical profile
 * @returns {object} { contact?, testimonials? }
 */
export function profileToFactSections(profile) {
  const sections = {};

  if (profile.phone || profile.address || profile.website) {
    sections.contact = {
      heading: 'Get In Touch',
      phone: profile.phone || '',
      address: profile.address || '',
      email: '',
    };
  }

  // Real Google reviews make better testimonials than invented ones — but only
  // POSITIVE ones (4★+). This is the business's own marketing site; a 1★ "they
  // were rude to me" review must never be surfaced as a testimonial.
  const realReviews = (profile.reviews || []).filter(
    (r) => r.text && r.text.trim() && typeof r.rating === 'number' && r.rating >= 4
  );
  if (realReviews.length > 0) {
    sections.testimonials = {
      heading: 'What Our Customers Say',
      testimonials: realReviews.map((r) => ({
        quote: r.text,
        author: r.author || 'Verified customer',
        role: r.rating ? `${r.rating}★ Google review` : 'Google review',
      })),
    };
  }

  return sections;
}

// ---- internal helpers ----

function matchFirst(html, regex) {
  const m = html.match(regex);
  return m ? stripTags(m[1]).trim() : '';
}

/**
 * Extract a <meta> tag's content value, regardless of attribute order
 * (e.g. <meta name="description" content="..."> or content-first).
 * @param {string} html
 * @param {string} attr - 'name' or 'property'
 * @param {string} value - e.g. 'description' or 'og:site_name'
 * @returns {string}
 */
function metaContent(html, attr, value) {
  const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the whole meta tag that carries the target attr=value, then pull content=.
  const tagRe = new RegExp(`<meta[^>]*\\b${attr}=["']${esc}["'][^>]*>`, 'i');
  const tag = html.match(tagRe);
  if (!tag) return '';
  const content = tag[0].match(/\bcontent=["']([^"']*)["']/i);
  return content ? stripTags(content[1]).trim() : '';
}

function stripTags(s) {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleText(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Strip common " | Site Name" / " - Tagline" suffixes from a <title>.
function cleanTitle(title) {
  if (!title) return '';
  return title.split(/\s[|\-–—]\s/)[0].trim();
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
