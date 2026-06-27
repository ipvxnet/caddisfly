/**
 * Industry-aware styling: map a business's industry/category to an appropriate
 * color palette, image-forward template variants, and stock-photo keywords.
 *
 * This is why a restaurant should look warm and food-forward instead of a
 * generic blue SaaS layout. Used by both the AI-generate and refactoring flows.
 */

// Keyword groups → normalized industry key. First match wins.
const INDUSTRY_KEYWORDS = [
  // Café/bakery before food so a coffee shop gets a cozy look, not a restaurant one.
  ['cafe', ['coffee shop', 'coffee house', 'coffeehouse', 'coffee', 'cafe', 'café', 'espresso', 'roastery', 'coffee roaster', 'latte']],
  ['bakery', ['bakery', 'bakeshop', 'pastry', 'patisserie', 'baked goods', 'cupcake', 'donut']],
  // Winery before food so a vineyard gets an elegant estate look, not a bar/grill one.
  ['winery', ['winery', 'vineyard', 'wine tasting', 'tasting room', 'wine cellar', 'wines', 'wine estate']],
  // Brewery before food so a craft brewery/taproom gets its own craft look
  // (the generic 'bar' keyword stays on food for sports bars/grills).
  ['brewery', ['brewery', 'brewpub', 'craft brewery', 'craft beer', 'taproom', 'tap room', 'microbrewery', 'beer garden', 'brewing company', 'brewing co']],
  ['food', ['restaurant', 'food', 'burrito', 'taco', 'pizza', 'sushi', 'grill', 'diner', 'bar', 'bistro', 'catering', 'kitchen', 'eatery', 'mexican', 'italian', 'cuisine', 'steakhouse']],
  ['fitness', ['gym', 'fitness', 'yoga', 'crossfit', 'pilates', 'training', 'workout', 'wellness studio']],
  // Barbershop before beauty so "barber" gets a masculine look, not a salon one.
  ['barbershop', ['barbershop', 'barber shop', 'barber', 'barbers', 'fade', 'mens grooming', "men's grooming"]],
  // Med spa before spa/beauty/health so aesthetics gets the luxe-clinical look.
  ['medspa', ['med spa', 'medical spa', 'medspa', 'aesthetics', 'aesthetic clinic', 'botox', 'dermal filler', 'injectables', 'laser hair', 'skin clinic']],
  // Spa before beauty so a spa gets a tranquil look, not a hair-salon one.
  ['spa', ['spa', 'massage', 'day spa', 'sauna', 'wellness retreat', 'reiki']],
  ['beauty', ['salon', 'beauty', 'hair', 'nails', 'skincare', 'cosmetic', 'lashes', 'waxing']],
  ['tattoo', ['tattoo', 'tattoos', 'tattoo studio', 'piercing', 'body art', 'ink studio']],
  // Dental before health so a dentist gets the bright clinical look, not generic medical.
  ['dental', ['dental', 'dentist', 'dentistry', 'orthodontist', 'orthodontics', 'teeth', 'smile makeover']],
  // Veterinary before health so an animal hospital gets a pet-friendly look.
  ['veterinary', ['veterinary', 'veterinarian', 'vet clinic', 'animal hospital', 'animal clinic']],
  // Men's health before health so a men's clinic gets the premium masculine look.
  ['menshealth', ["men's health", 'mens health', "men's clinic", 'mens clinic', 'testosterone', 'trt', 'hormone therapy', 'peptides', 'low testosterone']],
  // Therapy/counseling before health so a therapist/mental-health practice gets
  // the calm, personal look instead of the clinical one (bare 'therapy' lives
  // here now — removed from health below).
  ['therapy', ['therapy', 'therapist', 'counseling', 'counselling', 'counselor', 'counsellor', 'mental health', 'psychotherapy', 'psychotherapist', 'psychologist', 'psychology', 'psychiatrist', 'marriage counseling', 'family therapy']],
  ['health', ['clinic', 'medical', 'doctor', 'health', 'chiropractic', 'pharmacy']],
  // Finance before legal so an accountant gets a finance look, not a law-firm one.
  ['finance', ['finance', 'financial', 'accounting', 'accountant', 'bookkeeping', 'tax', 'taxes', 'wealth', 'investment', 'cpa']],
  ['legal', ['law', 'lawyer', 'attorney', 'legal', 'firm', 'insurance', 'consulting']],
  ['realestate', ['real estate', 'realtor', 'property', 'realty', 'mortgage', 'broker']],
  // Roofing & HVAC before construction/home so an exterior/climate trade gets the
  // quote-first, badge-forward look. Pulls 'roofing' off construction and 'hvac'
  // off home (removed there) so those keep their own buckets.
  ['roofing', ['roofing contractor', 'roofing company', 'roofing', 'roofer', 'roofers', 'roof repair', 'roof replacement', 're-roof', 'reroof', 'shingle', 'shingles', 'metal roof', 'gutter', 'gutters', 'siding', 'hvac', 'heating and cooling', 'heating & cooling', 'air conditioning', 'ac repair', 'furnace', 'heat pump']],
  // Construction before home so a contractor gets the industrial look; home keeps
  // the lighter recurring-services trades (plumbing/electric/cleaning).
  ['construction', ['construction', 'contractor', 'builder', 'remodel', 'remodeling', 'renovation', 'masonry', 'framing', 'concrete']],
  // Landscaping before home so lawn/garden work gets the verdant photo-forward look.
  ['landscaping', ['landscaping', 'lawn care', 'landscape', 'lawn mowing', 'hardscaping', 'irrigation', 'tree service', 'garden design']],
  ['home', ['plumbing', 'plumber', 'electric', 'electrician', 'cleaning', 'pest control']],
  ['automotive', ['auto', 'car', 'mechanic', 'automotive', 'repair', 'tire', 'dealership']],
  ['pet', ['pet', 'pets', 'dog', 'dogs', 'cat', 'cats', 'puppy', 'kennel', 'pet grooming', 'pet store', 'doggy daycare', 'animal shelter']],
  ['travel', ['travel', 'tour', 'tours', 'tourism', 'hotel', 'resort', 'vacation', 'hostel', 'getaway', 'itinerary', 'destination', 'safari']],
  // Wedding (venue/planning) before events so it gets the romantic, photo-forward
  // look; generic corporate/party events keep the 'events' template.
  ['wedding', ['wedding venue', 'wedding planner', 'wedding planning', 'wedding', 'bridal', 'reception venue', 'elopement']],
  ['events', ['event planning', 'event planner', 'events', 'party', 'parties', 'celebration', 'banquet', 'venue', 'quinceanera']],
  // Childcare before education so a daycare gets the playful look, not an academic one.
  ['childcare', ['childcare', 'child care', 'daycare', 'day care', 'preschool', 'pre-school', 'nursery', 'montessori', 'early learning', 'kindergarten', 'after school']],
  ['education', ['school', 'academy', 'tutoring', 'tutor', 'tutors', 'courses', 'education', 'e-learning', 'learning center', 'university', 'college']],
  ['nonprofit', ['nonprofit', 'non-profit', 'charity', 'charitable', 'foundation', 'ngo', 'donate', 'donation', 'volunteer', 'mission-driven']],
  ['museum', ['museum', 'exhibit', 'exhibition', 'planetarium', 'science center', 'historical society', 'cultural center', 'heritage', 'aquarium']],
  // Architecture/interior before creative so they don't get caught by 'design'/'studio'.
  ['architecture', ['architecture', 'architect', 'architectural', 'architecture firm', 'architects']],
  ['interior', ['interior design', 'interior designer', 'home staging', 'interior decorator', 'home decor']],
  ['florist', ['florist', 'flowers', 'floral', 'bouquet', 'flower shop', 'flower farm']],
  ['coaching', ['life coach', 'business coach', 'coaching', 'mentorship', 'executive coach', 'career coach']],
  ['church', ['church', 'ministry', 'worship', 'congregation', 'parish', 'gospel', 'faith community']],
  // Photography before creative so a photographer gets the dark gallery look.
  ['photography', ['photography', 'photographer', 'photo studio', 'portrait', 'headshot', 'headshots', 'videography']],
  // Music before creative so a recording studio / band gets the stage look,
  // not the generic 'studio'/'media' creative one.
  ['music', ['recording studio', 'music studio', 'live music', 'music venue', 'record label', 'music producer', 'musician', 'songwriter', 'concert', 'band']],
  ['creative', ['design', 'studio', 'agency', 'art', 'creative', 'media', 'marketing', 'branding']],
  // Jeweler before retail so fine jewelry gets a luxe look, not a generic boutique one.
  ['jeweler', ['jeweler', 'jewelry', 'jewellery', 'fine jewelry', 'diamonds', 'engagement rings', 'watchmaker']],
  // Note: bare 'shop'/'store' are intentionally excluded — too generic (they
  // would mis-match "Tire Shop", "Coffee Shop", "Barber Shop", etc.).
  ['retail', ['boutique', 'retail', 'clothing', 'fashion', 'furniture', 'apparel', 'thrift']],
  ['dispensary', ['dispensary', 'cannabis', 'cbd', 'marijuana', 'hemp', 'cannabis store']],
  ['tech', ['software', 'tech', 'technology', 'app', 'saas', 'startup', 'digital', 'ai', 'data', 'cloud', 'platform', 'systems', 'communications', 'electronics', 'cybersecurity']],
];

