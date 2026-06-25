// 📚 course_list — the /courses catalog page body (Courses plugin). Synthetic
// section baked at deploy + served by the preview route. Renders published
// courses as cards linking to each course player at /courses/:slug. Data comes
// in via the section's content_json (courseListSection in utils/course-render.js).

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(cents, currency, lang) {
  try { return new Intl.NumberFormat(lang, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`; }
}

const T = {
  en: { heading: 'Courses', empty: 'Courses will appear here once published.', free: 'Free', lessons: 'lessons' },
  es: { heading: 'Cursos', empty: 'Los cursos aparecerán aquí una vez publicados.', free: 'Gratis', lessons: 'lecciones' },
  pt: { heading: 'Cursos', empty: 'Os cursos aparecerão aqui após a publicação.', free: 'Grátis', lessons: 'aulas' },
};

export function courseListTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = data.lang || config.lang || 'en';
  const tr = T[lang] || T.en;
  const base = data.base || config.previewBase || '';
  const embedSuffix = config.embed ? '?embed=1' : '';
  const currency = data.currency || config.store_currency || 'usd';
  const courses = Array.isArray(data.courses) ? data.courses : [];
  const heading = data.heading || tr.heading;

  const styles = `
<style>
.crs-section { padding: 5rem 2rem; background: #fff; }
.crs-container { max-width: 1100px; margin: 0 auto; }
.crs-header { text-align: center; margin-bottom: 3rem; }
.crs-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; }
.crs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 1.8rem; }
.crs-card { background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.07); display: flex; flex-direction: column; transition: transform .25s ease, box-shadow .25s ease; text-decoration: none; }
.crs-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.13); }
.crs-img { aspect-ratio: 16 / 9; background-size: cover; background-position: center; }
.crs-img-empty { background: linear-gradient(135deg, ${primary_color}33, ${primary_color}88); display:flex; align-items:center; justify-content:center; font-size:2.4rem; }
.crs-body { padding: 1.1rem 1.2rem 1.3rem; display: flex; flex-direction: column; gap: .45rem; flex: 1; }
.crs-cat { font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: ${primary_color}; }
.crs-title { color: #1a202c; font-size: 1.15rem; font-weight: 700; line-height: 1.3; }
.crs-sub { color: #4a5568; font-size: .9rem; line-height: 1.5; flex: 1; }
.crs-foot { display: flex; justify-content: space-between; align-items: center; margin-top: .4rem; }
.crs-price { color: #1a202c; font-weight: 800; }
.crs-free { color: #166534; font-weight: 800; }
.crs-meta { color: #718096; font-size: .82rem; }
.crs-empty { text-align: center; color: #718096; border: 2px dashed #e2e8f0; border-radius: 14px; padding: 3rem 1.5rem; max-width: 640px; margin: 0 auto; }
@media (max-width: 768px) { .crs-section { padding: 3rem 1.5rem; } }
</style>`;

  if (!courses.length) {
    if (config.trackId) return ''; // published: hide empty
    return `<section class="crs-section"><div class="crs-container"><div class="crs-empty">📚 ${esc(tr.empty)}</div></div></section>${styles}`;
  }

  const cards = courses.map((c) => {
    const href = `${base}/courses/${c.slug}${embedSuffix}`;
    const priceHtml = c.price_cents > 0
      ? `<span class="crs-price">${money(c.price_cents, currency, lang)}</span>`
      : `<span class="crs-free">${esc(tr.free)}</span>`;
    return `
    <a class="crs-card" href="${esc(href)}">
      ${c.image ? `<div class="crs-img" style="background-image:url('${esc(c.image)}')"></div>` : '<div class="crs-img crs-img-empty">📚</div>'}
      <div class="crs-body">
        ${c.category ? `<span class="crs-cat">${esc(c.category)}</span>` : ''}
        <h3 class="crs-title">${esc(c.title)}</h3>
        ${c.subtitle ? `<p class="crs-sub">${esc(c.subtitle)}</p>` : ''}
        <div class="crs-foot">
          ${priceHtml}
          ${c.lessons ? `<span class="crs-meta">${c.lessons} ${esc(tr.lessons)}</span>` : ''}
        </div>
      </div>
    </a>`;
  }).join('');

  return `
<section class="crs-section">
  <div class="crs-container">
    <div class="crs-header"><h2 class="crs-heading">${esc(heading)}</h2></div>
    <div class="crs-grid">${cards}</div>
  </div>
</section>${styles}`.trim();
}
