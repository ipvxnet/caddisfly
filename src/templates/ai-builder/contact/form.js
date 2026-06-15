// Contact Section with Form (centered) — composes the shared form core.

import { contactCopy, contactInfoHtml, contactSocialHtml, contactFormBlock, contactFormStyles } from './form-core.js';

/**
 * Generates a contact section with form
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function contactFormTemplate(data, config) {
  const { font_heading = 'Inter' } = config;
  const { heading, subheading } = contactCopy(data, config);

  return `
<section id="contact" class="contact-section">
  <div class="contact-container">
    <div class="contact-header">
      <h2 class="contact-heading">${heading}</h2>
      <p class="contact-subheading">${subheading}</p>
    </div>
    ${contactInfoHtml(data)}
    <div class="contact-social-center">${contactSocialHtml(data)}</div>
    ${contactFormBlock(data, config)}
  </div>
</section>

<style>
.contact-section {
  padding: var(--cf-section-pad, 5rem) 2rem;
  background: #f7fafc;
}
.contact-container { max-width: 800px; margin: 0 auto; }
.contact-header { text-align: center; margin-bottom: 3rem; }
.contact-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: clamp(2rem, 3vw, 2.5rem);
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
}
.contact-subheading { font-size: 1.25rem; color: #4a5568; }
.contact-section .contact-info { justify-content: center; }
.contact-section .contact-social-center { display: flex; justify-content: center; }
${contactFormStyles(config)}

@media (max-width: 768px) {
  .contact-section { padding: 3rem 1.5rem; }
  .contact-form { padding: 2rem; }
  .form-row { grid-template-columns: 1fr; gap: 0; }
}
</style>
  `.trim();
}
