// 📚 Courses — ADDABLE body section (Courses plugin). Promotes the site's
// published courses as cards on any page; clicking a card opens the course
// player at /courses/:slug. Course data is injected LIVE at render time
// (assemblePage opts.courses → config.courses), like the catalogue section.
// Classes are `.crsec-*` (distinct from the /courses page templates' `.crs-*`).

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(cents, currency, lang) {
  try { return new Intl.NumberFormat(lang, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`; }
}

const T = {
  en: { heading: 'Courses', empty: 'Publish a course to feature it here.', free: 'Free', all: 'View all courses →' },
  es: { heading: 'Cursos', empty: 'Publica un curso para destacarlo aquí.', free: 'Gratis', all: 'Ver todos los cursos →' },
  pt: { heading: 'Cursos', empty: 'Publique um curso para destacá-lo aqui.', free: 'Grátis', all: 'Ver todos os cursos →' },
};

export function coursesSectionTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const tr = T[lang] || T.en;
  const all = Array.isArray(config.courses) ? config.courses : [];
  const base = config.previewBase || '';
  const embedSuffix = config.embed ? '?embed=1' : '';
  const published = !!config.trackId;
  const currency = config.store_currency || 'usd';
  const heading = data.heading || tr.heading;
  // Optional cap (data.limit); default show up to 6 on a promo strip.
  const limit = parseInt(data.limit, 10);
  const items = Number.isFinite(limit) && limit > 0 ? all.slice(0, limit) : all.slice(0, 6);

  const styles = `
<style>
.crsec-section { padding: 5rem 2rem; background: #fff; }
.crsec-container { max-width: 1100px; margin: 0 auto; }
.crsec-header { text-align: center; margin-bottom: 3rem; }
.crsec-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; }
.crsec-sub { font-size: 1.15rem; color: #4a5568; margin-top: .6rem; }
.crsec-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 1.8rem; }
.crsec-card { background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.07); display: flex; flex-direction: column; transition: transform .25s ease, box-shadow .25s ease; text-decoration: none; }
.crsec-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.13); }
.crsec-img { aspect-ratio: 16 / 9; background-size: cover; background-position: center; }
.crsec-img-empty { background: linear-gradient(135deg, ${primary_color}33, ${primary_color}88); display:flex; align-items:center; justify-content:center; font-size:2.2rem; }
.crsec-body { padding: 1.1rem 1.2rem 1.3rem; display: flex; flex-direction: column; gap: .45rem; flex: 1; }
.crsec-cat { font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: ${primary_color}; }
.crsec-title { color: #1a202c; font-size: 1.12rem; font-weight: 700; line-height: 1.3; }
.crsec-desc { color: #4a5568; font-size: .9rem; line-height: 1.5; flex: 1; }
.crsec-price { color: #1a202c; font-weight: 800; margin-top: .3rem; }
.crsec-free { color: #166534; font-weight: 800; margin-top: .3rem; }
.crsec-all { display: inline-block; margin-top: 2rem; color: ${primary_color}; font-weight: 700; text-decoration: none; }
.crsec-empty { text-align: center; color: #718096; border: 2px dashed #e2e8f0; border-radius: 14px; padding: 2.5rem 1.5rem; max-width: 640px; margin: 0 auto; }
@media (max-width: 768px) { .crsec-section { padding: 3rem 1.5rem; } }
</style>`;

  if (!items.length) {
    if (published) return ''; // hide empty on a live site
    return `<section class="crsec-section"><div class="crsec-container"><div class="crsec-empty">📚 ${esc(tr.empty)}</div></div></section>${styles}`;
  }

  const cards = items.map((c) => {
    const href = `${base}/courses/${c.slug}${embedSuffix}`;
    const price = c.price_cents > 0
      ? `<span class="crsec-price">${money(c.price_cents, currency, lang)}</span>`
      : `<span class="crsec-free">${esc(tr.free)}</span>`;
    return `
    <a class="crsec-card" href="${esc(href)}">
      ${c.image ? `<div class="crsec-img" style="background-image:url('${esc(c.image)}')"></div>` : '<div class="crsec-img crsec-img-empty">📚</div>'}
      <div class="crsec-body">
        ${c.category ? `<span class="crsec-cat">${esc(c.category)}</span>` : ''}
        <h3 class="crsec-title">${esc(c.title)}</h3>
        ${c.subtitle ? `<p class="crsec-desc">${esc(c.subtitle)}</p>` : ''}
        ${price}
      </div>
    </a>`;
  }).join('');

  return `
<section class="crsec-section">
  <div class="crsec-container">
    <div class="crsec-header">
      <h2 class="crsec-heading">${esc(heading)}</h2>
      ${data.subheading ? `<p class="crsec-sub">${esc(data.subheading)}</p>` : ''}
    </div>
    <div class="crsec-grid">${cards}</div>
    <div style="text-align:center"><a class="crsec-all" href="${esc(base)}/courses${embedSuffix}">${esc(tr.all)}</a></div>
  </div>
</section>${styles}`.trim();
}
