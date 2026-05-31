// Testimonials Section with Cards

/**
 * Generates a testimonials section with cards
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function testimonialsCardsTemplate(data, config) {
  const {
    heading = 'What Our Customers Say',
    subheading = 'Testimonials',
    testimonials = [
      { name: 'John Doe', role: 'Customer', text: 'Great service!', rating: 5 },
      { name: 'Jane Smith', role: 'Client', text: 'Highly recommend!', rating: 5 },
      { name: 'Bob Johnson', role: 'Partner', text: 'Excellent work!', rating: 5 },
    ],
  } = data;
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;

  const renderStars = (rating) => {
    return '⭐'.repeat(rating);
  };

  return `
<section id="testimonials" class="testimonials-section">
  <div class="testimonials-container">
    <div class="testimonials-header">
      <h2 class="testimonials-heading">${heading}</h2>
      <p class="testimonials-subheading">${subheading}</p>
    </div>
    <div class="testimonials-grid">
      ${testimonials
        .map(
          (testimonial) => `
        <div class="testimonial-card">
          <div class="testimonial-rating">${renderStars(testimonial.rating || 5)}</div>
          <p class="testimonial-text">"${testimonial.text || testimonial.quote || ''}"</p>
          <div class="testimonial-author">
            <div class="author-avatar">${(testimonial.name || testimonial.author || 'A').charAt(0)}</div>
            <div class="author-info">
              <div class="author-name">${testimonial.name || testimonial.author || 'Anonymous'}</div>
              <div class="author-role">${testimonial.role || 'Customer'}</div>
            </div>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>
</section>

<style>
.testimonials-section {
  padding: 5rem 2rem;
  background: white;
}

.testimonials-container {
  max-width: 1200px;
  margin: 0 auto;
}

.testimonials-header {
  text-align: center;
  margin-bottom: 4rem;
}

.testimonials-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: clamp(2rem, 3vw, 2.5rem);
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
}

.testimonials-subheading {
  font-size: 1.25rem;
  color: #4a5568;
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.testimonial-card {
  background: #f7fafc;
  padding: 2rem;
  border-radius: 12px;
  border-left: 4px solid ${primary_color};
  transition: all 0.3s ease;
}

.testimonial-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
}

.testimonial-rating {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.testimonial-text {
  font-size: 1.125rem;
  color: #2d3748;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  font-style: italic;
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.author-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${primary_color};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.25rem;
}

.author-name {
  font-weight: 600;
  color: #1a202c;
  font-size: 1rem;
}

.author-role {
  font-size: 0.875rem;
  color: #718096;
}

@media (max-width: 768px) {
  .testimonials-section {
    padding: 3rem 1.5rem;
  }

  .testimonials-header {
    margin-bottom: 2.5rem;
  }

  .testimonials-grid {
    gap: 1.5rem;
  }
}
</style>
  `.trim();
}
