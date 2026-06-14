/**
 * Whole-site template presets ("themes") for the customize page.
 *
 * A theme is a re-skin the user can apply on top of their already-generated
 * sections: it maps section types to template variants and sets a font pairing.
 * Applying a theme bulk-updates each section's html_template and the config's
 * fonts — content, colors, order, and visibility are preserved.
 *
 * Only section types with more than one variant in the registry are listed in a
 * theme's `variants` map (hero, about, services, testimonials, gallery); single-
 * variant types (header/contact/footer/features/...) are intentionally omitted
 * and left untouched. Variant names must match the registry
 * (src/templates/ai-builder/registry.js) — validated at apply time and by the
 * unit check in scripts. The `video` hero variant is avoided (needs video data).
 *
 * `accent` is purely decorative for the picker card; it is NOT applied to the
 * site (colors are preserved when switching themes).
 */

export const SITE_THEMES = [
  {
    key: 'bold',
    label: 'Bold',
    description: 'Big full-bleed hero, punchy condensed headings.',
    accent: 'linear-gradient(135deg, #111827 0%, #ef4444 100%)',
    variants: {
      hero: 'fullscreen',
      about: 'text-image',
      services: 'cards',
      testimonials: 'cards',
      gallery: 'masonry',
    },
    fonts: { heading: 'Oswald', body: 'Roboto' },
  },
  {
    key: 'elegant',
    label: 'Elegant',
    description: 'Refined editorial serif with a split hero and quote testimonials.',
    accent: 'linear-gradient(135deg, #4c1d95 0%, #c084fc 100%)',
    variants: {
      hero: 'split',
      about: 'text-image',
      services: 'cards',
      testimonials: 'quotes',
      gallery: 'carousel',
    },
    fonts: { heading: 'Playfair Display', body: 'Lato' },
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Clean, restrained layout with a minimal hero and icon grid.',
    accent: 'linear-gradient(135deg, #f3f4f6 0%, #9ca3af 100%)',
    variants: {
      hero: 'minimal',
      about: 'text-image',
      services: 'icon-grid',
      testimonials: 'quotes',
      gallery: 'masonry',
    },
    fonts: { heading: 'Inter', body: 'Inter' },
  },
  {
    key: 'classic',
    label: 'Classic',
    description: 'Traditional centered hero, team intro, and trustworthy serif.',
    accent: 'linear-gradient(135deg, #1e3a8a 0%, #60a5fa 100%)',
    variants: {
      hero: 'centered',
      about: 'team',
      services: 'icon-grid',
      testimonials: 'cards',
      gallery: 'masonry',
    },
    fonts: { heading: 'Merriweather', body: 'Source Sans Pro' },
  },
  // Dark themes carry their own palette (colors) + surface tokens + mode:'dark'.
  // Applying one overrides colors (unlike the light themes above, which preserve
  // them); the assembler injects darkModeCss() when the active style_theme is dark.
  {
    key: 'midnight',
    label: 'Midnight',
    description: 'Sleek near-black surfaces with an electric-blue accent.',
    mode: 'dark',
    accent: 'linear-gradient(135deg, #0d0d0f 0%, #3b82f6 100%)',
    variants: {
      hero: 'split',
      about: 'text-image',
      services: 'cards',
      testimonials: 'quotes',
      gallery: 'masonry',
    },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    colors: { primary: '#3b82f6', secondary: '#60a5fa' },
    surface: { bg: '#0d0d0f', card: '#18181b', text: '#f4f4f5', muted: '#a1a1aa', border: '#27272a' },
  },
  {
    key: 'goldcard',
    label: 'Gold Card',
    description: 'Black and champagne gold — luxe, official, high-contrast serif.',
    mode: 'dark',
    accent: 'linear-gradient(135deg, #000000 0%, #f0c94f 100%)',
    variants: {
      hero: 'fullscreen',
      about: 'text-image',
      services: 'cards',
      testimonials: 'quotes',
      gallery: 'carousel',
    },
    fonts: { heading: 'Instrument Serif', body: 'Instrument Sans' },
    colors: { primary: '#f0c94f', secondary: '#cfae44' },
    surface: { bg: '#000000', card: '#15130d', text: '#f5ecd6', muted: '#b8a98a', border: '#3a3320' },
  },
];

