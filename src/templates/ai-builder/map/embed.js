// Map section — an embedded Google Map for the business address with a
// "Get Directions" button. Uses the keyless Google Maps embed
// (maps?q=<address>&output=embed), so no API key is needed. Facade-friendly:
// the iframe lazy-loads. When no address is set yet it shows a gentle prompt.

import { sectionDefault } from '../section-defaults.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

export function mapEmbedTemplate(data, config) {
  const lang = config.lang || 'en';
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter' } = config;
  const {
    heading = '',
    subheading = '',
    address = '',
    button_text = '',
    show_directions = true,
    zoom = 15,
  } = data;
  const PROMPT = {
    en: 'Add your address in the editor to show the map.',
    es: 'Agrega tu dirección en el editor para mostrar el mapa.',
    pt: 'Adicione seu endereço no editor para exibir o mapa.',
  }[lang] || 'Add your address in the editor to show the map.';
  const dirLabel = button_text || { en: 'Get Directions', es: 'Cómo Llegar', pt: 'Como Chegar' }[lang] || 'Get Directions';

  const wantDir = show_directions !== false && show_directions !== 'no';
  const addr = String(address || '').trim();
  const q = encodeURIComponent(addr);
  const z = Math.min(20, Math.max(1, parseInt(zoom, 10) || 15));
  const embedSrc = addr ? `https://www.google.com/maps?q=${q}&z=${z}&output=embed` : '';
  const dirHref = addr ? `https://www.google.com/maps/dir/?api=1&destination=${q}` : '';

  const header = (heading || subheading) ? `
    <div class="map-header">
      ${heading ? `<h2 class="map-heading" style="font-family:'${fontHeading}',sans-serif;">${esc(heading)}</h2>` : ''}
      ${subheading ? `<p class="map-sub">${esc(subheading)}</p>` : ''}
    </div>` : '';

  const inner = embedSrc
    ? `<iframe class="map-frame" src="${escAttr(embedSrc)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen title="${escAttr(heading || 'Map')}"></iframe>
       ${(wantDir && dirHref) ? `<a class="map-directions" href="${escAttr(dirHref)}" target="_blank" rel="noopener" style="background:${primaryColor};color:var(--on-primary,#fff);">➤ ${esc(dirLabel)}</a>` : ''}`
    : `<div class="map-empty">📍 ${esc(PROMPT)}</div>`;

  return `
<section class="map-section">
  ${header}
  <div class="map-wrap">${inner}</div>
</section>

<style>
.map-section { background: #fff; }
.map-header { text-align: center; max-width: var(--cf-container, 1200px); margin: 0 auto; padding: var(--cf-section-pad, 4rem) 2rem 1.5rem; }
.map-heading { font-size: clamp(1.8rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; margin: 0 0 0.5rem; }
.map-sub { font-size: 1.15rem; color: #4a5568; margin: 0; }
.map-wrap { position: relative; width: 100%; }
.map-frame { display: block; width: 100%; height: 460px; border: 0; }
.map-empty { display: flex; align-items: center; justify-content: center; min-height: 280px; background: #f1f5f9; color: #64748b; font-size: 1.05rem; text-align: center; padding: 2rem; }
.map-directions { position: absolute; top: 1.25rem; left: 1.25rem; display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.3rem; border-radius: var(--cf-btn-radius, 8px); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.9rem; text-decoration: none; box-shadow: 0 6px 18px rgba(0,0,0,0.2); }
.map-directions:hover { transform: translateY(-2px); }
@media (max-width: 768px) {
  .map-header { padding: 3rem 1.25rem 1.25rem; }
  .map-frame { height: 340px; }
  .map-directions { top: 0.85rem; left: 0.85rem; padding: 0.6rem 1rem; font-size: 0.8rem; }
}
</style>
  `.trim();
}
