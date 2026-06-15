// Boxed CTA — a centered, contained call-to-action card on a light section
// (distinct from the full-bleed gradient banner). Token- and dark-aware.

export function ctaBoxedTemplate(data, config) {
  const { heading = 'Ready to get started?', description = '', cta_text = 'Get Started', cta_url, cta_url_new_tab = false } = data;
  const { primary_color: primaryColor = '#667eea', secondary_color: secondaryColor = '#764ba2', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;

  return `
<section class="cta-boxed">
  <div class="cta-boxed-card" style="background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});">
    <h2 class="cta-boxed-heading" style="font-family: ${fontHeading};">${heading}</h2>
    ${description ? `<p class="cta-boxed-desc" style="font-family: ${fontBody};">${description}</p>` : ''}
    <a href="${cta_url || '#contact'}"${cta_url_new_tab ? ' target="_blank" rel="noopener"' : ''} class="cta-boxed-btn">${cta_text || 'Get Started'}</a>
  </div>
</section>

<style>
.cta-boxed { padding: var(--cf-section-pad, 5rem) 2rem; background: #f7fafc; }
.cta-boxed-card {
  max-width: 960px;
  margin: 0 auto;
  border-radius: var(--cf-radius, 20px);
  box-shadow: var(--cf-shadow, 0 20px 50px rgba(0,0,0,0.18));
  padding: 3.5rem 2.5rem;
  text-align: center;
  color: #fff;
}
.cta-boxed-heading { font-size: clamp(1.9rem, 3.5vw, 2.75rem); font-weight: 700; margin: 0 0 1rem; line-height: 1.2; }
.cta-boxed-desc { font-size: 1.2rem; line-height: 1.6; margin: 0 auto 2rem; max-width: 620px; opacity: 0.95; }
.cta-boxed-btn {
  display: inline-block;
  padding: 1.1rem 3rem;
  background: #fff;
  color: #1a202c;
  text-decoration: none;
  border-radius: var(--cf-btn-radius, 50px);
  font-weight: 600;
  font-size: 1.1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.cta-boxed-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.25); }
@media (max-width: 640px) {
  .cta-boxed-card { padding: 2.5rem 1.5rem; }
}
</style>
  `.trim();
}
