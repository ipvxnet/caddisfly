// Services "numbered" — an editorial numbered list (01, 02, 03…) of services,
// each row clickable to open the shared service modal. Distinct from cards/
// icon-grid/spotlight. Token- and dark-aware.

import { serviceCardAttrs, serviceModalAssets, serviceLabels } from './service-modal.js';

export function servicesNumberedTemplate(data, config) {
  const { heading = 'Our Services', description = '', services } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter' } = config;
  const labels = serviceLabels(config.lang || 'en');

  const list = Array.isArray(services) && services.length ? services : [{ title: 'Service', description: '' }];

  const rows = list
    .map((s, i) => `
      <button type="button" class="svc-num-row" ${serviceCardAttrs(s)}>
        <span class="svc-num-index">${String(i + 1).padStart(2, '0')}</span>
        <span class="svc-num-body">
          <span class="svc-num-title">${s.title || ''}</span>
          <span class="svc-num-desc">${s.description || ''}</span>
        </span>
        <span class="svc-num-arrow" aria-hidden="true">→</span>
      </button>`)
    .join('');

  return `
<section class="services-numbered">
  <div class="svc-num-container">
    <div class="svc-num-header">
      <h2 style="font-family: ${fontHeading};">${heading}</h2>
      ${description ? `<p>${description}</p>` : ''}
    </div>
    <div class="svc-num-list">${rows}</div>
  </div>
  ${serviceModalAssets(config)}
</section>

<style>
.services-numbered { padding: var(--cf-section-pad, 6rem) 2rem; background: #ffffff; }
.svc-num-container { max-width: var(--cf-container, 900px); margin: 0 auto; }
.svc-num-header { text-align: center; margin-bottom: 3rem; }
.svc-num-header h2 { font-size: 2.75rem; font-weight: 700; color: #1a202c; margin: 0 0 1rem; }
.svc-num-header p { font-size: 1.25rem; color: #4a5568; }
.svc-num-list { display: flex; flex-direction: column; }
.svc-num-row {
  display: flex; align-items: center; gap: 1.5rem; width: 100%; text-align: left;
  padding: 1.75rem 0.5rem; border: none; border-top: 1px solid rgba(0,0,0,0.08);
  background: none; font-family: inherit; cursor: pointer; transition: padding-left 0.2s ease;
}
.svc-num-list .svc-num-row:last-child { border-bottom: 1px solid rgba(0,0,0,0.08); }
.svc-num-row:hover { padding-left: 1.25rem; }
.svc-num-index { font-family: '${fontHeading}', sans-serif; font-size: 1.5rem; font-weight: 700; color: ${primaryColor}; min-width: 2.5rem; }
.svc-num-body { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.svc-num-title { font-family: '${fontHeading}', sans-serif; font-size: 1.4rem; font-weight: 600; color: #1a202c; }
.svc-num-desc { font-size: 1rem; color: #4a5568; }
.svc-num-arrow { color: ${primaryColor}; font-size: 1.4rem; opacity: 0; transition: opacity 0.2s ease; }
.svc-num-row:hover .svc-num-arrow { opacity: 1; }
@media (max-width: 600px) {
  .services-numbered { padding: var(--cf-section-pad, 4rem) 1.5rem; }
  .svc-num-header h2 { font-size: 2rem; }
  .svc-num-index { font-size: 1.2rem; min-width: 2rem; }
  .svc-num-title { font-size: 1.15rem; }
}
</style>
  `.trim();
}
