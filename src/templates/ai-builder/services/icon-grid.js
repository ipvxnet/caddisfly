// Services Section with Icon Grid

import { serviceMediaTile, serviceCardAttrs, serviceModalAssets, serviceLabels } from './service-modal.js';

/**
 * Generates a services section with an image/icon grid; cards open a modal with
 * the full description + a contact/booking CTA.
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function servicesIconGridTemplate(data, config) {
  const {
    heading = 'Our Services',
    subheading = 'What We Offer',
    services = [
      { title: 'Service 1', description: 'Description of service 1', icon: '🚀' },
      { title: 'Service 2', description: 'Description of service 2', icon: '💡' },
      { title: 'Service 3', description: 'Description of service 3', icon: '⭐' },
    ],
  } = data;
  const { primary_color = '#667eea', secondary_color = '#764ba2', font_heading = 'Inter' } = config;
  const labels = serviceLabels(config.lang || 'en');

  return `
<section id="services" class="services-section">
  <div class="services-container">
    <div class="services-header">
      <h2 class="services-heading">${heading}</h2>
      <p class="services-subheading">${subheading}</p>
    </div>
    <div class="services-grid">
      ${services
        .map(
          (service) => `
        <button type="button" class="service-card" ${serviceCardAttrs(service)}>
          ${serviceMediaTile(service, primary_color, secondary_color)}
          <h3 class="service-title">${service.title}</h3>
          <p class="service-description">${service.description}</p>
          <span class="svc-more">${labels.more} →</span>
        </button>
      `
        )
        .join('')}
    </div>
  </div>
  ${serviceModalAssets(config)}
</section>

<style>
.services-section {
  padding: 5rem 2rem;
  background: #f7fafc;
}

.services-container {
  max-width: 1200px;
  margin: 0 auto;
}

.services-header {
  text-align: center;
  margin-bottom: 4rem;
}

.services-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: clamp(2rem, 3vw, 2.5rem);
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
}

.services-subheading {
  font-size: 1.25rem;
  color: #4a5568;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.service-card {
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  text-align: center;
  /* reset button defaults — the whole card is a click target */
  display: block;
  width: 100%;
  border: none;
  font-family: inherit;
  cursor: pointer;
}

.service-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
}

/* center the icon-tile fallback in this centered layout */
.service-card .svc-media--icon { margin-left: auto; margin-right: auto; }

.service-icon {
  font-size: 3rem;
  margin-bottom: 1.5rem;
  filter: grayscale(0);
}

.service-title {
  font-family: ${font_heading}, sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 1rem;
}

.service-description {
  font-size: 1rem;
  color: #4a5568;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .services-section {
    padding: 3rem 1.5rem;
  }

  .services-header {
    margin-bottom: 2.5rem;
  }

  .services-grid {
    gap: 1.5rem;
  }

  .service-card {
    padding: 2rem;
  }
}
</style>
  `.trim();
}
