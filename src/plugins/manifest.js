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
  instagram_feed: {
    key: 'instagram_feed',
    label: 'Instagram Feed',
    summary: "A \"What's happening\" section that shows your latest Instagram posts, refreshed automatically.",
    priceCents: 0,        // FREE plugin — opt-in from the store, no charge, no base plan needed
    free: true,
    priceVar: 'STRIPE_PRICE_PLUGIN_INSTAGRAM_FEED', // unused for free; kept for history
    sectionTypes: ['instagram_feed'],
  },
  members: {
    key: 'members',
    label: 'Members',
    summary: 'Let visitors sign in to your site (passwordless) and keep pages or sections members-only.',
    priceCents: 500,
    priceVar: 'STRIPE_PRICE_PLUGIN_MEMBERS',
    sectionTypes: ['members'],
  },
};

/**
 * Bundles — a single Stripe price that grants several plugins at a discount.
 * Vertical bundles ($10/mo, 3 plugins → save $5) target a buyer type; the
 * `everything` bundle ($20/mo) grants ALL plugins, current AND future
 * (`plugins: 'all'` sentinel — resolved by bundlePluginKeys). À la carte stays
 * $5/plugin. `bestFor` drives the "Best for…" recommendation copy on /plugins.
 * @type {Record<string, {key: string, label: string, plugins: string[]|'all', priceVar: string}>}
 */
export const BUNDLES = {
  commerce: {
    key: 'commerce',
    label: 'Commerce',
    summary: 'Everything to sell online — a rich catalogue plus inventory, discounts and variants, and a customer CRM.',
    bestFor: 'Online stores, retail & boutiques',
    plugins: ['catalogue', 'advanced_store', 'crm'],
    priceCents: 1000, // vs $15 separately — saves $5/mo
    priceVar: 'STRIPE_PRICE_BUNDLE_COMMERCE',
  },
  creators: {
    key: 'creators',
    label: 'Creators & Coaches',
    summary: 'Sell online courses, keep members-only content behind a login, and showcase your latest Instagram posts.',
    bestFor: 'Coaches, fitness & yoga, educators, membership sites',
    plugins: ['courses', 'members', 'instagram_feed'],
    priceCents: 1000,
    priceVar: 'STRIPE_PRICE_BUNDLE_CREATORS',
  },
  local_pro: {
    key: 'local_pro',
    label: 'Local Pro',
    summary: 'Capture and manage leads with a CRM and show a service menu or portfolio — plus the free Instagram feed.',
    bestFor: 'Salons, barbershops, dentists, contractors, photographers',
    plugins: ['crm', 'catalogue'], // Instagram is now a FREE plugin (not bundled/charged)
    priceCents: 800, // vs $10 separately — saves $2/mo
    priceVar: 'STRIPE_PRICE_BUNDLE_LOCAL_PRO',
  },
  everything: {
    key: 'everything',
    label: 'Everything',
    summary: 'Every plugin we offer — now and everything we add in the future — at one price.',
    bestFor: 'Power users who want it all',
    plugins: 'all', // sentinel → all current + future plugin keys (bundlePluginKeys)
    priceCents: 2000, // vs $30 separately — saves $10/mo
    priceVar: 'STRIPE_PRICE_BUNDLE_EVERYTHING',
  },
};

/** Resolve a bundle's member plugin keys — expands the 'all' sentinel to every
 *  current plugin (so the Everything bundle auto-includes future plugins). */
export function bundlePluginKeys(bundle) {
  if (!bundle) return [];
  return bundle.plugins === 'all' ? Object.keys(PLUGINS) : (bundle.plugins || []);
}

/** Is this a FREE plugin (opt-in from the store, no charge, no base plan)? */
export function isFreePlugin(key) {
  return !!(PLUGINS[key] && PLUGINS[key].free);
}

