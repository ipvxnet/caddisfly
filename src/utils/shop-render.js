// Shop rendering glue: products rows -> SYNTHETIC section objects that flow
// through the normal assemblePage pipeline (header + synthetic body + footer).
// Used by deploy.js (baking static R2 copies) and the /ai-preview shop routes.
// Mirrors blog-render.js.

import { mdLiteToHtml } from './md-lite.js';
import { t } from '../i18n/index.js';

/** Synthetic nav entry so the navbar shows a Shop link (slug drives the href). */
export function shopNavPage(lang = 'en') {
  return { slug: 'shop', title: t(lang, 'shopw.nav_title'), is_visible: 1, is_home: 0 };
}

/** First ~line of a product description as a card excerpt (plain text). */
function productExcerpt(description, max = 120) {
  const text = String(description || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s\S*$/, '')}…`;
}

/** Synthetic shop_list section for the shop index page. */
export function shopListSection(products, base, currency, lang = 'en') {
  const data = {
    heading: t(lang, 'shopw.list_heading'),
    base,
    currency,
    products: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price_cents: p.price_cents,
      image: p.image || '',
      excerpt: productExcerpt(p.description),
    })),
  };
  return {
    section_type: 'shop_list',
    html_template: 'default',
    content_json: JSON.stringify(data),
    is_visible: 1,
    id: null,
    section_order: 1,
  };
}

/** Synthetic shop_product section for one product page. */
export function shopProductSection(product, base, currency) {
  const data = {
    base,
    currency,
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price_cents: product.price_cents,
      image: product.image || '',
      description_html: mdLiteToHtml(product.description || ''),
    },
  };
  return {
    section_type: 'shop_product',
    html_template: 'default',
    content_json: JSON.stringify(data),
    is_visible: 1,
    id: null,
    section_order: 1,
  };
}
