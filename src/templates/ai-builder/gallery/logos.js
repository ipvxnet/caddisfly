// Gallery — "logos" (logo wall): brand/partner logos rendered SMALL and fully
// CONTAINED (never cropped or enlarged) on white tiles in a tight grid. For
// "Brands we work with" rows. Uses object-fit:contain (vs cover) so wide marks
// like BOSCH/CATERPILLAR show in full. Tiles stay white on dark themes so logos
// stay legible. Optional per-item link makes a logo clickable.

import { sectionDefault } from '../section-defaults.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const PLACE = 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&auto=format&q=70';

export function galleryLogosTemplate(data, config) {
  const lang = config.lang || 'en';
  const {
    heading = sectionDefault(lang, 'gallery', 0),
    subheading = sectionDefault(lang, 'gallery', 1),
    images = [],
  } = data;
  const { font_heading = 'Inter' } = config;
  const items = Array.isArray(images) ? images : [];

  const tile = (im) => {
    const alt = esc(im.title || im.alt || im.caption || '');
    const img = `<img src="${esc(im.url || PLACE)}" alt="${alt}" loading="lazy" />`;
    if (im.link) {
      const nt = im.newtab ? ' target="_blank" rel="noopener"' : '';
      return `<a class="glogo-tile" href="${esc(im.link)}"${nt} title="${alt}">${img}</a>`;
    }
    return `<div class="glogo-tile" title="${alt}">${img}</div>`;
  };
  const tiles = items.map(tile).join('');

  return `
<section class="gallery-logos-section">
  <div class="glogos-container">
    <div class="glogos-header">
      <h2 class="glogos-heading">${esc(heading)}</h2>
      ${subheading ? `<p class="glogos-sub">${esc(subheading)}</p>` : ''}
    </div>
    <div class="glogos-grid">${tiles}</div>
  </div>
</section>

<style>
.gallery-logos-section { padding: var(--cf-section-pad, 5rem) 2rem; background: #fff; }
.glogos-container { max-width: var(--cf-container, 1200px); margin: 0 auto; }
.glogos-header { text-align: center; margin-bottom: 2.5rem; }
.glogos-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 700; color: #1a202c; margin: 0 0 0.75rem; }
.glogos-sub { font-size: 1.1rem; color: #4a5568; margin: 0; }
.glogos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1.25rem; align-items: center; }
.glogo-tile { display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 10px; padding: 1rem 1.25rem; height: 96px; box-shadow: var(--cf-shadow-sm, 0 2px 10px rgba(0,0,0,0.06)); }
.glogo-tile img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
a.glogo-tile { transition: transform 0.2s ease, box-shadow 0.2s ease; }
a.glogo-tile:hover { transform: translateY(-3px); box-shadow: var(--cf-shadow, 0 8px 20px rgba(0,0,0,0.12)); }
@media (max-width: 768px) {
  .gallery-logos-section { padding: 3rem 1.5rem; }
  .glogos-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; }
  .glogo-tile { height: 80px; padding: 0.8rem; }
}
</style>
  `.trim();
}
