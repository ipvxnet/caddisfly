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
    cta_link_new_tab = false,
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

  // Multi-page nav: render page links when the project has more than one visible
  // page (injected via config by assemblePage). Falls back to the single Contact
  // CTA / anchor nav for single-page sites.
  const pages = Array.isArray(config.pages) ? config.pages.filter((p) => p.is_visible !== 0) : [];
  const previewBase = config.previewBase || '';
  const currentSlug = config.currentSlug || '';
  const embedSuffix = config.embed ? '?embed=1' : '';
  const contactLabel = { en: 'Contact', es: 'Contacto', pt: 'Contato' }[config.lang] || 'Contact';
  // previewBase is '' for SUBDOMAIN copies (nav rooted at /) — that's a valid
  // base, not "no pages". Gating links on `previewBase` truthiness left
  // subdomain-served sites with NO nav menu at all (links like `/about` are
  // exactly what we want there). Single-page sites still get the anchor nav.
  const homeHref = previewBase ? `${previewBase}/home${embedSuffix}` : pages.length > 1 ? '/' : '#top';

  const pageLinks =
    pages.length > 1
      ? pages
          .map((p) => {
            const active = p.slug === currentSlug ? ' nav-link-active' : '';
            const aria = p.slug === currentSlug ? ' aria-current="page"' : '';
            return `<a class="nav-link${active}"${aria} href="${escapeAttr(`${previewBase}/${p.slug}${embedSuffix}`)}">${escapeHtml(p.nav_label || p.title || p.slug)}</a>`;
          })
          .join('\n      ')
      : '';

  const actions = pageLinks
    ? `${pageLinks}\n      ${phoneLink}`
    : `${phoneLink}\n      <a class="nav-cta" href="${escapeAttr(cta_link)}"${cta_link_new_tab ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(contactLabel)}</a>`;

  // Multi-page sites get a hamburger on small screens (the link row would
  // otherwise wrap into a wall of links). Single-page anchor navs stay as-is.
  const toggle = pageLinks
    ? `<button class="nav-toggle" aria-label="Menu" aria-expanded="false"
        onclick="var n=this.closest('.site-nav');var o=n.classList.toggle('nav-open');this.setAttribute('aria-expanded',o);this.textContent=o?'✕':'☰'">☰</button>`
    : '';

  return `
<header class="site-nav${pageLinks ? ' has-menu' : ''}">
  <div class="site-nav-inner">
    <a class="nav-brand" href="${escapeAttr(homeHref)}">${brand}</a>
    ${toggle}
    <nav class="nav-actions">
      ${actions}
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
.nav-link {
  color: #2d3748;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.3rem 0;
  border-bottom: 2px solid transparent;
}
.nav-link:hover { color: ${primaryColor}; }
.nav-link-active {
  color: ${primaryColor};
  border-bottom-color: ${primaryColor};
}

.nav-toggle { display: none; background: none; border: 1.5px solid rgba(0,0,0,0.12); border-radius: 8px;
  font-size: 1.05rem; line-height: 1; padding: 0.4rem 0.6rem; cursor: pointer; color: #2d3748; }

@media (max-width: 768px) {
  .site-nav-inner { padding: 0.6rem 1rem; }
  .nav-logo { height: 32px; }
  /* Multi-page sites: collapse the link row behind a hamburger dropdown. */
  .site-nav.has-menu .nav-toggle { display: inline-flex; }
  .site-nav.has-menu .nav-actions { display: none; }
  .site-nav.has-menu.nav-open .nav-actions {
    display: flex; flex-direction: column; align-items: flex-start; gap: 0.95rem;
    position: absolute; top: 100%; left: 0; right: 0; background: #ffffff;
    padding: 1rem 1.25rem 1.2rem; border-bottom: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 12px 24px rgba(0,0,0,0.08);
  }
  .site-nav.has-menu .nav-link { font-size: 1.02rem; }
  /* Single-page anchor nav: keep the compact wrap behavior. */
  .site-nav:not(.has-menu) .site-nav-inner { flex-wrap: wrap; }
  .site-nav:not(.has-menu) .nav-phone { display: none; }
  .site-nav:not(.has-menu) .nav-actions { gap: 0.85rem; flex-wrap: wrap; }
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
