// Process Steps — a numbered "how it works / my approach" section. Each step is
// a card with a big number badge, title, and short description, connected in a
// gentle flow. Common on therapy, coaching, consulting, and service sites where
// the journey matters. Uses the `features` array shape { icon, title, description }.
// Token- and dark-aware; the number badge uses --on-primary for readable text.

export function featuresStepsTemplate(data, config) {
  const { heading = 'How It Works', description = '', features } = data;
  const primaryColor = config.primary_color || config.primaryColor || '#6b8cae';
  const fontHeading = config.font_heading || config.fontHeading || 'Inter';
  const fontBody = config.font_body || config.fontBody || 'Inter';

  const steps = (Array.isArray(features) && features.length ? features : [
    { title: 'Reach Out', description: 'Book a free, no-pressure consultation to share what’s on your mind.', icon: '💬' },
    { title: 'First Session', description: 'We get to know each other and shape a plan that fits your goals.', icon: '🤝' },
    { title: 'Ongoing Support', description: 'Regular sessions and steady progress, at a pace that feels right.', icon: '🌱' },
  ]).slice(0, 4);

  return `
<section class="features-steps">
  <div class="features-steps-container">
    ${heading ? `<div class="features-steps-header"><h2 style="font-family: ${fontHeading};">${heading}</h2>${description ? `<p style="font-family: ${fontBody};">${description}</p>` : ''}</div>` : ''}
    <ol class="features-steps-grid">
      ${steps.map((s, i) => `
        <li class="step-card">
          <span class="step-num" style="background: ${primaryColor}; color: var(--on-primary, #fff);">${i + 1}</span>
          <span class="step-title" style="font-family: ${fontHeading};">${s.title || ''}</span>
          ${s.description ? `<span class="step-desc" style="font-family: ${fontBody};">${s.description}</span>` : ''}
        </li>
      `).join('')}
    </ol>
  </div>
</section>

<style>
.features-steps { padding: var(--cf-section-pad, 6rem) 2rem; background: #f7fafc; }
.features-steps-container { max-width: var(--cf-container, 1080px); margin: 0 auto; }
.features-steps-header { text-align: center; margin-bottom: 3rem; }
.features-steps-header h2 { font-size: clamp(2rem, 3vw, 2.6rem); font-weight: 700; color: #1a202c; margin: 0 0 0.85rem; }
.features-steps-header p { font-size: 1.15rem; color: #4a5568; max-width: 640px; margin: 0 auto; line-height: 1.7; }
.features-steps-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; counter-reset: step; }
.step-card { position: relative; display: flex; flex-direction: column; gap: 0.65rem; padding: 2.25rem 1.9rem; background: #fff; border-radius: var(--cf-radius, 16px); box-shadow: var(--cf-shadow-sm, 0 8px 24px rgba(0,0,0,0.06)); transition: transform 0.25s ease, box-shadow 0.25s ease; }
.step-card:hover { transform: translateY(-5px); box-shadow: var(--cf-shadow, 0 18px 40px rgba(0,0,0,0.12)); }
.step-num { width: 48px; height: 48px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800; margin-bottom: 0.4rem; }
.step-title { font-size: 1.3rem; font-weight: 700; color: #1a202c; }
.step-desc { font-size: 1rem; color: #4a5568; line-height: 1.65; }
@media (max-width: 768px) {
  .features-steps { padding: 4rem 1.5rem; }
  .features-steps-grid { grid-template-columns: 1fr; }
}
</style>
  `.trim();
}
