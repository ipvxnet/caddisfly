// Font Picker Component
// Lets users change the site's typeface via curated heading+body pairings.
// Sizes/layout stay fixed (hardcoded in templates); only the font family changes.
// Mirrors color-picker.js; reuses the global showNotification() it defines.

import { listFontPairings, findPairing } from '../utils/font-pairings.js';
import { translator } from '../i18n/index.js';

/**
 * Generate the font picker UI.
 * @param {object} config - Current website config (font_heading/font_body)
 * @param {string} projectId - Project ID
 * @param {string} lang - UI language
 * @returns {string} Font picker HTML (+ styles + script)
 */
export function generateFontPicker(config, projectId, lang = 'en') {
  const tr = translator(lang);
  const pairings = listFontPairings();
  const selected = findPairing(config.font_heading, config.font_body);
  const selectedKey = selected ? selected.key : '';

  // One Google Fonts link so the card previews render in their real typefaces.
  const familyParams = pairings
    .flatMap((p) => [p.heading, p.body])
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((name) => `family=${encodeURIComponent(name)}:wght@400;600;700`)
    .join('&');
  const fontsHref = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;

  return `
<link href="${fontsHref}" rel="stylesheet">
<div class="font-picker-panel">
  <h3 class="picker-title">${tr('pick.font_title')}</h3>
  <p class="font-hint">${tr('pick.font_hint')}</p>

  <div class="font-grid">
    ${pairings
      .map(
        (p) => `
      <button
        class="font-card ${p.key === selectedKey ? 'selected' : ''}"
        data-font-key="${p.key}"
        onclick="applyFonts('${p.heading.replace(/'/g, "\\'")}', '${p.body.replace(/'/g, "\\'")}', this)"
        title="${p.label}"
      >
        <span class="font-card-heading" style="font-family: '${p.heading}', serif;">${p.heading}</span>
        <span class="font-card-body" style="font-family: '${p.body}', sans-serif;">${p.body} — Aa Bb Cc 123</span>
      </button>
    `
      )
      .join('')}
  </div>
</div>

<style>
.font-picker-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

.font-hint {
  font-size: 0.8125rem;
  color: #718096;
  margin: -0.75rem 0 1.25rem 0;
}

.font-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.font-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 64px;
  justify-content: center;
}

.font-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.font-card.selected {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102,126,234,0.2);
}

.font-card.applying {
  opacity: 0.6;
  pointer-events: none;
}

.font-card-heading {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a202c;
  line-height: 1.2;
}

.font-card-body {
  font-size: 0.78rem;
  color: #718096;
}
</style>

<script>
window.fontPickerProjectId = '${projectId}';

async function applyFonts(heading, body, card) {
  document.querySelectorAll('.font-card.applying').forEach(c => c.classList.remove('applying'));
  if (card) card.classList.add('applying');

  try {
    const response = await fetch(\`/api/ai-builder/\${window.fontPickerProjectId}/config/fonts\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ font_heading: heading, font_body: body })
    });
    const data = await response.json();

    if (data.success) {
      // Mark the clicked card selected.
      document.querySelectorAll('.font-card').forEach(c => c.classList.remove('selected'));
      if (card) { card.classList.remove('applying'); card.classList.add('selected'); }

      // Reload just the preview iframe.
      const previewIframe = document.getElementById('preview-iframe');
      if (previewIframe) previewIframe.contentWindow.location.reload();

      showNotification(${JSON.stringify(tr('pick.fonts_updated'))}, 'success');
    } else {
      throw new Error(data.error || ${JSON.stringify(tr('pick.fonts_failed'))});
    }
  } catch (error) {
    if (card) card.classList.remove('applying');
    alert(${JSON.stringify(tr('pick.fonts_failed'))} + ': ' + error.message);
  }
}
</script>
  `;
}
