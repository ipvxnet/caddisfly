/**
 * Canonical shape for the "detailed" business profile collected on the
 * single-page detailed form (Phase 2), pre-filled by research (Phase 4) and
 * consumed by generation (Phase 3) and refactor reuse (Phase 7).
 *
 * Stored as one JSON blob in ai_projects.detailed_profile_json. Pure functions,
 * no I/O — safe to import anywhere.
 */

export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'x', 'youtube', 'linkedin', 'tiktok'];
const AREA_TYPES = ['city', 'country', 'world'];

/**
 * An empty profile with every field present (so templates/forms never hit
 * `undefined`).
 * @returns {object}
 */
export function emptyDetailedProfile() {
  const social = {};
  for (const p of SOCIAL_PLATFORMS) social[p] = '';
  return {
    business_name: '',
    prefill_from_website: false,
    website_url: '',
    // How the user says to find them on Google when their site can't be read —
    // drives the Places text search (e.g. "Clinica Nouva dentista Florianópolis").
    search_query: '',
    history: '',
    founder: '',
    services: '',
    social,
    demographics: '',
    service_area: { type: 'city', value: '' },
    contact: { email: '', phone: '', address: '' },
    logo_url: '',
    picture_urls: [],
  };
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Normalize an arbitrary object (form payload, parsed JSON, research result)
 * into the canonical profile shape. Unknown keys are dropped; missing keys get
 * empty defaults. Never throws.
 * @param {object} raw
 * @returns {object}
 */
export function coerceDetailedProfile(raw = {}) {
  const base = emptyDetailedProfile();
  if (!raw || typeof raw !== 'object') return base;

  base.business_name = str(raw.business_name);
  base.prefill_from_website = raw.prefill_from_website === true || raw.prefill_from_website === 'true';
  base.website_url = str(raw.website_url);
  base.search_query = str(raw.search_query);
  base.history = str(raw.history);
  base.founder = str(raw.founder);
  base.services = str(raw.services);
  base.demographics = str(raw.demographics);

  const social = raw.social && typeof raw.social === 'object' ? raw.social : {};
  for (const p of SOCIAL_PLATFORMS) base.social[p] = str(social[p]);

  const area = raw.service_area && typeof raw.service_area === 'object' ? raw.service_area : {};
  base.service_area.type = AREA_TYPES.includes(area.type) ? area.type : 'city';
  base.service_area.value = str(area.value);

  const contact = raw.contact && typeof raw.contact === 'object' ? raw.contact : {};
  base.contact.email = str(contact.email);
  base.contact.phone = str(contact.phone);
  base.contact.address = str(contact.address);

  base.logo_url = str(raw.logo_url);
  base.picture_urls = Array.isArray(raw.picture_urls)
    ? raw.picture_urls.map(str).filter(Boolean)
    : [];

  return base;
}

/**
 * Parse the stored JSON blob safely into a canonical profile.
 * @param {string|null} json - ai_projects.detailed_profile_json
 * @returns {object}
 */
export function parseDetailedProfile(json) {
  if (!json) return emptyDetailedProfile();
  try {
    return coerceDetailedProfile(JSON.parse(json));
  } catch {
    return emptyDetailedProfile();
  }
}

/**
 * Map a detailed profile to the partial generation `context` the AI prompts
 * consume (description, location, audience, source_material) plus `facts` —
 * hard data injected verbatim rather than hallucinated.
 * @param {object|string} profile - canonical profile or its JSON string
 * @returns {object} partial context
 */
export function detailedToContext(profile) {
  const p = typeof profile === 'string' ? parseDetailedProfile(profile) : coerceDetailedProfile(profile);
  const ctx = {};

  const parts = [];
  if (p.history) parts.push(`Business history: ${p.history}`);
  if (p.founder) parts.push(`About the founder: ${p.founder}`);
  if (p.services) parts.push(`Services/products offered: ${p.services}`);
  if (p.demographics) parts.push(`Target customers: ${p.demographics}`);
  const source_material = parts.join('\n');

  if (p.history || p.services) ctx.description = (p.history || p.services).slice(0, 300);
  if (p.demographics) ctx.audience = p.demographics;
  if (p.service_area.value) ctx.location = p.service_area.value;
  if (source_material) ctx.source_material = source_material;
  ctx.facts = detailedToFactSections(p);

  return ctx;
}

/**
 * Build hard-fact section overlays from a detailed profile (no AI). The caller
 * merges these over AI-generated content so contact details + social links are
 * real, not invented.
 * @param {object|string} profile
 * @returns {object} { contact?, social? }
 */
export function detailedToFactSections(profile) {
  const p = typeof profile === 'string' ? parseDetailedProfile(profile) : coerceDetailedProfile(profile);
  const sections = {};

  if (p.contact.phone || p.contact.address || p.contact.email) {
    sections.contact = { phone: p.contact.phone, address: p.contact.address, email: p.contact.email };
  }

  const social_links = SOCIAL_PLATFORMS.filter((k) => p.social[k]).map((k) => ({ platform: k, url: p.social[k] }));
  if (social_links.length) sections.social = { social_links };

  return sections;
}

/**
 * Merge a research result into an existing profile, filling BLANKS ONLY — the
 * user's typed values always win (used by the prefill flow, Phase 4).
 * @param {object} current - existing profile (canonical)
 * @param {object} found - research-derived partial (canonical-ish)
 * @returns {object} merged canonical profile
 */
export function mergeFillingBlanks(current, found) {
  const cur = coerceDetailedProfile(current);
  const f = coerceDetailedProfile(found);

  const pickStr = (a, b) => (a ? a : b);
  cur.business_name = pickStr(cur.business_name, f.business_name);
  cur.website_url = pickStr(cur.website_url, f.website_url);
  cur.history = pickStr(cur.history, f.history);
  cur.founder = pickStr(cur.founder, f.founder);
  cur.services = pickStr(cur.services, f.services);
  cur.demographics = pickStr(cur.demographics, f.demographics);

  for (const p of SOCIAL_PLATFORMS) cur.social[p] = pickStr(cur.social[p], f.social[p]);

  if (!cur.service_area.value && f.service_area.value) cur.service_area = { ...f.service_area };
  cur.contact.email = pickStr(cur.contact.email, f.contact.email);
  cur.contact.phone = pickStr(cur.contact.phone, f.contact.phone);
  cur.contact.address = pickStr(cur.contact.address, f.contact.address);

  cur.logo_url = pickStr(cur.logo_url, f.logo_url);
  if (cur.picture_urls.length === 0 && f.picture_urls.length) cur.picture_urls = [...f.picture_urls];

  return cur;
}
