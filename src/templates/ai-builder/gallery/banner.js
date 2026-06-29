// Gallery — "banner": a hero banner (background image + a colored panel with
// heading, intro and an optional CTA) above a row of image cards that overlap
// the banner's bottom edge. Mirrors classic "product line" headers
// (e.g. ARM Diesel "High Performance Diesel Components" + Injectors/Pumps/Turbos).

import { sectionDefault } from '../section-defaults.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const PLACE = 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&auto=format&q=70';
const PLACE_BANNER = 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1600&auto=format&q=70';

export function galleryBannerTemplate(data, config) {
  const lang = config.lang || 'en';
  const {
    heading = sectionDefault(lang, 'gallery', 0),
    subheading = sectionDefault(lang, 'gallery', 1),
    banner_image = '',
    cta_text = '',
    cta_link = '',
    images = [],
  } = data;
  const { font_heading = 'Inter', primary_color = '#1e3a8a' } = config;
  const items = Array.isArray(images) ? images : [];
  const bg = banner_image || PLACE_BANNER;

  const inner = (im) => `
        <div class="gcard-img"><img src="${esc(im.url || PLACE)}" alt="${esc(im.alt || im.title || im.caption || '')}" width="800" height="600" loading="lazy" /></div>
        ${im.title ? `<h3 class="gcard-title">${esc(im.title)}</h3>` : ''}
        ${im.caption && im.caption !== 'undefined' ? `<p class="gcard-desc">${esc(im.caption)}</p>` : ''}`;
  const cards = items
    .map((im) => (im.link
      ? `<a class="gcard gcard-link" href="${esc(im.link)}"${im.newtab ? ' target="_blank" rel="noopener"' : ''}>${inner(im)}</a>`
      : `<div class="gcard">${inner(im)}</div>`))
    .join('');
  const cta = cta_text
    ? `<a class="gbanner-cta" href="${esc(cta_link || '#contact')}">${esc(cta_text)}</a>`
    : '';

  return `
<section class="gallery-banner-section">
  <div class="gbanner-hero" style="background-image:url('${esc(bg)}')">
    <div class="gbanner-panel">
      <h2 class="gbanner-heading">${esc(heading)}</h2>
      <p class="gbanner-sub">${esc(subheading)}</p>
      ${cta}
    </div>
  </div>
  ${cards ? `<div class="gbanner-cards-wrap"><div class="gcards-grid">${cards}</div></div>` : ''}
</section>

<style>
.gallery-banner-section { background: #fff; }
.gbanner-hero { position: relative; background-size: cover; background-position: center; min-height: 460px; display: flex; }
.gbanner-hero::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,.15), transparent 60%); }
.gbanner-panel { position: relative; z-index: 1; background: ${primary_color}; color: #fff; width: min(48%, 560px); padding: 3rem 3rem 3rem 2.5rem; display: flex; flex-direction: column; justify-content: center; clip-path: polygon(0 0, 100% 0, 82% 100%, 0 100%); }
.gbanner-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(1.8rem, 3.2vw, 2.6rem); font-weight: 800; text-transform: uppercase; line-height: 1.1; margin: 0 0 1rem; color: #fff; }
.gbanner-sub { font-size: 1.05rem; line-height: 1.5; margin: 0 0 1.4rem; color: rgba(255,255,255,.9); max-width: 34ch; }
.gbanner-cta { display: inline-block; align-self: flex-start; background: #fff; color: ${primary_color}; font-weight: 700; padding: 0.7rem 1.5rem; border-radius: 8px; text-decoration: none; transition: transform .2s ease; }
.gbanner-cta:hover { transform: translateY(-2px); }
.gbanner-cards-wrap { max-width: var(--cf-container, 1200px); margin: -4rem auto 0; padding: 0 2rem 4rem; position: relative; z-index: 2; }
.gcards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 2rem; }
.gcard { display: block; text-decoration: none; color: inherit; }
.gcard-img { border-radius: var(--cf-img-radius, 12px); overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.14); background: #fff; }
.gcard-img img { width: 100%; display: block; aspect-ratio: 4/3; object-fit: cover; transition: transform 0.3s ease; }
.gcard-link:hover .gcard-img img { transform: scale(1.05); }
.gcard-title { font-family: ${font_heading}, sans-serif; font-size: 1.25rem; font-weight: 700; color: #1a202c; margin: 1rem 0 0.35rem; }
.gcard-desc { color: #4a5568; font-size: 1rem; line-height: 1.55; margin: 0; }
.gcard-link:hover .gcard-title { color: ${primary_color}; }
@media (max-width: 768px) {
  .gbanner-hero { min-height: 320px; }
  .gbanner-panel { width: 100%; clip-path: none; padding: 2rem 1.5rem; }
  .gbanner-cards-wrap { margin-top: 1.5rem; padding: 0 1.5rem 3rem; }
  .gcards-grid { grid-template-columns: 1fr; gap: 1.5rem; }
}
</style>
  `.trim();
}
