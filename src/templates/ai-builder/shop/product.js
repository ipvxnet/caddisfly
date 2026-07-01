// Single product page — image + name/price/description + add-to-cart.
// Rendered from SYNTHETIC section data (see utils/shop-render.js).
// data: { product: {id,slug,name,price_cents,image,description_html},
// base, currency }.

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

function mediaEmbed(url) {
  const u = String(url);
  let m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (m) return `<iframe class="cat-video" src="https://www.youtube.com/embed/${m[1]}" loading="lazy" allowfullscreen></iframe>`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `<iframe class="cat-video" src="https://player.vimeo.com/video/${m[1]}" loading="lazy" allowfullscreen></iframe>`;
  if (/\.(mp4|webm)(\?|$)/i.test(u)) return `<video class="cat-video" src="${esc(u)}" controls preload="metadata"></video>`;
  return `<a class="cat-link" href="${esc(u)}" target="_blank" rel="noopener">▶ ${esc(u)}</a>`;
}

export function shopProductTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const p = data.product || {};
  const base = data.base || '';
  const currency = data.currency || 'usd';
  const media = p.media || {};
  // Variants (Advanced Store): when present the buyer picks one; each has its own
  // price + stock. A variant product is buyable if >= 1 variant is in stock,
  // regardless of the base price (which variants override).
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const hasVariants = variants.length > 0;
  const inStockVariants = variants.filter((v) => v.stock == null || v.stock > 0);
  const buyable = hasVariants ? inStockVariants.length > 0 : (p.for_sale !== 0 && (p.price_cents || 0) > 0);
  const firstBuyable = inStockVariants[0] || variants[0] || null;
  const displayPrice = hasVariants ? (firstBuyable ? firstBuyable.price_cents : 0) : (p.price_cents || 0);
  const soldOut = t(lang, 'varw.sold_out');
  // Display-only ("Not for sale") items read as documentation, not store pages —
  // a neutral "← Back" label rather than "Back to Shop".
  const displayOnly = p.for_sale === 0;

  // Rich catalogue detail (body + media) — only present on catalogue items.
  const detail = [];
  if (p.body_html) detail.push(`<div class="cat-detail-body shop-product-desc">${p.body_html}</div>`);
  if (Array.isArray(media.gallery) && media.gallery.length) {
    detail.push(`<div class="cat-gallery">${media.gallery.map((u) => `<img loading="lazy" src="${esc(u)}" alt="${esc(p.name)}">`).join('')}</div>`);
  }
  if (Array.isArray(media.videos) && media.videos.length) {
    detail.push(`<div class="cat-videos">${media.videos.map(mediaEmbed).join('')}</div>`);
  }
  if (Array.isArray(media.files) && media.files.length) {
    detail.push(`<ul class="cat-files">${media.files.map((f) => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener">📄 ${esc(f.name || f.url)}</a></li>`).join('')}</ul>`);
  }
  if (Array.isArray(media.links) && media.links.length) {
    detail.push(`<ul class="cat-links">${media.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.label || l.url)}</a></li>`).join('')}</ul>`);
  }

  return `
<section id="shop" class="shop-product-section">
  <div class="shop-product-container">
    <a class="shop-back" href="${esc(`${base}/shop`)}" data-shop-back>← ${t(lang, displayOnly ? 'shopw.back' : 'shopw.back_to_shop')}</a>
    <div class="shop-product-grid">
      <div class="shop-product-media">
        ${p.image ? `<img class="shop-product-img" src="${esc(p.image)}" alt="${esc(p.name)}">` : '<div class="shop-product-img shop-product-img-empty"></div>'}
      </div>
      <div class="shop-product-info">
        <h1 class="shop-product-name">${esc(p.name)}</h1>
        ${buyable ? `<div class="shop-product-price" data-cf-price>${money(displayPrice, currency, lang)}</div>` : ''}
        ${p.description_html ? `<div class="shop-product-desc">${p.description_html}</div>` : ''}
        ${hasVariants
          ? (buyable
            ? `<div data-cf-buy>
        <select class="shop-variant" data-cf-variant aria-label="${esc(p.name)}">
          ${variants.map((v) => `<option value="${v.id}" data-price="${v.price_cents}" data-label="${esc(v.label)}"${v.stock === 0 ? ' disabled' : ''}>${esc(v.label)} — ${money(v.price_cents, currency, lang)}${v.stock === 0 ? ` (${esc(soldOut)})` : ''}</option>`).join('')}
        </select>
        <button class="shop-add-btn shop-add-lg" data-cf-add data-id="${p.id}" data-name="${esc(p.name)}" data-image="${esc(p.image || '')}">${t(lang, 'shopw.add')}</button>
      </div>`
            : `<div class="shop-sold-out-lg">${esc(soldOut)}</div>`)
          : (buyable ? `<button class="shop-add-btn shop-add-lg" data-cf-add data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price_cents || 0}" data-image="${esc(p.image || '')}">${t(lang, 'shopw.add')}</button>` : '')}
      </div>
    </div>
    ${detail.length ? `<div class="cat-detail">${detail.join('')}</div>` : ''}
  </div>
