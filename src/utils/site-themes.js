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
    key: 'eclipse',
    label: 'Eclipse',
    description: 'Deep slate and warm gold — a premium, after-hours look for dental & clinics.',
    style: 'elegant',
    mode: 'dark',
    accent: 'linear-gradient(135deg, #0f1620 0%, #c9a24b 100%)',
    industries: ['dental'],
    variants: {
      hero: 'split',
      about: 'text-image',
      services: 'icon-grid',
      features: 'grid',
      testimonials: 'cards',
      gallery: 'masonry',
      contact: 'split',
      footer: 'minimal',
      cta: 'banner',
    },
    fonts: { heading: 'Fraunces', body: 'Inter' },
    colors: { primary: '#c9a24b', secondary: '#e0c489' },
    surface: { bg: '#0f1620', card: '#18222f', text: '#eef2f7', muted: '#9fb0c0', border: '#28323f' },
    tokens: 'luxe',
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

  // ── Style variations on existing verticals (industry × style) ─────────────
  // Same industry + palette as the default; a distinct LAYOUT (hero/section mix),
  // token density and type pairing give each a different feel. The wizard's style
  // choice selects among these; the original (listed first) stays the default.
  {
    key: 'noir', label: 'Noir', style: 'elegant',
    description: 'Dark, fine-dining drama — moody surfaces, gold accents, editorial serif.',
    mode: 'dark',
    accent: 'linear-gradient(135deg, #1a1411 0%, #c9a227 100%)',
    industries: ['food'],
    variants: { hero: 'fullscreen', about: 'text-image', services: 'spotlight', testimonials: 'spotlight', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Cormorant Garamond', body: 'Inter' },
    colors: { primary: '#c9a227', secondary: '#b08d57' },
    surface: { bg: '#14100c', card: '#201a14', text: '#f5efe6', muted: '#b8ab97', border: '#332b22' },
    tokens: 'editorial',
  },
  {
    key: 'gridiron', label: 'Gridiron', style: 'minimal',
    description: 'Clean, no-nonsense fitness — minimal hero, numbered programs, lots of air.',
    accent: 'linear-gradient(135deg, #e74c3c 0%, #2c3e50 100%)',
    industries: ['fitness'],
    variants: { hero: 'minimal', about: 'text-image', services: 'numbered', features: 'grid', testimonials: 'quotes', gallery: 'masonry', contact: 'form', footer: 'minimal', cta: 'banner' },
    fonts: { heading: 'Archivo', body: 'Inter' },
    tokens: 'minimal',
  },
  {
    key: 'glow', label: 'Glow', style: 'modern',
    description: 'Soft, modern salon — rounded cards, overlap hero, a carousel of looks.',
    accent: 'linear-gradient(135deg, #c98ca0 0%, #e8c1a0 100%)',
    industries: ['beauty'],
    variants: { hero: 'overlap', about: 'text-image', services: 'cards', testimonials: 'cards', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Poppins', body: 'Inter' },
    tokens: 'round',
  },
  {
    key: 'manor', label: 'Manor', style: 'classic',
    description: 'Stately, editorial real estate — full-bleed hero, spotlight listings, serif.',
    accent: 'linear-gradient(135deg, #2c3e50 0%, #e1b12c 100%)',
    industries: ['realestate'],
    variants: { hero: 'fullscreen', about: 'text-image', services: 'spotlight', testimonials: 'quotes', gallery: 'carousel', contact: 'split', footer: 'multi-column', cta: 'boxed' },
    fonts: { heading: 'Playfair Display', body: 'Lato' },
    tokens: 'editorial',
  },
  {
    key: 'launch', label: 'Launch', style: 'bold',
    description: 'Bold, high-contrast SaaS — punchy fullscreen hero, sharp cards, big CTA.',
    accent: 'linear-gradient(135deg, #5b2be0 0%, #00cec9 100%)',
    industries: ['tech'],
    variants: { hero: 'fullscreen', about: 'text-image', services: 'cards', features: 'grid', testimonials: 'cards', gallery: 'masonry', contact: 'form', footer: 'multi-column', cta: 'banner' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    tokens: 'sharp',
  },
  {
    key: 'counsel', label: 'Counsel', style: 'modern',
    description: 'Modern, approachable law firm — split hero, clean cards, sans-serif.',
    accent: 'linear-gradient(135deg, #1a2980 0%, #4b6cb7 100%)',
    industries: ['legal'],
    variants: { hero: 'split', about: 'text-image', services: 'cards', features: 'grid', testimonials: 'quotes', gallery: 'masonry', contact: 'split', footer: 'multi-column', cta: 'boxed' },
    fonts: { heading: 'Manrope', body: 'Source Sans Pro' },
    tokens: 'modern',
  },
  {
    key: 'vault', label: 'Vault', style: 'minimal',
    description: 'Bright, minimal boutique — airy hero, masonry lookbook, restrained type.',
    accent: 'linear-gradient(135deg, #e84393 0%, #fdcb6e 100%)',
    industries: ['retail'],
    variants: { hero: 'minimal', about: 'text-image', services: 'cards', testimonials: 'cards', gallery: 'masonry', contact: 'form', footer: 'minimal', cta: 'banner' },
    fonts: { heading: 'Jost', body: 'Inter' },
    tokens: 'minimal',
  },
  {
    key: 'clinic', label: 'Clinic', style: 'classic',
    description: 'Traditional, reassuring healthcare — split hero, icon services, serif headings.',
    accent: 'linear-gradient(135deg, #16a085 0%, #2980b9 100%)',
    industries: ['health'],
    variants: { hero: 'split', about: 'text-image', services: 'icon-grid', features: 'grid', testimonials: 'cards', gallery: 'masonry', contact: 'split', footer: 'multi-column', cta: 'banner' },
    fonts: { heading: 'Merriweather', body: 'Open Sans' },
    tokens: 'classic',
  },

  // ── New verticals (batch toward 100) ─────────────────────────────────────
  {
    key: 'brew', label: 'Brew', style: 'modern',
    description: 'Cozy coffeehouse warmth — rounded cards, overlap hero, friendly serif.',
    accent: 'linear-gradient(135deg, #6f4e37 0%, #e8b04b 100%)',
    industries: ['cafe'],
    variants: { hero: 'overlap', about: 'text-image', services: 'cards', testimonials: 'cards', gallery: 'masonry', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Fraunces', body: 'Work Sans' },
    tokens: 'round',
  },
  {
    key: 'crumb', label: 'Crumb', style: 'classic',
    description: 'Sweet artisan bakery — full-bleed hero, spotlight treats, a carousel of bakes.',
    accent: 'linear-gradient(135deg, #d8849b 0%, #f6c453 100%)',
    industries: ['bakery'],
    variants: { hero: 'fullscreen', about: 'text-image', services: 'spotlight', testimonials: 'cards', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Playfair Display', body: 'Nunito' },
    tokens: 'round',
  },
  {
    key: 'serenity', label: 'Serenity', style: 'elegant',
    description: 'Tranquil spa calm — airy minimal hero, soft serif, a gallery of escapes.',
    accent: 'linear-gradient(135deg, #6b8e7f 0%, #d9b382 100%)',
    industries: ['spa'],
    variants: { hero: 'minimal', about: 'text-image', services: 'cards', testimonials: 'spotlight', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Cormorant Garamond', body: 'Lato' },
    tokens: 'editorial',
  },
  {
    key: 'ink', label: 'Ink', style: 'bold',
    description: 'Dark, edgy tattoo studio — full-bleed hero, numbered work, gallery-first.',
    mode: 'dark',
    accent: 'linear-gradient(135deg, #1a1a1a 0%, #e63946 100%)',
    industries: ['tattoo'],
    variants: { hero: 'fullscreen', about: 'text-image', services: 'numbered', testimonials: 'spotlight', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Oswald', body: 'Inter' },
    colors: { primary: '#e63946', secondary: '#c1121f' },
    surface: { bg: '#0f0f10', card: '#1a1a1c', text: '#f5f5f5', muted: '#a3a3a3', border: '#2a2a2c' },
    tokens: 'sharp',
  },
  {
    key: 'companion', label: 'Companion', style: 'modern',
    description: 'Friendly, caring vet clinic — rounded, approachable, lots of reassurance.',
    accent: 'linear-gradient(135deg, #1aa6a0 0%, #ff9f43 100%)',
    industries: ['veterinary'],
    variants: { hero: 'split', features: 'actions', about: 'text-image', services: 'icon-grid', testimonials: 'cards', gallery: 'masonry', contact: 'split', footer: 'multi-column', cta: 'banner' },
    fonts: { heading: 'Quicksand', body: 'Open Sans' },
    tokens: 'round',
  },
  {
    key: 'bloom', label: 'Bloom', style: 'elegant',
    description: 'Romantic florist — overlap hero, a carousel of arrangements, graceful serif.',
    accent: 'linear-gradient(135deg, #d6336c 0%, #f6a5c0 100%)',
    industries: ['florist'],
    variants: { hero: 'overlap', about: 'text-image', services: 'cards', testimonials: 'cards', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Cormorant Garamond', body: 'Montserrat' },
    tokens: 'editorial',
  },
  {
    key: 'blueprint', label: 'Blueprint', style: 'minimal',
    description: 'Precise, minimal architecture — restrained hero, numbered projects, lots of grid.',
    accent: 'linear-gradient(135deg, #2d3436 0%, #0984e3 100%)',
    industries: ['architecture'],
    variants: { hero: 'minimal', about: 'text-image', services: 'numbered', testimonials: 'quotes', gallery: 'masonry', contact: 'form', footer: 'minimal', cta: 'banner' },
    fonts: { heading: 'Archivo', body: 'Inter' },
    tokens: 'minimal',
  },
  {
    key: 'atelier', label: 'Atelier', style: 'elegant',
    description: 'Refined interior design — editorial full-bleed hero, spotlight rooms, serif.',
    accent: 'linear-gradient(135deg, #8d7b68 0%, #c8b6a6 100%)',
    industries: ['interior'],
    variants: { hero: 'fullscreen', about: 'text-image', services: 'spotlight', testimonials: 'quotes', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Cormorant Garamond', body: 'Lato' },
    tokens: 'editorial',
  },
  {
    key: 'elevate', label: 'Elevate', style: 'modern',
    description: 'Motivational coaching — split hero, numbered steps, spotlight wins, strong CTA.',
    accent: 'linear-gradient(135deg, #6c5ce7 0%, #00b894 100%)',
    industries: ['coaching'],
    variants: { hero: 'split', about: 'text-image', services: 'numbered', features: 'grid', testimonials: 'spotlight', gallery: 'masonry', contact: 'form', footer: 'multi-column', cta: 'boxed' },
    fonts: { heading: 'Poppins', body: 'Inter' },
    tokens: 'modern',
  },
  {
    key: 'sanctuary', label: 'Sanctuary', style: 'classic',
    description: 'Warm, welcoming church — full-bleed hero, ministries grid, a clear invitation.',
    accent: 'linear-gradient(135deg, #34495e 0%, #c9a227 100%)',
    industries: ['church'],
    variants: { hero: 'fullscreen', about: 'text-image', services: 'icon-grid', testimonials: 'cards', gallery: 'masonry', contact: 'split', footer: 'multi-column', cta: 'banner' },
    fonts: { heading: 'Merriweather', body: 'Open Sans' },
    tokens: 'classic',
  },
  {
    key: 'carat', label: 'Carat', style: 'luxe',
    description: 'Refined fine jewelry — editorial full-bleed hero, spotlight pieces, antique gold.',
    accent: 'linear-gradient(135deg, #1a1a1a 0%, #d4af37 100%)',
    industries: ['jeweler'],
    variants: { hero: 'fullscreen', about: 'text-image', services: 'spotlight', testimonials: 'quotes', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Cormorant Garamond', body: 'Jost' },
    tokens: 'luxe',
  },
  {
    key: 'bud', label: 'Bud', style: 'modern',
    description: 'Clean, modern dispensary — overlap hero, product cards, calm green palette.',
    accent: 'linear-gradient(135deg, #2e7d32 0%, #aed581 100%)',
    industries: ['dispensary'],
    variants: { hero: 'overlap', about: 'text-image', services: 'cards', features: 'grid', testimonials: 'cards', gallery: 'masonry', contact: 'split', footer: 'multi-column', cta: 'banner' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    tokens: 'modern',
  },

  // ── Batch from competitor-site research (utility components + new looks) ──
  {
    key: 'vigor', label: 'Vigor', style: 'bold',
    description: 'Premium men’s health — dark, masculine, copper accent, pill feature-tags hero.',
    mode: 'dark',
    accent: 'linear-gradient(135deg, #1a1a1a 0%, #b87333 100%)',
    industries: ['menshealth'],
    variants: { hero: 'tags', about: 'text-image', services: 'cards', features: 'grid', testimonials: 'spotlight', gallery: 'masonry', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Oswald', body: 'Inter' },
    colors: { primary: '#b87333', secondary: '#d9a05b' },
    surface: { bg: '#101012', card: '#1b1b1f', text: '#f4f4f5', muted: '#a1a1aa', border: '#2c2c30' },
    tokens: 'sharp',
  },
  {
    key: 'rotunda', label: 'Rotunda', style: 'classic',
    description: 'Stately museum & cultural institution — carousel hero, plan-your-visit cards, serif.',
    accent: 'linear-gradient(135deg, #1f3a5f 0%, #c9a227 100%)',
    industries: ['museum'],
    variants: { hero: 'fullscreen', features: 'actions', about: 'text-image', services: 'cards', testimonials: 'quotes', gallery: 'carousel', contact: 'split', footer: 'multi-column', cta: 'banner' },
    fonts: { heading: 'Playfair Display', body: 'Lato' },
    tokens: 'editorial',
  },
  {
    key: 'taphouse', label: 'Taphouse', style: 'bold',
    description: 'Bold sports-bar energy — dark, full-bleed hero, quick-order cards, big CTA.',
    mode: 'dark',
    accent: 'linear-gradient(135deg, #1a1a1a 0%, #c0392b 100%)',
    industries: ['food'],
    variants: { hero: 'fullscreen', features: 'actions', about: 'text-image', services: 'cards', testimonials: 'cards', gallery: 'masonry', contact: 'split', footer: 'minimal', cta: 'banner' },
    fonts: { heading: 'Oswald', body: 'Inter' },
    colors: { primary: '#e74c3c', secondary: '#c0392b' },
    surface: { bg: '#141416', card: '#1f1f22', text: '#f5f5f5', muted: '#a3a3a3', border: '#2c2c30' },
    tokens: 'sharp',
  },

  // ── Batch from browser research (childcare/landscaping/medspa/winery) ─────
  {
    key: 'sprout', label: 'Sprout', style: 'playful',
    description: 'Bright, cheerful childcare — rounded shapes, playful color, schedule-a-tour cards.',
    accent: 'linear-gradient(135deg, #ff8fab 0%, #56c2e6 100%)',
    industries: ['childcare'],
    variants: { hero: 'overlap', features: 'actions', about: 'text-image', services: 'icon-grid', testimonials: 'cards', gallery: 'masonry', contact: 'split', footer: 'multi-column', cta: 'banner' },
    fonts: { heading: 'Baloo 2', body: 'Nunito' },
    tokens: 'round',
  },
  {
    key: 'verdant', label: 'Verdant', style: 'modern',
    description: 'Lush, photo-forward landscaping — full-bleed greenery, before/after gallery, free-quote CTA.',
    accent: 'linear-gradient(135deg, #3a7d3a 0%, #a3d62b 100%)',
    industries: ['landscaping'],
    variants: { hero: 'fullscreen', features: 'actions', about: 'text-image', services: 'cards', testimonials: 'cards', gallery: 'masonry', contact: 'split', footer: 'multi-column', cta: 'banner' },
    fonts: { heading: 'Bitter', body: 'Inter' },
    tokens: 'modern',
  },
  {
    key: 'aura', label: 'Aura', style: 'elegant',
    description: 'Luxe-clinical med spa — soft neutrals, editorial serif, spacious, spotlight treatments.',
    accent: 'linear-gradient(135deg, #5b6b73 0%, #c9a96b 100%)',
    industries: ['medspa'],
    variants: { hero: 'overlap', about: 'text-image', services: 'spotlight', testimonials: 'spotlight', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'boxed' },
    fonts: { heading: 'Cormorant Garamond', body: 'Jost' },
    tokens: 'editorial',
  },
  {
    key: 'vintner', label: 'Vintner', style: 'classic',
    description: 'Estate winery elegance — golden-hour full-bleed hero, refined serif, visit & wine club.',
    accent: 'linear-gradient(135deg, #6e2639 0%, #c9a227 100%)',
    industries: ['winery'],
    variants: { hero: 'fullscreen', about: 'text-image', services: 'spotlight', testimonials: 'quotes', gallery: 'carousel', contact: 'split', footer: 'multi-column', cta: 'boxed' },
    fonts: { heading: 'Cormorant Garamond', body: 'Lato' },
    tokens: 'editorial',
  },
  // --- 2026-06-18 batch: 6 templates filling light/dark gaps + new verticals,
  // built on the new showcase / founder-quote / split-image layouts. ---
  {
    key: 'aperture', label: 'Aperture', style: 'editorial',
    description: 'A bright, editorial counterpart to Lens — oversized type, gallery-forward, monochrome with a warm accent for photographers.',
    accent: 'linear-gradient(135deg, #1a1a1a 0%, #e0a96d 100%)',
    industries: ['photography'],
    variants: { hero: 'showcase', about: 'founder-quote', services: 'cards', testimonials: 'quotes', gallery: 'masonry', contact: 'split', footer: 'minimal', cta: 'split-image' },
    fonts: { heading: 'Fraunces', body: 'Inter' },
    tokens: 'editorial',
  },
  {
    key: 'velocity', label: 'Velocity', style: 'modern',
    description: 'A bright, high-energy look for auto shops & dealers — sporty navy/red, technical type, strong service grid (a light alternative to Midnight).',
    accent: 'linear-gradient(135deg, #2c3e50 0%, #c0392b 100%)',
    industries: ['automotive'],
    variants: { hero: 'split', about: 'text-image', services: 'cards', features: 'grid', testimonials: 'cards', gallery: 'masonry', contact: 'split', footer: 'multi-column', cta: 'split-image' },
    fonts: { heading: 'Rajdhani', body: 'Roboto' },
    tokens: 'sharp',
  },
  {
    key: 'fade', label: 'Fade', style: 'classic', mode: 'dark',
    description: 'A dedicated dark barbershop look — leather-and-brass, condensed caps, founder quote and spotlight services.',
    accent: 'linear-gradient(135deg, #141210 0%, #c9a86a 100%)',
    industries: ['barbershop'],
    variants: { hero: 'showcase', about: 'founder-quote', services: 'spotlight', testimonials: 'quotes', gallery: 'masonry', contact: 'split', footer: 'minimal', cta: 'banner' },
    fonts: { heading: 'Oswald', body: 'Inter' },
    colors: { primary: '#c9a86a', secondary: '#9b2226' },
    surface: { bg: '#141210', card: '#1f1b16', text: '#f2ece1', muted: '#b6a78f', border: '#332c22' },
    tokens: 'sharp',
  },
  {
    key: 'vows', label: 'Vows', style: 'elegant',
    description: 'Soft, romantic and photo-led for wedding venues & planners — dusty rose and sage, airy serif, gallery and founder story.',
    accent: 'linear-gradient(135deg, #a8746f 0%, #c9a35c 100%)',
    industries: ['wedding'],
    variants: { hero: 'showcase', about: 'founder-quote', services: 'cards', testimonials: 'quotes', gallery: 'masonry', contact: 'split', footer: 'multi-column', cta: 'split-image' },
    fonts: { heading: 'Cormorant Garamond', body: 'Lato' },
    tokens: 'editorial',
  },
  {
    key: 'encore', label: 'Encore', style: 'bold', mode: 'dark',
    description: 'Stage-lit and loud for musicians, bands & venues — near-black with electric magenta/cyan, poster display type, tour-ready.',
    accent: 'linear-gradient(135deg, #0c0c12 0%, #ff2d75 100%)',
    industries: ['music'],
    variants: { hero: 'showcase', about: 'text-image', services: 'cards', testimonials: 'quotes', gallery: 'carousel', contact: 'split', footer: 'minimal', cta: 'banner' },
    fonts: { heading: 'Bebas Neue', body: 'Inter' },
    colors: { primary: '#ff2d75', secondary: '#00cec9' },
    surface: { bg: '#0c0c12', card: '#16161f', text: '#f4f4f8', muted: '#a0a0b2', border: '#262630' },
    tokens: 'sharp',
  },
  {
    key: 'barrel', label: 'Barrel', style: 'classic', mode: 'dark',
    description: 'Craft and industrial for breweries & taprooms — espresso and amber, slab serif, spotlight beers and gallery.',
    accent: 'linear-gradient(135deg, #171109 0%, #e0a04a 100%)',
    industries: ['brewery'],
    variants: { hero: 'showcase', about: 'founder-quote', services: 'spotlight', testimonials: 'quotes', gallery: 'masonry', contact: 'split', footer: 'minimal', cta: 'split-image' },
    fonts: { heading: 'Bitter', body: 'Inter' },
    colors: { primary: '#e0a04a', secondary: '#c2682a' },
    surface: { bg: '#171109', card: '#22190f', text: '#f5ecdc', muted: '#bda988', border: '#352812' },
    tokens: 'sharp',
  },
];

// Style tag per template (modern/classic/minimal/bold/elegant/luxe/playful) — used
// by the showcase filters and to let the wizard's style choice pick a variation
// within an industry. With one template per industry today each is its industry's
// default; as variations land, give each a distinct `style` and mark one `default`.
const STYLE_TAGS = {
  bold: 'bold', elegant: 'elegant', minimal: 'minimal', classic: 'classic',
  midnight: 'bold', goldcard: 'luxe', savory: 'classic', care: 'modern',
  studio: 'modern', estate: 'modern', trades: 'bold', smile: 'modern',
  ledger: 'classic', build: 'bold', paws: 'playful', voyage: 'modern',
  celebration: 'elegant', scholar: 'modern', cause: 'modern', lens: 'minimal',
};
for (const t of SITE_THEMES) { if (!t.style) t.style = STYLE_TAGS[t.key] || 'modern'; }

// Photo-forward verticals show testimonials best as the large-photo `portrait`
// layout (generation attaches a customer photo to each). Applied in one place
// so every theme for these industries uses it; other verticals keep their
// chosen testimonials variant.
const PORTRAIT_TESTIMONIAL_INDUSTRIES = new Set([
  'beauty', 'spa', 'medspa', 'fitness', 'dental', 'wedding', 'coaching', 'realestate', 'veterinary', 'barbershop',
]);
for (const t of SITE_THEMES) {
  if (t.variants && t.variants.testimonials && (t.industries || []).some((i) => PORTRAIT_TESTIMONIAL_INDUSTRIES.has(i))) {
    t.variants.testimonials = 'portrait';
  }
}

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
 * Pick a template for a generated site. The industry decides the candidate set;
 * within it, the wizard "style" (modern/classic/minimal/bold/…) picks the
 * matching VARIATION when one exists, else the industry's default variation.
 *
 * (Previously a generic style word that happened to be a template key — 'classic',
 * 'minimal', 'bold' — would override the industry pick entirely; that's fixed:
 * the industry now leads, and style only chooses among that industry's looks.)
 * @param {string} industry - inferIndustry() key
 * @param {string} [style] - the wizard's style choice (a style TAG, not a key)
 * @returns {object} a theme
 */
export function selectTemplate(industry, style) {
  const candidates = SITE_THEMES.filter((t) => Array.isArray(t.industries) && t.industries.includes(industry));
  if (candidates.length) {
    if (style) {
      const byStyle = candidates.find((t) => t.style === style);
      if (byStyle) return byStyle;
    }
    return candidates.find((t) => t.default) || candidates[0];
  }
  // No industry template (e.g. 'general'): honor an explicit template key if the
  // caller passed one, else a safe universal default.
  if (style && getTheme(style)) return getTheme(style);
  return getTheme('classic') || SITE_THEMES[0];
}

/** Templates that serve a given industry, in display order (for variation pickers). */
export function templatesForIndustry(industry) {
  return SITE_THEMES.filter((t) => Array.isArray(t.industries) && t.industries.includes(industry));
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
  '.features-actions',
  '.hero-showcase', '.about-founder', '.cta-split', '.testimonials-video', '.testimonials-portrait',
  '.blog-list-section', '.blog-post-section',
  '.shop-list-section', '.shop-product-section', '.shop-feat-section',
  '.bkg-section',
];

// Inner card/well surfaces (light) — flipped to the slightly lighter surface.card.
const DARK_CARD_SURFACES = [
  '.service-card', '.service-card-inner', '.testimonial-card', '.quote-card',
  '.pricing-card', '.contact-form', '.contact-info-item', '.timeline-content',
  '.team-card', '.feature-item', '.blog-card', '.shop-card', '.shop-feat-card',
  '.footer-minimal-social a', '.hero-overlap-card', '.action-card', '.cta-split-copy', '.vt-card', '.tp-card',
  '.bkg-card', '.bkg-panel',
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
// Fallback surfaces for the per-section appearance override (utils below): a
// standard light surface (to force a section light on a dark theme) and a default
// dark surface (to force a section dark on a light theme that has no theme.surface).
const LIGHT_SURFACE = { bg: '#ffffff', card: '#ffffff', text: '#1a202c', muted: '#4a5568', border: 'rgba(0,0,0,.08)' };
const DEFAULT_DARK_SURFACE = { bg: '#0f1419', card: '#1b2531', text: '#f7fafc', muted: '#9fb0c3', border: 'rgba(255,255,255,.12)' };

/**
 * The surface override rule block, optionally scoped to a subtree so it can be
 * reused for both the global dark layer and a per-section appearance override.
 * @param {string} rootSel - element that gets the bg+text (e.g. 'body' or '#ai-sec-7')
 * @param {string} p - descendant-selector prefix ('' globally, or '#ai-sec-7 ' scoped)
 * @param {object} s - a surface { bg, card, text, muted, border }
 */
function surfaceLayerCss(rootSel, p, s) {
  const j = (arr) => arr.map((c) => p + c).join(', ');
  return `
    ${rootSel} { background: ${s.bg} !important; color: ${s.text} !important; }
    ${j(DARK_SURFACE_SECTIONS)} { background: ${s.bg} !important; }
    ${j(DARK_CARD_SURFACES)} { background: ${s.card} !important; border-color: ${s.border} !important; }
    ${j(['section h1', 'section h2', 'section h3', 'section h4', 'section h5', 'section h6'])} { color: ${s.text} !important; }
    ${j(['section p', 'section li', '.service-card p', '.testimonial-card p', '.quote-card p', '.pricing-card li', '.timeline-content p', '.svc-num-desc', '.hero-showcase-sub', '.about-founder-role', '.cta-split-desc', '.vt-quote', '.vt-role', '.tp-quote', '.tp-role'])} { color: ${s.muted} !important; }
    ${j(['.quote-text', '.author-name', '.testimonial-text', '.testimonial-author', '.contact-info-item', '.contact-social-link', '.contact-form label', '.form-group label', '.footer-minimal-links a', '.footer-minimal-brand', '.cta-boxed-desc', '.svc-num-title', '.tspot-quote', '.tspot-author', '.action-title', '.value-item', '.about-founder-quote', '.about-founder-name', '.vt-name', '.tp-name', '.bkg-panel-head strong', '.bkg-pick'])} { color: ${s.text} !important; }
    ${j(['.bkg-sub', '.bkg-tz', '.bkg-desc'])} { color: ${s.muted} !important; }
    ${j(['.bkg-form input', '.bkg-form textarea'])} { background: ${s.card} !important; color: ${s.text} !important; border-color: ${s.border} !important; }
    ${j(['.bkg-form input::placeholder', '.bkg-form textarea::placeholder'])} { color: ${s.muted} !important; }
    ${j(['.action-desc'])} { color: ${s.muted} !important; }
    ${j(['.blog-post-body', '.blog-card-meta', '.blog-post-date', '.blog-post-body blockquote'])} { color: ${s.muted} !important; }
    ${j(['.shop-card-excerpt', '.shop-product-desc', '.shop-card-price', '.shop-feat-sub', '.shop-feat-excerpt'])} { color: ${s.muted} !important; }
    ${j(['.shop-card-body h3', '.shop-product-name', '.shop-feat-price'])} { color: ${s.text} !important; }
    ${j(['.contact-form input', '.contact-form textarea', '.contact-form select'])} { background: ${s.card} !important; color: ${s.text} !important; border-color: ${s.border} !important; }
    ${j(['.contact-form input::placeholder', '.contact-form textarea::placeholder'])} { color: ${s.muted} !important; }`;
}

export function darkModeCss(theme) {
  const s = theme && theme.surface;
  if (!s) return '';
  return surfaceLayerCss('body', '', s) + `
    /* Caddisfly branding strip */
    body > div[style*="#f7fafc"] { background: ${s.bg} !important; color: ${s.muted} !important; }
  `;
}

/**
 * Per-section appearance override. A section's content_json may carry
 * `_appearance: 'light' | 'dark'` (set in the editor); 'auto'/absent = follow the
 * theme. We emit CSS scoped to that section's `#ai-sec-<id>` wrapper. The id gives
 * the scoped rules higher specificity, so a forced-light section beats the global
 * dark layer and a forced-dark section beats the section's own light CSS.
 * @param {Array} sections - the page's sections (with id + content_json)
 * @param {object} theme - the active theme (its surface is used for forced-dark)
 * @returns {string} CSS (no <style> wrapper)
 */
export function sectionAppearanceCss(sections, theme) {
  if (!Array.isArray(sections) || !sections.length) return '';
  const darkSurface = (theme && theme.surface) || DEFAULT_DARK_SURFACE;
  const blocks = [];
  for (const sec of sections) {
    if (!sec || sec.id == null) continue;
    let appearance = '';
    try {
      const cj = typeof sec.content_json === 'string' ? JSON.parse(sec.content_json) : (sec.content_json || {});
      appearance = (cj && cj._appearance) || '';
    } catch { /* ignore malformed json */ }
    if (appearance !== 'light' && appearance !== 'dark') continue;
    const scope = `#ai-sec-${sec.id}`;
    blocks.push(surfaceLayerCss(scope, `${scope} `, appearance === 'dark' ? darkSurface : LIGHT_SURFACE));
  }
  return blocks.join('\n');
}
