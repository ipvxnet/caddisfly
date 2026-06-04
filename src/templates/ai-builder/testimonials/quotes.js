// Testimonials Quotes Template
// Large quote format testimonials

export function testimonialsQuotesTemplate(data, config) {
  const { heading, testimonials } = data;
  const { primaryColor, secondaryColor, fontHeading, fontBody } = config;

  // Default testimonials if not provided
  const testimonialList = testimonials || [
    {
      quote: 'Working with this team has been transformative for our business. Their expertise and dedication are unmatched.',
      author: 'Jessica Martinez',
      position: 'CEO, TechCorp',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    },
    {
      quote: 'The level of professionalism and quality delivered exceeded all our expectations. Highly recommended!',
      author: 'Robert Chen',
      position: 'Founder, StartupXYZ',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    },
    {
      quote: 'Outstanding service from start to finish. They truly understand what it takes to succeed in this industry.',
      author: 'Amanda Williams',
      position: 'Director, Global Inc',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    },
  ];

  return `
<section class="testimonials-quotes" style="background: linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15);">
  <div class="testimonials-quotes-container">
    <h2 class="testimonials-quotes-heading" style="font-family: ${fontHeading};">${heading}</h2>

    <div class="quotes-grid">
      ${testimonialList
        .map(
          (testimonial, index) => `
        <div class="quote-card" data-index="${index}">
          <div class="quote-mark" style="color: ${primaryColor};">"</div>
          <blockquote class="quote-text" style="font-family: ${fontBody};">
            ${testimonial.quote}
          </blockquote>
          <div class="quote-author">
            <img src="${testimonial.avatar}" alt="${testimonial.author}" class="author-avatar">
            <div class="author-info">
              <div class="author-name">${testimonial.author}</div>
              <div class="author-position" style="color: ${primaryColor};">${testimonial.position}</div>
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
.testimonials-quotes {
  padding: 6rem 2rem;
}

.testimonials-quotes-container {
  max-width: 1200px;
  margin: 0 auto;
}

.testimonials-quotes-heading {
  font-size: 2.75rem;
  font-weight: 700;
  color: #1a202c;
  text-align: center;
  margin: 0 0 4rem 0;
}

.quotes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2.5rem;
}

.quote-card {
  background: white;
  padding: 2.5rem;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s, box-shadow 0.3s;
  opacity: 0;
  animation: fadeInUp 0.6s ease-out forwards;
}

.quote-card:nth-child(1) { animation-delay: 0.1s; }
.quote-card:nth-child(2) { animation-delay: 0.2s; }
.quote-card:nth-child(3) { animation-delay: 0.3s; }

.quote-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
}

.quote-mark {
  font-size: 5rem;
  font-weight: 700;
  line-height: 0.8;
  opacity: 0.2;
  margin-bottom: 1rem;
}

.quote-text {
  font-size: 1.125rem;
  line-height: 1.8;
  color: #2d3748;
  margin: 0 0 2rem 0;
  font-style: italic;
}

.quote-author {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.author-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #f7fafc;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.author-info {
  flex: 1;
}

.author-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 0.25rem;
}

.author-position {
  font-size: 0.95rem;
  font-weight: 500;
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
  .testimonials-quotes {
    padding: 4rem 1.5rem;
  }

  .testimonials-quotes-heading {
    font-size: 2rem;
  }

  .quotes-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .quote-card {
    padding: 2rem;
  }

  .quote-mark {
    font-size: 4rem;
  }
}
</style>
  `;
}
