// Template Registry
// Maps section types to their template functions

import { heroCenteredTemplate } from './heroes/centered.js';
import { heroSplitTemplate } from './heroes/split.js';
import { aboutTextImageTemplate } from './about/text-image.js';
import { servicesIconGridTemplate } from './services/icon-grid.js';
import { testimonialsCardsTemplate } from './testimonials/cards.js';
import { contactFormTemplate } from './contact/form.js';
import { footerMultiColumnTemplate } from './footer/multi-column.js';
import { galleryMasonryTemplate } from './gallery/masonry.js';

/**
 * Template registry
 * Maps section types to their available template variants
 */
export const TEMPLATE_REGISTRY = {
  hero: {
    centered: heroCenteredTemplate,
    split: heroSplitTemplate,
    default: heroCenteredTemplate,
  },
  about: {
    'text-image': aboutTextImageTemplate,
    default: aboutTextImageTemplate,
  },
  services: {
    'icon-grid': servicesIconGridTemplate,
    default: servicesIconGridTemplate,
  },
  testimonials: {
    cards: testimonialsCardsTemplate,
    default: testimonialsCardsTemplate,
  },
  contact: {
    form: contactFormTemplate,
    default: contactFormTemplate,
  },
  footer: {
    'multi-column': footerMultiColumnTemplate,
    default: footerMultiColumnTemplate,
  },
  gallery: {
    masonry: galleryMasonryTemplate,
    default: galleryMasonryTemplate,
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
    return template(data, config);
  } catch (error) {
    console.error(`Error rendering template ${sectionType}:${variant}:`, error);
    return `<!-- Error rendering ${sectionType}:${variant} -->`;
  }
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
