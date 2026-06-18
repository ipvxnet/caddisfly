// Localized default section titles.
//
// New sections are created with empty content (`content_json: '{}'`), so the
// template renders its built-in defaults until the user edits. Those defaults
// were hardcoded in English, which made a freshly-added section show e.g.
// "Gallery" on a Portuguese site. `sectionDefault()` returns a heading/subhead
// in the site's language instead. Templates call it as the fallback for an
// empty `data.heading` / `data.subheading`.

const DEFAULTS = {
  en: {
    hero: ['Welcome', 'Your business tagline'],
    about: ['About Us', 'Our Story'],
    services: ['Our Services', 'What we offer'],
    features: ['Why Choose Us', 'What sets us apart'],
    gallery: ['Gallery', 'Our Work'],
    testimonials: ['What Our Customers Say', ''],
    pricing: ['Pricing', 'Simple, honest pricing'],
    stats: ['By the Numbers', ''],
    cta: ['Ready to get started?', ''],
    contact: ['Get in Touch', 'We’d love to hear from you'],
  },
  es: {
    hero: ['Bienvenido', 'El eslogan de tu negocio'],
    about: ['Sobre Nosotros', 'Nuestra Historia'],
    services: ['Nuestros Servicios', 'Lo que ofrecemos'],
    features: ['Por Qué Elegirnos', 'Lo que nos distingue'],
    gallery: ['Galería', 'Nuestro Trabajo'],
    testimonials: ['Lo Que Dicen Nuestros Clientes', ''],
    pricing: ['Precios', 'Precios simples y honestos'],
    stats: ['En Números', ''],
    cta: ['¿Listo para empezar?', ''],
    contact: ['Contáctanos', 'Nos encantaría saber de ti'],
  },
  pt: {
    hero: ['Bem-vindo', 'O slogan do seu negócio'],
    about: ['Sobre Nós', 'Nossa História'],
    services: ['Nossos Serviços', 'O que oferecemos'],
    features: ['Por Que Nos Escolher', 'O que nos diferencia'],
    gallery: ['Galeria', 'Nosso Trabalho'],
    testimonials: ['O Que Dizem Nossos Clientes', ''],
    pricing: ['Preços', 'Preços simples e honestos'],
    stats: ['Em Números', ''],
    cta: ['Pronto para começar?', ''],
    contact: ['Fale Conosco', 'Adoraríamos ouvir você'],
  },
};

/**
 * Localized default title for a section type.
 * @param {string} lang - 'en' | 'es' | 'pt'
 * @param {string} type - section type (gallery, about, …)
 * @param {number} [idx] - 0 = heading, 1 = subheading
 * @returns {string}
 */
export function sectionDefault(lang, type, idx = 0) {
  const set = DEFAULTS[lang] || DEFAULTS.en;
  const pair = set[type] || DEFAULTS.en[type];
  return (pair && pair[idx]) || '';
}
