/**
 * Company profile: merge a best-effort scrape signal with Google Places facts
 * into one canonical object that drives content + template generation.
 *
 * The scrape is no longer load-bearing (target sites are often bot-protected),
 * so Places data takes precedence for hard facts; the scrape only fills gaps.
 *
 * Pure functions, no I/O, no global state.
 */

import { coerceDetailedProfile, SOCIAL_PLATFORMS } from './detailed-profile.js';

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
    logo: '',
    brandColor: '',
    images: [],
  };

  if (!html || typeof html !== 'string') {
    return signal;
  }

  signal.title = matchFirst(html, /<title[^>]*>([^<]+)<\/title>/i);
  signal.description = metaContent(html, 'name', 'description');
  signal.siteName = metaContent(html, 'property', 'og:site_name');

  // Identity signals from the original site's <head> (usually readable even on
  // bot-protected sites): logo image and brand color. Resolve to absolute URLs.
  const logoRaw =
    metaContent(html, 'property', 'og:image') ||
    metaContent(html, 'name', 'twitter:image') ||
    linkHref(html, 'apple-touch-icon');
  signal.logo = absoluteUrl(logoRaw, url);

  signal.brandColor =
    metaContent(html, 'name', 'theme-color') ||
    metaContent(html, 'name', 'msapplication-TileColor') ||
    '';

  // Collect up to 8 heading texts (h1-h3) as topic hints.
  const headingMatches = html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
  for (const m of headingMatches) {
    const text = stripTags(m[1]);
    if (text && signal.headings.length < 8) signal.headings.push(text);
  }

  // A small sample of visible body text for additional context.
  signal.sampleText = visibleText(html).slice(0, 1500);

  // Real content photos from the page body (the original site's own imagery) —
  // used to fill the photo pool when the business has no Google Places listing.
  signal.images = extractContentImages(html, url);

  return signal;
}

/**
 * Pull likely *content* images (real photos) from page HTML, skipping logos,
 * icons, sprites, emoji, screenshots and tiny thumbnails. Returns absolute URLs,
 * best-first (real-photo formats and larger dimension hints rank higher).
 * @param {string} html
 * @param {string} baseUrl
 * @returns {string[]}
 */