// Palette per industry: { primary, secondary, accent }
const PALETTES = {
  winery: { primary: '#6e2639', secondary: '#3d2b24', accent: '#c9a227' }, // burgundy + earth + gold
  brewery: { primary: '#b5651d', secondary: '#3a2a1a', accent: '#e0a96d' }, // amber + espresso + tan
  wedding: { primary: '#a8746f', secondary: '#6b7d62', accent: '#c9a35c' }, // dusty rose + sage + gold
  music: { primary: '#d6336c', secondary: '#1a1a2e', accent: '#00cec9' }, // magenta + near-black + cyan
  childcare: { primary: '#ff8fab', secondary: '#56c2e6', accent: '#ffcf56' }, // coral + sky + sunny yellow
  landscaping: { primary: '#3a7d3a', secondary: '#1f5130', accent: '#a3d62b' }, // forest + lime green
  cafe: { primary: '#6f4e37', secondary: '#c8a27c', accent: '#e8b04b' }, // espresso brown + cream + honey
  bakery: { primary: '#d8849b', secondary: '#a9744f', accent: '#f6c453' }, // pink + caramel + butter
  food: { primary: '#c0392b', secondary: '#e67e22', accent: '#27ae60' }, // warm red/orange + green
  fitness: { primary: '#e74c3c', secondary: '#2c3e50', accent: '#f39c12' },
  // Classic barbershop: near-black + warm brass, deep barber-red accent.
  barbershop: { primary: '#1c1c1e', secondary: '#b08d57', accent: '#9b2226' },
  medspa: { primary: '#5b6b73', secondary: '#b8a99a', accent: '#c9a96b' }, // soft slate + taupe + gold
  spa: { primary: '#6b8e7f', secondary: '#a8c0b5', accent: '#d9b382' }, // sage + soft green + sand
  beauty: { primary: '#c98ca0', secondary: '#7d5a6b', accent: '#e8c1a0' },
  tattoo: { primary: '#e63946', secondary: '#1a1a1a', accent: '#9b2226' }, // ink red + charcoal
  veterinary: { primary: '#1aa6a0', secondary: '#ff9f43', accent: '#ffd166' }, // friendly teal + orange
  menshealth: { primary: '#b87333', secondary: '#2b2b2e', accent: '#d9a05b' }, // copper + charcoal
  dental: { primary: '#0aa1dd', secondary: '#16a085', accent: '#4dd0e1' }, // bright clinical cyan/teal
  therapy: { primary: '#6b8cae', secondary: '#4a5d70', accent: '#cbb89d' }, // calm dusty blue + slate + warm sand
  health: { primary: '#16a085', secondary: '#2980b9', accent: '#1abc9c' },
  finance: { primary: '#1e5631', secondary: '#243b53', accent: '#c9a227' }, // deep green + navy + gold
  legal: { primary: '#1a2980', secondary: '#26334d', accent: '#c9a227' }, // navy + gold
  realestate: { primary: '#2c3e50', secondary: '#16a085', accent: '#e1b12c' },
  construction: { primary: '#d35400', secondary: '#2c3e50', accent: '#f39c12' }, // safety amber + charcoal
  roofing: { primary: '#1d4e6f', secondary: '#26323a', accent: '#e09f3e' }, // trustworthy steel blue + charcoal + amber
  home: { primary: '#2980b9', secondary: '#27ae60', accent: '#f39c12' },
  automotive: { primary: '#2c3e50', secondary: '#c0392b', accent: '#95a5a6' },
  pet: { primary: '#16a596', secondary: '#ff8c42', accent: '#ffd166' }, // playful teal + orange
  travel: { primary: '#0277bd', secondary: '#ff7043', accent: '#ffca28' }, // ocean blue + sunset
  events: { primary: '#9b3b6a', secondary: '#5d3a5e', accent: '#d4af37' }, // plum + gold
  education: { primary: '#2962ff', secondary: '#1a237e', accent: '#ffb300' }, // friendly blue + amber
  nonprofit: { primary: '#2e7d32', secondary: '#00897b', accent: '#fbc02d' }, // hopeful green/teal
  architecture: { primary: '#2d3436', secondary: '#636e72', accent: '#0984e3' }, // charcoal + steel blue
  interior: { primary: '#8d7b68', secondary: '#a4907c', accent: '#c8b6a6' }, // taupe + warm neutrals
  florist: { primary: '#d6336c', secondary: '#5c8a4a', accent: '#f6a5c0' }, // rose + leaf green + blush
  coaching: { primary: '#6c5ce7', secondary: '#00b894', accent: '#fdcb6e' }, // motivating violet + teal
  church: { primary: '#34495e', secondary: '#7f8c8d', accent: '#c9a227' }, // deep slate + warm gold
  museum: { primary: '#1f3a5f', secondary: '#33415c', accent: '#c9a227' }, // institutional navy + gold
  photography: { primary: '#1a1a1a', secondary: '#4a4a4a', accent: '#e0a96d' }, // mono + warm gold
  creative: { primary: '#8e44ad', secondary: '#e74c3c', accent: '#f1c40f' },
  jeweler: { primary: '#1a1a1a', secondary: '#b8860b', accent: '#d4af37' }, // black + antique gold
  retail: { primary: '#e84393', secondary: '#2d3436', accent: '#fdcb6e' },
  dispensary: { primary: '#2e7d32', secondary: '#1b5e20', accent: '#aed581' }, // cannabis green
  tech: { primary: '#667eea', secondary: '#764ba2', accent: '#00cec9' },
  general: { primary: '#667eea', secondary: '#764ba2', accent: '#f093fb' },
};

