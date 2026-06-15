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

/**
 * Design-token bundles — the "feel" knobs beyond color/font (corner radius,
 * shadow depth, section spacing density, container width, button/image radius).
 * Each template picks ONE bundle via its `tokens` key. Section templates read
 * these as CSS vars (var(--cf-radius, <fallback>)), so a template can express
 * "sharp & flat" vs "soft & rounded" vs "editorial" without bespoke layouts.
 * Injected at render time (templateTokensCss) — no DB column.
 */
export const TOKEN_PRESETS = {
  sharp: { radius: '4px', radiusSm: '3px', shadow: '0 2px 10px rgba(0,0,0,.10)', shadowSm: '0 1px 3px rgba(0,0,0,.08)', sectionPad: '4.5rem', container: '1200px', btnRadius: '4px', imgRadius: '6px' },
  editorial: { radius: '3px', radiusSm: '2px', shadow: '0 18px 50px rgba(0,0,0,.10)', shadowSm: '0 6px 18px rgba(0,0,0,.06)', sectionPad: '7rem', container: '1080px', btnRadius: '2px', imgRadius: '3px' },
  round: { radius: '22px', radiusSm: '14px', shadow: '0 16px 40px rgba(0,0,0,.08)', shadowSm: '0 6px 16px rgba(0,0,0,.05)', sectionPad: '6rem', container: '1080px', btnRadius: '999px', imgRadius: '18px' },
  classic: { radius: '8px', radiusSm: '6px', shadow: '0 6px 20px rgba(0,0,0,.10)', shadowSm: '0 2px 8px rgba(0,0,0,.08)', sectionPad: '5.5rem', container: '1200px', btnRadius: '6px', imgRadius: '8px' },
  modern: { radius: '14px', radiusSm: '10px', shadow: '0 12px 32px rgba(0,0,0,.16)', shadowSm: '0 4px 14px rgba(0,0,0,.12)', sectionPad: '6rem', container: '1200px', btnRadius: '10px', imgRadius: '14px' },
  luxe: { radius: '4px', radiusSm: '3px', shadow: '0 16px 44px rgba(0,0,0,.28)', shadowSm: '0 6px 18px rgba(0,0,0,.22)', sectionPad: '7rem', container: '1120px', btnRadius: '2px', imgRadius: '4px' },
};

