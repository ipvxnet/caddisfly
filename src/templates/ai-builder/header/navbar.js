// Header / navigation bar — carries brand identity (logo + name)

/**
 * Sticky top navigation bar with the business logo and name.
 * Restores brand identity to generated sites (logo recovered from the original
 * site's <head>, or a text wordmark when no logo is available).
 * @param {object} data - { logo, business_name, phone, cta_link }
 * @param {object} config - Website configuration
 * @returns {string} HTML
 */
export function navbarTemplate(data, config) {
  const {
    logo = '',
    business_name = 'Home',
    phone = '',
    cta_link = '#contact',
  } = data;
  const primaryColor = config.primary_color || '#667eea';
  const fontHeading = config.font_heading || 'Inter';

  const brand = logo
    ? `<img class="nav-logo" src="${logo}" alt="${escapeAttr(business_name)}" />
       <span class="nav-brand-name">${escapeHtml(business_name)}</span>`
    : `<span class="nav-brand-name nav-brand-wordmark">${escapeHtml(business_name)}</span>`;

  const phoneLink = phone
    ? `<a class="nav-phone" href="tel:${phone.replace(/[^+\d]/g, '')}">${escapeHtml(phone)}</a>`
    : '';

  return `
<header class="site-nav">
  <div class="site-nav-inner">
    <a class="nav-brand" href="#top">${brand}</a>
    <nav class="nav-actions">
      ${phoneLink}
      <a class="nav-cta" href="${escapeAttr(cta_link)}">Contact</a>
    </nav>
  </div>
</header>

<style>
.site-nav {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: #ffffff;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 1px 8px rgba(0,0,0,0.04);
}
.site-nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.nav-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
}
.nav-logo {
  height: 40px;
  width: auto;
  max-width: 180px;
  object-fit: contain;
}
.nav-brand-name {
  font-family: '${fontHeading}', sans-serif;
  font-weight: 700;
  font-size: 1.15rem;
  color: #1a202c;
}
.nav-brand-wordmark {
  font-size: 1.4rem;
  color: ${primaryColor};
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}
.nav-phone {
  color: #2d3748;
  text-decoration: none;
  font-weight: 600;
}
.nav-phone:hover { color: ${primaryColor}; }
.nav-cta {
  background: ${primaryColor};
  color: #fff;
  text-decoration: none;
  padding: 0.6rem 1.4rem;
  border-radius: 8px;
  font-weight: 600;
}
.nav-cta:hover { opacity: 0.92; }

@media (max-width: 600px) {
  .site-nav-inner { padding: 0.6rem 1rem; }
  .nav-phone { display: none; }
  .nav-logo { height: 32px; }
}
</style>
  `.trim();
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
