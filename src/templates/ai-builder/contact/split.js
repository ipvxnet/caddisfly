// Contact Section — split layout: heading + contact details/social on one side,
// the form on the other. Composes the shared form core (same live submission).

import { contactCopy, contactInfoHtml, contactSocialHtml, contactFormBlock, contactFormStyles } from './form-core.js';

export function contactSplitTemplate(data, config) {
  const { font_heading = 'Inter' } = config;
  const { heading, subheading } = contactCopy(data, config);

  return `
<section id="contact" class="contact-split">
  <div class="contact-split-inner">
    <div class="contact-split-info">
      <h2 class="contact-split-heading">${heading}</h2>
      <p class="contact-split-sub">${subheading}</p>
      ${contactInfoHtml(data)}
      ${contactSocialHtml(data)}
    </div>
    <div class="contact-split-form">
      ${contactFormBlock(data, config)}
    </div>
  </div>
</section>

<style>
.contact-split { padding: var(--cf-section-pad, 5rem) 2rem; background: #f7fafc; }
.contact-split-inner {
  max-width: var(--cf-container, 1100px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 3.5rem;
  align-items: start;
}
.contact-split-heading {
  font-family: '${font_heading}', sans-serif;
  font-size: clamp(2rem, 3vw, 2.6rem);
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 1rem;
}
.contact-split-sub { font-size: 1.2rem; color: #4a5568; margin: 0 0 2rem; line-height: 1.6; }
/* In the split layout the details/social stack and left-align. */
.contact-split-info .contact-info { flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 1rem; }
.contact-split-info .contact-social { justify-content: flex-start; }
${contactFormStyles(config)}

@media (max-width: 860px) {
  .contact-split-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .contact-split { padding: 3rem 1.5rem; }
  .contact-form { padding: 2rem; }
  .form-row { grid-template-columns: 1fr; gap: 0; }
}
</style>
  `.trim();
}
