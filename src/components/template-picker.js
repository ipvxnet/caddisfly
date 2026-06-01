// Template Picker Component
// Lets users re-skin the whole site by applying a named theme preset.
// Mirrors color-picker.js. Changing template updates section variants + fonts
// across the whole site; colors and content are preserved.

import { listThemes } from '../utils/site-themes.js';

/**
 * Generate the whole-site template picker UI.
 * @param {string} currentTheme - The currently applied theme key (config.style_theme)
 * @returns {string} Template picker HTML (+ scoped styles)
 */
export function generateTemplatePicker(currentTheme) {
  const themes = listThemes();

  return `
<div class="template-picker-panel">
  <h3 class="picker-title">🧩 Choose a Template</h3>
  <p class="template-hint">Restyle the whole site at once. Your text and colors are kept.</p>

  <div class="template-grid">
    ${themes
      .map(
        (theme) => `
      <button
        class="template-card ${theme.key === currentTheme ? 'selected' : ''}"
        data-theme="${theme.key}"
        onclick="applyTemplate('${theme.key}')"
        title="${theme.description}"
      >
        <div class="template-swatch" style="background: ${theme.accent};"></div>
        <span class="template-name" style="font-family: '${theme.fonts.heading}', serif;">${theme.label}</span>
        <span class="template-desc">${theme.description}</span>
      </button>
    `
      )
      .join('')}
  </div>
</div>

<style>
.template-picker-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

.template-hint {
  font-size: 0.8125rem;
  color: #718096;
  margin: -0.75rem 0 1.25rem 0;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.template-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.template-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.template-card.selected {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102,126,234,0.2);
}

.template-card.applying {
  opacity: 0.6;
  pointer-events: none;
}

.template-swatch {
  height: 40px;
  border-radius: 6px;
}

.template-name {
  font-size: 1rem;
  font-weight: 700;
  color: #1a202c;
}

.template-desc {
  font-size: 0.72rem;
  color: #718096;
  line-height: 1.35;
}
</style>
  `;
}
