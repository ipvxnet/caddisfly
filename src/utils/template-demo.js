// Live template demos for the public /templates showcase.
//
// Renders a real one-page site for any template by driving the SAME assembler
// the builder uses (assemblePage) with canned, industry-tailored content. No
// stored screenshots — every demo reflects the template's current design
// (variants + fonts + palette + tokens + dark surface) and never goes stale.

import { assemblePage } from './ai-page-assembler.js';
import { getTheme, listThemes } from './site-themes.js';
import { paletteFor } from './industry-style.js';

// Known-good stock photos (these ship as template defaults in prod, so they're
// guaranteed to load). Used as a small rotating pool for hero/about/gallery.
const PHOTOS = [
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1200&q=80&auto=format&fit=crop',
];

// Light, per-industry copy so each demo reads like a real business. Anything not
// overridden falls back to the section template's built-in defaults.
const PROFILES = {
  food: { brand: 'Trattoria Lucia', hero: ['Authentic Italian, Made Fresh Daily', 'Hand-rolled pasta, wood-fired pizza, and a wine list to match'],
    services: [['Dinner Service', 'Seasonal plates from our open kitchen', '🍝'], ['Private Events', 'Host your celebration with us', '🥂'], ['Catering', 'Bring the trattoria to your table', '🍷']] },
  fitness: { brand: 'Forge Athletic', hero: ['Train Hard. Live Strong.', 'Coaching, classes, and a community that shows up'],
    services: [['Personal Training', 'One-on-one programming for real results', '💪'], ['Group Classes', 'HIIT, strength, and conditioning', '🔥'], ['Nutrition Coaching', 'Fuel your performance', '🥗']] },
  barbershop: { brand: 'The Sharp Fade', hero: ['Classic Cuts, Modern Edge', 'Precision grooming for the well-kept gentleman'],
    services: [['Haircut & Style', 'Tailored to your look', '💈'], ['Beard Trim', 'Shape, line, and hot towel', '🧔'], ['Hot Shave', 'The traditional straight-razor experience', '🪒']] },
  beauty: { brand: 'Lumière Salon & Spa', hero: ['Where You Glow', 'Hair, skin, and self-care in a serene setting'],
    services: [['Hair Styling', 'Cut, color, and treatments', '💇'], ['Facials', 'Radiance-restoring skincare', '✨'], ['Massage', 'Unwind and reset', '💆']] },
  dental: { brand: 'Bright Smile Dental', hero: ['Brighter Smiles Ahead', 'Gentle, expert dental care for the whole family'],
    services: [['Checkups & Cleanings', 'Healthy teeth, every visit', '🦷'], ['Teeth Whitening', 'A brighter smile in one session', '😁'], ['Cosmetic Dentistry', 'Veneers, implants, and more', '✨']] },
  health: { brand: 'Vitality Health Clinic', hero: ['Care That Puts You First', 'Compassionate, whole-person healthcare'],
    services: [['Primary Care', 'Your health home base', '🩺'], ['Wellness Visits', 'Preventive, proactive care', '💚'], ['Telehealth', 'Quality care from anywhere', '📱']] },
  finance: { brand: 'Summit Wealth & Tax', hero: ['Your Money, Working Smarter', 'Accounting, tax, and planning you can trust'],
    services: [['Tax Preparation', 'Maximize returns, minimize stress', '📊'], ['Bookkeeping', 'Clean books, clear decisions', '📒'], ['Financial Planning', 'A roadmap to your goals', '📈']] },
  legal: { brand: 'Hartwell & Associates', hero: ['Trusted Counsel When It Matters', 'Experienced advocates on your side'],
    services: [['Business Law', 'Protect and grow your company', '⚖️'], ['Estate Planning', 'Secure your legacy', '📜'], ['Litigation', 'Decisive representation', '🏛️']] },
  realestate: { brand: 'Hearthstone Realty', hero: ['Elevate Your Home', 'Expert guidance for buying, selling, and valuing property'],
    services: [['Buying', 'Find the one', '🔑'], ['Selling', 'Sell for more, faster', '🏡'], ['Valuation', 'Know what your home is worth', '📐']] },
  construction: { brand: 'Apex Builders', hero: ['Built to Last', 'Construction and remodeling done right the first time'],
    services: [['New Construction', 'From foundation to finish', '🏗️'], ['Remodeling', 'Transform your space', '🔨'], ['Roofing', 'Protect what matters', '🧱']] },
  home: { brand: 'Reliable Home Services', hero: ['Your Home, In Good Hands', 'Fast, friendly, get-it-done service'],
    services: [['Plumbing', 'Leaks, installs, and repairs', '🔧'], ['Electrical', 'Safe, certified work', '💡'], ['HVAC', 'Comfortable all year', '❄️']] },
  automotive: { brand: 'Apex Auto Garage', hero: ['Precision Service, Every Mile', 'Expert repair and maintenance you can rely on'],
    services: [['Repair', 'Diagnostics to fixes', '🔧'], ['Maintenance', 'Keep it running right', '🛢️'], ['Detailing', 'Showroom shine', '✨']] },
  pet: { brand: 'Happy Tails Pet Co.', hero: ['Tails Wag Here', 'Grooming, daycare, and lots of love for your best friend'],
    services: [['Grooming', 'Fresh, fluffy, and happy', '🛁'], ['Daycare', 'Play all day', '🦴'], ['Boarding', 'A home away from home', '🏠']] },
  travel: { brand: 'Wanderlust Travel Co.', hero: ['Your Next Adventure Awaits', 'Handcrafted trips to unforgettable places'],
    services: [['Custom Itineraries', 'Tailored to your dreams', '🗺️'], ['Guided Tours', 'Local experts, real experiences', '🧭'], ['Getaways', 'Escape, refresh, return', '🏝️']] },
  events: { brand: 'Eternal Vows Events', hero: ['Moments Worth Celebrating', 'Weddings and events, beautifully planned'],
    services: [['Wedding Planning', 'Your perfect day, handled', '💍'], ['Corporate Events', 'Polished and memorable', '🥂'], ['Venue Styling', 'Spaces that wow', '🎀']] },
  education: { brand: 'Bright Minds Academy', hero: ['Where Curiosity Grows', 'Tutoring and courses that build confidence'],
    services: [['Tutoring', 'Personalized one-on-one help', '📚'], ['Courses', 'Structured learning paths', '🎓'], ['Test Prep', 'Ready for the big day', '✏️']] },
  nonprofit: { brand: 'Hope Forward Foundation', hero: ['Together, We Do More', 'Join us in making a real difference'],
    services: [['Our Programs', 'Impact where it counts', '🤝'], ['Volunteer', 'Lend your time and talent', '🙌'], ['Donate', 'Fuel the mission', '❤️']] },
  photography: { brand: 'Aperture & Light', hero: ['Capture Life’s Moments', 'Portraits, weddings, and events, beautifully shot'],
    services: [['Portraits', 'You, at your best', '📷'], ['Weddings', 'Every moment, remembered', '💞'], ['Events', 'The story of the day', '🎉']] },
  creative: { brand: 'Studio North', hero: ['Ideas Worth Seeing', 'Branding, design, and digital that moves people'],
    services: [['Branding', 'Identity that resonates', '🎨'], ['Web Design', 'Sites that convert', '🖥️'], ['Campaigns', 'Stories that spread', '🚀']] },
  retail: { brand: 'Maison Boutique', hero: ['Curated for You', 'Thoughtfully sourced pieces you’ll love'],
    services: [['New Arrivals', 'Fresh finds weekly', '🛍️'], ['Personal Styling', 'Looks made for you', '👗'], ['Gift Guide', 'The perfect pick', '🎁']] },
  tech: { brand: 'Nimbus', hero: ['Software That Just Works', 'Ship faster with a platform built for teams'],
    services: [['Platform', 'Everything in one place', '☁️'], ['Integrations', 'Connect your stack', '🔌'], ['Analytics', 'Decisions backed by data', '📊']] },
  general: { brand: 'Acme Co.', hero: ['Welcome to Acme', 'Quality service you can count on'],
    services: [['Service One', 'What we do best', '⭐'], ['Service Two', 'Reliable and proven', '✅'], ['Service Three', 'Built around you', '🤝']] },
};

