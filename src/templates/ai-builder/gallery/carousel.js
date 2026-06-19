// Gallery Carousel Template
// Image carousel/slider with navigation

import { sectionDefault } from '../section-defaults.js';

export function galleryCarouselTemplate(data, config) {
  const lang = config.lang || 'en';
  const { heading = sectionDefault(lang, 'gallery', 0), description = '', images } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter', font_body: fontBody = 'Inter' } = config;

  // Default images if not provided
  const galleryImages = images || [
    { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&q=70', caption: 'Modern workspace' },
    { url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&auto=format&q=70', caption: 'Collaborative environment' },
    { url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&auto=format&q=70', caption: 'Innovation hub' },
    { url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&auto=format&q=70', caption: 'Creative space' },
  ];

  return `
<section class="gallery-carousel">
  <div class="gallery-carousel-container">
    <div class="gallery-carousel-header">
      <h2 style="font-family: ${fontHeading};">${heading}</h2>
      <p style="font-family: ${fontBody};">${description}</p>
    </div>

    <div class="carousel-wrapper">
      <button class="carousel-btn carousel-prev" onclick="moveCarousel(-1)" style="background: ${primaryColor};">
        ‹
      </button>

      <div class="carousel-track-container">
        <div class="carousel-track" id="carouselTrack">
          ${galleryImages
            .map(
              (image, index) => `
            <div class="carousel-slide ${index === 0 ? 'active' : ''}">
              <img src="${image.url}" alt="${image.alt || image.caption || ''}" class="carousel-image" width="1200" height="800" loading="lazy">
              ${image.caption && image.caption !== 'undefined' ? `<div class="carousel-caption">${image.caption}</div>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <button class="carousel-btn carousel-next" onclick="moveCarousel(1)" style="background: ${primaryColor};">
        ›
      </button>
    </div>

    <div class="carousel-dots">
      ${galleryImages
        .map(
          (_, index) => `
        <button
          class="carousel-dot ${index === 0 ? 'active' : ''}"
          onclick="goToSlide(${index})"
          style="background: ${index === 0 ? primaryColor : '#cbd5e0'};"
        ></button>
      `
        )
        .join('')}
    </div>
  </div>
</section>

<script>
let currentSlide = 0;
const totalSlides = ${galleryImages.length};
const primaryColor = '${primaryColor}';

function moveCarousel(direction) {
  currentSlide = (currentSlide + direction + totalSlides) % totalSlides;
  updateCarousel();
}

function goToSlide(index) {
  currentSlide = index;
  updateCarousel();
}

function updateCarousel() {
  const track = document.getElementById('carouselTrack');
  const slides = track.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.carousel-dot');

  slides.forEach((slide, index) => {
    slide.classList.toggle('active', index === currentSlide);
  });

  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentSlide);
    dot.style.background = index === currentSlide ? primaryColor : '#cbd5e0';
  });

  track.style.transform = \`translateX(-\${currentSlide * 100}%)\`;
}

// Auto-advance carousel every 5 seconds
setInterval(() => moveCarousel(1), 5000);
</script>

<style>
.gallery-carousel {
  padding: 6rem 2rem;
  background: #f7fafc;
}

.gallery-carousel-container {
  max-width: 1200px;
  margin: 0 auto;
}

.gallery-carousel-header {
  text-align: center;
  margin-bottom: 3rem;
}

.gallery-carousel-header h2 {
  font-size: 2.75rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 1rem 0;
}

.gallery-carousel-header p {
  font-size: 1.25rem;
  color: #4a5568;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.7;
}

.carousel-wrapper {
  position: relative;
  max-width: 1000px;
  margin: 0 auto 2rem;
}

.carousel-track-container {
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.carousel-track {
  display: flex;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.carousel-slide {
  min-width: 100%;
  position: relative;
}

.carousel-image {
  width: 100%;
  height: 500px;
  object-fit: cover;
  display: block;
}

.carousel-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  color: white;
  font-size: 1.25rem;
  font-weight: 500;
}

.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 50px;
  height: 50px;
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 2rem;
  cursor: pointer;
  transition: all 0.3s;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.carousel-btn:hover {
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.carousel-prev {
  left: -25px;
}

.carousel-next {
  right: -25px;
}

.carousel-dots {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.carousel-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
}

.carousel-dot:hover {
  transform: scale(1.3);
}

.carousel-dot.active {
  width: 32px;
  border-radius: 6px;
}

@media (max-width: 768px) {
  .gallery-carousel {
    padding: 4rem 1.5rem;
  }

  .gallery-carousel-header h2 {
    font-size: 2rem;
  }

  .carousel-image {
    height: 300px;
  }

  .carousel-btn {
    width: 40px;
    height: 40px;
    font-size: 1.5rem;
  }

  .carousel-prev {
    left: 10px;
  }

  .carousel-next {
    right: 10px;
  }
}
</style>
  `;
}
