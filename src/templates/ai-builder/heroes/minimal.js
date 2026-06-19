// Minimal Hero Template
// Clean, text-focused hero with subtle animations

import { uiText } from '../section-defaults.js';

export function heroMinimalTemplate(data, config) {
  const lang = config.lang || 'en';
  const { heading = 'Welcome', subheading = 'Your business tagline', cta_text = uiText(lang, 'cta'), cta_url = '', cta_link = '', cta_link_new_tab = false } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;

  return `
<section class="hero-minimal">
  <div class="hero-minimal-container">
    <h1 class="hero-minimal-heading" style="font-family: ${fontHeading};">
      ${heading}
    </h1>
    <p class="hero-minimal-subheading" style="font-family: ${fontBody};">
      ${subheading}
    </p>
    ${
      cta_text
        ? `
    <div class="hero-minimal-cta">
      <a href="${cta_link || cta_url || '#contact'}"${cta_link_new_tab ? ' target="_blank" rel="noopener"' : ''} class="cta-button" style="background: ${primaryColor};">
        ${cta_text}
      </a>
    </div>
    `
        : ''
    }
  </div>
</section>

<style>
.hero-minimal {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: #ffffff;
}

.hero-minimal-container {
  max-width: 800px;
  text-align: center;
  animation: fadeInUp 0.8s ease-out;
}

.hero-minimal-heading {
  font-size: 3.5rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 1.5rem 0;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.hero-minimal-subheading {
  font-size: 1.25rem;
  color: #4a5568;
  margin: 0 0 2.5rem 0;
  line-height: 1.6;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.hero-minimal-cta {
  margin-top: 2rem;
}

.hero-minimal .cta-button {
  display: inline-block;
  padding: 1rem 2.5rem;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1.125rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.hero-minimal .cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
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
  .hero-minimal {
    min-height: 50vh;
    padding: 3rem 1.5rem;
  }

  .hero-minimal-heading {
    font-size: 2.5rem;
  }

  .hero-minimal-subheading {
    font-size: 1.125rem;
  }
}
</style>
  `;
}