function profileFor(theme) {
  const industry = (theme.industries && theme.industries[0]) || 'general';
  return { industry, ...(PROFILES[industry] || PROFILES.general) };
}

let _sid = 0;
function section(type, html_template, content, order) {
  return {
    id: ++_sid,
    section_type: type,
    html_template: html_template || 'default',
    section_order: order,
    is_visible: 1,
    content_json: JSON.stringify(content || {}),
  };
}

/** Build the canned section list for a template (variants pulled from the theme). */
function demoSections(theme) {
  const p = profileFor(theme);
  const v = theme.variants || {};
  const photo = (i) => PHOTOS[i % PHOTOS.length];
  const services = (p.services || []).map(([title, description, icon]) => ({ title, name: title, description, icon }));
  const out = [];
  let order = 0;

  out.push(section('header', 'navbar', { brand: p.brand }, order++));
  out.push(section('hero', v.hero, {
    heading: p.hero[0], subheading: p.hero[1], cta_text: 'Get Started', cta_link: '#contact',
    background_image: photo(0), image_url: photo(1),
  }, order++));
  out.push(section('about', v.about, {
    heading: 'About Us', subheading: `Why ${p.brand}`,
    content: `At ${p.brand}, we combine craft, care, and consistency to deliver an experience our customers come back for. Get to know what makes us different.`,
    image_url: photo(2),
    features: ['Trusted by the community', 'Experienced, friendly team', 'Quality you can feel'],
  }, order++));
  out.push(section('services', v.services, {
    heading: 'What We Offer', subheading: 'Services tailored to you', description: 'Services tailored to you', services,
  }, order++));
  if (v.features) {
    out.push(section('features', v.features, {
      heading: 'Why Choose Us', description: 'What sets us apart',
      features: [
        { title: 'Proven Results', description: 'A track record you can trust', icon: '🏆' },
        { title: 'Fair Pricing', description: 'Clear quotes, no surprises', icon: '💲' },
        { title: 'On Your Schedule', description: 'Flexible, on-time service', icon: '⏱️' },
        { title: 'Satisfaction First', description: 'We’re not done until you’re happy', icon: '😊' },
      ],
    }, order++));
  }
  out.push(section('gallery', v.gallery, {
    heading: 'Our Work', description: 'A look at what we do',
    images: [3, 4, 5, 6, 7, 0].map((i, n) => ({ url: photo(i), alt: `${p.brand} ${n + 1}`, caption: '' })),
  }, order++));
  out.push(section('testimonials', v.testimonials, { heading: 'What Our Customers Say' }, order++));
  if (v.cta) {
    out.push(section('cta', v.cta, {
      heading: 'Ready to get started?', description: `Reach out to ${p.brand} today — we’d love to help.`, cta_text: 'Contact Us', cta_url: '#contact',
    }, order++));
  }
  out.push(section('contact', v.contact, {
    heading: 'Get in Touch', subheading: 'We’d love to hear from you',
    phone: '(555) 012-3456', email: `hello@${p.brand.toLowerCase().replace(/[^a-z]+/g, '')}.com`, address: '123 Main Street, Your City',
  }, order++));
  out.push(section('footer', v.footer, { brand: p.brand, business_name: p.brand }, order++));
  return out;
}

