// Template Picker Component
// Lets users re-skin the whole site by applying a named theme preset. Each card
// shows a real mini-mockup (the template's actual colors, fonts, radius/shadow
// tokens), and the industry match is badged "Recommended". Applying a template
// updates section variants + fonts + tokens; content is preserved.

import { listThemes, TOKEN_PRESETS } from '../utils/site-themes.js';
import { translator } from '../i18n/index.js';

/** A small scaled mockup that conveys a template's real look (color/font/tokens). */
function templateMock(theme) {
  const t = TOKEN_PRESETS[theme.tokens] || TOKEN_PRESETS.classic;
  const dark = theme.mode === 'dark';
  const bg = dark ? theme.surface.bg : '#ffffff';
  const card = dark ? theme.surface.card : '#eef2f7';
  const muted = dark ? theme.surface.muted : '#cbd5e0';
  const primary = (theme.colors && theme.colors.primary) || '#667eea';
  return `
    <div class="tpl-mock" style="background:${bg};">
      <div class="tpl-mock-nav">
        <span class="tpl-mock-brand" style="color:${primary};font-family:'${theme.fonts.heading}',serif;">Aa</span>
        <span class="tpl-mock-links"><i style="background:${muted}"></i><i style="background:${muted}"></i><i style="background:${muted}"></i></span>
      </div>
      <div class="tpl-mock-hero" style="background:${theme.accent};">
        <span class="tpl-mock-h" style="font-family:'${theme.fonts.heading}',serif;">${theme.label}</span>
        <span class="tpl-mock-btn" style="border-radius:${t.btnRadius};"></span>
      </div>
      <div class="tpl-mock-cards">
        <span class="tpl-mock-card" style="background:${card};border-radius:${t.radius};box-shadow:${t.shadowSm};"></span>
        <span class="tpl-mock-card" style="background:${card};border-radius:${t.radius};box-shadow:${t.shadowSm};"></span>
        <span class="tpl-mock-card" style="background:${card};border-radius:${t.radius};box-shadow:${t.shadowSm};"></span>
      </div>
    </div>`;
}

/**
 * Generate the whole-site template picker UI.
 * @param {string} currentTheme - currently applied theme key (config.style_theme)
 * @param {string} lang - UI language
 * @param {string} [recommendedKey] - template key recommended for this business
 * @returns {string} Template picker HTML (+ scoped styles)
 */
export function generateTemplatePicker(currentTheme, lang = 'en', recommendedKey = null, projectId = '') {
  const tr = translator(lang);
  const recoLabel = tr('pick.tpl_recommended');
  // Carry the project id so the showcase can APPLY a chosen template back to this
  // site (instead of its default "start a new site" action).
  const browseHref = '/templates' + (projectId ? `?apply=${encodeURIComponent(projectId)}` : '');

  // Surface the most relevant templates first: recommended, then the one in use,
  // then the rest — so the user rarely has to scroll to act.
  const themes = listThemes().slice().sort((a, b) => {
    const rank = (t) => (t.key === recommendedKey ? 0 : t.key === currentTheme ? 1 : 2);
    return rank(a) - rank(b);
  });
  const count = themes.length;

  return `
<div class="template-picker-panel">
  <div class="picker-head">
    <div>
      <h3 class="picker-title">${tr('pick.tpl_title')}</h3>
      <p class="template-hint">${tr('pick.tpl_hint')}</p>
    </div>
    <a class="picker-browse" href="${browseHref}" target="_blank" rel="noopener">${tr('pick.tpl_browse')} ↗</a>
  </div>

  <div class="template-scroll">
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
        ${theme.key === recommendedKey ? `<span class="template-reco">★ ${recoLabel}</span>` : ''}
        ${theme.key === currentTheme ? `<span class="template-current">✓</span>` : ''}
        ${templateMock(theme)}
        <span class="template-name" style="font-family: '${theme.fonts.heading}', serif;">${theme.label}</span>
      </button>
    `
      )
      .join('')}
  </div>
  </div>
  <p class="picker-foot">${count} ${tr('pick.tpl_count_suffix')} · <a href="${browseHref}" target="_blank" rel="noopener">${tr('pick.tpl_browse')} ↗</a></p>
</div>

<style>
.template-picker-panel { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
.picker-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.picker-browse { flex-shrink: 0; font-size: 0.8rem; font-weight: 700; color: #667eea; text-decoration: none; white-space: nowrap; }
.picker-browse:hover { text-decoration: underline; }
.template-hint { font-size: 0.8125rem; color: #718096; margin: 0.15rem 0 1rem 0; }
/* Cap the height so 20+ templates don't dominate the panel — scroll inside. */
.template-scroll { max-height: 430px; overflow-y: auto; margin: 0 -0.25rem; padding: 0.25rem; }
.template-scroll::-webkit-scrollbar { width: 8px; }
.template-scroll::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 999px; }
.template-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
.template-card { position: relative; background: white; border: 2px solid #e2e8f0; border-radius: 10px; padding: 0.45rem; cursor: pointer; transition: all 0.2s; text-align: left; display: flex; flex-direction: column; gap: 0.35rem; }
.template-card:hover { border-color: #667eea; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.template-card.selected { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.2); }
.template-card.applying { opacity: 0.6; pointer-events: none; }
.template-reco { position: absolute; top: 5px; left: 5px; z-index: 2; background: #16a34a; color: #fff; font-size: 0.56rem; font-weight: 700; padding: 2px 6px; border-radius: 999px; letter-spacing: 0.02em; }
.template-current { position: absolute; top: 5px; right: 5px; z-index: 2; width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; background: #667eea; color: #fff; font-size: 0.6rem; font-weight: 800; border-radius: 50%; }
.template-name { font-size: 0.85rem; font-weight: 700; color: #1a202c; line-height: 1.1; }
.picker-foot { font-size: 0.74rem; color: #94a3b8; margin: 0.85rem 0 0; text-align: center; }
.picker-foot a { color: #667eea; font-weight: 600; text-decoration: none; }
@media (max-width: 600px) { .template-grid { grid-template-columns: repeat(2, 1fr); } }

/* Mini mockup */
.tpl-mock { border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); }
.tpl-mock-nav { display: flex; align-items: center; justify-content: space-between; padding: 4px 7px; }
.tpl-mock-brand { font-size: 9px; font-weight: 800; line-height: 1; }
.tpl-mock-links { display: flex; gap: 3px; }
.tpl-mock-links i { width: 8px; height: 3px; border-radius: 2px; display: block; }
.tpl-mock-hero { height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; }
.tpl-mock-h { font-size: 11px; font-weight: 800; color: #fff; line-height: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.25); }
.tpl-mock-btn { width: 28px; height: 7px; background: #fff; display: block; }
.tpl-mock-cards { display: flex; gap: 5px; padding: 7px; }
.tpl-mock-card { flex: 1; height: 22px; display: block; }
</style>
  `;
}