// (Template-variant selection moved to industry-recipe.js — single home.)

// Base stock-photo keywords per industry (appended to business hints).
const IMAGE_KEYWORDS = {
  winery: 'vineyard winery wine grapes landscape',
  brewery: 'craft brewery beer taproom barrels',
  wedding: 'wedding venue ceremony reception flowers elegant',
  music: 'live music concert stage band performance',
  childcare: 'happy children daycare preschool play',
  landscaping: 'landscaping lush garden lawn green',
  medspa: 'medical spa aesthetics skincare treatment',
  cafe: 'coffee shop cafe latte barista',
  bakery: 'bakery pastry bread cake',
  food: 'restaurant food dish plating',
  fitness: 'gym fitness workout',
  barbershop: 'barbershop barber haircut beard grooming',
  spa: 'spa massage wellness relaxation',
  beauty: 'salon beauty hair nails',
  tattoo: 'tattoo studio tattoo artist ink',
  veterinary: 'veterinarian pet care animal hospital',
  menshealth: 'fit man fitness strong confident',
  dental: 'dentist dental clinic smile',
  therapy: 'therapy counseling calm peaceful office wellness',
  health: 'medical clinic healthcare',
  finance: 'finance accounting office professional',
  legal: 'office professional business',
  realestate: 'modern house real estate interior',
  construction: 'construction site builder tools',
  roofing: 'roofing contractor roof house exterior home',
  home: 'home service maintenance',
  automotive: 'car automotive garage',
  pet: 'happy pet dog cat grooming',
  travel: 'travel destination landscape adventure',
  events: 'wedding event celebration venue',
  education: 'classroom students learning campus',
  nonprofit: 'community volunteers helping people',
  architecture: 'modern architecture building design',
  interior: 'interior design home decor living room',
  florist: 'florist flowers bouquet floral arrangement',
  coaching: 'business coaching mentorship speaker',
  church: 'church community worship congregation',
  museum: 'museum exhibit gallery hall artifact',
  photography: 'photographer camera portrait studio',
  creative: 'creative studio design workspace',
  jeweler: 'fine jewelry diamond ring luxury',
  retail: 'boutique store shopping',
  dispensary: 'cannabis dispensary plant wellness',
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
  //
  // WHOLE-WORD matching only: a plain substring test made short keywords hijack
  // unrelated copy — 'cat' matched "communi(cat)ion" → a C3-comms firm themed as
  // a pet store; 'ai' matched "T(ai)lored". Word boundaries kill that class. The
  // explicit singular+plural keyword lists ('pet'/'pets', 'tour'/'tours') already
  // assume whole-word matching.
  let best = 'general';
  let bestScore = 0;
  for (const [industry, keywords] of INDUSTRY_KEYWORDS) {
    let score = 0;
    for (const k of keywords) {
      if (matchesWord(haystack, k)) score += k.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = industry;
    }
  }
  return best;
}