/** Build a render config from the template (colors + fonts + token/dark key). */
function demoConfig(theme) {
  const p = profileFor(theme);
  const pal = paletteFor(p.industry);
  const colors = theme.colors || pal;
  return {
    business_name: p.brand,
    primary_color: colors.primary || pal.primary,
    secondary_color: colors.secondary || pal.secondary,
    accent_color: pal.accent,
    font_heading: theme.fonts.heading,
    font_body: theme.fonts.body,
    style_theme: theme.key, // drives tokens + dark surface in buildHTMLDocument
  };
}

/**
 * Render a full live demo page for a template key.
 * @param {string} themeKey
 * @param {object} [opts] - { lang, embed, appOrigin }
 * @returns {string|null} Full HTML document, or null if the key is unknown.
 */
export function renderTemplateDemo(themeKey, opts = {}) {
  const theme = getTheme(themeKey);
  if (!theme || theme.key !== themeKey) return null; // getTheme falls back; reject unknown keys
  _sid = 0;
  const sections = demoSections(theme);
  const config = demoConfig(theme);
  const project = { project_id: `demo-${theme.key}`, project_name: profileFor(theme).brand };
  return assemblePage(sections, config, project, {
    preordered: true,
    embed: !!opts.embed,
    hideBadge: true,
    lang: opts.lang || 'en',
    appOrigin: opts.appOrigin || '',
  });
}

/** All demo-able templates with the metadata the showcase grid needs. */
export function demoTemplates() {
  return listThemes().map((t) => {
    const p = profileFor(t);
    const pal = paletteFor(p.industry);
    const colors = t.colors || pal;
    return {
      key: t.key,
      label: t.label,
      description: t.description,
      industry: p.industry,
      style: t.style || 'modern',
      dark: t.mode === 'dark',
      fonts: t.fonts,
      tokens: t.tokens,
      accent: t.accent,
      colors: { primary: colors.primary || pal.primary, secondary: colors.secondary || pal.secondary, accent: pal.accent },
    };
  });
}
