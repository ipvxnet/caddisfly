// Features — "columns": a full-bleed band of equal-height panels. The first
// panel is an image-backed intro (heading + description); each feature becomes a
// panel alternating the brand color and light grey. Colors are inline + !important
// so the band stays branded on any theme (no dark-layer recolor needed).

import { sectionDefault, defaultItems } from '../section-defaults.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function featuresColumnsTemplate(data, config) {
  const lang = config.lang || 'en';
  const {
    heading = sectionDefault(lang, 'features', 0),
    description = '',
    features,
    background_image = '',
    image = '',
  } = data;
  const items = (Array.isArray(features) && features.length) ? features : defaultItems(lang, 'features-columns');
  const primary = config.primary_color || config.primaryColor || '#2b305c';
  const fontHeading = config.font_heading || config.fontHeading || 'Inter';
  const bg = background_image || image || '';

  const introStyle = bg
    ? `background-image:linear-gradient(rgba(10,14,25,0.72),rgba(10,14,25,0.72)),url('${esc(bg)}');background-size:cover;background-position:center;`
    : `background:${primary};`;

  const panels = items.map((f, i) => {
    const dark = i % 2 === 0; // first feature panel = brand color, then grey, …
    const panelBg = dark ? primary : '#e2e5ea';
    const titleCol = dark ? '#ffffff' : primary;
    const descCol = dark ? 'rgba(255,255,255,0.85)' : '#4a5568';
    return `<div class="fcol-panel" style="background:${panelBg}">
      <h3 class="fcol-title" style="color:${titleCol} !important;font-family:${fontHeading},sans-serif">${esc(f.title)}</h3>
      <p class="fcol-desc" style="color:${descCol} !important">${esc(f.description)}</p>
    </div>`;
  }).join('');

  return `
<section class="features-columns-section">
  <div class="fcol-row">
    <div class="fcol-panel fcol-intro" style="${introStyle}">
      <h2 class="fcol-intro-title" style="font-family:${fontHeading},sans-serif">${esc(heading)}</h2>
      ${description ? `<p class="fcol-intro-desc">${esc(description)}</p>` : ''}
    </div>
    ${panels}
  </div>
</section>

<style>
.features-columns-section { width: 100%; }
.fcol-row { display: flex; flex-wrap: wrap; align-items: stretch; }
.fcol-panel { flex: 1 1 0; min-width: 210px; padding: 3rem 2rem; display: flex; flex-direction: column; justify-content: center; }
.fcol-intro-title { font-size: clamp(1.5rem, 2.2vw, 2rem); font-weight: 800; color: #ffffff !important; margin: 0 0 1rem; line-height: 1.15; }
.fcol-intro-desc { color: rgba(255,255,255,0.85) !important; font-size: 1rem; line-height: 1.6; margin: 0; }
.fcol-title { font-size: clamp(1.4rem, 2vw, 1.9rem); font-weight: 800; margin: 0 0 1rem; line-height: 1.15; }
.fcol-desc { font-size: 1rem; line-height: 1.6; margin: 0; }
@media (max-width: 768px) { .fcol-panel { flex: 1 1 100%; padding: 2.25rem 1.75rem; } }
</style>
  `.trim();
}
