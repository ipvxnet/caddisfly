// 📒 Catalogue — ADDABLE body section (Catalogue plugin). Renders catalogue
// items (products carrying catalogue fields) as tiles, filtered to ONE category
// so multiple catalogue sections can sit on a page (one per category). Item data
// is injected LIVE at render time (assemblePage opts.products → config.products),
// like the featured-shop section. Each tile links to the item detail page; items
// flagged for_sale show a Buy button once published, info-only items don't.

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

const CAT_T = {
  en: { heading: 'Catalogue', view: 'View details', buy: 'Buy now', learn: 'Learn more', empty: 'Add catalogue items to show them here.' },
  es: { heading: 'Catálogo', view: 'Ver detalles', buy: 'Comprar', learn: 'Más información', empty: 'Agrega artículos al catálogo para mostrarlos aquí.' },
  pt: { heading: 'Catálogo', view: 'Ver detalhes', buy: 'Comprar', learn: 'Saiba mais', empty: 'Adicione itens ao catálogo para exibi-los aqui.' },
};

export function catalogueTilesTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const tr = CAT_T[lang] || CAT_T.en;
  const all = Array.isArray(config.products) ? config.products : [];
  const base = config.previewBase || '';
  const embedSuffix = config.embed ? '?embed=1' : '';
  const published = !!config.trackId;
  const currency = config.store_currency || 'usd';

  // One section = one category (multi-section-per-page). Empty category → all items.
  const category = (data.category || '').trim();
  const items = category ? all.filter((p) => (p.category || '') === category) : all;
  const heading = data.heading || category || tr.heading;

  const styles = `
<style>
.cat-section { padding: 5rem 2rem; background: #fff; }
.cat-container { max-width: 1100px; margin: 0 auto; }
.cat-header { text-align: center; margin-bottom: 3rem; }
.cat-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; }
.cat-sub { font-size: 1.15rem; color: #4a5568; margin-top: .6rem; }
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.8rem; }
.cat-card { background: #fff; border: 1px solid rgba(0,0,0,.05); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.07); display: flex; flex-direction: column; transition: transform .25s ease, box-shadow .25s ease; }
.cat-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.12); }
.cat-link { text-decoration: none; display: flex; flex-direction: column; flex: 1; }
.cat-img { aspect-ratio: 4 / 3; background-size: cover; background-position: center; }
.cat-img-empty { background: linear-gradient(135deg, ${primary_color}22, ${primary_color}55); }
.cat-body { padding: 1.1rem 1.2rem .4rem; display: flex; flex-direction: column; gap: .45rem; flex: 1; }
.cat-body h3 { color: #1a202c; font-size: 1.1rem; line-height: 1.35; }
.cat-desc { color: #4a5568; font-size: .9rem; line-height: 1.5; }
.cat-foot { display: flex; justify-content: space-between; align-items: center; gap: .6rem; padding: .6rem 1.2rem 1.2rem; }
.cat-price { color: #1a202c; font-weight: 800; font-size: 1.05rem; }
.cat-view { color: ${primary_color}; font-weight: 700; font-size: .9rem; text-decoration: none; }
.cat-buy { background: ${primary_color}; color: #fff; border: none; border-radius: 9px; padding: .5rem .85rem; font-size: .85rem; font-weight: 700; cursor: pointer; transition: opacity .2s; text-decoration: none; }
.cat-buy:hover { opacity: .88; }
.cat-empty { text-align: center; color: #718096; border: 2px dashed #e2e8f0; border-radius: 14px; padding: 2.5rem 1.5rem; max-width: 640px; margin: 0 auto; }
@media (max-width: 768px) { .cat-section { padding: 3rem 1.5rem; } }
</style>`;

  if (!items.length) {
    if (published) return '';
    return `
<section class="cat-section">
  <div class="cat-container"><div class="cat-empty">📒 ${esc(tr.empty)}</div></div>
</section>
${styles}`.trim();
  }

  const cards = items
    .map((p) => {
      const href = esc(`${base}/shop/${p.slug}${embedSuffix}`);
      const buyable = p.for_sale !== 0 && p.price_cents > 0;
      return `
    <div class="cat-card">
      <a class="cat-link" href="${href}">
        ${p.image ? `<div class="cat-img" style="background-image:url('${esc(p.image)}')"></div>` : '<div class="cat-img cat-img-empty"></div>'}
        <div class="cat-body">
          <h3>${esc(p.name)}</h3>
          ${p.description ? `<p class="cat-desc">${esc(p.description)}</p>` : ''}
        </div>
      </a>
      <div class="cat-foot">
        ${buyable ? `<span class="cat-price">${money(p.price_cents, currency, lang)}</span>` : `<a class="cat-view" href="${href}">${esc(tr.view)} →</a>`}
        ${buyable && published
          ? `<button class="cat-buy" data-cf-add data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price_cents}" data-image="${esc(p.image || '')}">${esc(tr.buy)}</button>`
          : `<a class="cat-buy" href="${href}">${esc(buyable ? tr.buy : tr.learn)}</a>`}
      </div>
    </div>`;
    })
    .join('');

  return `
<section class="cat-section">
  <div class="cat-container">
    <div class="cat-header">
      <h2 class="cat-heading">${esc(heading)}</h2>
      ${data.subheading ? `<p class="cat-sub">${esc(data.subheading)}</p>` : ''}
    </div>
    <div class="cat-grid">${cards}</div>
  </div>
</section>
${styles}`.trim();
}