function extractContentImages(html, baseUrl) {
  const JUNK = /(logo|icon|favicon|sprite|smiley|emoji|removebg|avatar|placeholder|loading|spinner|badge|button|screenshot|whatsapp|pixel|1x1|blank|banner)/i;
  const raw = new Set();
  const re = /<img\b[^>]*?>/gi;
  let tag;
  while ((tag = re.exec(html)) && raw.size < 40) {
    const t = tag[0];
    let src = (t.match(/\b(?:data-src|src)=["']([^"']+)["']/i) || [])[1] || '';
    const ss = (t.match(/\bsrcset=["']([^"']+)["']/i) || [])[1];
    if (ss) {
      const cands = ss.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
      if (cands.length) src = cands[cands.length - 1]; // largest in srcset
    }
    if (src) raw.add(src);
  }
  const out = [];
  for (const r of raw) {
    if (/^data:/i.test(r)) continue;
    const abs = absoluteUrl(r, baseUrl);
    if (!abs) continue;
    const clean = abs.split('?')[0];
    if (!/\.(jpe?g|webp|png)$/i.test(clean)) continue;
    if (JUNK.test(clean)) continue;
    const dim = clean.match(/(\d{2,4})x(\d{2,4})\.(?:jpe?g|webp|png)$/i);
    if (dim && Math.max(+dim[1], +dim[2]) < 400) continue; // skip thumbnails
    out.push(clean);
  }
  const uniq = [...new Set(out)];
  const score = (u) => {
    let s = /\.(jpe?g|webp)$/i.test(u) ? 1000 : 0; // real photos are usually jpg/webp
    const d = u.match(/(\d{2,4})x(\d{2,4})/);
    if (d) s += Math.min(2000, Math.max(+d[1], +d[2]));
    return s;
  };
  uniq.sort((a, b) => score(b) - score(a));
  return uniq.slice(0, 8);
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

  // Identity is scrape-first: only a verified Places match overrides the real
  // business name recovered from the original site (see google-places.js).
  const name = places.name || pickBusinessName(scrapeSignal) || 'Your Business';

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
    photos: Array.isArray(places.photos) ? places.photos : [],
    // Real content images scraped from the original site (used when there are no
    // Places photos — e.g. a business with no Google listing).
    scrape_images: Array.isArray(scrapeSignal.images) ? scrapeSignal.images : [],
    // Original-site identity (recovered from the static <head>).
    logo: scrapeSignal.logo || '',
    brand_color: scrapeSignal.brandColor || '',
    domain: scrapeSignal.domain || '',
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
 * The optional recipe grounds copy in the vertical (tone + real service hints).
 * @param {object} profile - Canonical profile
 * @param {object} [recipe] - Industry recipe (getRecipe) for tone/service hints
 * @returns {object} Generation context
 */
export function profileToContext(profile, recipe = {}, industry = '') {
  return {
    business_name: profile.name,
    business_type: profile.category || industry || 'business',
    industry: profile.category || industry || 'general',
    audience: 'customers',
    tone: recipe.tone || 'professional',
    style: 'modern',
    content_source: 'google_places',
    // Extra facts the prompts can weave in (description, location, reviews).
    description: profile.description,
    location: profile.address,
    // Vertical grounding for AI copy (Phase 3).
    service_hints: recipe.serviceHints || '',
    // The REAL content scraped from the business's existing site (headings +
    // body sample). This is what makes refactor copy specific instead of
    // generic — the AI grounds hero/about/services in what they actually do.
    source_material: buildSourceMaterial(profile),
    selected_sections: [],
  };
}

/**
 * Assemble a compact "source material" brief from the scraped original site so
 * the content prompts can ground copy in the real business. Empty when we have
 * nothing useful (the prompts then fall back to industry hints).
 * @param {object} profile - Canonical profile (carries source.* hints)
 * @returns {string}
 */
function buildSourceMaterial(profile) {
  const src = (profile && profile.source) || {};
  const parts = [];
  if (profile && profile.description) parts.push(`Tagline/summary: ${profile.description}`);
  const headings = Array.isArray(src.scrape_headings) ? src.scrape_headings.filter(Boolean) : [];
  if (headings.length) parts.push(`Headings from their current site: ${headings.slice(0, 8).join(' | ')}`);
  const sample = (src.scrape_sample || '').trim();
  if (sample) parts.push(`Body text from their current site: ${sample.slice(0, 800)}`);
  return parts.join('\n');
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

  const socialLinks = Array.isArray(profile.social) ? profile.social.filter((s) => s && s.url) : [];

  if (profile.phone || profile.address || profile.website || profile.email || socialLinks.length) {
    sections.contact = {
      heading: 'Get In Touch',
      phone: profile.phone || '',
      address: profile.address || '',
      email: profile.email || '',
      social_links: socialLinks,
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

/**
 * Overlay a user-confirmed detailed profile onto a company profile so the human
 * edits win over scraped/Places facts (refactor reuse, Phase 7). Returns a new
 * profile; the detailed founder/services/demographics are folded into the
 * source sample so AI copy reflects them.
 * @param {object} profile - canonical company profile (from buildProfile)
 * @param {object|string} detailedRaw - detailed profile (object or JSON string)
 * @returns {object} overridden profile
 */
export function applyDetailedOverride(profile, detailedRaw) {
  const d = coerceDetailedProfile(typeof detailedRaw === 'string' ? safeParse(detailedRaw) : detailedRaw);
  const out = { ...(profile || {}) };

  if (d.business_name) out.name = d.business_name;
  if (d.history) out.description = d.history;
  if (d.contact.phone) out.phone = d.contact.phone;
  if (d.contact.address) out.address = d.contact.address;
  if (d.contact.email) out.email = d.contact.email;
  if (d.logo_url) out.logo = d.logo_url;

  const social = SOCIAL_PLATFORMS.filter((k) => d.social[k]).map((k) => ({ platform: k, url: d.social[k] }));
  if (social.length) out.social = social;

  const extra = [
    d.founder && `About the founder: ${d.founder}`,
    d.services && `Services/products: ${d.services}`,
    d.demographics && `Target customers: ${d.demographics}`,
  ]
    .filter(Boolean)
    .join('\n');
  if (extra) {
    const prevSample = (out.source && out.source.scrape_sample) || '';
    out.source = { ...(out.source || {}), scrape_sample: `${prevSample}\n${extra}`.trim() };
  }

  if (Array.isArray(d.picture_urls) && d.picture_urls.length) out.user_pictures = d.picture_urls;

  return out;
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
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

/**
 * Extract a <link rel="..."> href value (e.g. apple-touch-icon, icon).
 * @param {string} html
 * @param {string} rel
 * @returns {string}
 */
function linkHref(html, rel) {
  const esc = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRe = new RegExp(`<link[^>]*\\brel=["'][^"']*${esc}[^"']*["'][^>]*>`, 'i');
  const tag = html.match(tagRe);
  if (!tag) return '';
  const href = tag[0].match(/\bhref=["']([^"']*)["']/i);
  return href ? href[1].trim() : '';
}

/**
 * Resolve a possibly-relative URL against a base page URL.
 * @param {string} maybeUrl
 * @param {string} base
 * @returns {string}
 */
function absoluteUrl(maybeUrl, base) {
  if (!maybeUrl) return '';
  try {
    return new URL(maybeUrl, base).href;
  } catch {
    return maybeUrl.startsWith('http') ? maybeUrl : '';
  }
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

/**
 * Pick the most likely business NAME from scrape signals (no Places match).
 * Order: og:site_name → the <title> segment that matches the domain (the brand
 * is usually the domain) → the shortest title segment (names are short,
 * taglines long) → the domain. Avoids using a descriptive title as the name.
 * @param {object} s - scrapeSignal
 * @returns {string}
 */
function pickBusinessName(s = {}) {
  if (s.siteName && s.siteName.trim()) return s.siteName.trim();

  const segs = (s.title || '')
    .split(/\s[|\-–—:•]\s/)
    .map((x) => x.trim())
    .filter(Boolean);

  const domainCore = (s.domain || '').split('.')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (domainCore && segs.length) {
    const hit = segs.find((seg) => seg.replace(/[^a-z0-9]/gi, '').toLowerCase().includes(domainCore));
    if (hit) return hit;
  }
  if (segs.length) return segs.slice().sort((a, b) => a.length - b.length)[0];
  return cleanTitle(s.title) || s.domain || '';
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
