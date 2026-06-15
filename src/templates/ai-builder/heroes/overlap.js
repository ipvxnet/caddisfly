// Overlap Hero — a wide background photo with a content card overlapping its
// lower edge. Modern/editorial, distinct from fullscreen/split/centered/minimal.
// Token- and dark-aware. Same content fields as the other heroes.

export function heroOverlapTemplate(data, config) {
  const { heading = 'Welcome', subheading = 'Your business tagline', cta_text, cta_url, cta_link, cta_link_new_tab = false, background_image } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;
  const bg = background_image || 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920';
  const href = cta_link || cta_url || '#contact';

  return `
<section class="hero-overlap">
  <div class="hero-overlap-media" style="background-image: linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.35)), url('${bg}');"></div>
  <div class="hero-overlap-card">
    <h1 class="hero-overlap-heading" style="font-family: ${fontHeading};">${heading}</h1>
    <p class="hero-overlap-sub" style="font-family: ${fontBody};">${subheading}</p>
    ${cta_text ? `<a href="${href}"${cta_link_new_tab ? ' target="_blank" rel="noopener"' : ''} class="hero-overlap-cta">${cta_text}</a>` : ''}
  </div>
</section>

<style>
.hero-overlap { background: #f7fafc; padding-bottom: 4rem; }
.hero-overlap-media {
  height: 64vh; min-height: 420px;
  background-size: cover; background-position: center;
}
.hero-overlap-card {
  position: relative;
  max-width: 780px;
  margin: -8rem auto 0;
  background: #ffffff;
  border-radius: var(--cf-radius, 16px);
  box-shadow: var(--cf-shadow, 0 24px 60px rgba(0,0,0,0.18));
  padding: 3rem 3rem 3.25rem;
  text-align: center;
}
.hero-overlap-heading {
  font-size: clamp(2.25rem, 4.5vw, 3.5rem);
  font-weight: 800;
  color: #1a202c;
  line-height: 1.1;
  margin: 0 0 1.25rem;
  letter-spacing: -0.02em;
}
.hero-overlap-sub { font-size: 1.25rem; color: #4a5568; line-height: 1.6; margin: 0 0 2rem; }
.hero-overlap-cta {
  display: inline-block;
  padding: 1.05rem 2.75rem;
  background: ${primaryColor};
  color: #fff;
  text-decoration: none;
  border-radius: var(--cf-btn-radius, 10px);
  font-weight: 600;
  font-size: 1.1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.hero-overlap-cta:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,0.18); }
@media (max-width: 640px) {
  .hero-overlap-media { height: 46vh; min-height: 300px; }
  .hero-overlap-card { margin: -5rem 1rem 0; padding: 2rem 1.5rem 2.25rem; }
}
</style>
  `.trim();
}
