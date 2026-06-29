// Gallery — "cards" (advanced): each item is an image + title + description,
// optionally a clickable link (to a section/page anchor or external URL). For
// rich product/feature showcases like "Components: Injectors / Pumps / Turbos".

import { sectionDefault } from '../section-defaults.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const PLACE = 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&auto=format&q=70';

export function galleryCardsTemplate(data, config) {
  const lang = config.lang || 'en';
  const {
    heading = sectionDefault(lang, 'gallery', 0),
    subheading = sectionDefault(lang, 'gallery', 1),
    images = [],
  } = data;
  const { font_heading = 'Inter' } = config;
  const items = Array.isArray(images) ? images : [];

  const inner = (im) => `
        <div class="gcard-img"><img src="${esc(im.url || PLACE)}" alt="${esc(im.alt || im.title || im.caption || '')}" width="800" height="600" loading="lazy" /></div>
        ${im.title ? `<h3 class="gcard-title">${esc(im.title)}</h3>` : ''}
        ${im.caption && im.caption !== 'undefined' ? `<p class="gcard-desc">${esc(im.caption)}</p>` : ''}`;

  const cards = items
    .map((im) => {
      if (im.link) {
        const nt = im.newtab ? ' target="_blank" rel="noopener"' : '';
        return `<a class="gcard gcard-link" href="${esc(im.link)}"${nt}>${inner(im)}</a>`;
      }
      return `<div class="gcard">${inner(im)}</div>`;
    })
    .join('');

  return `
<section class="gallery-cards-section">
  <div class="gcards-container">
    <div class="gcards-header">
      <h2 class="gcards-heading">${heading}</h2>
      <p class="gcards-subheading">${subheading}</p>
    </div>
    <div class="gcards-grid">${cards}</div>
  </div>
</section>

<style>
.gallery-cards-section { padding: var(--cf-section-pad, 5rem) 2rem; background: #fff; }
.gcards-container { max-width: var(--cf-container, 1200px); margin: 0 auto; }
.gcards-header { text-align: center; margin-bottom: 3rem; }
.gcards-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; margin-bottom: 1rem; }
.gcards-subheading { font-size: 1.25rem; color: #4a5568; }
.gcards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 2rem; }
.gcard { display: block; text-decoration: none; color: inherit; }
.gcard-img { border-radius: var(--cf-img-radius, 12px); overflow: hidden; box-shadow: var(--cf-shadow-sm, 0 4px 15px rgba(0,0,0,0.1)); }
.gcard-img img { width: 100%; display: block; aspect-ratio: 4/3; object-fit: cover; transition: transform 0.3s ease; }
.gcard-link { cursor: pointer; }
.gcard-link:hover .gcard-img img { transform: scale(1.05); }
.gcard-title { font-family: ${font_heading}, sans-serif; font-size: 1.25rem; font-weight: 700; color: #1a202c; margin: 1rem 0 0.35rem; }
.gcard-desc { color: #4a5568; font-size: 1rem; line-height: 1.55; margin: 0; }
.gcard-link:hover .gcard-title { color: var(--primary, #7c3aed); }
@media (max-width: 768px) {
  .gallery-cards-section { padding: 3rem 1.5rem; }
  .gcards-grid { grid-template-columns: 1fr; gap: 1.5rem; }
}
</style>
  `.trim();
}
