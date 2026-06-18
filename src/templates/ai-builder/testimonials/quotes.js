// Testimonials Quotes Template
// Large quote format testimonials

import { TESTIMONIAL_DEFAULTS } from './cards.js';

export function testimonialsQuotesTemplate(data, config) {
  const {
    primary_color: primaryColor = '#667eea',
    secondary_color: secondaryColor = '#764ba2',
    font_heading: fontHeading = 'Inter',
    font_body: fontBody = 'Inter',
  } = config;
  const lang = config.lang || 'en';
  const tx = TESTIMONIAL_DEFAULTS[lang] || TESTIMONIAL_DEFAULTS.en;
  const { heading = tx.heading, testimonials } = data;

  // Default testimonials if not provided (localized; rendered via the
  // quote||text / author||name / position||role fallbacks below).
  const testimonialList = testimonials || tx.items;

  return `
<section class="testimonials-quotes" style="background: linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15);">
  <div class="testimonials-quotes-container">
    <h2 class="testimonials-quotes-heading" style="font-family: ${fontHeading};">${heading}</h2>

    <div class="quotes-grid">
      ${testimonialList
        .map((testimonial, index) => {
          // Accept both schemas: editor/cards use {text,name,role}; quotes use {quote,author,position}.
          const quote = testimonial.quote || testimonial.text || '';
          const author = testimonial.author || testimonial.name || 'Anonymous';
          const position = testimonial.position || testimonial.role || '';
          const avatarHtml = testimonial.avatar
            ? `<img src="${testimonial.avatar}" alt="${author}" class="author-avatar" width="60" height="60" loading="lazy">`
            : `<div class="author-avatar" style="background:${primaryColor};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.4rem;">${(author || 'A').charAt(0)}</div>`;
          return `
        <div class="quote-card" data-index="${index}">
          <div class="quote-mark" style="color: ${primaryColor};">"</div>
          <blockquote class="quote-text" style="font-family: ${fontBody};">
            ${quote}
          </blockquote>
          <div class="quote-author">
            ${avatarHtml}
            <div class="author-info">
              <div class="author-name">${author}</div>
              <div class="author-position" style="color: ${primaryColor};">${position}</div>
            </div>
          </div>
        </div>
      `;
        })
        .join('')}
    </div>
  </div>
</section>

<style>
.testimonials-quotes {
  padding: var(--cf-section-pad, 6rem) 2rem;
}

.testimonials-quotes-container {
  max-width: var(--cf-container, 1200px);
  margin: 0 auto;
}

.testimonials-quotes-heading {
  font-size: 2.75rem;
  font-weight: 700;
  color: #1a202c;
  text-align: center;
  margin: 0 0 4rem 0;
}

.quotes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2.5rem;
}

.quote-card {
  background: white;
  padding: 2.5rem;
  border-radius: var(--cf-radius, 16px);
  box-shadow: var(--cf-shadow-sm, 0 4px 20px rgba(0, 0, 0, 0.08));
  transition: transform 0.3s, box-shadow 0.3s;
  opacity: 0;
  animation: fadeInUp 0.6s ease-out forwards;
}

.quote-card:nth-child(1) { animation-delay: 0.1s; }
.quote-card:nth-child(2) { animation-delay: 0.2s; }
.quote-card:nth-child(3) { animation-delay: 0.3s; }

.quote-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--cf-shadow, 0 12px 30px rgba(0, 0, 0, 0.15));
}

.quote-mark {
  font-size: 5rem;
  font-weight: 700;
  line-height: 0.8;
  opacity: 0.2;
  margin-bottom: 1rem;
}

.quote-text {
  font-size: 1.125rem;
  line-height: 1.8;
  color: #2d3748;
  margin: 0 0 2rem 0;
  font-style: italic;
}

.quote-author {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.author-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #f7fafc;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.author-info {
  flex: 1;
}

.author-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 0.25rem;
}

.author-position {
  font-size: 0.95rem;
  font-weight: 500;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .testimonials-quotes {
    padding: 4rem 1.5rem;
  }

  .testimonials-quotes-heading {
    font-size: 2rem;
  }

  .quotes-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .quote-card {
    padding: 2rem;
  }

  .quote-mark {
    font-size: 4rem;
  }
}
</style>
  `;
}
