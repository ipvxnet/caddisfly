// Tags Hero — full-bleed image with left-aligned content and a row of "feature
// pill" tags under the headline (e.g. Better Sex · More Energy · Strong Muscle).
// Bold and premium; great for clinics, wellness, fitness. Content sits over the
// image with a gradient, so it's always legible (no dark-surface flip needed).
// Same content fields as the other heroes, plus `tags` (array of strings).

export function heroTagsTemplate(data, config) {
  const { heading = 'Welcome', subheading = 'Your business tagline', cta_text, cta_url, cta_link, cta_link_new_tab = false, background_image, tags } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;
  const bg = background_image || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1920';
  const href = cta_link || cta_url || '#contact';
  const pills = (Array.isArray(tags) && tags.length ? tags : ['Trusted', 'Experienced', 'Personalized']).slice(0, 4);

  return `
<section class="hero-tags" style="background-image: linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.15) 100%), url('${bg}');">
  <div class="hero-tags-inner">
    <h1 class="hero-tags-heading" style="font-family: ${fontHeading};">${heading}</h1>
    <div class="hero-tags-pills">
      ${pills.map((t) => `<span class="hero-tag" style="font-family: ${fontBody};">${t}</span>`).join('')}
    </div>
    <p class="hero-tags-sub" style="font-family: ${fontBody};">${subheading}</p>
    ${cta_text ? `<a href="${href}"${cta_link_new_tab ? ' target="_blank" rel="noopener"' : ''} class="hero-tags-cta" style="background: ${primaryColor};">${cta_text}</a>` : ''}
  </div>
</section>

<style>
.hero-tags {
  min-height: 88vh;
  display: flex;
  align-items: center;
  background-size: cover;
  background-position: center;
}
.hero-tags-inner {
  max-width: var(--cf-container, 1200px);
  width: 100%;
  margin: 0 auto;
  padding: 2rem clamp(1.5rem, 5vw, 4rem);
}
.hero-tags-heading {
  font-size: clamp(2.75rem, 7vw, 5.5rem);
  font-weight: 800;
  color: #fff;
  line-height: 1.02;
  letter-spacing: -0.02em;
  margin: 0 0 1.5rem;
  max-width: 14ch;
  text-transform: uppercase;
}
.hero-tags-pills { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.5rem; }
.hero-tag {
  display: inline-block;
  padding: 0.5rem 1.1rem;
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 999px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(4px);
}
.hero-tags-sub { font-size: clamp(1.05rem, 2vw, 1.3rem); color: rgba(255,255,255,0.9); line-height: 1.6; margin: 0 0 2rem; max-width: 46ch; }
.hero-tags-cta {
  display: inline-block;
  padding: 1.05rem 2.75rem;
  color: var(--on-primary, #fff);
  text-decoration: none;
  border-radius: var(--cf-btn-radius, 999px);
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.hero-tags-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(0,0,0,0.35); }
@media (max-width: 640px) {
  .hero-tags { min-height: 78vh; }
  .hero-tags-heading { font-size: clamp(2.25rem, 11vw, 3.25rem); }
}
</style>
  `.trim();
}