</section>

<style>
.shop-product-section { padding: 4.5rem 2rem 5rem; background: #f7fafc; }
.shop-product-container { max-width: 1000px; margin: 0 auto; }
.shop-back { display: inline-block; color: ${primary_color}; text-decoration: none; font-weight: 600; margin-bottom: 1.6rem; font-size: .95rem; }
.shop-product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; align-items: start; }
.shop-product-img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); display: block; }
.shop-product-img-empty { background: linear-gradient(135deg, ${primary_color}22, ${primary_color}55); }
.shop-product-name { font-family: ${font_heading}, sans-serif; font-size: clamp(1.7rem, 3vw, 2.3rem); font-weight: 800; color: #1a202c; line-height: 1.2; }
.shop-product-price { color: ${primary_color}; font-weight: 800; font-size: 1.5rem; margin: .8rem 0 1.1rem; }
.shop-product-desc { color: #4a5568; line-height: 1.7; font-size: 1rem; }
.shop-product-desc p { margin-bottom: .9rem; }
.shop-product-desc ul { padding-left: 1.2rem; margin-bottom: .9rem; }
.shop-add-lg { margin-top: 1.4rem; padding: .8rem 1.6rem; font-size: 1rem; border-radius: 11px; }
.shop-variant { display: block; width: 100%; max-width: 320px; margin-top: 1.2rem; padding: .65rem .7rem; font-size: .95rem; border: 1px solid #cbd5e0; border-radius: 10px; background: #fff; }
[data-cf-buy] .shop-add-lg { margin-top: .8rem; }
.shop-sold-out-lg { margin-top: 1.4rem; display: inline-block; font-weight: 700; color: #9b2c2c; background: #fed7d7; border-radius: 10px; padding: .6rem 1.1rem; }
.shop-add-btn { background: ${primary_color}; color: #fff; border: none; font-weight: 700; cursor: pointer; transition: opacity .2s; }
.shop-add-btn:hover { opacity: .88; }
.cat-detail { margin-top: 3rem; max-width: 820px; }
.cat-detail-body { margin-bottom: 1.8rem; }
.cat-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.8rem; }
.cat-gallery img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; }
.cat-videos { display: grid; gap: 1rem; margin-bottom: 1.8rem; }
.cat-video { width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 12px; background: #000; }
.cat-files, .cat-links { list-style: none; padding: 0; margin: 0 0 1.4rem; display: flex; flex-direction: column; gap: .5rem; }
.cat-files a, .cat-links a { color: ${primary_color}; text-decoration: none; font-weight: 600; }
.cat-files a:hover, .cat-links a:hover { text-decoration: underline; }
@media (max-width: 768px) { .shop-product-grid { grid-template-columns: 1fr; gap: 1.6rem; } .shop-product-section { padding: 3rem 1.5rem 4rem; } }
</style>
${cartScript(config)}
<script>
(function(){
  var b = document.querySelector('a.shop-back[data-shop-back]');
  if (!b) return;
  // Return to the exact section the visitor came from (in-site history) instead
  // of the shop index the href points to. Use e.preventDefault() — an inline
  // "return false" does NOT reliably cancel the link's default navigation here.
  b.addEventListener('click', function(e){
    if (!document.referrer) return;              // direct/external load → keep the /shop fallback
    try { if (new URL(document.referrer).host === location.host) { e.preventDefault(); history.back(); } } catch (_) {}
  });
})();
</script>
  `.trim();
}
