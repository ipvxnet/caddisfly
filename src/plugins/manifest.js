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
  // Future (see PLUGIN_PLATFORM_DESIGN.md §11A): advanced_store, members.
};

/**
 * Bundles — a single Stripe price that grants several plugins at a discount.
 * @type {Record<string, {key: string, label: string, plugins: string[], priceVar: string}>}
 */
export const BUNDLES = {
  // all_access: { key: 'all_access', label: 'All-Access', plugins: ['catalogue','crm','advanced_store'], priceVar: 'STRIPE_PRICE_BUNDLE_ALL' },
};

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
