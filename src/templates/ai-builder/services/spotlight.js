// Services "spotlight" — full-width alternating image/text rows (distinct from
// the cards/icon-grid). Two modes per row:
//   • CTA mode  — when the row has a `cta_link`, it renders as an article with a
//     real button that links out (a page, section, or a PDF). Used for the
//     "showcase" media+text bands (image | eyebrow → heading → text/bullets → CTA).
//   • Modal mode — legacy behavior: the whole row is a button that opens the
//     shared service detail modal. Kept for existing services sites (no cta_link).
// A row's media accepts ONE image, a small COLLAGE (2+ images), or falls back to
// the gradient icon tile. A section-level `theme: 'dark'` renders a dark band.
// Token- and dark-aware. Same content shape as the other services variants.

import { serviceCardAttrs, serviceModalAssets, serviceLabels } from './service-modal.js';
import { sectionDefault, defaultItems } from '../section-defaults.js';

const escAttr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Split a multi-line / comma list into trimmed non-empty entries.
const lines = (s) => String(s == null ? '' : s).split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);

export function servicesSpotlightTemplate(data, config) {
  const lang = config.lang || 'en';
  // subheading is the editor field; fall back to description only when it was
  // never set (an explicitly-empty subheading means "no sub-line").
  const { heading = sectionDefault(lang, 'services', 0), subheading, description = '', services, theme = '' } = data;
  const sub = subheading !== undefined ? subheading : description;
  const { primary_color: primaryColor = '#667eea', secondary_color: secondaryColor = '#764ba2', font_heading: fontHeading = 'Inter' } = config;
  const labels = serviceLabels(lang);
  const dark = String(theme).toLowerCase() === 'dark';

  const list = Array.isArray(services) && services.length
    ? services
    : defaultItems(lang, 'services-placeholder');

  const rows = list
    .map((s) => {
      // Media: single image, a collage of the primary + extra images, or the icon.
      // Per-row image fit: '' / 'cover' = fill the box (may crop); 'contain' = show
      // the whole image uncropped on a white tile (good for product graphics).
      const imgs = [s.image_url, ...lines(s.images)].map((u) => String(u || '').trim()).filter(Boolean).slice(0, 6);
      const fit = String(s.img_fit || '').toLowerCase() === 'contain' ? ' fit-contain' : '';
      let media;
      if (imgs.length >= 2) {
        media = `<div class="svc-spot-media svc-spot-collage" data-n="${imgs.length}">${imgs
          .map((u) => `<img src="${escAttr(u)}" alt="${escAttr(s.title || '')}" loading="lazy">`).join('')}</div>`;
      } else if (imgs.length === 1) {
        media = `<div class="svc-spot-media${fit}"><img src="${escAttr(imgs[0])}" alt="${escAttr(s.title || '')}" width="1200" height="750" loading="lazy"></div>`;
      } else {
        media = `<div class="svc-spot-media svc-spot-media--icon" style="background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});">${escHtml(s.icon || '✨')}</div>`;
      }

      const eyebrow = s.eyebrow ? `<span class="svc-spot-eyebrow">${escHtml(s.eyebrow)}</span>` : '';
      const desc = s.description ? `<p class="svc-spot-desc">${s.description}</p>` : '';
      const bl = lines(s.bullets);
      const bullets = bl.length ? `<ul class="svc-spot-bullets">${bl.map((b) => `<li>${escHtml(b)}</li>`).join('')}</ul>` : '';

      const hasCta = !!(s.cta_link && String(s.cta_link).trim());
      if (hasCta) {
        const href = String(s.cta_link).trim();
        const external = /^https?:\/\//i.test(href);
        const cta = `<a class="svc-spot-cta" href="${escAttr(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${escHtml(s.cta_label || labels.more)}</a>`;
        return `
      <div class="svc-spot-row">
        ${media}
        <div class="svc-spot-text">
          ${eyebrow}
          <h3 class="svc-spot-title">${s.title || ''}</h3>
          ${desc}
          ${bullets}
          ${cta}
        </div>
      </div>`;
      }
      // Legacy modal mode (no CTA): the whole row opens the shared detail modal.
      return `
      <button type="button" class="svc-spot-row" ${serviceCardAttrs(s)}>
        ${media}
        <div class="svc-spot-text">
          ${eyebrow}
          <h3 class="svc-spot-title">${s.title || ''}</h3>
          ${desc}
          ${bullets}
          <span class="svc-more">${labels.more} →</span>
        </div>
      </button>`;
    })
    .join('');

  return `
<section class="services-spotlight${dark ? ' is-dark' : ''}">
  <div class="svc-spot-container">
    <div class="svc-spot-header">
      <h2 style="font-family: ${fontHeading};">${heading}</h2>
      ${sub ? `<p>${sub}</p>` : ''}
    </div>
    <div class="svc-spot-rows">${rows}</div>
  </div>
  ${serviceModalAssets(config)}
</section>

<style>
.services-spotlight { padding: var(--cf-section-pad, 6rem) 2rem; background: #ffffff; }
.services-spotlight.is-dark { background: #141a2e; }
.svc-spot-container { max-width: var(--cf-container, 1100px); margin: 0 auto; }
.svc-spot-header { text-align: center; margin-bottom: 3.5rem; }
.svc-spot-header h2 { font-size: 2.75rem; font-weight: 700; color: #1a202c; margin: 0 0 1rem; }
.svc-spot-header p { font-size: 1.25rem; color: #4a5568; max-width: 700px; margin: 0 auto; }
.is-dark .svc-spot-header h2 { color: #ffffff; }
.is-dark .svc-spot-header p { color: #cbd5e0; }
.svc-spot-rows { display: flex; flex-direction: column; gap: 3rem; }
.svc-spot-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; align-items: center;
  width: 100%; text-align: left; border: none; background: none; padding: 0;
  font-family: inherit;
}
button.svc-spot-row { cursor: pointer; }
.svc-spot-row:nth-child(even) { direction: rtl; }
.svc-spot-row:nth-child(even) > * { direction: ltr; }
.svc-spot-media {
  width: 100%; aspect-ratio: 16 / 10; border-radius: var(--cf-img-radius, 14px);
  overflow: hidden; box-shadow: var(--cf-shadow, 0 16px 40px rgba(0,0,0,0.12));
}
.svc-spot-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
.svc-spot-row:hover .svc-spot-media img { transform: scale(1.04); }
.svc-spot-media--icon { display: flex; align-items: center; justify-content: center; font-size: 3.5rem; }
/* Per-row "Show whole image": single image uncropped on a white tile. */
.svc-spot-media.fit-contain { background: #ffffff; }
.svc-spot-media.fit-contain img { object-fit: contain; padding: 1rem; }
/* Collage: a loose grid of the row's images. */
.svc-spot-collage { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; background: none; box-shadow: none; aspect-ratio: 16 / 10; }
.svc-spot-collage img { border-radius: 10px; box-shadow: 0 8px 22px rgba(0,0,0,0.10); background: #fff; object-fit: contain; padding: .35rem; }
.svc-spot-collage[data-n="3"] img:first-child,
.svc-spot-collage[data-n="5"] img:first-child { grid-column: span 2; }
.is-dark .svc-spot-collage img { background: #f8fafc; }
.svc-spot-eyebrow { display: inline-block; font-size: .85rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${primaryColor}; margin-bottom: .5rem; }
.is-dark .svc-spot-eyebrow { color: #a5b4fc; }
.svc-spot-title { font-family: '${fontHeading}', sans-serif; font-size: 1.9rem; font-weight: 700; color: #1a202c; margin: 0 0 1rem; }
.svc-spot-desc { font-size: 1.1rem; line-height: 1.7; color: #4a5568; margin: 0 0 1.25rem; }
.svc-spot-bullets { margin: 0 0 1.25rem; padding-left: 1.2rem; color: #4a5568; font-size: 1.05rem; line-height: 1.8; }
.svc-spot-bullets li { margin-bottom: .3rem; }
.is-dark .svc-spot-title { color: #ffffff; }
.is-dark .svc-spot-desc, .is-dark .svc-spot-bullets { color: #cbd5e0; }
.svc-more { display: inline-block; font-weight: 600; color: ${primaryColor}; }
.is-dark .svc-more { color: #a5b4fc; }
.svc-spot-cta {
  display: inline-block; margin-top: .25rem; padding: .7rem 1.5rem; border-radius: 10px;
  background: ${primaryColor}; color: #fff; text-decoration: none; font-weight: 700; font-size: .95rem;
  transition: opacity .2s;
}
.svc-spot-cta:hover { opacity: .9; }
.is-dark .svc-spot-cta { background: #ffffff; color: #141a2e; }
@media (max-width: 768px) {
  .services-spotlight { padding: var(--cf-section-pad, 4rem) 1.5rem; }
  .svc-spot-row, .svc-spot-row:nth-child(even) { grid-template-columns: 1fr; direction: ltr; gap: 1.25rem; }
  .svc-spot-header h2 { font-size: 2rem; }
}
</style>
  `.trim();
}
