// Services Section with Icon Grid

/**
 * Generates a services section with icon grid
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
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;

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
        <div class="service-card">
          <div class="service-icon">${service.icon}</div>
          <h3 class="service-title">${service.title}</h3>
          <p class="service-description">${service.description}</p>
        </div>
      `
        )
        .join('')}
    </div>
  </div>
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
}

.service-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
}

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
