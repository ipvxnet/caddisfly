// Contact Section with Form

/**
 * Generates a contact section with form
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function contactFormTemplate(data, config) {
  const {
    heading = 'Get In Touch',
    subheading = "We'd love to hear from you",
    button_text = 'Send Message',
  } = data;
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;

  return `
<section id="contact" class="contact-section">
  <div class="contact-container">
    <div class="contact-header">
      <h2 class="contact-heading">${heading}</h2>
      <p class="contact-subheading">${subheading}</p>
    </div>
    <form class="contact-form" onsubmit="event.preventDefault(); alert('Form submission not configured yet. Connect to your backend!');">
      <div class="form-row">
        <div class="form-group">
          <label for="name">Your Name</label>
          <input type="text" id="name" name="name" required />
        </div>
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" required />
        </div>
      </div>
      <div class="form-group">
        <label for="message">Message</label>
        <textarea id="message" name="message" rows="5" required></textarea>
      </div>
      <button type="submit" class="contact-submit">${button_text}</button>
    </form>
  </div>
</section>

<style>
.contact-section {
  padding: 5rem 2rem;
  background: #f7fafc;
}

.contact-container {
  max-width: 800px;
  margin: 0 auto;
}

.contact-header {
  text-align: center;
  margin-bottom: 3rem;
}

.contact-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: clamp(2rem, 3vw, 2.5rem);
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
}

.contact-subheading {
  font-size: 1.25rem;
  color: #4a5568;
}

.contact-form {
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.875rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.3s ease;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: ${primary_color};
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.contact-submit {
  width: 100%;
  padding: 1rem 2rem;
  background: ${primary_color};
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.contact-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

@media (max-width: 768px) {
  .contact-section {
    padding: 3rem 1.5rem;
  }

  .contact-form {
    padding: 2rem;
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
  `.trim();
}
