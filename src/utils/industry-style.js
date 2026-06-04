/**
 * Industry-aware styling: map a business's industry/category to an appropriate
 * color palette, image-forward template variants, and stock-photo keywords.
 *
 * This is why a restaurant should look warm and food-forward instead of a
 * generic blue SaaS layout. Used by both the AI-generate and refactoring flows.
 */

// Keyword groups → normalized industry key. First match wins.
const INDUSTRY_KEYWORDS = [
  ['food', ['restaurant', 'food', 'cafe', 'coffee', 'bakery', 'burrito', 'taco', 'pizza', 'sushi', 'grill', 'diner', 'bar', 'bistro', 'catering', 'kitchen', 'eatery', 'brewery', 'mexican', 'italian', 'cuisine']],
  ['fitness', ['gym', 'fitness', 'yoga', 'crossfit', 'pilates', 'training', 'workout', 'wellness studio']],
  ['beauty', ['salon', 'spa', 'beauty', 'hair', 'nails', 'barber', 'skincare', 'cosmetic', 'massage']],
  ['health', ['clinic', 'dental', 'dentist', 'medical', 'doctor', 'health', 'therapy', 'chiropractic', 'veterinary', 'pharmacy']],
  ['legal', ['law', 'lawyer', 'attorney', 'legal', 'firm', 'accounting', 'accountant', 'finance', 'insurance', 'consulting']],
  ['realestate', ['real estate', 'realtor', 'property', 'realty', 'mortgage', 'broker']],
  // Note: bare 'shop'/'store' are intentionally excluded — too generic (they
  // would mis-match "Tire Shop", "Coffee Shop", "Barber Shop", etc.).
  ['retail', ['boutique', 'retail', 'clothing', 'fashion', 'jewelry', 'furniture', 'apparel']],
  ['creative', ['design', 'studio', 'agency', 'photography', 'art', 'creative', 'media', 'marketing', 'branding']],
  ['automotive', ['auto', 'car', 'mechanic', 'automotive', 'repair', 'tire', 'dealership']],
  ['home', ['plumbing', 'plumber', 'electric', 'hvac', 'roofing', 'construction', 'contractor', 'landscaping', 'cleaning', 'remodeling']],
  ['tech', ['software', 'tech', 'app', 'saas', 'startup', 'digital', 'ai', 'data', 'cloud', 'platform']],
];

// Palette per industry: { primary, secondary, accent }
const PALETTES = {
  food: { primary: '#c0392b', secondary: '#e67e22', accent: '#27ae60' }, // warm red/orange + green
  fitness: { primary: '#e74c3c', secondary: '#2c3e50', accent: '#f39c12' },
  beauty: { primary: '#c98ca0', secondary: '#7d5a6b', accent: '#e8c1a0' },
  health: { primary: '#16a085', secondary: '#2980b9', accent: '#1abc9c' },
  legal: { primary: '#1a2980', secondary: '#26334d', accent: '#c9a227' }, // navy + gold
  realestate: { primary: '#2c3e50', secondary: '#16a085', accent: '#e1b12c' },
  retail: { primary: '#e84393', secondary: '#2d3436', accent: '#fdcb6e' },
  creative: { primary: '#8e44ad', secondary: '#e74c3c', accent: '#f1c40f' },
  automotive: { primary: '#2c3e50', secondary: '#c0392b', accent: '#95a5a6' },
  home: { primary: '#2980b9', secondary: '#27ae60', accent: '#f39c12' },
  tech: { primary: '#667eea', secondary: '#764ba2', accent: '#00cec9' },
  general: { primary: '#667eea', secondary: '#764ba2', accent: '#f093fb' },
};

// (Template-variant selection moved to industry-recipe.js — single home.)

// Base stock-photo keywords per industry (appended to business hints).
const IMAGE_KEYWORDS = {
  food: 'restaurant food dish plating',
  fitness: 'gym fitness workout',
  beauty: 'salon spa beauty',
  health: 'medical clinic healthcare',
  legal: 'office professional business',
  realestate: 'modern house real estate interior',
  retail: 'boutique store shopping',
  creative: 'creative studio design workspace',
  automotive: 'car automotive garage',
  home: 'home renovation service',
  tech: 'technology office workspace',
  general: 'modern business',
};

/**
 * Infer a normalized industry key from any free text (category, business type,
 * name, or prompt). Returns 'general' if nothing matches.
 * @param {...string} texts - One or more strings to scan
 * @returns {string} industry key
 */
export function inferIndustry(...texts) {
  const haystack = texts.filter(Boolean).join(' ').toLowerCase();

  // Score each industry by total matched keyword length so more-specific signals
  // win (e.g. "Tire Shop" → automotive via 'tire', not retail). First-listed
  // industry wins ties (strictly-greater comparison preserves order).
  let best = 'general';
  let bestScore = 0;
  for (const [industry, keywords] of INDUSTRY_KEYWORDS) {
    let score = 0;
    for (const k of keywords) {
      if (haystack.includes(k)) score += k.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = industry;
    }
  }
  return best;
}

/**
 * Color palette for an industry.
 * @param {string} industry
 * @returns {{primary: string, secondary: string, accent: string}}
 */
export function paletteFor(industry) {
  return PALETTES[industry] || PALETTES.general;
}

/**
 * Stock-photo search query for an industry, optionally enriched with business
 * hints (name/category words) for more relevant imagery.
 * @param {string} industry
 * @param {string} [extra] - Extra hint terms (e.g. "Mexican", business name)
 * @returns {string}
 */
export function imageKeywordsFor(industry, extra = '') {
  const base = IMAGE_KEYWORDS[industry] || IMAGE_KEYWORDS.general;
  const hint = (extra || '').trim();
  // Lead with the specific hint when present (e.g. "Mexican restaurant food...").
  return hint ? `${hint} ${base}` : base;
}
