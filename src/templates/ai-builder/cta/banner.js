// CTA Banner Template
// Call-to-action banner section

export function ctaBannerTemplate(data, config) {
  const { heading, description = '', cta_text, cta_url, cta_url_new_tab = false } = data;
  const { primary_color: primaryColor = '#667eea', secondary_color: secondaryColor = '#764ba2', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;

  return `
<section class="cta-banner" style="background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});">
  <div class="cta-banner-container">
    <div class="cta-content">
      <h2 class="cta-heading" style="font-family: ${fontHeading};">
        ${heading}
      </h2>
      <p class="cta-description" style="font-family: ${fontBody};">
        ${description}
      </p>
    </div>
    <div class="cta-action">
      <a href="${cta_url || '#contact'}"${cta_url_new_tab ? ' target="_blank" rel="noopener"' : ''} class="cta-button">
        ${cta_text || 'Get Started'}
      </a>
    </div>
  </div>
</section>

<style>
.cta-banner {
  padding: 5rem 2rem;
  color: white;
}

.cta-banner-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3rem;
}

.cta-content {
  flex: 1;
}

.cta-heading {
  font-size: 3rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  line-height: 1.2;
  animation: fadeInLeft 0.8s ease-out;
}

.cta-description {
  font-size: 1.25rem;
  line-height: 1.6;
  margin: 0;
  opacity: 0.95;
  animation: fadeInLeft 0.8s ease-out 0.2s backwards;
}

.cta-action {
  animation: fadeInRight 0.8s ease-out 0.4s backwards;
}

.cta-button {
  display: inline-block;
  padding: 1.25rem 3rem;
  background: white;
  color: #1a202c;
  text-decoration: none;
  border-radius: 50px;
  font-weight: 600;
  font-size: 1.125rem;
  transition: all 0.3s;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.cta-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 768px) {
  .cta-banner {
    padding: 4rem 1.5rem;
  }

  .cta-banner-container {
    flex-direction: column;
    text-align: center;
    gap: 2rem;
  }

  .cta-heading {
    font-size: 2rem;
  }

  .cta-description {
    font-size: 1.125rem;
  }

  .cta-button {
    padding: 1rem 2.5rem;
    font-size: 1rem;
  }
}
</style>
  `;
}
