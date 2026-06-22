// Header / navigation bar — carries brand identity (logo + name)

import { SECTION_NAV_LABELS } from '../../../utils/anchor-normalize.js';

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

  // Decide multi-page vs single-page. Blog/Shop are standalone nav pages that can
  // coexist with a single-page (one-pager) content site, so they don't count as
  // "multi-page content".
  const CONTENT_SLUGS = new Set(['home', 'about', 'services', 'gallery', 'contact']);
  // A label-only menu GROUP (e.g. an "About" dropdown header) is NOT a content
  // page — counting it as one used to flip a one-pager into "multi-page" mode and
  // strip the home page's section-anchor nav. Exclude groups from the decision.
  const contentPages = pages.filter((p) => CONTENT_SLUGS.has(p.slug) && !p.is_group);
  const extraPages = pages.filter((p) => !CONTENT_SLUGS.has(p.slug)); // e.g. blog, shop
  const multiPage = contentPages.length > 1;
  const sectionNav = Array.isArray(config.sectionNav) ? config.sectionNav : [];

  const pageLink = (p) => {
    const active = p.slug === currentSlug ? ' nav-link-active' : '';
    const aria = p.slug === currentSlug ? ' aria-current="page"' : '';
    return `<a class="nav-link${active}"${aria} href="${escapeAttr(`${previewBase}/${p.slug}${embedSuffix}`)}">${escapeHtml(p.nav_label || p.title || p.slug)}</a>`;
  };
  // Section anchors (e.g. #about) live on the HOME page. On a sub-page (a custom
  // page like /antes-e-depois) those anchors can't resolve in-page, so prefix
  // them with the home route — `/#about` on a subdomain, `/site/:id/home#about`
  // on the app copy — so the primary menu stays consistent and clickable across
  // every page instead of collapsing to just the current page's sections.
  const homePage = pages.find((p) => p.is_home) || pages.find((p) => p.slug === 'home');
  const onHome = !homePage || !currentSlug || currentSlug === homePage.slug;
  const homeAnchorBase = previewBase ? `${previewBase}/home` : '/';
  const anchorLink = (s) => {
    const href = onHome ? s.anchor : `${homeAnchorBase}${embedSuffix}${s.anchor}`;
    return `<a class="nav-link" href="${escapeAttr(href)}">${escapeHtml(s.label)}</a>`;
  };

  // --- Hierarchy: a page can nest under a parent, and a parent can be a
  // label-only "group" (a dropdown header with no page of its own). One level
  // deep. Children render inside the parent's dropdown; on desktop it opens on
  // hover/focus, on mobile the caret toggles it open. ---
  const childrenOf = (id) =>
    pages.filter((p) => (p.parent_id || null) === id).sort((a, b) => (a.page_order || 0) - (b.page_order || 0));
  const pageHref = (p) => `${previewBase}/${p.slug}${embedSuffix}`;
  const subLink = (p) => {
    const active = p.slug === currentSlug ? ' nav-link-active' : '';
    return `<a class="nav-sublink${active}" role="menuitem" href="${escapeAttr(pageHref(p))}">${escapeHtml(p.nav_label || p.title || p.slug)}</a>`;
  };
  // A page's in-page sections, exposed as submenu items when the page opts in
  // (`show_sections_in_nav`). config.pageSections maps pageId -> raw sections.
  const navLabels = SECTION_NAV_LABELS[config.lang] || SECTION_NAV_LABELS.en || {};
  const pageSections = (config.pageSections && typeof config.pageSections === 'object') ? config.pageSections : {};
  const sectionSubLinks = (p, deep = false) => {
    if (!p.show_sections_in_nav) return [];
    const secs = pageSections[p.id] || [];
    const seen = new Set();
    const out = [];
    const cls = deep ? 'nav-sublink nav-sublink-deep' : 'nav-sublink';
    // A deep anchor whose label just repeats the page's own name is redundant with
    // the page link right above it (e.g. an "About Us" page whose lone section is
    // also "About Us") — skip it.
    const pageLabel = String(p.nav_label || p.title || p.slug || '').trim().toLowerCase();
    for (const s of secs) {
      if (s.is_visible === 0) continue;
      let meta = {};
      try { meta = s.content_json ? JSON.parse(s.content_json) : {}; } catch { meta = {}; }
      if (meta._nav_hidden) continue;
      const type = s.section_type;
      const label = meta._nav_label || meta.heading || navLabels[type];
      if (!label) continue;                 // only navigable, titled sections
      if (deep && String(label).trim().toLowerCase() === pageLabel) continue; // redundant with the page link
      const key = String(label).trim().toLowerCase();
      if (seen.has(key)) continue;          // dedup by LABEL — a page can hold many sections of one type (e.g. two catalogues)
      seen.add(key);
      // Anchor each section by its unique wrapper id (ai-sec-<id>) so multiple
      // same-type sections each resolve; fall back to the type id when unavailable.
      const anchor = s.id != null ? `#ai-sec-${s.id}` : `#${type}`;
      const href = p.slug === currentSlug ? anchor : `${pageHref(p).replace(embedSuffix, '')}${embedSuffix}${anchor}`;
      out.push(`<a class="${cls}" role="menuitem" href="${escapeAttr(href)}">${escapeHtml(String(label).slice(0, 40))}</a>`);
    }
    return out;
  };
  // A top-level page/group, rendered as a plain link or (if it has children or
  // opted-in sections) a dropdown. Groups are non-link buttons; pages keep their
  // link plus a caret. Submenu = child pages first, then the page's own sections.
  const navItem = (p) => {
    const kids = childrenOf(p.id);
    const secLinks = sectionSubLinks(p);
    // An empty group (no child pages, no section links) has nothing to drop down —
    // render nothing rather than a dead dropdown that won't open. A leaf page
    // renders as a plain link.
    if (!kids.length && !secLinks.length) return p.is_group ? '' : pageLink(p);
    const label = escapeHtml(p.nav_label || p.title || p.slug);
    // A nested child page that opted into "sections as submenu" surfaces its
    // section anchors right under its own link (flattened into this one dropdown —
    // menus stay one level deep). Without this a page's section submenu vanished
    // the moment it was nested under a group.
    const kidLinks = kids.map((k) => subLink(k) + sectionSubLinks(k, true).join('')).join('');
    const submenu = `<div class="nav-submenu" role="menu">${kidLinks}${secLinks.join('')}</div>`;
    const caret = `<button type="button" class="nav-caret" aria-haspopup="true" aria-expanded="false" aria-label="${label}"
        onclick="var i=this.closest('.nav-item');var o=i.classList.toggle('open');this.setAttribute('aria-expanded',o)">▾</button>`;
    const trigger = p.is_group
      ? `<button type="button" class="nav-link nav-grouphdr" aria-haspopup="true" aria-expanded="false"
          onclick="var i=this.closest('.nav-item');var o=i.classList.toggle('open');this.setAttribute('aria-expanded',o)">${label}<span class="nav-caret-i">▾</span></button>`
      : `<a class="nav-link${p.slug === currentSlug ? ' nav-link-active' : ''}" href="${escapeAttr(pageHref(p))}">${label}</a>${caret}`;
    return `<div class="nav-item has-sub">${trigger}${submenu}</div>`;
  };

  // Multi-page → top-level page links/dropdowns. Single-page → in-page section
  // anchors, plus any top-level standalone/custom pages and label-only groups.
  const topLevelPages = pages.filter((p) => !p.parent_id);
  const topLevelExtras = topLevelPages.filter((p) => !p.is_home && (p.is_group || !CONTENT_SLUGS.has(p.slug)));
  const navLinks = multiPage
    ? topLevelPages.map(navItem).join('\n      ')
    : [sectionNav.map(anchorLink).join('\n      '), topLevelExtras.map(navItem).join('\n      ')]
        .filter(Boolean)
        .join('\n      ');

  const actions = navLinks
    ? `${navLinks}\n      ${phoneLink}`
    : `${phoneLink}\n      <a class="nav-cta" href="${escapeAttr(cta_link)}"${cta_link_new_tab ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(contactLabel)}</a>`;

  // A populated menu collapses behind a hamburger on small screens (section
  // anchors included — they scroll the one-pager on tap).
  const toggle = navLinks
    ? `<button class="nav-toggle" aria-label="Menu" aria-expanded="false"
        onclick="var n=this.closest('.site-nav');var o=n.classList.toggle('nav-open');this.setAttribute('aria-expanded',o);this.textContent=o?'✕':'☰'">☰</button>`
    : '';

  return `
<header class="site-nav${navLinks ? ' has-menu' : ''}">
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

/* Dropdown submenus (nested pages / label-only groups) */
.nav-item { position: relative; display: inline-flex; align-items: center; }
.nav-grouphdr { background: none; border: none; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 0.25rem; }
.nav-caret { background: none; border: none; cursor: pointer; color: #718096; font-size: 0.7rem; line-height: 1; padding: 0.3rem 0.15rem; }
.nav-caret-i { font-size: 0.7rem; color: #718096; }
.nav-submenu {
  position: absolute; top: 100%; left: 0; min-width: 200px;
  background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 10px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.12); padding: 0.4rem;
  display: none; flex-direction: column; gap: 0.05rem; z-index: 1001;
}
.nav-item:hover > .nav-submenu,
.nav-item:focus-within > .nav-submenu,
.nav-item.open > .nav-submenu { display: flex; }
.nav-sublink {
  color: #2d3748; text-decoration: none; font-weight: 500; font-size: 0.92rem;
  padding: 0.5rem 0.7rem; border-radius: 7px; white-space: nowrap;
}
.nav-sublink:hover { background: rgba(0,0,0,0.04); color: ${primaryColor}; }
.nav-sublink.nav-link-active { color: ${primaryColor}; border-bottom: none; }
/* A nested page's own section anchors, indented under its link in a group dropdown. */
.nav-sublink-deep { padding-left: 1.5rem; font-size: 0.86rem; opacity: 0.9; }

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
  /* Submenus become an inline accordion inside the hamburger (no hover). */
  .site-nav.has-menu.nav-open .nav-item { position: static; flex-direction: column; align-items: flex-start; width: 100%; }
  .site-nav.has-menu.nav-open .nav-item.has-sub { gap: 0.4rem; }
  .site-nav.has-menu.nav-open .nav-submenu {
    position: static; display: none !important; box-shadow: none; border: none;
    padding: 0.1rem 0 0.2rem 1rem; min-width: 0; background: transparent;
  }
  .site-nav.has-menu.nav-open .nav-item.open > .nav-submenu { display: flex !important; }
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
