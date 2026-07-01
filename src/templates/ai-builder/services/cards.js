// Service Cards Template
// Services as clickable cards with an AI image tile; tapping opens a modal with
// the full description + a contact/booking CTA.

import { serviceMediaTile, serviceCardAttrs, serviceModalAssets, serviceLabels } from './service-modal.js';
import { sectionDefault, defaultItems } from '../section-defaults.js';

export function servicesCardsTemplate(data, config) {
  const lang = config.lang || 'en';
  // The editor saves the sub-line as `subheading`; older/generated sections used
  // `description`. Read subheading first, fall back to description.
  // Prefer `subheading` (the editor field); fall back to `description` ONLY when
  // subheading was never set (older/AI sections). An explicitly-empty subheading
  // means "no sub-line" — don't resurrect a stale description.
  const { heading = sectionDefault(lang, 'services', 0), subheading, description = '', services } = data;
  const sub = subheading !== undefined ? subheading : description;
  const { primary_color: primaryColor = '#667eea', secondary_color: secondaryColor = '#764ba2', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;
  const labels = serviceLabels(lang);

  // Default services if not provided (localized to the site language)
  const serviceList = services || defaultItems(lang, 'services');

  return `
<section class="services-cards">
  <div class="services-cards-container">
    <div class="services-cards-header">
      <h2 style="font-family: ${fontHeading};">${heading}</h2>
      ${sub ? `<p style="font-family: ${fontBody};">${sub}</p>` : ''}
    </div>

    <div class="services-grid">
      ${serviceList
        .map(
          (service, index) => `
        <button type="button" class="service-card" data-index="${index}" ${serviceCardAttrs(service)}>
          <div class="service-card-inner">
            ${serviceMediaTile(service, primaryColor, secondaryColor)}
            <h3 class="service-title">${service.title}</h3>
            <p class="service-description">${service.description}</p>
            <span class="svc-more">${labels.more} →</span>
          </div>
        </button>
      `
        )
        .join('')}
    </div>
  </div>
  ${serviceModalAssets(config)}
</section>

<style>
.services-cards {
  padding: var(--cf-section-pad, 6rem) 2rem;
  background: white;
}

.services-cards-container {
  max-width: var(--cf-container, 1200px);
  margin: 0 auto;
}

.services-cards-header {
  text-align: center;
  margin-bottom: 4rem;
}

.services-cards-header h2 {
  font-size: 2.75rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.services-cards-header p {
  font-size: 1.25rem;
  color: #4a5568;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.7;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.service-card {
  opacity: 0;
  animation: fadeInUp 0.6s ease-out forwards;
  /* reset button defaults — the whole card is now a click target */
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
  cursor: pointer;
}

.service-card:nth-child(1) { animation-delay: 0.1s; }
.service-card:nth-child(2) { animation-delay: 0.2s; }
.service-card:nth-child(3) { animation-delay: 0.3s; }
.service-card:nth-child(4) { animation-delay: 0.4s; }

.service-card-inner {
  height: 100%;
  padding: 2.5rem;
  background: #f7fafc;
  border-radius: var(--cf-radius, 16px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.service-card-inner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, transparent, currentColor, transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.service-card:hover .service-card-inner {
  background: white;
  transform: translateY(-8px);
  box-shadow: var(--cf-shadow, 0 20px 40px rgba(0, 0, 0, 0.12));
}

.service-card:hover .service-card-inner::before {
  opacity: 1;
}

.service-icon {
  width: 70px;
  height: 70px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.service-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.service-description {
  font-size: 1rem;
  color: #4a5568;
  line-height: 1.6;
  margin: 0 0 1.5rem 0;
}

.service-arrow {
  font-size: 1.5rem;
  font-weight: 600;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.3s;
}

.service-card:hover .service-arrow {
  opacity: 1;
  transform: translateX(0);
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
  .services-cards {
    padding: 4rem 1.5rem;
  }

  .services-cards-header h2 {
    font-size: 2rem;
  }

  .services-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .service-card-inner {
    padding: 2rem;
  }
}
</style>
  `;
}
