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
  // Barbershop before beauty so "barber" gets a masculine look, not a salon one.
  ['barbershop', ['barbershop', 'barber shop', 'barber', 'barbers', 'fade', 'mens grooming', "men's grooming"]],
  ['beauty', ['salon', 'spa', 'beauty', 'hair', 'nails', 'skincare', 'cosmetic', 'massage']],
  // Dental before health so a dentist gets the bright clinical look, not generic medical.
  ['dental', ['dental', 'dentist', 'dentistry', 'orthodontist', 'orthodontics', 'teeth', 'smile makeover']],
  ['health', ['clinic', 'medical', 'doctor', 'health', 'therapy', 'chiropractic', 'veterinary', 'pharmacy']],
  // Finance before legal so an accountant gets a finance look, not a law-firm one.
  ['finance', ['finance', 'financial', 'accounting', 'accountant', 'bookkeeping', 'tax', 'taxes', 'wealth', 'investment', 'cpa']],
  ['legal', ['law', 'lawyer', 'attorney', 'legal', 'firm', 'insurance', 'consulting']],
  ['realestate', ['real estate', 'realtor', 'property', 'realty', 'mortgage', 'broker']],
  // Construction before home so a contractor gets the industrial look; home keeps
  // the lighter recurring-services trades (plumbing/electric/hvac/cleaning).
  ['construction', ['construction', 'contractor', 'builder', 'remodel', 'remodeling', 'renovation', 'roofing', 'masonry', 'framing', 'concrete']],
  ['home', ['plumbing', 'plumber', 'electric', 'electrician', 'hvac', 'landscaping', 'lawn care', 'cleaning', 'pest control']],
  ['automotive', ['auto', 'car', 'mechanic', 'automotive', 'repair', 'tire', 'dealership']],
  ['pet', ['pet', 'pets', 'dog', 'dogs', 'cat', 'cats', 'puppy', 'kennel', 'pet grooming', 'pet store', 'doggy daycare', 'animal shelter']],
  ['travel', ['travel', 'tour', 'tours', 'tourism', 'hotel', 'resort', 'vacation', 'hostel', 'getaway', 'itinerary', 'destination', 'safari']],
  ['events', ['wedding', 'weddings', 'event planning', 'event planner', 'events', 'party', 'parties', 'celebration', 'banquet', 'venue', 'quinceanera']],
  ['education', ['school', 'academy', 'tutoring', 'tutor', 'tutors', 'courses', 'education', 'e-learning', 'learning center', 'preschool', 'kindergarten', 'university', 'college']],
  ['nonprofit', ['nonprofit', 'non-profit', 'charity', 'charitable', 'foundation', 'ngo', 'donate', 'donation', 'volunteer', 'mission-driven']],
  // Photography before creative so a photographer gets the dark gallery look.
  ['photography', ['photography', 'photographer', 'photo studio', 'portrait', 'headshot', 'headshots', 'videography']],
  ['creative', ['design', 'studio', 'agency', 'art', 'creative', 'media', 'marketing', 'branding']],
  // Note: bare 'shop'/'store' are intentionally excluded — too generic (they
  // would mis-match "Tire Shop", "Coffee Shop", "Barber Shop", etc.).
  ['retail', ['boutique', 'retail', 'clothing', 'fashion', 'jewelry', 'furniture', 'apparel']],
  ['tech', ['software', 'tech', 'app', 'saas', 'startup', 'digital', 'ai', 'data', 'cloud', 'platform']],
];

// Palette per industry: { primary, secondary, accent }
const PALETTES = {
  food: { primary: '#c0392b', secondary: '#e67e22', accent: '#27ae60' }, // warm red/orange + green
  fitness: { primary: '#e74c3c', secondary: '#2c3e50', accent: '#f39c12' },
  // Classic barbershop: near-black + warm brass, deep barber-red accent.
  barbershop: { primary: '#1c1c1e', secondary: '#b08d57', accent: '#9b2226' },
  beauty: { primary: '#c98ca0', secondary: '#7d5a6b', accent: '#e8c1a0' },
  dental: { primary: '#0aa1dd', secondary: '#16a085', accent: '#4dd0e1' }, // bright clinical cyan/teal
  health: { primary: '#16a085', secondary: '#2980b9', accent: '#1abc9c' },
  finance: { primary: '#1e5631', secondary: '#243b53', accent: '#c9a227' }, // deep green + navy + gold
  legal: { primary: '#1a2980', secondary: '#26334d', accent: '#c9a227' }, // navy + gold
  realestate: { primary: '#2c3e50', secondary: '#16a085', accent: '#e1b12c' },
  construction: { primary: '#d35400', secondary: '#2c3e50', accent: '#f39c12' }, // safety amber + charcoal
  home: { primary: '#2980b9', secondary: '#27ae60', accent: '#f39c12' },
  automotive: { primary: '#2c3e50', secondary: '#c0392b', accent: '#95a5a6' },
  pet: { primary: '#16a596', secondary: '#ff8c42', accent: '#ffd166' }, // playful teal + orange
  travel: { primary: '#0277bd', secondary: '#ff7043', accent: '#ffca28' }, // ocean blue + sunset
  events: { primary: '#9b3b6a', secondary: '#5d3a5e', accent: '#d4af37' }, // plum + gold
  education: { primary: '#2962ff', secondary: '#1a237e', accent: '#ffb300' }, // friendly blue + amber
  nonprofit: { primary: '#2e7d32', secondary: '#00897b', accent: '#fbc02d' }, // hopeful green/teal
  photography: { primary: '#1a1a1a', secondary: '#4a4a4a', accent: '#e0a96d' }, // mono + warm gold
  creative: { primary: '#8e44ad', secondary: '#e74c3c', accent: '#f1c40f' },
  retail: { primary: '#e84393', secondary: '#2d3436', accent: '#fdcb6e' },
  tech: { primary: '#667eea', secondary: '#764ba2', accent: '#00cec9' },
  general: { primary: '#667eea', secondary: '#764ba2', accent: '#f093fb' },
};

// (Template-variant selection moved to industry-recipe.js — single home.)

// Base stock-photo keywords per industry (appended to business hints).
const IMAGE_KEYWORDS = {
  food: 'restaurant food dish plating',
  fitness: 'gym fitness workout',
  barbershop: 'barbershop barber haircut beard grooming',
  beauty: 'salon spa beauty',
  dental: 'dentist dental clinic smile',
  health: 'medical clinic healthcare',
  finance: 'finance accounting office professional',
  legal: 'office professional business',
  realestate: 'modern house real estate interior',
  construction: 'construction site builder tools',
  home: 'home service maintenance',
  automotive: 'car automotive garage',
  pet: 'happy pet dog cat grooming',
  travel: 'travel destination landscape adventure',
  events: 'wedding event celebration venue',
  education: 'classroom students learning campus',
  nonprofit: 'community volunteers helping people',
  photography: 'photographer camera portrait studio',
  creative: 'creative studio design workspace',
  retail: 'boutique store shopping',
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