export const SITE_THEMES = [
  {
    key: 'bold',
    label: 'Bold',
    description: 'Big full-bleed hero, punchy condensed headings.',
    accent: 'linear-gradient(135deg, #111827 0%, #ef4444 100%)',
    industries: ['fitness', 'barbershop'],
    variants: {
      hero: 'fullscreen',
      about: 'text-image',
      services: 'cards',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'form',
      footer: 'multi-column',
      cta: 'banner',
    },
    fonts: { heading: 'Oswald', body: 'Roboto' },
    tokens: 'sharp',
  },
  {
    key: 'elegant',
    label: 'Elegant',
    description: 'Refined editorial serif with a split hero and quote testimonials.',
    accent: 'linear-gradient(135deg, #4c1d95 0%, #c084fc 100%)',
    industries: ['beauty'],
    variants: {
      hero: 'overlap',
      about: 'text-image',
      services: 'spotlight',
      testimonials: 'spotlight',
      gallery: 'carousel',
      contact: 'split',
      footer: 'minimal',
      cta: 'boxed',
    },
    fonts: { heading: 'Playfair Display', body: 'Lato' },
    tokens: 'editorial',
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Clean, restrained layout with a minimal hero and icon grid.',
    accent: 'linear-gradient(135deg, #f3f4f6 0%, #9ca3af 100%)',
    industries: ['tech'],
    variants: {
      hero: 'minimal',
      about: 'text-image',
      services: 'numbered',
      testimonials: 'spotlight',
      gallery: 'masonry',
      contact: 'split',
      footer: 'minimal',
      cta: 'boxed',
    },
    fonts: { heading: 'Inter', body: 'Inter' },
    tokens: 'round',
  },
  {
    key: 'classic',
    label: 'Classic',
    description: 'Traditional centered hero, team intro, and trustworthy serif.',
    accent: 'linear-gradient(135deg, #1e3a8a 0%, #60a5fa 100%)',
    industries: ['legal'],
    variants: {
      hero: 'centered',
      about: 'team',
      services: 'icon-grid',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'form',
      footer: 'multi-column',
      cta: 'banner',
    },
    fonts: { heading: 'Merriweather', body: 'Source Sans Pro' },
    tokens: 'classic',
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
    industries: ['automotive'],
    variants: {
      hero: 'split',
      about: 'text-image',
      services: 'cards',
      testimonials: 'quotes',
      gallery: 'masonry',
      contact: 'split',
      footer: 'minimal',
      cta: 'boxed',
    },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    colors: { primary: '#3b82f6', secondary: '#60a5fa' },
    surface: { bg: '#0d0d0f', card: '#18181b', text: '#f4f4f5', muted: '#a1a1aa', border: '#27272a' },
    tokens: 'modern',
  },
  {
    key: 'goldcard',
    label: 'Gold Card',
    description: 'Black and champagne gold — luxe, official, high-contrast serif.',
    mode: 'dark',
    accent: 'linear-gradient(135deg, #000000 0%, #f0c94f 100%)',
    industries: ['retail'],
    variants: {
      hero: 'fullscreen',
      about: 'text-image',
      services: 'spotlight',
      testimonials: 'spotlight',
      gallery: 'carousel',
      contact: 'split',
      footer: 'minimal',
      cta: 'boxed',
    },
    fonts: { heading: 'Instrument Serif', body: 'Instrument Sans' },
    colors: { primary: '#f0c94f', secondary: '#cfae44' },
    surface: { bg: '#000000', card: '#15130d', text: '#f5ecd6', muted: '#b8a98a', border: '#3a3320' },
    tokens: 'luxe',
  },
  // Light, industry-palette-driven templates for specific verticals (compose the
  // existing variants with distinct fonts/tokens). Listed after the base set so
  // their (now exclusive) industries win in selectTemplate's first-match order.
  {
    key: 'savory',
    label: 'Savory',
    description: 'Appetizing full-bleed hero, image-rich spotlight services, warm serif.',
    accent: 'linear-gradient(135deg, #c0392b 0%, #e67e22 100%)',
    industries: ['food'],
    variants: {
      hero: 'fullscreen',
      about: 'text-image',
      services: 'spotlight',
      testimonials: 'cards',
      gallery: 'carousel',
      contact: 'split',
      footer: 'multi-column',
      cta: 'boxed',
    },
    fonts: { heading: 'Playfair Display', body: 'Nunito Sans' },
    tokens: 'round',
  },
  {
    key: 'care',
    label: 'Care',
    description: 'Calm, reassuring layout for clinics and wellness — soft and approachable.',
    accent: 'linear-gradient(135deg, #16a085 0%, #1abc9c 100%)',
    industries: ['health'],
    variants: {
      hero: 'split',
      about: 'text-image',
      services: 'icon-grid',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'split',
      footer: 'minimal',
      cta: 'boxed',
    },
    fonts: { heading: 'Poppins', body: 'Open Sans' },
    tokens: 'round',
  },
  {
    key: 'studio',
    label: 'Studio',
    description: 'Bold modern type, overlap hero and numbered services — for creative studios.',
    accent: 'linear-gradient(135deg, #8e44ad 0%, #f1c40f 100%)',
    industries: ['creative'],
    variants: {
      hero: 'overlap',
      about: 'text-image',
      services: 'numbered',
      testimonials: 'spotlight',
      gallery: 'masonry',
      contact: 'split',
      footer: 'minimal',
      cta: 'boxed',
    },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    tokens: 'modern',
  },
  {
    key: 'estate',
    label: 'Estate',
    description: 'Photo-forward and trustworthy — big hero, gallery and clean cards for property.',
    accent: 'linear-gradient(135deg, #2c3e50 0%, #16a085 100%)',
    industries: ['realestate'],
    variants: {
      hero: 'overlap',
      about: 'text-image',
      services: 'cards',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'split',
      footer: 'multi-column',
      cta: 'boxed',
    },
    fonts: { heading: 'Montserrat', body: 'Lato' },
    tokens: 'modern',
  },
  {
    key: 'trades',
    label: 'Trades',
    description: 'Sturdy and direct for home services — strong hero, clear services and a get-a-quote CTA.',
    accent: 'linear-gradient(135deg, #2980b9 0%, #27ae60 100%)',
    industries: ['home'],
    variants: {
      hero: 'fullscreen',
      about: 'text-image',
      services: 'cards',
      features: 'grid',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'split',
      footer: 'multi-column',
      cta: 'banner',
    },
    fonts: { heading: 'Rajdhani', body: 'Roboto' },
    tokens: 'sharp',
  },
  {
    key: 'smile',
    label: 'Smile',
    description: 'Bright, clean and reassuring for dental & clinics — friendly hero, clear services.',
    accent: 'linear-gradient(135deg, #0aa1dd 0%, #4dd0e1 100%)',
    industries: ['dental'],
    variants: {
      hero: 'split',
      about: 'text-image',
      services: 'icon-grid',
      features: 'grid',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'split',
      footer: 'multi-column',
      cta: 'banner',
    },
    fonts: { heading: 'Poppins', body: 'Open Sans' },
    tokens: 'round',
  },
  {
    key: 'ledger',
    label: 'Ledger',
    description: 'Sober and trustworthy for finance & accounting — measured type, calm structure.',
    accent: 'linear-gradient(135deg, #1e5631 0%, #243b53 100%)',
    industries: ['finance'],
    variants: {
      hero: 'minimal',
      about: 'text-image',
      services: 'numbered',
      features: 'grid',
      testimonials: 'quotes',
      gallery: 'masonry',
      contact: 'form',
      footer: 'multi-column',
      cta: 'boxed',
    },
    fonts: { heading: 'Merriweather', body: 'Source Sans Pro' },
    tokens: 'classic',
  },
  {
    key: 'build',
    label: 'Build',
    description: 'Industrial and rugged for construction & contractors — bold hero, sturdy blocks.',
    accent: 'linear-gradient(135deg, #d35400 0%, #2c3e50 100%)',
    industries: ['construction'],
    variants: {
      hero: 'fullscreen',
      about: 'text-image',
      services: 'cards',
      features: 'grid',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'split',
      footer: 'multi-column',
      cta: 'banner',
    },
    fonts: { heading: 'Oswald', body: 'Roboto' },
    tokens: 'sharp',
  },
  {
    key: 'paws',
    label: 'Paws',
    description: 'Playful and warm for pet services — rounded, friendly and full of personality.',
    accent: 'linear-gradient(135deg, #16a596 0%, #ff8c42 100%)',
    industries: ['pet'],
    variants: {
      hero: 'centered',
      about: 'text-image',
      services: 'icon-grid',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'split',
      footer: 'minimal',
      cta: 'boxed',
    },
    fonts: { heading: 'Quicksand', body: 'Nunito' },
    tokens: 'round',
  },
  {
    key: 'voyage',
    label: 'Voyage',
    description: 'Wanderlust and photo-forward for travel & tourism — immersive hero, big gallery.',
    accent: 'linear-gradient(135deg, #0277bd 0%, #ff7043 100%)',
    industries: ['travel'],
    variants: {
      hero: 'overlap',
      about: 'text-image',
      services: 'cards',
      testimonials: 'spotlight',
      gallery: 'carousel',
      contact: 'split',
      footer: 'multi-column',
      cta: 'boxed',
    },
    fonts: { heading: 'Montserrat', body: 'Lato' },
    tokens: 'modern',
  },
  {
    key: 'celebration',
    label: 'Celebration',
    description: 'Festive and elegant for weddings & events — graceful serif, romantic spacing.',
    accent: 'linear-gradient(135deg, #9b3b6a 0%, #d4af37 100%)',
    industries: ['events'],
    variants: {
      hero: 'fullscreen',
      about: 'text-image',
      services: 'spotlight',
      testimonials: 'spotlight',
      gallery: 'carousel',
      contact: 'split',
      footer: 'minimal',
      cta: 'boxed',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'Montserrat' },
    tokens: 'editorial',
  },
  {
    key: 'scholar',
    label: 'Scholar',
    description: 'Friendly and credible for schools & courses — approachable type, clear pathways.',
    accent: 'linear-gradient(135deg, #2962ff 0%, #ffb300 100%)',
    industries: ['education'],
    variants: {
      hero: 'split',
      about: 'text-image',
      services: 'numbered',
      features: 'grid',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'form',
      footer: 'multi-column',
      cta: 'banner',
    },
    fonts: { heading: 'Poppins', body: 'Source Sans Pro' },
    tokens: 'round',
  },
  {
    key: 'cause',
    label: 'Cause',
    description: 'Warm and mission-driven for nonprofits — hopeful hero, strong donate call to action.',
    accent: 'linear-gradient(135deg, #2e7d32 0%, #00897b 100%)',
    industries: ['nonprofit'],
    variants: {
      hero: 'overlap',
      about: 'text-image',
      services: 'icon-grid',
      testimonials: 'spotlight',
      gallery: 'masonry',
      contact: 'split',
      footer: 'multi-column',
      cta: 'banner',
    },
    fonts: { heading: 'Poppins', body: 'Open Sans' },
    tokens: 'round',
  },
  {
    key: 'lens',
    label: 'Lens',
    description: 'Dark, gallery-first for photographers — the work fills the frame, chrome stays out of the way.',
    mode: 'dark',
    accent: 'linear-gradient(135deg, #1a1a1a 0%, #e0a96d 100%)',
    industries: ['photography'],
    variants: {
      hero: 'fullscreen',
      about: 'text-image',
      services: 'numbered',
      testimonials: 'spotlight',
      gallery: 'carousel',
      contact: 'split',
      footer: 'minimal',
      cta: 'boxed',
    },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    colors: { primary: '#e0a96d', secondary: '#c98a4b' },
    surface: { bg: '#0f0f10', card: '#1a1a1c', text: '#f5f5f5', muted: '#a3a3a3', border: '#2a2a2c' },
    tokens: 'modern',
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
 * CSS custom-property declarations for a theme's design-token bundle, to drop
 * inside the page :root. Empty when the theme has no token bundle (sections then
 * use their hardcoded fallbacks, so legacy/un-regenerated sites are unchanged).
 * @param {object} theme - a theme (with a `tokens` preset key)
 * @returns {string} CSS declarations (no selector wrapper)
 */
export function templateTokensCss(theme) {
  const p = theme && theme.tokens && TOKEN_PRESETS[theme.tokens];
  if (!p) return '';
  return `
    --cf-radius: ${p.radius};
    --cf-radius-sm: ${p.radiusSm};
    --cf-shadow: ${p.shadow};
    --cf-shadow-sm: ${p.shadowSm};
    --cf-section-pad: ${p.sectionPad};
    --cf-container: ${p.container};
    --cf-btn-radius: ${p.btnRadius};
    --cf-img-radius: ${p.imgRadius};`;
}

/**
 * All themes, in display order.
 * @returns {object[]}
 */
export function listThemes() {
  return SITE_THEMES;
}

/**
 * Pick a template for a generated site. An explicit wizard "style" that maps to
 * a template wins; otherwise the first template whose `industries` includes the
 * inferred industry; otherwise a safe, universal default.
 * @param {string} industry - inferIndustry() key
 * @param {string} [style] - the wizard's style choice (may be a template key)
 * @returns {object} a theme
 */
export function selectTemplate(industry, style) {
  if (style && getTheme(style)) return getTheme(style);
  const byIndustry = SITE_THEMES.find((t) => Array.isArray(t.industries) && t.industries.includes(industry));
  return byIndustry || getTheme('classic') || SITE_THEMES[0];
}

// Section wrappers that hardcode a light background — flipped to surface.bg.
// Config-gradient/image sections (.hero-centered/.hero-fullscreen/.cta-banner/
// .stats-numbers) are intentionally NOT listed so they keep the theme palette.
const DARK_SURFACE_SECTIONS = [
  '.hero-minimal', '.hero-split', '.hero-split-content', '.hero-overlap', '.cta-boxed',
  '.about-section', '.about-team', '.about-timeline',
  '.services-cards', '.services-section', '.features-grid',
  '.testimonials-section', '.testimonials-quotes', '.testimonials-spotlight',
  '.gallery-section', '.gallery-carousel',
  '.contact-section', '.contact-split', '.pricing-tables',
  '.services-spotlight', '.services-numbered', '.footer-minimal',
  '.blog-list-section', '.blog-post-section',
  '.shop-list-section', '.shop-product-section',
];

// Inner card/well surfaces (light) — flipped to the slightly lighter surface.card.
const DARK_CARD_SURFACES = [
  '.service-card', '.service-card-inner', '.testimonial-card', '.quote-card',
  '.pricing-card', '.contact-form', '.contact-info-item', '.timeline-content',
  '.team-card', '.feature-item', '.blog-card', '.shop-card',
  '.footer-minimal-social a', '.hero-overlap-card',
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
    section p, section li, .service-card p, .testimonial-card p, .quote-card p, .pricing-card li, .timeline-content p, .svc-num-desc { color: ${s.muted} !important; }
    /* Key content text that isn't a p/li/heading — keep it bright, not dark-on-dark.
       (review quotes/authors, contact details, form labels, social links.) */
    .quote-text, .author-name, .testimonial-text, .testimonial-author,
    .contact-info-item, .contact-social-link, .contact-form label, .form-group label,
    .footer-minimal-links a, .footer-minimal-brand, .cta-boxed-desc, .svc-num-title,
    .tspot-quote, .tspot-author { color: ${s.text} !important; }
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
