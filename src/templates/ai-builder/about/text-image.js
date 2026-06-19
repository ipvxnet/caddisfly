// About Section with Text and Image

import { sectionDefault, defaultItems } from '../section-defaults.js';

/**
 * Generates an about section with text and image
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function aboutTextImageTemplate(data, config) {
  const lang = config.lang || 'en';
  const {
    heading = sectionDefault(lang, 'about', 0),
    subheading = sectionDefault(lang, 'about', 1),
    story = defaultItems(lang, 'about-story'),
    values = defaultItems(lang, 'about-values'),
    image_url = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&q=70',
  } = data;
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;

  return `
<section class="about-section">
  <div class="about-container">
    <div class="about-image">
      <img src="${image_url}" alt="${heading}" width="1200" height="800" loading="lazy" />
    </div>
    <div class="about-content">
      <h2 class="about-heading">${heading}</h2>
      <h3 class="about-subheading">${subheading}</h3>
      <p class="about-story">${story}</p>
      <div class="about-values">
        ${values.map((value) => `<div class="value-item"><span class="value-check">✓</span>${value}</div>`).join('')}
      </div>
    </div>
  </div>
</section>

<style>
.about-section {
  padding: var(--cf-section-pad, 5rem) 2rem;
  background: white;
}

.about-container {
  max-width: var(--cf-container, 1200px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.about-image img {
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: var(--cf-img-radius, 12px);
  box-shadow: var(--cf-shadow, 0 10px 40px rgba(0,0,0,0.1));
}

.about-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: clamp(2rem, 3vw, 2.5rem);
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 0.5rem;
}

.about-subheading {
  font-size: 1.25rem;
  color: ${primary_color};
  margin-bottom: 1.5rem;
  font-weight: 600;
}

.about-story {
  font-size: 1.125rem;
  color: #4a5568;
  line-height: 1.8;
  margin-bottom: 2rem;
}

.about-values {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.value-item {
  display: flex;
  align-items: center;
  font-size: 1.125rem;
  color: #2d3748;
}

.value-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: ${primary_color};
  color: white;
  border-radius: 50%;
  margin-right: 0.75rem;
  font-size: 0.875rem;
  font-weight: bold;
}

@media (max-width: 968px) {
  .about-section {
    padding: 3rem 1.5rem;
  }

  .about-container {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
</style>
  `.trim();
}
