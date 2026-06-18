// Split Hero Template (text on left, image on right)

/**
 * Generates a split hero section
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function heroSplitTemplate(data, config) {
  const {
    heading = 'Welcome',
    subheading = 'Your business tagline',
    cta_text = 'Get Started',
    cta_link = '#contact',
    cta_link_new_tab = false,
    image_url = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
  } = data;
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;

  return `
<section class="hero-split">
  <div class="hero-split-container">
    <div class="hero-split-content">
      <h1 class="hero-split-heading">${heading}</h1>
      <p class="hero-split-subheading">${subheading}</p>
      <a href="${cta_link}"${cta_link_new_tab ? ' target="_blank" rel="noopener"' : ''} class="hero-split-cta">${cta_text}</a>
    </div>
    <div class="hero-split-image">
      <img src="${image_url}" alt="${heading}" width="1200" height="800" fetchpriority="high" />
    </div>
  </div>
</section>

<style>
.hero-split {
  min-height: 78vh;
  display: flex;
  align-items: center;
  padding: 5rem 2rem;
  background: #f7fafc;
}

.hero-split-container {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.hero-split-content {
  animation: fadeInLeft 0.8s ease-out;
}

.hero-split-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: clamp(2.5rem, 4vw, 3.5rem);
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1.5rem;
  line-height: 1.2;
}

.hero-split-subheading {
  font-size: clamp(1.125rem, 2vw, 1.375rem);
  color: #4a5568;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.hero-split-cta {
  display: inline-block;
  padding: 1rem 2.5rem;
  background: ${primary_color};
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1.125rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.hero-split-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.hero-split-image {
  animation: fadeInRight 0.8s ease-out;
}

.hero-split-image img {
  width: 100%;
  height: clamp(320px, 46vh, 480px);
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
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

@media (max-width: 968px) {
  .hero-split {
    min-height: auto;
    padding: 3rem 1.5rem;
  }

  .hero-split-container {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .hero-split-image {
    order: -1;
  }
}
</style>
  `.trim();
}
