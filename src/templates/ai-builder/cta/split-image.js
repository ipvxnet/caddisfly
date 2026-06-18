// Split-image CTA — a two-up band: copy + button on one side, a photo on the
// other (falls back to a brand-gradient panel with a glyph when no image is
// set, so it always looks intentional). Distinct from the full-bleed banner and
// the centered boxed card. Token- and dark-aware.

export function ctaSplitImageTemplate(data, config) {
  const { heading = 'Ready to get started?', description = '', cta_text = 'Get Started', cta_url, cta_url_new_tab = false, image_url = '' } = data;
  const { primary_color: primaryColor = '#667eea', secondary_color: secondaryColor = '#764ba2', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;
  const newTab = cta_url_new_tab ? ' target="_blank" rel="noopener"' : '';

  const media = image_url
    ? `<div class="cta-split-media"><img src="${image_url}" alt="${heading}" width="900" height="700" loading="lazy"></div>`
    : `<div class="cta-split-media cta-split-media--fill" style="background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});"><span class="cta-split-glyph">✦</span></div>`;

  return `
<section class="cta-split">
  <div class="cta-split-inner">
    <div class="cta-split-copy">
      <h2 class="cta-split-heading" style="font-family:'${fontHeading}',sans-serif;">${heading}</h2>
      ${description ? `<p class="cta-split-desc" style="font-family:'${fontBody}',sans-serif;">${description}</p>` : ''}
      <a href="${cta_url || '#contact'}"${newTab} class="cta-split-btn" style="background:${primaryColor};color:var(--on-primary,#fff);">${cta_text || 'Get Started'}</a>
    </div>
    ${media}
  </div>
</section>

<style>
.cta-split { padding: var(--cf-section-pad, 5rem) 2rem; background: #ffffff; }
.cta-split-inner { max-width: var(--cf-container, 1120px); margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-radius: var(--cf-radius, 16px); overflow: hidden; box-shadow: var(--cf-shadow, 0 18px 50px rgba(0,0,0,.12)); }
.cta-split-copy { padding: clamp(2rem, 5vw, 3.75rem); display: flex; flex-direction: column; align-items: flex-start; justify-content: center; background: #f9fafb; }
.cta-split-heading { font-size: clamp(1.8rem, 3.2vw, 2.5rem); font-weight: 800; line-height: 1.15; color: #12161c; margin: 0 0 1rem; }
.cta-split-desc { font-size: 1.08rem; line-height: 1.7; color: #4a5568; margin: 0 0 1.75rem; }
.cta-split-btn { display: inline-block; padding: 0.95rem 2.4rem; border-radius: var(--cf-btn-radius, 8px); font-weight: 700; text-decoration: none; box-shadow: var(--cf-shadow-sm, 0 6px 18px rgba(0,0,0,.12)); transition: transform .2s ease; }
.cta-split-btn:hover { transform: translateY(-2px); }
.cta-split-media { position: relative; min-height: 280px; }
.cta-split-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cta-split-media--fill { display: flex; align-items: center; justify-content: center; }
.cta-split-glyph { font-size: 4rem; color: rgba(255,255,255,0.85); }
@media (max-width: 820px) {
  .cta-split { padding: 3.5rem 1.25rem; }
  .cta-split-inner { grid-template-columns: 1fr; }
  .cta-split-media { min-height: 220px; }
}
</style>
  `.trim();
}
