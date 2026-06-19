// Services "spotlight" — full-width alternating image/text rows (distinct from
// the cards/icon-grid). Each row opens the shared service detail modal. Token-
// and dark-aware. Same content shape as the other services variants.

import { serviceCardAttrs, serviceModalAssets, serviceLabels } from './service-modal.js';
import { sectionDefault, defaultItems } from '../section-defaults.js';

const escAttr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function servicesSpotlightTemplate(data, config) {
  const lang = config.lang || 'en';
  const { heading = sectionDefault(lang, 'services', 0), description = '', services } = data;
  const { primary_color: primaryColor = '#667eea', secondary_color: secondaryColor = '#764ba2', font_heading: fontHeading = 'Inter' } = config;
  const labels = serviceLabels(lang);

  const list = Array.isArray(services) && services.length
    ? services
    : defaultItems(lang, 'services-placeholder');

  const rows = list
    .map((s) => {
      const media = s.image_url
        ? `<div class="svc-spot-media"><img src="${escAttr(s.image_url)}" alt="${escAttr(s.title || '')}" width="1200" height="750" loading="lazy"></div>`
        : `<div class="svc-spot-media svc-spot-media--icon" style="background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});">${s.icon || '✨'}</div>`;
      return `
      <button type="button" class="svc-spot-row" ${serviceCardAttrs(s)}>
        ${media}
        <div class="svc-spot-text">
          <h3 class="svc-spot-title">${s.title || ''}</h3>
          <p class="svc-spot-desc">${s.description || ''}</p>
          <span class="svc-more">${labels.more} →</span>
        </div>
      </button>`;
    })
    .join('');

  return `
<section class="services-spotlight">
  <div class="svc-spot-container">
    <div class="svc-spot-header">
      <h2 style="font-family: ${fontHeading};">${heading}</h2>
      ${description ? `<p>${description}</p>` : ''}
    </div>
    <div class="svc-spot-rows">${rows}</div>
  </div>
  ${serviceModalAssets(config)}
</section>

<style>
.services-spotlight { padding: var(--cf-section-pad, 6rem) 2rem; background: #ffffff; }
.svc-spot-container { max-width: var(--cf-container, 1100px); margin: 0 auto; }
.svc-spot-header { text-align: center; margin-bottom: 3.5rem; }
.svc-spot-header h2 { font-size: 2.75rem; font-weight: 700; color: #1a202c; margin: 0 0 1rem; }
.svc-spot-header p { font-size: 1.25rem; color: #4a5568; max-width: 700px; margin: 0 auto; }
.svc-spot-rows { display: flex; flex-direction: column; gap: 3rem; }
.svc-spot-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; align-items: center;
  width: 100%; text-align: left; border: none; background: none; padding: 0;
  font-family: inherit; cursor: pointer;
}
.svc-spot-row:nth-child(even) { direction: rtl; }
.svc-spot-row:nth-child(even) > * { direction: ltr; }
.svc-spot-media {
  width: 100%; aspect-ratio: 16 / 10; border-radius: var(--cf-img-radius, 14px);
  overflow: hidden; box-shadow: var(--cf-shadow, 0 16px 40px rgba(0,0,0,0.12));
}
.svc-spot-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
.svc-spot-row:hover .svc-spot-media img { transform: scale(1.04); }
.svc-spot-media--icon { display: flex; align-items: center; justify-content: center; font-size: 3.5rem; }
.svc-spot-title { font-family: '${fontHeading}', sans-serif; font-size: 1.9rem; font-weight: 700; color: #1a202c; margin: 0 0 1rem; }
.svc-spot-desc { font-size: 1.1rem; line-height: 1.7; color: #4a5568; margin: 0 0 1.25rem; }
.svc-more { display: inline-block; font-weight: 600; color: ${primaryColor}; }
@media (max-width: 768px) {
  .services-spotlight { padding: var(--cf-section-pad, 4rem) 1.5rem; }
  .svc-spot-row, .svc-spot-row:nth-child(even) { grid-template-columns: 1fr; direction: ltr; gap: 1.25rem; }
  .svc-spot-header h2 { font-size: 2rem; }
}
</style>
  `.trim();
}