/** Whole-word (phrase) match of `keyword` in an already-lowercased haystack.
 *  Boundaries are non-alphanumeric, so 'cat' matches "cat"/"a cat." but NOT
 *  "communication"; multi-word + hyphenated keywords ("pet grooming",
 *  "e-learning") still match as a unit. */
function matchesWord(haystack, keyword) {
  const k = String(keyword).toLowerCase();
  let from = 0;
  for (;;) {
    const i = haystack.indexOf(k, from);
    if (i < 0) return false;
    const before = i === 0 ? '' : haystack[i - 1];
    const after = i + k.length >= haystack.length ? '' : haystack[i + k.length];
    const okBefore = !before || !/[a-z0-9]/.test(before);
    const okAfter = !after || !/[a-z0-9]/.test(after);
    if (okBefore && okAfter) return true;
    from = i + 1;
  }
}

/**
 * Infer an industry while PREFERRING authoritative signals (user-typed business
 * details, a Google Places category) over noisy free text (a scraped page body
 * or a long describe-prompt). The fallback text is consulted only when the
 * authoritative signals alone don't identify a vertical.
 *
 * Why: inferIndustry() sums matched-keyword length across one flat haystack, so
 * a single stray word in low-trust text can outscore the truth — e.g. a diesel
 * shop whose site lists "we speak …, Italian, …" scored `food` (italian=7) over
 * `automotive` (auto=4), and a detailed profile mentioning "training" scored
 * `fitness` over the real auto-repair signal. Scoring the trustworthy text first
 * keeps that noise from hijacking the palette + template.
 *
 * @param {string[]} authoritativeTexts - high-trust signals (category, name, user details)
 * @param {string[]} [fallbackTexts] - low-trust signals (scrape body, raw prompt)
 * @returns {string} industry key
 */
export function inferIndustryPreferring(authoritativeTexts = [], fallbackTexts = []) {
  const primary = inferIndustry(...authoritativeTexts);
  if (primary !== 'general') return primary;
  return inferIndustry(...authoritativeTexts, ...fallbackTexts);
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
