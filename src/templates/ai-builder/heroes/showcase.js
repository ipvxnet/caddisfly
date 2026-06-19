// Showcase Hero — editorial: a centered headline + dual CTAs sitting ABOVE a
// wide, cinematic image band (distinct from split's side-by-side, centered's
// text-on-image, and fullscreen's overlay). Token- and dark-aware; the image
// is the LCP element so it stays eager with explicit dimensions.

import { uiText } from '../section-defaults.js';

export function heroShowcaseTemplate(data, config) {
  const lang = config.lang || 'en';
  const {
    heading = 'Welcome',
    subheading = 'Your business tagline',
    cta_text = uiText(lang, 'cta'),
    cta_link = '#contact',
    cta_link_new_tab = false,
    secondary_cta_text = '',
    secondary_cta_link = '#about',
    image_url = 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1280&auto=format&q=70',
  } = data;
  const { primary_color: primaryColor = '#667eea', secondary_color: secondaryColor = '#764ba2', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;
  const newTab = cta_link_new_tab ? ' target="_blank" rel="noopener"' : '';

  return `
<section class="hero-showcase">
  <div class="hero-showcase-head">
    <span class="hero-showcase-rule" style="background:${primaryColor};"></span>
    <h1 class="hero-showcase-title" style="font-family:'${fontHeading}',sans-serif;">${heading}</h1>
    <p class="hero-showcase-sub" style="font-family:'${fontBody}',sans-serif;">${subheading}</p>
    <div class="hero-showcase-actions">
      <a href="${cta_link}"${newTab} class="hero-showcase-cta" style="background:${primaryColor};color:var(--on-primary,#fff);">${cta_text}</a>
      ${secondary_cta_text ? `<a href="${secondary_cta_link}" class="hero-showcase-ghost" style="color:${primaryColor};border-color:${primaryColor};">${secondary_cta_text}</a>` : ''}
    </div>
  </div>
  <div class="hero-showcase-media">
    <img src="${image_url}" alt="${heading}" width="1600" height="760" fetchpriority="high">
  </div>
</section>

<style>
.hero-showcase { padding: var(--cf-section-pad, 5.5rem) 2rem 0; background: #ffffff; }
.hero-showcase-head { max-width: 880px; margin: 0 auto; text-align: center; }
.hero-showcase-rule { display: block; width: 64px; height: 4px; border-radius: 2px; margin: 0 auto 1.6rem; }
.hero-showcase-title { font-size: clamp(2.6rem, 6vw, 4.4rem); font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; color: #12161c; margin: 0 0 1.1rem; }
.hero-showcase-sub { font-size: clamp(1.05rem, 2.2vw, 1.35rem); line-height: 1.7; color: #4a5568; max-width: 640px; margin: 0 auto 2rem; }
.hero-showcase-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-bottom: 3.2rem; }
.hero-showcase-cta { display: inline-block; padding: 0.95rem 2.4rem; border-radius: var(--cf-btn-radius, 8px); font-weight: 700; text-decoration: none; box-shadow: var(--cf-shadow-sm, 0 6px 18px rgba(0,0,0,.12)); transition: transform .2s ease, box-shadow .2s ease; }
.hero-showcase-cta:hover { transform: translateY(-2px); box-shadow: var(--cf-shadow, 0 12px 30px rgba(0,0,0,.18)); }
.hero-showcase-ghost { display: inline-block; padding: 0.95rem 2.1rem; border-radius: var(--cf-btn-radius, 8px); font-weight: 600; text-decoration: none; border: 1.5px solid; background: transparent; transition: opacity .2s ease; }
.hero-showcase-ghost:hover { opacity: 0.72; }
.hero-showcase-media { max-width: var(--cf-container, 1240px); margin: 0 auto; border-radius: var(--cf-img-radius, 14px); overflow: hidden; box-shadow: var(--cf-shadow, 0 24px 60px rgba(0,0,0,.16)); }
.hero-showcase-media img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 8; object-fit: cover; }
@media (max-width: 768px) {
  .hero-showcase { padding: 3.5rem 1.25rem 0; }
  .hero-showcase-media img { aspect-ratio: 4 / 3; }
}
</style>
  `.trim();
}