/**
 * Look up a theme by key.
 * @param {string} key
 * @returns {object|null}
 */
export function getTheme(key) {
  return SITE_THEMES.find((t) => t.key === key) || null;
}

/**
 * All themes, in display order.
 * @returns {object[]}
 */
export function listThemes() {
  return SITE_THEMES;
}

// Section wrappers that hardcode a light background — flipped to surface.bg.
// Config-gradient/image sections (.hero-centered/.hero-fullscreen/.cta-banner/
// .stats-numbers) are intentionally NOT listed so they keep the theme palette.
const DARK_SURFACE_SECTIONS = [
  '.hero-minimal', '.hero-split', '.hero-split-content',
  '.about-section', '.about-team', '.about-timeline',
  '.services-cards', '.services-section', '.features-grid',
  '.testimonials-section', '.testimonials-quotes',
  '.gallery-section', '.gallery-carousel',
  '.contact-section', '.pricing-tables',
  '.blog-list-section', '.blog-post-section',
  '.shop-list-section', '.shop-product-section',
];

// Inner card/well surfaces (light) — flipped to the slightly lighter surface.card.
const DARK_CARD_SURFACES = [
  '.service-card', '.service-card-inner', '.testimonial-card', '.quote-card',
  '.pricing-card', '.contact-form', '.contact-info-item', '.timeline-content',
  '.team-card', '.feature-item', '.blog-card', '.shop-card',
  // Service detail modal — keep it on-theme (its title is an h3 inside the
  // services section, so the dark heading override would otherwise be invisible
  // on a white card).
  '.cf-svc-modal__card',
];

/**
 * Build the global dark-mode CSS override layer for a dark theme.
 *
 * Section templates set their backgrounds via class selectors in <style> blocks
 * that appear later in the document, so these overrides use !important to win.
 * Heading colors go to surface.text, body text to surface.muted; config-gradient
 * sections (heroes/CTA/stats) are left alone so they render the theme palette.
 * @param {object} theme - A theme with a `surface` object
 * @returns {string} CSS (no <style> wrapper)
 */
export function darkModeCss(theme) {
  const s = theme && theme.surface;
  if (!s) return '';
  return `
    body { background: ${s.bg} !important; color: ${s.text} !important; }
    ${DARK_SURFACE_SECTIONS.join(', ')} { background: ${s.bg} !important; }
    ${DARK_CARD_SURFACES.join(', ')} { background: ${s.card} !important; border-color: ${s.border} !important; }
    section h1, section h2, section h3, section h4, section h5, section h6 { color: ${s.text} !important; }
    section p, section li, .service-card p, .testimonial-card p, .quote-card p, .pricing-card li, .timeline-content p { color: ${s.muted} !important; }
    .blog-post-body, .blog-card-meta, .blog-post-date, .blog-post-body blockquote { color: ${s.muted} !important; }
    .shop-card-excerpt, .shop-product-desc, .shop-card-price { color: ${s.muted} !important; }
    .shop-card-body h3, .shop-product-name { color: ${s.text} !important; }
    .contact-form input, .contact-form textarea, .contact-form select {
      background: ${s.card} !important; color: ${s.text} !important; border-color: ${s.border} !important;
    }
    .contact-form input::placeholder, .contact-form textarea::placeholder { color: ${s.muted} !important; }
    /* Caddisfly branding strip */
    body > div[style*="#f7fafc"] { background: ${s.bg} !important; color: ${s.muted} !important; }
  `;
}
