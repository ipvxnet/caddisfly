// Fullscreen Hero Template
// Full viewport hero with scroll indicator

export function heroFullscreenTemplate(data, config) {
  const { heading = 'Welcome', subheading = 'Your business tagline', cta_text, cta_url, cta_link, cta_link_new_tab = false, background_image } = data;
  const { primary_color: primaryColor = '#667eea', secondary_color: secondaryColor = '#764ba2', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;

  const backgroundUrl = background_image || 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920';

  return `
<section class="hero-fullscreen" style="background: linear-gradient(135deg, ${primaryColor}dd, ${secondaryColor}dd), url('${backgroundUrl}') center/cover;">
  <div class="hero-fullscreen-content">
    <h1 class="hero-fullscreen-heading" style="font-family: ${fontHeading};">
      ${heading}
    </h1>
    <p class="hero-fullscreen-subheading" style="font-family: ${fontBody};">
      ${subheading}
    </p>
    ${
      cta_text
        ? `
    <a href="${cta_link || cta_url || '#contact'}"${cta_link_new_tab ? ' target="_blank" rel="noopener"' : ''} class="cta-button-outline">
      ${cta_text}
    </a>
    `
        : ''
    }
  </div>
  <div class="scroll-indicator">
    <div class="scroll-indicator-text">Scroll Down</div>
    <div class="scroll-indicator-arrow">↓</div>
  </div>
</section>

<style>
.hero-fullscreen {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
  padding: 2rem;
}

.hero-fullscreen-content {
  max-width: 1000px;
  animation: fadeInScale 1s ease-out;
}

.hero-fullscreen-heading {
  font-size: 4.5rem;
  font-weight: 800;
  margin: 0 0 1.5rem 0;
  line-height: 1.1;
  letter-spacing: -0.03em;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.hero-fullscreen-subheading {
  font-size: 1.5rem;
  margin: 0 0 3rem 0;
  line-height: 1.6;
  opacity: 0.95;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.hero-fullscreen .cta-button-outline {
  display: inline-block;
  padding: 1.25rem 3.5rem;
  color: white;
  text-decoration: none;
  border: 3px solid white;
  border-radius: 50px;
  font-weight: 600;
  font-size: 1.125rem;
  transition: all 0.3s;
  background: transparent;
}

.hero-fullscreen .cta-button-outline:hover {
  background: white;
  color: #1a202c;
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.scroll-indicator {
  position: absolute;
  bottom: 3rem;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  animation: bounce 2s infinite;
}

.scroll-indicator-text {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 0.5rem;
  opacity: 0.8;
}

.scroll-indicator-arrow {
  font-size: 1.5rem;
  opacity: 0.8;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  40% {
    transform: translateX(-50%) translateY(-10px);
  }
  60% {
    transform: translateX(-50%) translateY(-5px);
  }
}

@media (max-width: 768px) {
  .hero-fullscreen {
    height: 100vh;
  }

  .hero-fullscreen-heading {
    font-size: 2.75rem;
  }

  .hero-fullscreen-subheading {
    font-size: 1.125rem;
  }

  .hero-fullscreen .cta-button-outline {
    padding: 1rem 2.5rem;
    font-size: 1rem;
  }

  .scroll-indicator {
    bottom: 2rem;
  }
}
</style>
  `;
}
