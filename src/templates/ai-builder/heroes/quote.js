// Quote Hero — a split hero built for local home-service trades (roofing, HVAC):
// headline + trust badges + a primary "get a free estimate" CTA and a phone CTA
// on the left, a photo with an overlaid review/estimate card on the right. The
// photo is the LCP element so it stays eager with explicit dimensions. Token-
// and dark-aware; CTA text uses --on-primary so it clears contrast on any brand.

export function heroQuoteTemplate(data, config) {
  const {
    heading = 'Trusted Roofing & HVAC, Done Right',
    subheading = 'Licensed, insured, and on time — with upfront pricing and a workmanship guarantee.',
    cta_text = 'Get a Free Estimate',
    cta_link = '#contact',
    cta_link_new_tab = false,
    secondary_cta_text = '',
    secondary_cta_link = '#contact',
    image_url,
    background_image,
    badges,
    tags,
    rating_text = '★★★★★ Rated 5.0',
  } = data;
  const primaryColor = config.primary_color || config.primaryColor || '#1d4e6f';
  const fontHeading = config.font_heading || config.fontHeading || 'Inter';
  const fontBody = config.font_body || config.fontBody || 'Inter';
  const newTab = cta_link_new_tab ? ' target="_blank" rel="noopener"' : '';
  const img = image_url || background_image || 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=1280&auto=format&q=70';

  const badgeList = (Array.isArray(badges) && badges.length ? badges
    : Array.isArray(tags) && tags.length ? tags
    : ['Licensed & Insured', 'Free Estimates', '24/7 Emergency']).slice(0, 4);

  return `
<section class="hero-quote">
  <div class="hero-quote-inner">
    <div class="hero-quote-copy">
      <span class="hero-quote-rule" style="background:${primaryColor};"></span>
      <h1 class="hero-quote-title" style="font-family:'${fontHeading}',sans-serif;">${heading}</h1>
      <p class="hero-quote-sub" style="font-family:'${fontBody}',sans-serif;">${subheading}</p>
      <ul class="hero-quote-badges" style="font-family:'${fontBody}',sans-serif;">
        ${badgeList.map((b) => `<li class="hq-badge"><span class="hq-check" style="color:${primaryColor};">✓</span>${b}</li>`).join('')}
      </ul>
      <div class="hero-quote-actions">
        <a href="${cta_link}"${newTab} class="hero-quote-cta" style="background:${primaryColor};color:var(--on-primary,#fff);">${cta_text}</a>
        ${secondary_cta_text ? `<a href="${secondary_cta_link}" class="hero-quote-ghost" style="color:${primaryColor};border-color:${primaryColor};">${secondary_cta_text}</a>` : ''}
      </div>
    </div>
    <div class="hero-quote-media">
      <img src="${img}" alt="${heading}" width="720" height="600" fetchpriority="high">
      <div class="hq-card">
        <span class="hq-card-stars">${rating_text}</span>
        <span class="hq-card-label" style="font-family:'${fontBody}',sans-serif;">Trusted by local homeowners</span>
      </div>
    </div>
  </div>
</section>

<style>
.hero-quote { padding: var(--cf-section-pad, 5.5rem) 2rem; background: #ffffff; }
.hero-quote-inner { max-width: var(--cf-container, 1200px); margin: 0 auto; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: clamp(2rem, 5vw, 4rem); align-items: center; }
.hero-quote-rule { display: block; width: 56px; height: 4px; border-radius: 2px; margin: 0 0 1.4rem; }
.hero-quote-title { font-size: clamp(2.3rem, 5vw, 3.8rem); font-weight: 800; line-height: 1.06; letter-spacing: -0.02em; color: #12161c; margin: 0 0 1.1rem; }
.hero-quote-sub { font-size: clamp(1.05rem, 2vw, 1.3rem); line-height: 1.7; color: #4a5568; margin: 0 0 1.6rem; max-width: 560px; }
.hero-quote-badges { list-style: none; padding: 0; margin: 0 0 2rem; display: flex; flex-wrap: wrap; gap: 0.6rem 1.4rem; }
.hq-badge { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 1rem; font-weight: 600; color: #2d3748; }
.hq-check { font-weight: 800; }
.hero-quote-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
.hero-quote-cta { display: inline-block; padding: 1rem 2.4rem; border-radius: var(--cf-btn-radius, 8px); font-weight: 700; text-decoration: none; box-shadow: var(--cf-shadow-sm, 0 6px 18px rgba(0,0,0,.12)); transition: transform .2s ease, box-shadow .2s ease; }
.hero-quote-cta:hover { transform: translateY(-2px); box-shadow: var(--cf-shadow, 0 12px 30px rgba(0,0,0,.18)); }
.hero-quote-ghost { display: inline-block; padding: 1rem 2.1rem; border-radius: var(--cf-btn-radius, 8px); font-weight: 600; text-decoration: none; border: 1.5px solid; background: transparent; transition: opacity .2s ease; }
.hero-quote-ghost:hover { opacity: 0.72; }
.hero-quote-media { position: relative; }
.hero-quote-media img { display: block; width: 100%; height: auto; aspect-ratio: 6 / 5; object-fit: cover; border-radius: var(--cf-img-radius, 14px); box-shadow: var(--cf-shadow, 0 24px 60px rgba(0,0,0,.16)); }
.hq-card { position: absolute; left: -12px; bottom: -16px; background: #fff; border-radius: var(--cf-radius, 14px); padding: 0.9rem 1.2rem; box-shadow: var(--cf-shadow, 0 16px 40px rgba(0,0,0,.18)); display: flex; flex-direction: column; gap: 0.15rem; }
.hq-card-stars { color: #f5a623; font-size: 1.05rem; font-weight: 800; letter-spacing: 1px; }
.hq-card-label { font-size: 0.85rem; color: #4a5568; }
@media (max-width: 860px) {
  .hero-quote { padding: 3.5rem 1.25rem; }
  .hero-quote-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .hero-quote-media img { aspect-ratio: 4 / 3; }
  .hq-card { left: 12px; bottom: 12px; }
}
</style>
  `.trim();
}
