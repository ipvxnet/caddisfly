// 🛍 Shop products — ADDABLE body section featuring the store's latest active
// products on any page. Unlike the synthetic /shop pages, this is a real
// ai_sections row; the product data is injected LIVE at render time
// (assemblePage opts.products → config.products) so it never goes stale.
// Published pages get add-to-cart via the shared mini-cart (idempotent);
// previews render link-only cards, and an empty store shows a helper
// placeholder while editing but nothing once published.

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

export function featuredProductsTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const products = Array.isArray(config.products) ? config.products : [];
  const count = [3, 6, 9].includes(parseInt(data.count, 10)) ? parseInt(data.count, 10) : 3;
  const shown = products.slice(0, count);
  const base = config.previewBase || '';
  const embedSuffix = config.embed ? '?embed=1' : '';
  const published = !!config.trackId; // cart + checkout only work once published
  const currency = config.store_currency || 'usd';
  const heading = data.heading || t(lang, 'shopw.feat_heading');
  const ctaText = data.cta_text || t(lang, 'shopw.feat_cta');

  const styles = `
<style>
.shop-feat-section { padding: 5rem 2rem; background: #fff; }
.shop-feat-container { max-width: 1100px; margin: 0 auto; }
.shop-feat-header { text-align: center; margin-bottom: 3rem; }
.shop-feat-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; }
.shop-feat-sub { font-size: 1.15rem; color: #4a5568; margin-top: .6rem; }
.shop-feat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.8rem; }
.shop-feat-card { background: #fff; border: 1px solid rgba(0,0,0,.05); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.07);
  display: flex; flex-direction: column; transition: transform .25s ease, box-shadow .25s ease; }
.shop-feat-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.12); }
.shop-feat-link { text-decoration: none; display: flex; flex-direction: column; flex: 1; }
.shop-feat-img { aspect-ratio: 1 / 1; background-size: cover; background-position: center; }
.shop-feat-img-empty { background: linear-gradient(135deg, ${primary_color}22, ${primary_color}55); }
.shop-feat-body { padding: 1.1rem 1.2rem .4rem; display: flex; flex-direction: column; gap: .45rem; flex: 1; }
.shop-feat-body h3 { color: #1a202c; font-size: 1.1rem; line-height: 1.35; }
.shop-feat-excerpt { color: #4a5568; font-size: .9rem; line-height: 1.5; }
.shop-feat-foot { display: flex; justify-content: space-between; align-items: center; gap: .6rem; padding: .6rem 1.2rem 1.2rem; }
.shop-feat-price { color: #1a202c; font-weight: 800; font-size: 1.05rem; }
.shop-feat-foot .shop-add-btn { background: ${primary_color}; color: #fff; border: none; border-radius: 9px; padding: .5rem .85rem;
  font-size: .85rem; font-weight: 700; cursor: pointer; transition: opacity .2s; }
.shop-feat-foot .shop-add-btn:hover { opacity: .88; }
.shop-sold-out { font-size: .82rem; font-weight: 700; color: #9b2c2c; background: #fed7d7; border-radius: 8px; padding: .35rem .7rem; }
.shop-feat-cta-wrap { text-align: center; margin-top: 2.6rem; }
.shop-feat-cta { display: inline-block; background: ${primary_color}; color: #fff; text-decoration: none; font-weight: 700;
  padding: .85rem 2rem; border-radius: 10px; transition: opacity .2s; }
.shop-feat-cta:hover { opacity: .9; }
.shop-feat-empty { text-align: center; color: #718096; border: 2px dashed #e2e8f0; border-radius: 14px; padding: 2.5rem 1.5rem; max-width: 640px; margin: 0 auto; }
@media (max-width: 768px) { .shop-feat-section { padding: 3rem 1.5rem; } }
</style>`;

  // No products yet: helper placeholder while editing/previewing, nothing live.
  if (!shown.length) {
    if (published) return '';
    return `
<section class="shop-feat-section">
  <div class="shop-feat-container">
    <div class="shop-feat-empty">🛍 ${esc(t(lang, 'shopw.feat_empty'))}</div>
  </div>
</section>
${styles}
    `.trim();
  }

  const cards = shown
    .map(
      (p) => `
    <div class="shop-feat-card">
      <a class="shop-feat-link" href="${esc(`${base}/shop/${p.slug}${embedSuffix}`)}">
        ${p.image ? `<div class="shop-feat-img" style="background-image:url('${esc(p.image)}')"></div>` : '<div class="shop-feat-img shop-feat-img-empty"></div>'}
        <div class="shop-feat-body">
          <h3>${esc(p.name)}</h3>
          ${p.excerpt ? `<p class="shop-feat-excerpt">${esc(p.excerpt)}</p>` : ''}
        </div>
      </a>
      <div class="shop-feat-foot">
        ${(p.has_variants && Array.isArray(p.variants) && p.variants.length)
          ? `<span class="shop-feat-price">${t(lang, 'shopw.from_price')} ${money(Math.min(...p.variants.map((v) => v.price_cents)), currency, lang)}</span>
        <a class="shop-add-btn" href="${esc(`${base}/shop/${p.slug}${embedSuffix}`)}">${t(lang, 'shopw.view_options')}</a>`
          : `<span class="shop-feat-price">${money(p.price_cents, currency, lang)}</span>
        ${p.stock === 0
          ? `<span class="shop-sold-out">${t(lang, 'shopw.sold_out')}</span>`
          : (published
            ? `<button class="shop-add-btn" data-cf-add data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price_cents}" data-image="${esc(p.image || '')}">${t(lang, 'shopw.add')}</button>`
            : '')}`}
      </div>
    </div>`
    )
    .join('');

  return `
<section class="shop-feat-section">
  <div class="shop-feat-container">
    <div class="shop-feat-header">
      <h2 class="shop-feat-heading">${esc(heading)}</h2>
      ${data.subheading ? `<p class="shop-feat-sub">${esc(data.subheading)}</p>` : ''}
    </div>
    <div class="shop-feat-grid">${cards}</div>
    <div class="shop-feat-cta-wrap">
      <a class="shop-feat-cta" href="${esc(`${base}/shop${embedSuffix}`)}">${esc(ctaText)}</a>
    </div>
  </div>
</section>
${styles}
${published ? cartScript(config) : ''}
  `.trim();
}
