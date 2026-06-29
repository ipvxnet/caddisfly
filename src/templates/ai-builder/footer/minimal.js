// Minimal Footer — compact single-row footer (brand · inline links · social),
// light/bordered by default; flipped on dark themes via darkModeCss. Token-aware
// (social icon radius). Same content shape as the multi-column footer.

import { uiText } from '../section-defaults.js';
import { socialIconSvg } from '../social-icons.js';

export function footerMinimalTemplate(data, config) {
  const lang = config.lang || 'en';
  const {
    business_name = uiText(lang, 'business'),
    tagline = '',
    copyright = `${new Date().getFullYear()} ${business_name}. ${uiText(lang, 'rights')}.`,
    links = [
      { label: uiText(lang, 'nav_about'), url: '#about' },
      { label: uiText(lang, 'nav_services'), url: '#services' },
      { label: uiText(lang, 'nav_contact'), url: '#contact' },
    ],
    social = [],
    social_style = 'letters',
  } = data;
  const { primary_color: primaryColor = '#667eea', font_heading: fontHeading = 'Inter' } = config;

  const socialLinks = (Array.isArray(social) ? social : []).filter((s) => s && s.url && s.url !== '#');
  const useIcons = social_style === 'icons';
  const getSocialIcon = (platform) => {
    if (useIcons) { const svg = socialIconSvg(platform); if (svg) return svg; }
    const icons = { facebook: 'F', instagram: 'I', twitter: 'T', x: 'X', linkedin: 'in', youtube: 'Y', tiktok: 'TT' };
    return icons[String(platform).toLowerCase()] || '•';
  };

  const linksHtml = (Array.isArray(links) ? links : [])
    .map((l) => `<a href="${l.url}"${l.new_tab ? ' target="_blank" rel="noopener"' : ''}>${l.label}</a>`)
    .join('');

  const socialHtml = socialLinks.length
    ? `<div class="footer-minimal-social">${socialLinks
        .map((s) => `<a href="${s.url}" target="_blank" rel="noopener" aria-label="${s.platform}">${getSocialIcon(s.platform)}</a>`)
        .join('')}</div>`
    : '';

  return `
<footer class="footer-minimal">
  <div class="footer-minimal-inner">
    <span class="footer-minimal-brand">${business_name}</span>
    <nav class="footer-minimal-links">${linksHtml}</nav>
    ${socialHtml}
  </div>
  <p class="footer-minimal-copy">${copyright}</p>
</footer>

<style>
.footer-minimal {
  background: #ffffff;
  border-top: 1px solid rgba(0,0,0,0.08);
  padding: 2.25rem 2rem 1.75rem;
}
.footer-minimal-inner {
  max-width: var(--cf-container, 1200px);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.footer-minimal-brand {
  font-family: '${fontHeading}', sans-serif;
  font-weight: 700;
  font-size: 1.15rem;
  color: ${primaryColor};
}
.footer-minimal-links {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.footer-minimal-links a {
  color: #4a5568;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  transition: color 0.2s ease;
}
.footer-minimal-links a:hover { color: ${primaryColor}; }
.footer-minimal-social { display: flex; gap: 0.6rem; }
.footer-minimal-social a {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px;
  border-radius: var(--cf-btn-radius, 8px);
  background: rgba(0,0,0,0.05);
  color: #2d3748; text-decoration: none; font-weight: 600; font-size: 0.85rem;
  transition: all 0.2s ease;
}
.footer-minimal-social a:hover { background: ${primaryColor}; color: #fff; }
.footer-minimal-copy {
  max-width: var(--cf-container, 1200px);
  margin: 1.5rem auto 0;
  text-align: center;
  color: #718096;
  font-size: 0.8125rem;
}
@media (max-width: 640px) {
  .footer-minimal-inner { flex-direction: column; align-items: center; text-align: center; gap: 1rem; }
}
</style>
  `.trim();
}