// Localized label + summary per plugin/bundle key (en falls back to the manifest
// `label`/`summary` above). Used by the marketplace + transfer requirement list.
const PLUGIN_I18N = {
  es: {
    catalogue: { label: 'Catálogo', summary: 'Catálogos ricos de productos/servicios — categorías, galería, video, PDFs y compra opcional.' },
    crm: { label: 'CRM', summary: 'Toda persona que contacte, reserve o compre — leads, pipeline y notas en un solo lugar.' },
    advanced_store: { label: 'Tienda avanzada', summary: 'Seguimiento de inventario, alertas de stock bajo y códigos de descuento para tu tienda.' },
    courses: { label: 'Cursos', summary: 'Vende y comparte cursos en línea — lecciones, videos, PDFs y cuestionarios creados con IA en tu sitio.' },
    instagram_feed: { label: 'Feed de Instagram', summary: 'Una sección «Lo último» que muestra tus publicaciones más recientes de Instagram, actualizadas automáticamente.' },
    members: { label: 'Miembros', summary: 'Permite que los visitantes inicien sesión en tu sitio (sin contraseña) y reserva páginas o secciones solo para miembros.' },
    commerce: { label: 'Commerce', summary: 'Todo para vender en línea — un catálogo completo más inventario, descuentos y variantes, y un CRM de clientes.', bestFor: 'Tiendas en línea, retail y boutiques' },
    creators: { label: 'Creadores y Coaches', summary: 'Vende cursos en línea, mantén contenido exclusivo tras inicio de sesión y muestra tus últimas publicaciones de Instagram.', bestFor: 'Coaches, fitness y yoga, educadores, sitios de membresía' },
    local_pro: { label: 'Local Pro', summary: 'Capta y gestiona leads con un CRM, muestra un menú de servicios o portafolio, y mantén tu feed de Instagram al día.', bestFor: 'Salones, barberías, dentistas, contratistas, fotógrafos' },
    everything: { label: 'Todo Incluido', summary: 'Todos los plugins que ofrecemos — ahora y todo lo que agreguemos en el futuro — a un solo precio.', bestFor: 'Usuarios avanzados que lo quieren todo' },
  },
  pt: {
    catalogue: { label: 'Catálogo', summary: 'Catálogos ricos de produtos/serviços — categorias, galeria, vídeo, PDFs e compra opcional.' },
    crm: { label: 'CRM', summary: 'Todo mundo que entra em contato, reserva ou compra — leads, pipeline e notas em um único lugar.' },
    advanced_store: { label: 'Loja avançada', summary: 'Rastreamento de estoque, alertas de estoque baixo e códigos de desconto para sua loja.' },
    courses: { label: 'Cursos', summary: 'Venda e compartilhe cursos online — aulas, vídeos, PDFs e quizzes criados com IA no seu site.' },
    instagram_feed: { label: 'Feed do Instagram', summary: 'Uma seção «O que há de novo» que mostra suas publicações mais recentes do Instagram, atualizadas automaticamente.' },
    members: { label: 'Membros', summary: 'Permita que visitantes entrem no seu site (sem senha) e mantenha páginas ou seções exclusivas para membros.' },
    commerce: { label: 'Commerce', summary: 'Tudo para vender online — um catálogo completo mais estoque, descontos e variações, e um CRM de clientes.', bestFor: 'Lojas online, varejo e boutiques' },
    creators: { label: 'Criadores e Coaches', summary: 'Venda cursos online, mantenha conteúdo exclusivo atrás de login e exiba suas publicações mais recentes do Instagram.', bestFor: 'Coaches, fitness e yoga, educadores, sites de assinatura' },
    local_pro: { label: 'Local Pro', summary: 'Capte e gerencie leads com um CRM, mostre um menu de serviços ou portfólio, e mantenha seu feed do Instagram atualizado.', bestFor: 'Salões, barbearias, dentistas, prestadores, fotógrafos' },
    everything: { label: 'Tudo Incluído', summary: 'Todos os plugins que oferecemos — agora e tudo que adicionarmos no futuro — a um único preço.', bestFor: 'Usuários avançados que querem tudo' },
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

/** Localized "Best for…" audience line for a bundle key (falls back to English). */
export function bundleBestFor(key, lang = 'en') {
  const loc = PLUGIN_I18N[lang] && PLUGIN_I18N[lang][key];
  return (loc && loc.bestFor) || (BUNDLES[key] || {}).bestFor || '';
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
  return Object.values(BUNDLES).filter((b) => bundlePluginKeys(b).includes(pluginKey));
}
