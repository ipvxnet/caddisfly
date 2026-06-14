/**
 * Deterministic multi-page blueprint.
 *
 * Given the ordered list of section types a site will have, decide which pages
 * to create and which page each body section belongs to. Deterministic (no LLM)
 * for reliability. header/footer are site-level (not assigned to a page).
 *
 * Thin sites collapse to a single Home page so they look exactly like today.
 */

// Ordered page definitions; a page is created only if ≥1 of its types is present
// (Home is always created). Order here = nav order (home first).
const PAGE_DEFS = [
  { slug: 'home', title: 'Home', nav_label: 'Home', types: ['hero', 'cta', 'stats'] },
  { slug: 'about', title: 'About', nav_label: 'About', types: ['about', 'testimonials'] },
  { slug: 'services', title: 'Services', nav_label: 'Services', types: ['services', 'features', 'pricing'] },
  { slug: 'gallery', title: 'Gallery', nav_label: 'Gallery', types: ['gallery'] },
  { slug: 'contact', title: 'Contact', nav_label: 'Contact', types: ['contact'] },
];

const SITE_LEVEL = new Set(['header', 'footer']);
const COLLAPSE_THRESHOLD = 3; // ≤3 body sections → single Home page

// Localized page names (slugs stay English — they're URLs/anchors). nav_label +
// title use these so the generated site's menu is in the site's language.
const PAGE_NAMES = {
  en: { home: 'Home', about: 'About', services: 'Services', gallery: 'Gallery', contact: 'Contact' },
  es: { home: 'Inicio', about: 'Acerca de', services: 'Servicios', gallery: 'Galería', contact: 'Contacto' },
  pt: { home: 'Início', about: 'Sobre', services: 'Serviços', gallery: 'Galeria', contact: 'Contato' },
};

/**
 * @param {string[]} sectionTypes - section types in generation order
 * @param {string} lang - site language (localizes nav_label/title)
 * @returns {{ pages: Array<{slug,title,nav_label,order,is_home}>, assign: (type:string)=>string }}
 *   `assign(type)` → the page slug for a body section type ('home' fallback).
 */
export function planPages(sectionTypes, lang = 'en') {
  const names = PAGE_NAMES[lang] || PAGE_NAMES.en;
  const bodyTypes = (sectionTypes || []).filter((t) => !SITE_LEVEL.has(t));

  const typeToSlug = {};
  for (const def of PAGE_DEFS) for (const t of def.types) typeToSlug[t] = def.slug;
  const slugOf = (t) => typeToSlug[t] || 'home';

  // Single-page by default: every body section lives on Home with anchor-scroll
  // nav. This gives small-business sites a rich, mobile-friendly scrolling home
  // (like a classic one-pager) instead of a hero-only landing behind a
  // hamburger. The multi-page logic below is retained for potential future use.
  const SINGLE_PAGE = true;
  const distinctSlugs = new Set(bodyTypes.map(slugOf));
  if (SINGLE_PAGE || bodyTypes.length <= COLLAPSE_THRESHOLD || distinctSlugs.size <= 1) {
    return {
      pages: [{ slug: 'home', title: names.home, nav_label: names.home, order: 0, is_home: 1 }],
      assign: () => 'home',
    };
  }

  const pages = [];
  let order = 0;
  for (const def of PAGE_DEFS) {
    const present = def.types.some((t) => bodyTypes.includes(t));
    if (def.slug === 'home' || present) {
      pages.push({
        slug: def.slug,
        title: names[def.slug] || def.title,
        nav_label: names[def.slug] || def.nav_label,
        order: order++,
        is_home: def.slug === 'home' ? 1 : 0,
      });
    }
  }
  const pageSlugs = new Set(pages.map((p) => p.slug));
  const assign = (t) => {
    const s = slugOf(t);
    return pageSlugs.has(s) ? s : 'home';
  };
  return { pages, assign };
}

export function isSiteLevel(sectionType) {
  return SITE_LEVEL.has(sectionType);
}
