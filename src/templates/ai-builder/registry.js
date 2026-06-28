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
import { heroOverlapTemplate } from './heroes/overlap.js';
import { heroTagsTemplate } from './heroes/tags.js';
import { heroShowcaseTemplate } from './heroes/showcase.js';
import { heroQuoteTemplate } from './heroes/quote.js';

// About templates
import { aboutTextImageTemplate } from './about/text-image.js';
import { aboutTimelineTemplate } from './about/timeline.js';
import { aboutTeamTemplate } from './about/team.js';
import { aboutFounderQuoteTemplate } from './about/founder-quote.js';

// Service templates
import { servicesIconGridTemplate } from './services/icon-grid.js';
import { servicesCardsTemplate } from './services/cards.js';
import { servicesSpotlightTemplate } from './services/spotlight.js';
import { servicesNumberedTemplate } from './services/numbered.js';

// Testimonials templates
import { testimonialsCardsTemplate } from './testimonials/cards.js';
import { testimonialsQuotesTemplate } from './testimonials/quotes.js';
import { testimonialsSpotlightTemplate } from './testimonials/spotlight.js';
import { testimonialsVideoTemplate } from './testimonials/video.js';
import { testimonialsPortraitTemplate } from './testimonials/portrait.js';

// Gallery templates
import { galleryMasonryTemplate } from './gallery/masonry.js';
import { galleryCarouselTemplate } from './gallery/carousel.js';

// Contact templates
import { contactFormTemplate } from './contact/form.js';
import { contactSplitTemplate } from './contact/split.js';

// Footer templates
import { footerMultiColumnTemplate } from './footer/multi-column.js';
import { footerMinimalTemplate } from './footer/minimal.js';

// New section types
import { pricingTablesTemplate } from './pricing/tables.js';
import { featuresGridTemplate } from './features/grid.js';
import { featuresActionsTemplate } from './features/actions.js';
import { featuresStepsTemplate } from './features/steps.js';
import { ctaBannerTemplate } from './cta/banner.js';
import { ctaBoxedTemplate } from './cta/boxed.js';
import { ctaSplitImageTemplate } from './cta/split-image.js';
import { statsNumbersTemplate } from './stats/numbers.js';

// Blog (rendered from synthetic sections built at deploy/preview time — not
// user-addable; see ADDABLE_TYPES in api/ai-builder/section-create.js)
import { blogListTemplate } from './blog/list.js';
import { blogPostTemplate } from './blog/post.js';

// Shop (synthetic, like blog — products live in the `products` table)
import { shopGridTemplate } from './shop/grid.js';
import { shopProductTemplate } from './shop/product.js';
// Featured products — a real ADDABLE body section (live product injection)
import { featuredProductsTemplate } from './shop/featured.js';
// Catalogue (plugin) — addable body section, live product injection by category
import { catalogueTilesTemplate, catalogueShowcaseTemplate } from './catalogue/tiles.js';
import { bookingWidgetTemplate } from './booking/widget.js';
// Courses (plugin) — synthetic /courses + /courses/:slug pages (like shop)
import { courseListTemplate } from './courses/list.js';
import { coursePlayerTemplate } from './courses/player.js';
import { coursePlayerGateTemplate } from './courses/gate.js';
import { coursesSectionTemplate } from './courses/section.js';
// Instagram Feed (plugin) — addable body section; live client-side feed fetch
import { instagramFeedSectionTemplate } from './instagram_feed/section.js';
// Members (plugin) — passwordless sign-in / account widget
import { membersSectionTemplate } from './members/section.js';

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
    overlap: heroOverlapTemplate,
    tags: heroTagsTemplate,
    showcase: heroShowcaseTemplate,
    quote: heroQuoteTemplate,
    default: heroCenteredTemplate,
  },
  about: {
    'text-image': aboutTextImageTemplate,
    timeline: aboutTimelineTemplate,
    team: aboutTeamTemplate,
    'founder-quote': aboutFounderQuoteTemplate,
    default: aboutTextImageTemplate,
  },
  services: {
    'icon-grid': servicesIconGridTemplate,
    cards: servicesCardsTemplate,
    spotlight: servicesSpotlightTemplate,
    numbered: servicesNumberedTemplate,
    default: servicesIconGridTemplate,
  },
  testimonials: {
    cards: testimonialsCardsTemplate,
    quotes: testimonialsQuotesTemplate,
    spotlight: testimonialsSpotlightTemplate,
    video: testimonialsVideoTemplate,
    portrait: testimonialsPortraitTemplate,
    default: testimonialsCardsTemplate,
  },
  gallery: {
    masonry: galleryMasonryTemplate,
    carousel: galleryCarouselTemplate,
    default: galleryMasonryTemplate,
  },
  contact: {
    form: contactFormTemplate,
    split: contactSplitTemplate,
    default: contactFormTemplate,
  },
  footer: {
    'multi-column': footerMultiColumnTemplate,
    minimal: footerMinimalTemplate,
    default: footerMultiColumnTemplate,
  },
  pricing: {
    tables: pricingTablesTemplate,
    default: pricingTablesTemplate,
  },
  features: {
    grid: featuresGridTemplate,
    actions: featuresActionsTemplate,
    steps: featuresStepsTemplate,
    default: featuresGridTemplate,
  },
  cta: {
    banner: ctaBannerTemplate,
    boxed: ctaBoxedTemplate,
    'split-image': ctaSplitImageTemplate,
    default: ctaBannerTemplate,
  },
  stats: {
    numbers: statsNumbersTemplate,
    default: statsNumbersTemplate,
  },
  blog_list: {
    default: blogListTemplate,
  },
  blog_post: {
    default: blogPostTemplate,
  },
  products: {
    grid: featuredProductsTemplate,
    default: featuredProductsTemplate,
  },
  catalogue: {
    showcase: catalogueShowcaseTemplate, // compact, title-over-image (DEFAULT)
    tiles: catalogueTilesTemplate, // image + title + description card
    default: catalogueShowcaseTemplate,
  },
  booking: {
    panel: bookingWidgetTemplate,
    default: bookingWidgetTemplate,
  },
  shop_list: {
    default: shopGridTemplate,
  },
  shop_product: {
    default: shopProductTemplate,
  },
  course_list: {
    default: courseListTemplate,
  },
  course_player: {
    default: coursePlayerTemplate,
  },
  course_gate: {
    default: coursePlayerGateTemplate,
  },
  courses: {
    default: coursesSectionTemplate,
    tiles: coursesSectionTemplate,
  },
  instagram_feed: {
    default: instagramFeedSectionTemplate,
    grid: instagramFeedSectionTemplate,
  },
  members: {
    default: membersSectionTemplate,
    card: membersSectionTemplate,
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
