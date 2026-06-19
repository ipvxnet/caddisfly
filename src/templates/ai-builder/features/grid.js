// Features Grid Template
// Feature highlights in a grid layout

import { sectionDefault, defaultItems } from '../section-defaults.js';

export function featuresGridTemplate(data, config) {
  const lang = config.lang || 'en';
  const { heading = sectionDefault(lang, 'features', 0), description = '', features } = data;
  // Config rows use snake_case; accept camelCase too for safety.
  const primaryColor = config.primary_color || config.primaryColor || '#667eea';
  const fontHeading = config.font_heading || config.fontHeading || 'Inter';
  const fontBody = config.font_body || config.fontBody || 'Inter';

  // Default features if not provided (localized to the site language)
  const featureList = features || defaultItems(lang, 'features-grid');

  return `
<section class="features-grid">
  <div class="features-grid-container">
    <div class="features-grid-header">
      <h2 style="font-family: ${fontHeading};">${heading}</h2>
      <p style="font-family: ${fontBody};">${description}</p>
    </div>

    <div class="features-items">
      ${featureList
        .map(
          (feature, index) => `
        <div class="feature-item" data-index="${index}">
          <div class="feature-icon" style="color: ${primaryColor};">
            ${feature.icon}
          </div>
          <h3 class="feature-title">${feature.title}</h3>
          <p class="feature-description">${feature.description}</p>
        </div>
      `
        )
        .join('')}
    </div>
  </div>
</section>

<style>
.features-grid {
  padding: 6rem 2rem;
  background: white;
}

.features-grid-container {
  max-width: 1200px;
  margin: 0 auto;
}

.features-grid-header {
  text-align: center;
  margin-bottom: 4rem;
}

.features-grid-header h2 {
  font-size: 2.75rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.features-grid-header p {
  font-size: 1.25rem;
  color: #4a5568;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.7;
}

.features-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2.5rem;
}

.feature-item {
  text-align: center;
  opacity: 0;
  animation: fadeInUp 0.6s ease-out forwards;
}

.feature-item:nth-child(1) { animation-delay: 0.1s; }
.feature-item:nth-child(2) { animation-delay: 0.15s; }
.feature-item:nth-child(3) { animation-delay: 0.2s; }
.feature-item:nth-child(4) { animation-delay: 0.25s; }
.feature-item:nth-child(5) { animation-delay: 0.3s; }
.feature-item:nth-child(6) { animation-delay: 0.35s; }

.feature-icon {
  font-size: 3.5rem;
  margin-bottom: 1.5rem;
  display: inline-block;
  transition: transform 0.3s;
}

.feature-item:hover .feature-icon {
  transform: scale(1.2) rotate(5deg);
}

.feature-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.75rem 0;
}

.feature-description {
  font-size: 1rem;
  color: #4a5568;
  line-height: 1.6;
  margin: 0;
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
  .features-grid {
    padding: 4rem 1.5rem;
  }

  .features-grid-header h2 {
    font-size: 2rem;
  }

  .features-items {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 2rem;
  }
}
</style>
  `;
}
