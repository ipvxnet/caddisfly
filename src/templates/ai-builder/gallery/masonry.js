// Gallery Section with Masonry Layout

import { sectionDefault } from '../section-defaults.js';

/**
 * Generates a gallery section with masonry layout
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function galleryMasonryTemplate(data, config) {
  const lang = config.lang || 'en';
  const {
    heading = sectionDefault(lang, 'gallery', 0),
    subheading = sectionDefault(lang, 'gallery', 1),
    images = [
      { alt: 'Gallery image 1', caption: '', url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&auto=format&q=70' },
      { alt: 'Gallery image 2', caption: '', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&q=70' },
      { alt: 'Gallery image 3', caption: '', url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&auto=format&q=70' },
      { alt: 'Gallery image 4', caption: '', url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&q=70' },
    ],
  } = data;
  const { font_heading = 'Inter' } = config;

  return `
<section class="gallery-section">
  <div class="gallery-container">
    <div class="gallery-header">
      <h2 class="gallery-heading">${heading}</h2>
      <p class="gallery-subheading">${subheading}</p>
    </div>
    <div class="gallery-grid">
      ${images
        .map(
          (image) => `
        <div class="gallery-item">
          <img src="${image.url || 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&auto=format&q=70'}" alt="${image.alt || image.caption || ''}" width="800" height="600" loading="lazy" />
          ${image.caption && image.caption !== 'undefined' ? `<div class="gallery-caption">${image.caption}</div>` : ''}
        </div>
      `
        )
        .join('')}
    </div>
  </div>
</section>

<style>
.gallery-section {
  padding: var(--cf-section-pad, 5rem) 2rem;
  background: white;
}

.gallery-container {
  max-width: var(--cf-container, 1200px);
  margin: 0 auto;
}

.gallery-header {
  text-align: center;
  margin-bottom: 4rem;
}

.gallery-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: clamp(2rem, 3vw, 2.5rem);
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
}

.gallery-subheading {
  font-size: 1.25rem;
  color: #4a5568;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.gallery-item {
  position: relative;
  overflow: hidden;
  border-radius: var(--cf-img-radius, 12px);
  box-shadow: var(--cf-shadow-sm, 0 4px 15px rgba(0,0,0,0.1));
  transition: all 0.3s ease;
}

.gallery-item:hover {
  transform: translateY(-5px);
  box-shadow: var(--cf-shadow, 0 8px 25px rgba(0,0,0,0.15));
}

.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  aspect-ratio: 4/3;
  transition: transform 0.3s ease;
}

.gallery-item:hover img {
  transform: scale(1.05);
}

.gallery-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  color: white;
  padding: 1.5rem 1rem 1rem;
  font-size: 0.875rem;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.gallery-item:hover .gallery-caption {
  opacity: 1;
}

@media (max-width: 768px) {
  .gallery-section {
    padding: 3rem 1.5rem;
  }

  .gallery-header {
    margin-bottom: 2.5rem;
  }

  .gallery-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
  `.trim();
}
