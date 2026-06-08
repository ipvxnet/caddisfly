// Footer Section with Multiple Columns

/**
 * Generates a footer section with multiple columns
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function footerMultiColumnTemplate(data, config) {
  const {
    business_name = 'Your Business',
    tagline = 'Making a difference',
    copyright = `${new Date().getFullYear()} Your Business. All rights reserved.`,
    links = [
      { label: 'About', url: '#about' },
      { label: 'Services', url: '#services' },
      { label: 'Contact', url: '#contact' },
    ],
    social = [
      { platform: 'facebook', url: '#' },
      { platform: 'instagram', url: '#' },
      { platform: 'twitter', url: '#' },
    ],
  } = data;
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;

  const getSocialIcon = (platform) => {
    const icons = {
      facebook: 'F',
      instagram: 'I',
      twitter: 'T',
      linkedin: 'in',
      youtube: 'Y',
    };
    return icons[platform.toLowerCase()] || '•';
  };

  return `
<footer class="footer-section">
  <div class="footer-container">
    <div class="footer-brand">
      <h3 class="footer-brand-name">${business_name}</h3>
      <p class="footer-tagline">${tagline}</p>
    </div>
    <div class="footer-links">
      <h4 class="footer-links-heading">Quick Links</h4>
      <ul class="footer-links-list">
        ${links.map((link) => `<li><a href="${link.url}"${link.new_tab ? ' target="_blank" rel="noopener"' : ''}>${link.label}</a></li>`).join('')}
      </ul>
    </div>
    <div class="footer-social">
      <h4 class="footer-social-heading">Follow Us</h4>
      <div class="footer-social-icons">
        ${social
          .map(
            (item) => `
          <a href="${item.url}" class="social-icon" aria-label="${item.platform}">
            ${getSocialIcon(item.platform)}
          </a>
        `
          )
          .join('')}
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="footer-copyright">${copyright}</p>
  </div>
</footer>

<style>
.footer-section {
  background: #1a202c;
  color: white;
  padding: 3rem 2rem 2rem;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 3rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.footer-brand-name {
  font-family: ${font_heading}, sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: ${primary_color};
}

.footer-tagline {
  color: #a0aec0;
  font-size: 1rem;
}

.footer-links-heading,
.footer-social-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.footer-links-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-links-list li {
  margin-bottom: 0.75rem;
}

.footer-links-list a {
  color: #a0aec0;
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-links-list a:hover {
  color: ${primary_color};
}

.footer-social-icons {
  display: flex;
  gap: 1rem;
}

.social-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(255,255,255,0.1);
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
}

.social-icon:hover {
  background: ${primary_color};
  transform: translateY(-2px);
}

.footer-bottom {
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 2rem;
  text-align: center;
}

.footer-copyright {
  color: #718096;
  font-size: 0.875rem;
}

@media (max-width: 968px) {
  .footer-section {
    padding: 2.5rem 1.5rem 1.5rem;
  }

  .footer-container {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
</style>
  `.trim();
}
