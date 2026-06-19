// Testimonials "spotlight" — large, centered editorial quotes stacked with big
// quotation marks (distinct from the cards/quotes grids). Token- and dark-aware.
// Accepts both schemas: {quote,author,position} and {text,name,role}.

import { TESTIMONIAL_DEFAULTS } from './cards.js';

export function testimonialsSpotlightTemplate(data, config) {
  const lang = config.lang || 'en';
  const tx = TESTIMONIAL_DEFAULTS[lang] || TESTIMONIAL_DEFAULTS.en;
  const { heading = tx.heading, testimonials } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;

  const list = Array.isArray(testimonials) && testimonials.length
    ? testimonials
    : tx.items;

  const items = list
    .map((tm) => {
      const quote = tm.quote || tm.text || '';
      const author = tm.author || tm.name || 'Anonymous';
      const position = tm.position || tm.role || '';
      return `
      <figure class="tspot-item">
        <div class="tspot-mark" style="color: ${primaryColor};" aria-hidden="true">&ldquo;</div>
        <blockquote class="tspot-quote" style="font-family: ${fontHeading};">${quote}</blockquote>
        <figcaption class="tspot-cap" style="font-family: ${fontBody};">
          <span class="tspot-author">${author}</span>${position ? `<span class="tspot-role" style="color: ${primaryColor};">${position}</span>` : ''}
        </figcaption>
      </figure>`;
    })
    .join('');

  return `
<section class="testimonials-spotlight">
  <div class="tspot-container">
    <h2 class="tspot-heading" style="font-family: ${fontHeading};">${heading}</h2>
    <div class="tspot-list">${items}</div>
  </div>
</section>

<style>
.testimonials-spotlight { padding: var(--cf-section-pad, 6rem) 2rem; background: #ffffff; }
.tspot-container { max-width: var(--cf-container, 860px); margin: 0 auto; text-align: center; }
.tspot-heading { font-size: 2.75rem; font-weight: 700; color: #1a202c; margin: 0 0 3.5rem; }
.tspot-list { display: flex; flex-direction: column; gap: 3.5rem; }
.tspot-item { margin: 0; }
.tspot-item + .tspot-item { border-top: 1px solid rgba(0,0,0,0.08); padding-top: 3.5rem; }
.tspot-mark { font-size: 4rem; line-height: 0.5; height: 1.5rem; }
.tspot-quote {
  font-size: clamp(1.4rem, 2.6vw, 2rem);
  line-height: 1.5; font-weight: 500; color: #1a202c;
  margin: 0 0 1.5rem; font-style: italic;
}
.tspot-cap { display: flex; flex-direction: column; gap: 0.2rem; }
.tspot-author { font-weight: 700; color: #1a202c; font-size: 1.05rem; }
.tspot-role { font-size: 0.95rem; font-weight: 500; }
@media (max-width: 600px) {
  .testimonials-spotlight { padding: var(--cf-section-pad, 4rem) 1.5rem; }
  .tspot-heading { font-size: 2rem; margin-bottom: 2.5rem; }
}
</style>
  `.trim();
}
