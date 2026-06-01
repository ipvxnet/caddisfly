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
