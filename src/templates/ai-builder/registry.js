// Template Registry
// Maps section types to their template functions

// Header / nav
import { navbarTemplate } from './header/navbar.js';

// Hero templates
import { heroCenteredTemplate } from './heroes/centered.js';
import { heroSplitTemplate } from './heroes/split.js';
import { heroMinimalTemplate } from './heroes/minimal.js';
import { heroVideoTemplate } from './heroes/video.js';
import { heroFullscreenTemplate } from './heroes/fullscreen.js';

// About templates
import { aboutTextImageTemplate } from './about/text-image.js';
import { aboutTimelineTemplate } from './about/timeline.js';
import { aboutTeamTemplate } from './about/team.js';

// Service templates
import { servicesIconGridTemplate } from './services/icon-grid.js';
import { servicesCardsTemplate } from './services/cards.js';

// Testimonials templates
import { testimonialsCardsTemplate } from './testimonials/cards.js';
import { testimonialsQuotesTemplate } from './testimonials/quotes.js';

// Gallery templates
import { galleryMasonryTemplate } from './gallery/masonry.js';
import { galleryCarouselTemplate } from './gallery/carousel.js';

// Contact templates
import { contactFormTemplate } from './contact/form.js';

// Footer templates
import { footerMultiColumnTemplate } from './footer/multi-column.js';

// New section types
import { pricingTablesTemplate } from './pricing/tables.js';
import { featuresGridTemplate } from './features/grid.js';
import { ctaBannerTemplate } from './cta/banner.js';
import { statsNumbersTemplate } from './stats/numbers.js';

/**
 * Template registry
 * Maps section types to their available template variants
 */
export const TEMPLATE_REGISTRY = {
  header: {
    navbar: navbarTemplate,
    default: navbarTemplate,
  },
  hero: {
    centered: heroCenteredTemplate,
    split: heroSplitTemplate,
    minimal: heroMinimalTemplate,
    video: heroVideoTemplate,
    fullscreen: heroFullscreenTemplate,
    default: heroCenteredTemplate,
  },
  about: {
    'text-image': aboutTextImageTemplate,
    timeline: aboutTimelineTemplate,
    team: aboutTeamTemplate,
    default: aboutTextImageTemplate,
  },
  services: {
    'icon-grid': servicesIconGridTemplate,
    cards: servicesCardsTemplate,
    default: servicesIconGridTemplate,
  },
  testimonials: {
    cards: testimonialsCardsTemplate,
    quotes: testimonialsQuotesTemplate,
    default: testimonialsCardsTemplate,
  },
  gallery: {
    masonry: galleryMasonryTemplate,
    carousel: galleryCarouselTemplate,
    default: galleryMasonryTemplate,
  },
  contact: {
    form: contactFormTemplate,
    default: contactFormTemplate,
  },
  footer: {
    'multi-column': footerMultiColumnTemplate,
    default: footerMultiColumnTemplate,
  },
  pricing: {
    tables: pricingTablesTemplate,
    default: pricingTablesTemplate,
  },
  features: {
    grid: featuresGridTemplate,
    default: featuresGridTemplate,
  },
  cta: {
    banner: ctaBannerTemplate,
    default: ctaBannerTemplate,
  },
  stats: {
    numbers: statsNumbersTemplate,
    default: statsNumbersTemplate,
  },
};

/**
 * Get template function for a section type and variant
 * @param {string} sectionType - Type of section (hero, about, services, etc.)
 * @param {string} variant - Template variant (centered, split, etc.)
 * @returns {function|null} Template function or null
 */
export function getTemplate(sectionType, variant = 'default') {
  const sectionTemplates = TEMPLATE_REGISTRY[sectionType];

  if (!sectionTemplates) {
    console.error(`Unknown section type: ${sectionType}`);
    return null;
  }

  const template = sectionTemplates[variant] || sectionTemplates.default;

  if (!template) {
    console.error(`No template found for ${sectionType}:${variant}`);
    return null;
  }

  return template;
}

/**
 * Render a section using its template
 * @param {string} sectionType - Type of section
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @param {string} variant - Template variant
 * @returns {string} Rendered HTML
 */
export function renderSection(sectionType, data, config, variant = 'default') {
  const template = getTemplate(sectionType, variant);

  if (!template) {
    return `<!-- Template not found for ${sectionType}:${variant} -->`;
  }

  try {
    return template(data, normalizeConfig(config));
  } catch (error) {
    console.error(`Error rendering template ${sectionType}:${variant}:`, error);
    return `<!-- Error rendering ${sectionType}:${variant} -->`;
  }
}

/**
 * Normalize a website config so templates can read EITHER snake_case
 * (primary_color, font_heading) OR camelCase (primaryColor, fontHeading).
 * Historically some templates used camelCase keys that don't exist on the
 * snake_case config rows, producing "undefined" in rendered CSS. Carrying both
 * casings (with defaults) fixes all of them at one boundary.
 * @param {object} config - Website configuration (snake_case columns)
 * @returns {object} Config with both casings + defaults
 */
function normalizeConfig(config = {}) {
  const primary_color = config.primary_color || config.primaryColor || '#667eea';
  const secondary_color = config.secondary_color || config.secondaryColor || '#764ba2';
  const accent_color = config.accent_color || config.accentColor || '#f093fb';
  const font_heading = config.font_heading || config.fontHeading || 'Inter';
  const font_body = config.font_body || config.fontBody || 'Inter';

  return {
    ...config,
    primary_color,
    secondary_color,
    accent_color,
    font_heading,
    font_body,
    // camelCase aliases for templates that use them
    primaryColor: primary_color,
    secondaryColor: secondary_color,
    accentColor: accent_color,
    fontHeading: font_heading,
    fontBody: font_body,
  };
}

/**
 * Get available variants for a section type
 * @param {string} sectionType - Type of section
 * @returns {array} Array of variant names
 */
export function getAvailableVariants(sectionType) {
  const sectionTemplates = TEMPLATE_REGISTRY[sectionType];

  if (!sectionTemplates) {
    return [];
  }

  return Object.keys(sectionTemplates).filter((key) => key !== 'default');
}

/**
 * Get all available section types
 * @returns {array} Array of section type names
 */
export function getAvailableSectionTypes() {
  return Object.keys(TEMPLATE_REGISTRY);
}

/**
 * Check if a section type exists
 * @param {string} sectionType - Type of section
 * @returns {boolean} Whether the section type exists
 */
export function isSectionTypeValid(sectionType) {
  return sectionType in TEMPLATE_REGISTRY;
}
