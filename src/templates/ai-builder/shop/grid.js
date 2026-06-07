// Shop index — product card grid. Rendered from SYNTHETIC section data built
// at deploy/preview time (products are rows in `products`, not ai_sections).
// data: { heading, products: [{id,slug,name,price_cents,image,excerpt}],
// base, currency } where base is the link root (previewBase-aware).

import { t } from '../../../i18n/index.js';
import { cartScript } from './cart-js.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(cents, currency, lang) {
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function shopGridTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const products = Array.isArray(data.products) ? data.products : [];
  const base = data.base || '';
  const currency = data.currency || 'usd';
  const heading = data.heading || t(lang, 'shopw.list_heading');

  const cards = products
    .map(
      (p) => `
    <div class="shop-card">
      <a class="shop-card-link" href="${esc(`${base}/shop/${p.slug}`)}">
        ${p.image ? `<div class="shop-card-img" style="background-image:url('${esc(p.image)}')"></div>` : '<div class="shop-card-img shop-card-img-empty"></div>'}
        <div class="shop-card-body">
          <h3>${esc(p.name)}</h3>
          ${p.excerpt ? `<p class="shop-card-excerpt">${esc(p.excerpt)}</p>` : ''}
        </div>
      </a>
      <div class="shop-card-foot">
        <span class="shop-card-price">${money(p.price_cents, currency, lang)}</span>
        <button class="shop-add-btn" data-cf-add data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price_cents}" data-image="${esc(p.image || '')}">${t(lang, 'shopw.add')}</button>
      </div>
    </div>`
    )
    .join('');

  return `
<section id="shop" class="shop-list-section">
  <div class="shop-list-container">
    <div class="shop-list-header">
      <h2 class="shop-list-heading">${esc(heading)}</h2>
      ${data.sub ? `<p class="shop-list-sub">${esc(data.sub)}</p>` : ''}
    </div>
    ${products.length ? `<div class="shop-grid">${cards}</div>` : `<p class="shop-empty">${t(lang, 'shopw.no_products')}</p>`}
  </div>
</section>

<style>
.shop-list-section { padding: 5rem 2rem; background: #f7fafc; }
.shop-list-container { max-width: 1100px; margin: 0 auto; }
.shop-list-header { text-align: center; margin-bottom: 3rem; }
.shop-list-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; }
.shop-list-sub { font-size: 1.15rem; color: #4a5568; margin-top: .6rem; }
.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.8rem; }
.shop-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.07);
  display: flex; flex-direction: column; transition: transform .25s ease, box-shadow .25s ease; }
.shop-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.12); }
.shop-card-link { text-decoration: none; display: flex; flex-direction: column; flex: 1; }
.shop-card-img { aspect-ratio: 1 / 1; background-size: cover; background-position: center; }
.shop-card-img-empty { background: linear-gradient(135deg, ${primary_color}22, ${primary_color}55); }
.shop-card-body { padding: 1.1rem 1.2rem .4rem; display: flex; flex-direction: column; gap: .45rem; flex: 1; }
.shop-card-body h3 { color: #1a202c; font-size: 1.1rem; line-height: 1.35; }
.shop-card-excerpt { color: #4a5568; font-size: .9rem; line-height: 1.5; }
.shop-card-foot { display: flex; justify-content: space-between; align-items: center; gap: .6rem; padding: .6rem 1.2rem 1.2rem; }
.shop-card-price { color: #1a202c; font-weight: 800; font-size: 1.05rem; }
.shop-add-btn { background: ${primary_color}; color: #fff; border: none; border-radius: 9px; padding: .5rem .85rem;
  font-size: .85rem; font-weight: 700; cursor: pointer; transition: opacity .2s; }
.shop-add-btn:hover { opacity: .88; }
.shop-empty { text-align: center; color: #718096; padding: 2rem 0; }
@media (max-width: 768px) { .shop-list-section { padding: 3rem 1.5rem; } }
</style>
${cartScript(config)}
  `.trim();
}
