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

/**
 * @param {string[]} sectionTypes - section types in generation order
 * @returns {{ pages: Array<{slug,title,nav_label,order,is_home}>, assign: (type:string)=>string }}
 *   `assign(type)` → the page slug for a body section type ('home' fallback).
 */
export function planPages(sectionTypes) {
  const bodyTypes = (sectionTypes || []).filter((t) => !SITE_LEVEL.has(t));

  const typeToSlug = {};
  for (const def of PAGE_DEFS) for (const t of def.types) typeToSlug[t] = def.slug;
  const slugOf = (t) => typeToSlug[t] || 'home';

  // Collapse thin sites (or sites that would only fill Home) to a single page.
  const distinctSlugs = new Set(bodyTypes.map(slugOf));
  if (bodyTypes.length <= COLLAPSE_THRESHOLD || distinctSlugs.size <= 1) {
    return {
      pages: [{ slug: 'home', title: 'Home', nav_label: 'Home', order: 0, is_home: 1 }],
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
        title: def.title,
        nav_label: def.nav_label,
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
