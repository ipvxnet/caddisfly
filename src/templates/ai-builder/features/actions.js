// Quick-Action cards — a compact row of elevated icon cards right under the hero
// that link to key actions (Book, Order, Call, Find Us). Common on local-service
// sites (vets, clinics, salons). Token- and dark-aware. Uses the `features` array
// shape: { icon, title, description, link }.

export function featuresActionsTemplate(data, config) {
  const { heading = '', description = '', features } = data;
  const primaryColor = config.primary_color || config.primaryColor || '#667eea';
  const fontHeading = config.font_heading || config.fontHeading || 'Inter';
  const fontBody = config.font_body || config.fontBody || 'Inter';

  const actions = (Array.isArray(features) && features.length ? features : [
    { icon: '📅', title: 'Book Appointment', description: 'Schedule online in seconds', link: '#contact' },
    { icon: '📞', title: 'Call Us', description: 'We’re happy to help', link: '#contact' },
    { icon: '📍', title: 'Find Us', description: 'Get directions', link: '#contact' },
  ]).slice(0, 4);

  return `
<section class="features-actions">
  <div class="features-actions-container">
    ${heading ? `<div class="features-actions-header"><h2 style="font-family: ${fontHeading};">${heading}</h2>${description ? `<p style="font-family: ${fontBody};">${description}</p>` : ''}</div>` : ''}
    <div class="features-actions-grid">
      ${actions.map((a) => `
        <a class="action-card" href="${a.link || '#contact'}">
          <span class="action-icon" style="color: ${primaryColor};">${a.icon || '⭐'}</span>
          <span class="action-title" style="font-family: ${fontHeading};">${a.title || ''}</span>
          ${a.description ? `<span class="action-desc" style="font-family: ${fontBody};">${a.description}</span>` : ''}
          <span class="action-arrow" style="color: ${primaryColor};">→</span>
        </a>
      `).join('')}
    </div>
  </div>
</section>

<style>
.features-actions { padding: clamp(3rem, 6vw, 5rem) 2rem; background: #f7fafc; }
.features-actions-container { max-width: var(--cf-container, 1100px); margin: 0 auto; }
.features-actions-header { text-align: center; margin-bottom: 2.5rem; }
.features-actions-header h2 { font-size: 2.25rem; font-weight: 700; color: #1a202c; margin: 0 0 0.75rem; }
.features-actions-header p { font-size: 1.1rem; color: #4a5568; margin: 0; }
.features-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}
.action-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1.75rem 1.5rem;
  background: #fff;
  border-radius: var(--cf-radius, 14px);
  box-shadow: var(--cf-shadow-sm, 0 8px 24px rgba(0,0,0,0.08));
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.action-card:hover { transform: translateY(-4px); box-shadow: var(--cf-shadow, 0 16px 36px rgba(0,0,0,0.14)); }
.action-icon { font-size: 2.25rem; line-height: 1; }
.action-title { font-size: 1.2rem; font-weight: 700; color: #1a202c; }
.action-desc { font-size: 0.92rem; color: #718096; line-height: 1.45; }
.action-arrow { font-size: 1.1rem; font-weight: 700; margin-top: 0.35rem; }
@media (max-width: 640px) { .features-actions-grid { grid-template-columns: 1fr; } }
</style>
  `.trim();
}
