// Portrait testimonials — a photo-forward card: a large customer photo on top
// (cropped to favor faces) with the quote and name/role below. Distinct from
// cards (small inline avatar) and quotes (quote-mark + small avatar). Reuses the
// shared {name/role/text, avatar} schema; items without a photo fall back to a
// branded monogram tile so the grid still looks intentional. Token- & dark-aware.

import { TESTIMONIAL_DEFAULTS } from './cards.js';
import { lightboxAttrs, photoLightboxAssets } from './photo-lightbox.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

export function testimonialsPortraitTemplate(data, config) {
  const {
    primary_color: primaryColor = '#667eea',
    secondary_color: secondaryColor = '#764ba2',
    font_heading: fontHeading = 'Inter',
    font_body: fontBody = 'Inter',
  } = config;
  const lang = config.lang || 'en';
  const tx = TESTIMONIAL_DEFAULTS[lang] || TESTIMONIAL_DEFAULTS.en;
  const { heading = tx.heading, testimonials } = data;
  const list = (Array.isArray(testimonials) && testimonials.length) ? testimonials : tx.items;

  const cards = list.map((t) => {
    const quote = t.quote || t.text || '';
    const author = t.author || t.name || '';
    const role = t.position || t.role || '';
    const photo = t.avatar || t.image || '';
    const media = photo
      ? `<button type="button" class="tp-photo tp-photo-btn tstlb-trigger" ${lightboxAttrs({ img: photo, name: author, role, quote }, lang)}><img src="${escAttr(photo)}" alt="${escAttr(author)}" width="480" height="360" loading="lazy"></button>`
      : `<div class="tp-photo tp-photo--mono" style="background:linear-gradient(135deg, ${primaryColor}, ${secondaryColor});"><span>${esc((author || 'A').charAt(0))}</span></div>`;
    return `<figure class="tp-card">
      ${media}
      <figcaption class="tp-body">
        <blockquote class="tp-quote">${esc(quote)}</blockquote>
        <div class="tp-name">${esc(author)}</div>
        ${role ? `<div class="tp-role" style="color:${primaryColor};">${esc(role)}</div>` : ''}
      </figcaption>
    </figure>`;
  }).join('');

  return `
<section class="testimonials-portrait">
  <div class="tp-container">
    <h2 class="tp-heading" style="font-family:'${fontHeading}',sans-serif;">${esc(heading)}</h2>
    <div class="tp-grid" style="font-family:'${fontBody}',sans-serif;">${cards}</div>
  </div>
</section>

<style>
.testimonials-portrait { padding: var(--cf-section-pad, 6rem) 2rem; background: #f7fafc; }
.tp-container { max-width: var(--cf-container, 1200px); margin: 0 auto; }
.tp-heading { font-size: 2.6rem; font-weight: 700; color: #1a202c; text-align: center; margin: 0 0 3rem; }
.tp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
.tp-card { background: #fff; border-radius: var(--cf-radius, 16px); box-shadow: var(--cf-shadow-sm, 0 4px 20px rgba(0,0,0,0.08)); overflow: hidden; margin: 0; display: flex; flex-direction: column; }
.tp-photo { width: 100%; aspect-ratio: 4 / 3; overflow: hidden; }
.tp-photo img { width: 100%; height: 100%; object-fit: cover; object-position: center 28%; display: block; }
.tp-photo--mono { display: flex; align-items: center; justify-content: center; }
.tp-photo--mono span { color: #fff; font-size: 3.5rem; font-weight: 700; }
.tp-body { padding: 1.75rem; text-align: center; }
.tp-quote { font-size: 1.05rem; line-height: 1.7; color: #2d3748; font-style: italic; margin: 0 0 1.1rem; }
.tp-name { font-weight: 700; color: #1a202c; }
.tp-role { font-size: 0.9rem; font-weight: 500; margin-top: 0.15rem; }
.tp-photo-btn { border: none; padding: 0; width: 100%; cursor: zoom-in; display: block; }
.tp-photo-btn img { transition: transform 0.3s; }
.tp-photo-btn:hover img { transform: scale(1.04); }
@media (max-width: 768px) {
  .testimonials-portrait { padding: 4rem 1.25rem; }
  .tp-heading { font-size: 2rem; margin-bottom: 2rem; }
  .tp-grid { grid-template-columns: 1fr; }
}
</style>
${photoLightboxAssets(primaryColor, lang)}
  `.trim();
}
