// Plugin manifest — the single in-code registry of paid feature-module "plugins".
// Adding a plugin later = add an entry here + its module + a Stripe price secret.
// The platform iterates these generically (marketplace, gating, webhook sync).
// See PLUGIN_PLATFORM_DESIGN.md.

/**
 * @typedef {Object} PluginDef
 * @property {string} key           Stable id, also the account_plugins.plugin_key value.
 * @property {string} label         Display name.
 * @property {string} summary       One-line marketplace description.
 * @property {number} priceCents    Display price (actual charge is the Stripe price).
 * @property {string} priceVar      env var holding the Stripe monthly add-on price id.
 * @property {string[]} sectionTypes Registry section types this plugin gates (may be []).
 */

/** @type {Record<string, PluginDef>} */
export const PLUGINS = {
  catalogue: {
    key: 'catalogue',
    label: 'Catalogue',
    summary: 'Rich product/service catalogues — categories, gallery, video, PDFs and optional buy.',
    priceCents: 500,
    priceVar: 'STRIPE_PRICE_PLUGIN_CATALOGUE',
    sectionTypes: ['catalogue'],
  },
  crm: {
    key: 'crm',
    label: 'CRM',
    summary: 'Everyone who contacts, books, or buys — leads, pipeline and notes in one place.',
    priceCents: 500,
    priceVar: 'STRIPE_PRICE_PLUGIN_CRM',
    sectionTypes: [], // CRM is a manager/admin tool, not a site section
  },
  advanced_store: {
    key: 'advanced_store',
    label: 'Advanced Store',
    summary: 'Inventory tracking, low-stock alerts and discount codes for your shop.',
    priceCents: 500,
    priceVar: 'STRIPE_PRICE_PLUGIN_ADVANCED_STORE',
    sectionTypes: [], // upgrades the existing store; no new section
  },
  courses: {
    key: 'courses',
    label: 'Courses',
    summary: 'Sell and share online courses — AI-built lessons, videos, PDFs and quizzes on your site.',
    priceCents: 500,
    priceVar: 'STRIPE_PRICE_PLUGIN_COURSES',
    sectionTypes: ['courses'],
  },
  // Future (see PLUGIN_PLATFORM_DESIGN.md §11A): members.
};

/**
 * Bundles — a single Stripe price that grants several plugins at a discount.
 * @type {Record<string, {key: string, label: string, plugins: string[], priceVar: string}>}
 */
export const BUNDLES = {
  all_access: {
    key: 'all_access',
    label: 'All-Access',
    summary: 'Every plugin — Catalogue, CRM and Advanced Store — bundled at one price.',
    plugins: ['catalogue', 'crm', 'advanced_store'],
    priceCents: 1000, // vs $15 separately — saves $5/mo
    priceVar: 'STRIPE_PRICE_BUNDLE_ALL',
  },
};

// Localized label + summary per plugin/bundle key (en falls back to the manifest
// `label`/`summary` above). Used by the marketplace + transfer requirement list.
const PLUGIN_I18N = {
  es: {
    catalogue: { label: 'Catálogo', summary: 'Catálogos ricos de productos/servicios — categorías, galería, video, PDFs y compra opcional.' },
    crm: { label: 'CRM', summary: 'Toda persona que contacte, reserve o compre — leads, pipeline y notas en un solo lugar.' },
    advanced_store: { label: 'Tienda avanzada', summary: 'Seguimiento de inventario, alertas de stock bajo y códigos de descuento para tu tienda.' },
    courses: { label: 'Cursos', summary: 'Vende y comparte cursos en línea — lecciones, videos, PDFs y cuestionarios creados con IA en tu sitio.' },
    all_access: { label: 'Acceso total', summary: 'Todos los plugins — Catálogo, CRM y Tienda avanzada — en un solo precio.' },
  },
  pt: {
    catalogue: { label: 'Catálogo', summary: 'Catálogos ricos de produtos/serviços — categorias, galeria, vídeo, PDFs e compra opcional.' },
    crm: { label: 'CRM', summary: 'Todo mundo que entra em contato, reserva ou compra — leads, pipeline e notas em um único lugar.' },
    advanced_store: { label: 'Loja avançada', summary: 'Rastreamento de estoque, alertas de estoque baixo e códigos de desconto para sua loja.' },
    courses: { label: 'Cursos', summary: 'Venda e compartilhe cursos online — aulas, vídeos, PDFs e quizzes criados com IA no seu site.' },
    all_access: { label: 'Acesso total', summary: 'Todos os plugins — Catálogo, CRM e Loja avançada — em um único preço.' },
  },
};

/** Localized display label for a plugin/bundle key (falls back to English). */
export function pluginLabel(key, lang = 'en') {
  const loc = PLUGIN_I18N[lang] && PLUGIN_I18N[lang][key];
  return (loc && loc.label) || (PLUGINS[key] || BUNDLES[key] || {}).label || key;
}
/** Localized one-line summary for a plugin/bundle key (falls back to English). */
export function pluginSummary(key, lang = 'en') {
  const loc = PLUGIN_I18N[lang] && PLUGIN_I18N[lang][key];
  return (loc && loc.summary) || (PLUGINS[key] || BUNDLES[key] || {}).summary || '';
}

/** All known plugin keys. */
export const PLUGIN_KEYS = Object.keys(PLUGINS);

/** Look up the plugin whose manifest declares a given section type. */
export function pluginForSectionType(sectionType) {
  return Object.values(PLUGINS).find((p) => p.sectionTypes.includes(sectionType)) || null;
}

/** Resolve a Stripe price id (from env) → plugin key, for webhook sync. */
export function pluginKeyForPriceId(env, priceId) {
  if (!priceId) return null;
  for (const p of Object.values(PLUGINS)) {
    if (env[p.priceVar] && env[p.priceVar] === priceId) return p.key;
  }
  return null;
}

/** Resolve a Stripe price id (from env) → bundle key, for webhook sync. */
export function bundleKeyForPriceId(env, priceId) {
  if (!priceId) return null;
  for (const b of Object.values(BUNDLES)) {
    if (env[b.priceVar] && env[b.priceVar] === priceId) return b.key;
  }
  return null;
}

/**
 * Price id → entitlement key: a plugin key OR a bundle key. The webhook stores
 * a bundle as one account_plugins row (plugin_key = the bundle key); hasPlugin
 * expands that to the bundle's member plugins via bundlesIncluding().
 */
export function entitlementKeyForPriceId(env, priceId) {
  return pluginKeyForPriceId(env, priceId) || bundleKeyForPriceId(env, priceId);
}

/** Bundles whose plugin list includes `pluginKey` (so a bundle entitles it). */
export function bundlesIncluding(pluginKey) {
  return Object.values(BUNDLES).filter((b) => b.plugins.includes(pluginKey));
}
