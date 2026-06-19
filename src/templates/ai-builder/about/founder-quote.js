// Founder-Quote About — a portrait beside a large pull-quote (the story set as
// an oversized blockquote with an accent quote-mark) plus an attribution line.
// Distinct from text-image (paragraph), timeline, and team. Token- and
// dark-aware. Uses the standard about keys (heading/subheading/story/image_url).

export function aboutFounderQuoteTemplate(data, config) {
  const {
    heading = 'About Us',
    subheading = '',
    story = 'We built this around a simple belief: do great work, and treat people right.',
    image_url = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    founder_name = '',
    founder_role = '',
  } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;
  // Attribution is a person/brand signature — only show it when a real name is
  // provided (subheading like "Our Story" would read oddly as an attribution).
  const attribution = founder_name || '';

  return `
<section class="about-founder">
  <div class="about-founder-inner">
    <div class="about-founder-media">
      <img src="${image_url}" alt="${attribution || heading}" width="640" height="760" loading="lazy">
    </div>
    <div class="about-founder-body">
      ${heading ? `<span class="about-founder-eyebrow" style="color:${primaryColor};font-family:'${fontBody}',sans-serif;">${heading}</span>` : ''}
      <blockquote class="about-founder-quote" style="font-family:'${fontHeading}',serif;">
        <span class="about-founder-mark" style="color:${primaryColor};">&ldquo;</span>${story}
      </blockquote>
      ${attribution ? `<div class="about-founder-attr">
        <span class="about-founder-line" style="background:${primaryColor};"></span>
        <div><strong class="about-founder-name">${attribution}</strong>${founder_role ? `<span class="about-founder-role">${founder_role}</span>` : ''}</div>
      </div>` : ''}
    </div>
  </div>
</section>

<style>
.about-founder { padding: var(--cf-section-pad, 6rem) 2rem; background: #ffffff; }
.about-founder-inner { max-width: var(--cf-container, 1120px); margin: 0 auto; display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 3.5rem; align-items: center; }
.about-founder-media { border-radius: var(--cf-img-radius, 14px); overflow: hidden; box-shadow: var(--cf-shadow, 0 20px 50px rgba(0,0,0,.16)); }
.about-founder-media img { display: block; width: 100%; height: 100%; aspect-ratio: 4 / 5; object-fit: cover; }
.about-founder-eyebrow { display: inline-block; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 1.25rem; }
.about-founder-quote { position: relative; font-size: clamp(1.5rem, 3vw, 2.15rem); line-height: 1.4; font-weight: 500; color: #1a202c; margin: 0; }
.about-founder-mark { font-size: 1.2em; line-height: 0; margin-right: 0.1em; }
.about-founder-attr { display: flex; align-items: center; gap: 1rem; margin-top: 2rem; }
.about-founder-line { display: block; width: 44px; height: 3px; border-radius: 2px; flex: 0 0 auto; }
.about-founder-name { display: block; font-size: 1.05rem; color: #1a202c; }
.about-founder-role { display: block; font-size: 0.92rem; color: #718096; }
@media (max-width: 820px) {
  .about-founder { padding: 4rem 1.5rem; }
  .about-founder-inner { grid-template-columns: 1fr; gap: 2.25rem; }
  .about-founder-media { max-width: 360px; }
}
</style>
  `.trim();
}
