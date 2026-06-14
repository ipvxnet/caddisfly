/**
 * Industry recipes — the "template repository" backbone.
 *
 * After inferIndustry() identifies a vertical, getRecipe() returns an intentional
 * composition for it: section line-up, per-section template variants, font
 * pairing, copy tone, and real service hints. Both generation flows
 * (ai-builder/generate.js and template-generation.js) consume this so the output
 * is vertical-appropriate instead of a generic recolored brochure.
 *
 * Keys match the industry keys emitted by industry-style.js inferIndustry().
 * industry-style.js stays the home for palette + image keywords (visual/asset
 * concerns); this module owns structure + variants + fonts + tone + copy hints.
 *
 * Only section types both flows can generate content for are used here:
 * header, hero, about, services, features, gallery, testimonials, contact, footer.
 */

// Standard section order; recipes override/reorder as needed.
const BASE_SECTIONS = ['header', 'hero', 'about', 'services', 'gallery', 'testimonials', 'contact', 'footer'];

// Default (image-forward) variant per section; recipe.variants overrides these.
// Single home for variant selection (consumed by both generation flows).
const DEFAULT_VARIANTS = {
  header: 'navbar',
  hero: 'split',
  about: 'text-image',
  services: 'icon-grid',
  gallery: 'masonry',
  testimonials: 'cards',
  contact: 'form',
  footer: 'multi-column',
  features: 'grid',
  pricing: 'tables',
  stats: 'numbers',
  cta: 'banner',
};

const GENERAL = {
  sections: BASE_SECTIONS,
  variants: {}, // section -> variant overrides (image-forward etc.)
  fonts: { heading: 'Inter', body: 'Inter' },
  tone: 'professional and approachable',
  serviceHints: '',
};

const RECIPES = {
  food: {
    sections: ['header', 'hero', 'about', 'services', 'gallery', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'fullscreen', services: 'cards', gallery: 'masonry' },
    fonts: { heading: 'Playfair Display', body: 'Lato' },
    tone: 'warm, inviting, appetite-whetting',
    serviceHints: 'Dine-in, Takeout, Catering, Online ordering, Private events, Daily specials',
  },
  fitness: {
    sections: ['header', 'hero', 'services', 'features', 'gallery', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'fullscreen', gallery: 'masonry', services: 'cards' },
    fonts: { heading: 'Oswald', body: 'Roboto' },
    tone: 'energetic, motivating, bold',
    serviceHints: 'Personal training, Group classes, Strength training, Nutrition coaching, Memberships',
  },
  barbershop: {
    sections: ['header', 'hero', 'services', 'gallery', 'about', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'fullscreen', gallery: 'masonry', services: 'cards' },
    fonts: { heading: 'Oswald', body: 'Roboto' },
    tone: 'classic, masculine, sharp, welcoming',
    serviceHints: 'Haircuts, Fades, Beard trims, Hot towel shaves, Line-ups, Kids cuts, Hair styling, Shampoo',
  },
  beauty: {
    sections: ['header', 'hero', 'services', 'gallery', 'about', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'fullscreen', gallery: 'masonry', services: 'cards' },
    fonts: { heading: 'Cormorant Garamond', body: 'Montserrat' },
    tone: 'elegant, calming, premium',
    serviceHints: 'Haircuts, Color, Styling, Manicure, Pedicure, Facials, Waxing, Makeup',
  },
  health: {
    sections: ['header', 'hero', 'about', 'services', 'features', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'split', services: 'cards' },
    fonts: { heading: 'Poppins', body: 'Open Sans' },
    tone: 'reassuring, trustworthy, caring',
    serviceHints: 'Consultations, Preventive care, Treatments, Diagnostics, Follow-up care',
  },
  legal: {
    sections: ['header', 'hero', 'about', 'services', 'features', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'split', services: 'cards' },
    fonts: { heading: 'Merriweather', body: 'Source Sans Pro' },
    tone: 'authoritative, precise, trustworthy',
    serviceHints: 'Consultations, Case evaluation, Representation, Document review, Negotiation',
  },
  realestate: {
    sections: ['header', 'hero', 'services', 'gallery', 'about', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'fullscreen', gallery: 'masonry' },
    fonts: { heading: 'Montserrat', body: 'Lato' },
    tone: 'aspirational, polished, local-expert',
    serviceHints: 'Buying, Selling, Property valuation, Market analysis, Staging, Negotiation',
  },
  retail: {
    sections: ['header', 'hero', 'gallery', 'services', 'about', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'fullscreen', gallery: 'masonry', services: 'cards' },
    fonts: { heading: 'Poppins', body: 'Inter' },
    tone: 'fresh, on-trend, friendly',
    serviceHints: 'In-store shopping, Online orders, Personal styling, Gift cards, Easy returns',
  },
  creative: {
    sections: ['header', 'hero', 'gallery', 'services', 'about', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'fullscreen', gallery: 'masonry', services: 'cards' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    tone: 'bold, modern, distinctive',
    serviceHints: 'Branding, Web design, Photography, Content creation, Strategy',
  },
  automotive: {
    sections: ['header', 'hero', 'services', 'features', 'about', 'gallery', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'fullscreen', services: 'cards', gallery: 'masonry' },
    fonts: { heading: 'Rajdhani', body: 'Roboto' },
    tone: 'trustworthy, no-nonsense, local',
    serviceHints: 'Tire installation, Oil change, Brake service, Wheel alignment, Battery replacement, State inspection',
  },
  home: {
    sections: ['header', 'hero', 'services', 'features', 'about', 'gallery', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'split', services: 'cards' },
    fonts: { heading: 'Poppins', body: 'Open Sans' },
    tone: 'reliable, friendly, get-it-done',
    serviceHints: 'Installation, Repairs, Maintenance, Emergency service, Free estimates, Inspections',
  },
  tech: {
    sections: ['header', 'hero', 'features', 'services', 'about', 'testimonials', 'contact', 'footer'],
    variants: { hero: 'split' },
    fonts: { heading: 'Inter', body: 'Inter' },
    tone: 'clear, confident, modern',
    serviceHints: 'Product features, Integrations, Onboarding, Support, Security',
  },
};

/**
 * Get the recipe for an industry, merged over the general fallback so every
 * field is populated.
 * @param {string} industry - Key from inferIndustry()
 * @returns {{sections: string[], variants: object, fonts: {heading: string, body: string}, tone: string, serviceHints: string}}
 */
export function getRecipe(industry) {
  const recipe = RECIPES[industry] || {};
  return {
    sections: recipe.sections || GENERAL.sections,
    // Complete variant map: image-forward defaults + this vertical's overrides.
    variants: { ...DEFAULT_VARIANTS, ...GENERAL.variants, ...(recipe.variants || {}) },
    fonts: recipe.fonts || GENERAL.fonts,
    tone: recipe.tone || GENERAL.tone,
    serviceHints: recipe.serviceHints || GENERAL.serviceHints,
  };
}

/**
 * Resolve the template variant for a section from a recipe.
 * @param {object} recipe - From getRecipe()
 * @param {string} sectionType
 * @returns {string}
 */
export function recipeVariant(recipe, sectionType) {
  return (recipe.variants && recipe.variants[sectionType]) || DEFAULT_VARIANTS[sectionType] || 'default';
}
