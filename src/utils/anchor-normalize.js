// Anchor normalization shared by the page assembler (render-time link fix) and
// the link picker (editor). In-page section scroll targets are emitted as
// `id="<english_type>"` (e.g. id="contact"). AI-generated button links, however,
// sometimes store the LOCALIZED, capitalized heading as the anchor (e.g.
// `#Contato`, `#Serviços`) — which never resolves on the live site and falsely
// trips the editor's "no longer exists" warning. canonicalAnchor()/
// rewriteLocalizedAnchors() map those back to the real `#<type>` target.

// Localized single-page section nav labels, shared with the assembler's nav
// builder. type -> localized label.
export const SECTION_NAV_LABELS = {
  en: { hero: 'Home', about: 'About', services: 'Services', features: 'Features', gallery: 'Gallery', testimonials: 'Reviews', pricing: 'Pricing', contact: 'Contact' },
  es: { hero: 'Inicio', about: 'Acerca de', services: 'Servicios', features: 'Características', gallery: 'Galería', testimonials: 'Opiniones', pricing: 'Precios', contact: 'Contacto' },
  pt: { hero: 'Início', about: 'Sobre', services: 'Serviços', features: 'Recursos', gallery: 'Galeria', testimonials: 'Avaliações', pricing: 'Preços', contact: 'Contato' },
};

// Lowercase + trim + strip diacritics, so "Contato"/"contato"/"CONTATO" and
// "Serviços"/"servicos" all collapse to one key.
function strip(s) {
  return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// normalized alias (english type OR any-language localized label) -> '#type'
const ANCHOR_ALIASES = (() => {
  const m = {};
  for (const lang of Object.keys(SECTION_NAV_LABELS)) {
    const labels = SECTION_NAV_LABELS[lang];
    for (const type of Object.keys(labels)) {
      m[strip(type)] = `#${type}`;
      m[strip(labels[type])] = `#${type}`;
    }
  }
  return m;
})();

/**
 * Map a raw `#...` anchor to its canonical `#<type>` when it names a known
 * section (case/accent-insensitive, localized labels included). Non-section
 * anchors (page slugs, `#top`, external links) are returned unchanged.
 * @param {string} href
 * @returns {string}
 */
export function canonicalAnchor(href) {
  if (typeof href !== 'string' || href.charAt(0) !== '#' || href === '#top') return href;
  return ANCHOR_ALIASES[strip(href.slice(1))] || href;
}

/**
 * Rewrite localized / mis-cased in-page section anchors in rendered HTML so
 * links like `href="#Contato"` resolve to the real `id="contact"` target.
 * Run AFTER cross-page anchor routing so multi-page page-slug links (already
 * converted to routes) are left untouched.
 * @param {string} html
 * @returns {string}
 */
export function rewriteLocalizedAnchors(html) {
  return String(html).replace(/href="#([^"]+)"/g, (match, raw) => {
    const canon = canonicalAnchor(`#${raw}`);
    return canon === `#${raw}` ? match : `href="${canon}"`;
  });
}
