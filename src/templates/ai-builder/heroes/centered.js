// Centered Hero Template

/**
 * Generates a centered hero section
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function heroCenteredTemplate(data, config) {
  const { heading = 'Welcome', subheading = 'Your business tagline', cta_text = 'Get Started', cta_link = '#contact', cta_link_new_tab = false } = data;
  const { primary_color = '#667eea', secondary_color = '#764ba2', font_heading = 'Inter' } = config;

  return `
<section class="hero-centered">
  <div class="hero-content">
    <h1 class="hero-heading">${heading}</h1>
    <p class="hero-subheading">${subheading}</p>
    <a href="${cta_link}"${cta_link_new_tab ? ' target="_blank" rel="noopener"' : ''} class="hero-cta">${cta_text}</a>
  </div>
</section>

<style>
.hero-centered {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, ${primary_color} 0%, ${secondary_color} 100%);
  color: white;
  text-align: center;
  padding: 2rem;
  position: relative;
  overflow: hidden;
}

.hero-centered::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%);
  pointer-events: none;
}

.hero-content {
  max-width: 800px;
  position: relative;
  z-index: 1;
}

.hero-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  margin-bottom: 1.5rem;
  line-height: 1.2;
  animation: fadeInUp 0.8s ease-out;
}

.hero-subheading {
  font-size: clamp(1.125rem, 2vw, 1.5rem);
  margin-bottom: 2rem;
  opacity: 0.95;
  line-height: 1.6;
  animation: fadeInUp 0.8s ease-out 0.2s both;
}

.hero-cta {
  display: inline-block;
  padding: 1rem 2.5rem;
  background: white;
  color: ${primary_color};
  text-decoration: none;
  border-radius: 50px;
  font-weight: 600;
  font-size: 1.125rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  animation: fadeInUp 0.8s ease-out 0.4s both;
}

.hero-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
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
  .hero-centered {
    min-height: 80vh;
    padding: 1.5rem;
  }

  .hero-heading {
    font-size: 2.5rem;
  }

  .hero-subheading {
    font-size: 1.125rem;
  }

  .hero-cta {
    padding: 0.875rem 2rem;
    font-size: 1rem;
  }
}
</style>
  `.trim();
}
