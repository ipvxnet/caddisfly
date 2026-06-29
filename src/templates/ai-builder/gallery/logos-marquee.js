// Gallery — "logos-rotating": the logo wall, but the row scrolls continuously
// (an infinite marquee). Same tile specs as the "logos" variant (small, fully
// CONTAINED logos on white tiles). Pure CSS: the set is duplicated and the track
// translates -50% on loop for a seamless cycle; pauses on hover; honors
// prefers-reduced-motion (falls back to a scrollable row).

import { sectionDefault } from '../section-defaults.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const PLACE = 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&auto=format&q=70';

export function galleryLogosMarqueeTemplate(data, config) {
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
      return `<a class="lmq-tile" href="${esc(im.link)}"${nt} title="${alt}">${img}</a>`;
    }
    return `<span class="lmq-tile" title="${alt}">${img}</span>`;
  };
  const tiles = items.map(tile).join('');
  const track = tiles + tiles; // duplicate for a seamless loop
  const dur = Math.max(18, items.length * 3.5); // seconds — scales with logo count

  return `
<section class="gallery-logos-marquee-section">
  <div class="lmq-container">
    <div class="lmq-header">
      <h2 class="lmq-heading">${esc(heading)}</h2>
      ${subheading ? `<p class="lmq-sub">${esc(subheading)}</p>` : ''}
    </div>
    <div class="lmq-viewport">
      <div class="lmq-track" style="animation-duration:${dur}s">${track}</div>
    </div>
  </div>
</section>

<style>
.gallery-logos-marquee-section { padding: var(--cf-section-pad, 5rem) 0; background: #fff; }
.lmq-container { max-width: var(--cf-container, 1200px); margin: 0 auto; }
.lmq-header { text-align: center; margin-bottom: 2.5rem; padding: 0 2rem; }
.lmq-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 700; color: #1a202c; margin: 0 0 0.75rem; }
.lmq-sub { font-size: 1.1rem; color: #4a5568; margin: 0; }
.lmq-viewport { overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.lmq-track { display: flex; width: max-content; gap: 1.25rem; animation-name: lmq-scroll; animation-timing-function: linear; animation-iteration-count: infinite; }
.lmq-viewport:hover .lmq-track { animation-play-state: paused; }
.lmq-tile { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 170px; height: 96px; background: #fff; border-radius: 10px; padding: 1rem 1.25rem; box-shadow: var(--cf-shadow-sm, 0 2px 10px rgba(0,0,0,0.06)); }
.lmq-tile img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
@keyframes lmq-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .lmq-track { animation: none; overflow-x: auto; } }
@media (max-width: 768px) { .gallery-logos-marquee-section { padding: 3rem 0; } .lmq-tile { width: 140px; height: 80px; } }
</style>
  `.trim();
}
