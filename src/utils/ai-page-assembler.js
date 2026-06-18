// AI Page Assembler
// Assembles complete HTML pages from sections

import { renderSection } from '../templates/ai-builder/registry.js';
import { holidayDecorHtml } from './holiday-decor.js';
import { getTheme, darkModeCss, templateTokensCss } from './site-themes.js';
import { translator } from '../i18n/index.js';
import { SECTION_NAV_LABELS, rewriteLocalizedAnchors } from './anchor-normalize.js';

// Google Fonts that ship a single (400) weight only — requesting extra weights in
// the css2 URL returns HTTP 400 and breaks the whole stylesheet, so omit the axis.
const SINGLE_WEIGHT_FONTS = new Set(['Instrument Serif', 'Bebas Neue']);

/**
 * Build one css2 `family=` token for a font, picking a safe weight axis.
 * @param {string} name - Font family
 * @param {string} weights - Weight axis (e.g. '400;600;700') for multi-weight fonts
 * @returns {string}
 */
function fontFamilyParam(name, weights) {
  const family = encodeURIComponent(name);
  return SINGLE_WEIGHT_FONTS.has(name) ? `family=${family}` : `family=${family}:wght@${weights}`;
}

/**
 * Assemble a complete HTML page from sections
 * @param {array} sections - Array of section objects from database
 * @param {object} config - Website configuration
 * @param {object} project - AI project object
 * @returns {string} Complete HTML document
 */
export function assemblePage(sections, config, project, opts = {}) {
  const {
    pages = null, currentSlug = null, previewBase = null, embed = false, preordered = false,
    hideBadge = false, trackId = null, appOrigin = '', editOverlay = false,
    seoTitle = null, seoDescription = null, socialImage = null, heroImage = null, canonicalUrl = null, pageTitle = null, business = null,
    lang = 'en', products = null, bookingServices = null, holiday = null,
  } = opts;

  // Inject nav context so the navbar can render page links (other templates
  // ignore it). `products` feeds the 🛍 featured-products section live data.
  const renderConfig = { ...config, pages, currentSlug, previewBase, embed, hideBadge, trackId, appOrigin, lang, products, booking_services: bookingServices, holiday, editOverlay };

  // Render in the given order when preordered (multi-page: header + page body +
  // footer assembled by the caller); otherwise sort a COPY by section_order.
  const ordered = preordered ? sections.slice() : sections.slice().sort((a, b) => a.section_order - b.section_order);

  const visibleSections = ordered.filter((section) => section.is_visible);
  // Section types present on THIS page — used to decide whether a `#type` link
  // resolves here or must route to another page (multi-page sites).
  const currentTypes = new Set(visibleSections.map((s) => s.section_type));
  const seenTypes = new Set();

  // Single-page anchor nav: give the navbar a list of {anchor,label} for the
  // sections actually present, so the top menu scrolls to each section on the
  // page (the navbar ignores this when the site is multi-page).
  renderConfig.sectionNav = buildSectionNav(visibleSections, lang);

  const renderedParts = visibleSections
    .map((section) => {
      const contentData = section.content_json ? JSON.parse(section.content_json) : {};
      // Use html_template field if available, otherwise check contentData._variant
      const variant = section.html_template || contentData._variant || 'default';

      const rendered = renderSection(section.section_type, contentData, renderConfig, variant);
      // Semantic anchor target (e.g. id="contact") so in-page links like
      // `#contact` resolve regardless of which variant rendered — but only the
      // FIRST section of each type, and only if the template didn't already emit
      // that id (avoids duplicate ids).
      const type = section.section_type;
      let semanticAnchor = '';
      if (type && !seenTypes.has(type)) {
        seenTypes.add(type);
        if (!rendered.includes(`id="${type}"`)) {
          semanticAnchor = `<span id="${escapeHtml(type)}" aria-hidden="true" style="display:block;scroll-margin-top:70px"></span>`;
        }
      }
      // Wrap in a stable anchor so the customize page can scroll the preview to a
      // section by its DB id (matches the left-panel section list's data-section-id).
      const anchorId = section.id != null ? `ai-sec-${section.id}` : '';
      const inner = `${semanticAnchor}${rendered}`;
      const html = anchorId
        ? `<div id="${anchorId}" style="scroll-margin-top: 70px;">${inner}</div>`
        : inner;
      return { type, html };
    });

  // Wrap the content sections in a single <main> landmark (accessibility:
  // Lighthouse "document has a main landmark"). The header (<header>/banner) and
  // footer (<footer>/contentinfo) stay OUTSIDE <main> so we don't create nested
  // top-level-landmark violations.
  let renderedSections = '';
  let mainOpen = false;
  for (const part of renderedParts) {
    const isChrome = part.type === 'header' || part.type === 'footer';
    if (!isChrome && !mainOpen) { renderedSections += '<main>\n'; mainOpen = true; }
    if (isChrome && mainOpen) { renderedSections += '</main>\n'; mainOpen = false; }
    renderedSections += part.html + '\n\n';
  }
  if (mainOpen) renderedSections += '</main>\n';
  renderedSections = renderedSections.trim();

  // Multi-page link fix: a `#contact`-style link whose target section lives on a
  // DIFFERENT page can't resolve in-page — rewrite it to that page's route (same
  // format the navbar uses). Same-page anchors (and bare `#`) are left alone.
  // Route cross-page slug anchors first, THEN normalize remaining in-page
  // section anchors (e.g. `#Contato` → `#contact`) so localized/mis-cased
  // button links resolve to the real id="<type>" target.
  const routed = rewriteCrossPageAnchors(renderedSections, { pages, currentSlug, previewBase, embed, currentTypes });
  const body = rewriteLocalizedAnchors(routed);

  // Build complete HTML document
  const html = buildHTMLDocument({
    title: project.project_name || 'My Website',
    body,
    config: renderConfig,
    seo: { seoTitle, seoDescription, socialImage, heroImage, canonicalUrl, pageTitle, business },
  });

  return html;
}

// Single-page anchor nav order. Labels come from the shared SECTION_NAV_LABELS
// (anchor-normalize.js). header/footer/cta/stats are intentionally not navigable.
const SECTION_NAV_ORDER = ['hero', 'about', 'services', 'features', 'gallery', 'testimonials', 'pricing', 'contact'];

/**
 * Build the section anchor nav for a single-page site from the sections present.
 * @param {Array<{section_type:string}>} visibleSections
 * @param {string} lang
 * @returns {Array<{anchor:string,label:string}>}
 */
function buildSectionNav(visibleSections, lang = 'en') {
  const labels = SECTION_NAV_LABELS[lang] || SECTION_NAV_LABELS.en;
  const present = new Set((visibleSections || []).map((s) => s.section_type));
  const nav = [];
  for (const type of SECTION_NAV_ORDER) {
    if (present.has(type) && labels[type]) nav.push({ anchor: `#${type}`, label: labels[type] });
  }
  return nav;
}

/**
 * Rewrite cross-page in-page anchors to page routes on multi-page sites.
 * Hero CTAs / footers emit `#contact`, `#services`, `#about` (single-page
 * assumption). When the matching section lives on a SEPARATE page, that anchor
 * can never resolve — so point it at the page route instead (same `${base}/${slug}`
 * format the navbar uses). Anchors whose target is on the current page, bare
 * `#`, and external/route links are left untouched.
 * @returns {string} HTML with cross-page anchors rewritten
 */
function rewriteCrossPageAnchors(html, { pages, currentSlug, previewBase, embed, currentTypes }) {
  const visiblePages = Array.isArray(pages) ? pages.filter((p) => p.is_visible !== 0) : [];
  if (visiblePages.length <= 1) return html; // single-page: anchors stay in-page
  const pageSlugs = new Set(visiblePages.map((p) => p.slug));
  const base = previewBase || '';
  const embedSuffix = embed ? '?embed=1' : '';
  return html.replace(/href="#([A-Za-z0-9_-]+)"/g, (match, anchor) => {
    if (currentTypes && currentTypes.has(anchor)) return match; // resolves on this page
    if (pageSlugs.has(anchor) && anchor !== currentSlug) {
      return `href="${escapeHtml(`${base}/${anchor}${embedSuffix}`)}"`;
    }
    return match; // unknown anchor — leave as-is
  });
}

/**
 * Build the SEO <head> block for a published page: title, meta description,
 * canonical, Open Graph / Twitter cards, and a LocalBusiness JSON-LD when real
 * contact data is present. Everything falls back to the business name / tagline
 * so a site is SEO-ready with zero input; `seoTitle`/`seoDescription`/`socialImage`
 * (set in the customize SEO panel) override the auto values.
 */
function seoHead(seo, fallbackTitle, logoUrl = '') {
  const s = seo || {};
  const biz = s.business || {};
  const e = escapeHtml;
  const bizName = biz.name || fallbackTitle || 'My Website';
  const pageTitle = s.pageTitle || fallbackTitle || bizName;
  const metaTitle = s.seoTitle || (pageTitle && pageTitle !== bizName ? `${pageTitle} | ${bizName}` : bizName);
  const metaDesc = s.seoDescription || biz.description || `${bizName} — official website.`;
  let ogImage = s.socialImage || biz.logo || logoUrl || s.heroImage || '';
  const canonical = s.canonicalUrl || '';
  // og:image must be absolute for crawlers — anchor relative asset URLs
  // (/preview-asset/…) to the canonical host when we know it.
  if (ogImage.startsWith('/') && canonical) {
    try { ogImage = new URL(canonical).origin + ogImage; } catch { /* keep relative */ }
  }

  const tags = [
    `<title>${e(metaTitle)}</title>`,
    `<meta name="description" content="${e(metaDesc)}">`,
    canonical ? `<link rel="canonical" href="${e(canonical)}">` : '',
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${e(bizName)}">`,
    `<meta property="og:title" content="${e(metaTitle)}">`,
    `<meta property="og:description" content="${e(metaDesc)}">`,
    canonical ? `<meta property="og:url" content="${e(canonical)}">` : '',
    ogImage ? `<meta property="og:image" content="${e(ogImage)}">` : '',
    `<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${e(metaTitle)}">`,
    `<meta name="twitter:description" content="${e(metaDesc)}">`,
    ogImage ? `<meta name="twitter:image" content="${e(ogImage)}">` : '',
  ];

  let ld = '';
  if (biz.name && (biz.address || biz.phone)) {
    const obj = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: biz.name };
    if (metaDesc) obj.description = metaDesc;
    if (canonical) obj.url = canonical;
    if (ogImage) obj.image = ogImage;
    if (biz.phone) obj.telephone = biz.phone;
    if (biz.address) obj.address = { '@type': 'PostalAddress', streetAddress: biz.address };
    ld = `\n  <script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
  }
  return tags.filter(Boolean).join('\n  ') + ld;
}

/**
 * Build complete HTML document structure
 * @param {object} options - Document options
 * @returns {string} Complete HTML document
 */
export function buildHTMLDocument({ title, body, config, seo = null }) {
  const { primary_color = '#667eea', font_heading = 'Inter', font_body = 'Inter', hideBadge = false, trackId = null, appOrigin = '', lang = 'en', editOverlay = false } = config;

  // Brand favicon from the site logo (AI-generated or uploaded). Relative
  // /preview-asset/ URLs resolve on the app origin, subdomains, and custom
  // domains alike (the sites worker serves them from R2).
  const logoUrl = config.logo_url || '';
  const faviconMime = logoUrl.endsWith('.svg') ? 'image/svg+xml'
    : logoUrl.endsWith('.png') ? 'image/png'
    : logoUrl.endsWith('.webp') ? 'image/webp'
    : 'image/jpeg';
  const faviconTags = logoUrl
    ? `<link rel="icon" type="${faviconMime}" href="${escapeHtml(logoUrl)}">
  <link rel="apple-touch-icon" href="${escapeHtml(logoUrl)}">`
    : '';

  // Dark themes carry surface tokens; inject a global override layer when active.
  const theme = getTheme(config.style_theme);
  const isDark = theme && theme.mode === 'dark';
  const darkLayer = isDark ? darkModeCss(theme) : '';
  // Per-template design tokens (radius/shadow/spacing/etc.) → :root CSS vars.
  const tokenVars = templateTokensCss(theme);

  const fontsHref = `https://fonts.googleapis.com/css2?${fontFamilyParam(font_heading, '400;600;700')}&${fontFamilyParam(font_body, '400;500;600')}&display=swap`;

  // Preload the hero (LCP) image so the browser discovers it before parsing the
  // body — cuts "LCP request discovery" latency. Only for absolute/asset URLs.
  const heroImg = (seo && seo.heroImage) || '';
  const heroPreload = heroImg && /^(https?:|\/)/.test(heroImg)
    ? `\n  <link rel="preload" as="image" href="${escapeHtml(heroImg)}" fetchpriority="high">`
    : '';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${seoHead(seo, title, logoUrl)}
  ${faviconTags}

  <!-- Google Fonts (loaded non-blocking: preload as style, swap to stylesheet
       on load so the font CSS never blocks first render) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>${heroPreload}
  <link rel="preload" as="style" href="${fontsHref}" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link href="${fontsHref}" rel="stylesheet"></noscript>

  <style>
    /* Global Reset & Base Styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    main {
      display: block;
    }

    body {
      font-family: '${font_body}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #2d3748;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: '${font_heading}', sans-serif;
      line-height: 1.2;
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    /* CSS Variables */
    :root {
      --primary-color: ${primary_color};
      --primary-color-rgb: ${hexToRgb(primary_color)};
      --on-primary: ${readableOn(primary_color)};${tokenVars}
    }

    /* Smooth scroll offset for anchor links */
    section {
      scroll-margin-top: 20px;
    }

    /* NOTE: no body-level opacity fade-in. Starting <body> at opacity:0 made
       the first paint invisible, so Lighthouse (esp. throttled mobile) reported
       NO_FCP — "the page did not paint any content" — and it delayed real first
       paint too. Section entrance animations (fadeInUp etc.) live per-template. */

    /* Dark theme override layer (only present for dark themes) */
    ${darkLayer}
  </style>
</head>
<body>
${body}

<!-- Caddisfly Branding (free tier only; paid plans remove it) -->
${hideBadge ? '' : `<div style="text-align: center; padding: 1rem; background: #f7fafc; font-size: 0.875rem; color: #718096;">
  Built with <a href="${appOrigin || 'https://caddisfly.ai'}" target="_blank" style="color: ${primary_color}; text-decoration: none; font-weight: 600;">Caddisfly</a>
</div>`}

${holidayDecorHtml(config.holiday)}
${trackId ? `<!-- Caddisfly analytics (cookieless; fired after load via sendBeacon so it
     never sits in the critical request chain or triggers a CORS preflight) -->
<script>(function(){function t(){try{var u='${appOrigin}/api/track',d=JSON.stringify({s:'${trackId}',p:location.pathname,r:document.referrer});if(navigator.sendBeacon){navigator.sendBeacon(u,new Blob([d],{type:'text/plain'}));}else{fetch(u,{method:'POST',keepalive:true,headers:{'Content-Type':'text/plain'},body:d});}}catch(e){}}if(document.readyState==='complete'){t();}else{addEventListener('load',t);}})();</script>` : ''}

<!-- Simple smooth scroll script -->
<script>
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
      // Close the mobile menu after jumping to a section.
      const nav = document.querySelector('.site-nav.nav-open');
      if (nav) {
        nav.classList.remove('nav-open');
        const t = nav.querySelector('.nav-toggle');
        if (t) { t.setAttribute('aria-expanded', 'false'); t.textContent = '☰'; }
      }
    });
  });
</script>
${editOverlay ? builderEditOverlay(lang) : ''}
</body>
</html>`;
}

/**
 * Builder-only click-to-edit overlay (injected ONLY into the customize iframe).
 * Hovering a section outlines it and shows a floating "✎ Edit" pill; clicking
 * the pill postMessages the parent customize page to open that section's editor.
 * Runs only inside the iframe (window.self !== window.top).
 */
function builderEditOverlay(lang) {
  // Reuse the localized edit word, but drop any leading emoji (cust.edit is the
  // "✨ Edit" AI button) so the pill reads a clean "✎ Edit".
  const raw = translator(lang || 'en')('cust.edit') || 'Edit';
  const clean = String(raw).replace(/^[^A-Za-zÀ-ɏ]+/, '').trim() || 'Edit';
  const safeLabel = clean.replace(/[<>&"'\\]/g, '');
  return `<script>
(function(){
  if (window.self === window.top) return; // builder iframe only
  var LABEL = ${JSON.stringify(safeLabel)};
  var current = null;
  var pill = document.createElement('button');
  pill.type = 'button';
  pill.textContent = '\\u270E ' + LABEL;
  pill.style.cssText = 'position:fixed;z-index:2147483647;display:none;align-items:center;background:#7c3aed;color:#fff;border:none;border-radius:999px;padding:6px 13px;font:600 13px system-ui,-apple-system,sans-serif;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.28);';
  function place(sec){ var r = sec.getBoundingClientRect(); pill.style.top = Math.max(8, r.top + 8) + 'px'; pill.style.left = Math.min(window.innerWidth - 96, Math.max(8, r.right - 92)) + 'px'; }
  function sectionFor(el){ while (el && el !== document.body){ if (el.id && el.id.indexOf('ai-sec-') === 0) return el; el = el.parentElement; } return null; }
  function clearCurrent(){ if (current){ current.style.outline=''; current.style.outlineOffset=''; } current = null; pill.style.display='none'; }
  document.addEventListener('mouseover', function(e){
    var sec = sectionFor(e.target);
    if (!sec) return;
    if (sec !== current){ if (current){ current.style.outline=''; current.style.outlineOffset=''; } current = sec; sec.style.outline='2px solid #7c3aed'; sec.style.outlineOffset='-2px'; }
    pill.style.display='inline-flex'; place(sec);
  });
  document.addEventListener('mouseout', function(e){
    var to = e.relatedTarget;
    if (to === pill) return;
    if (current && (to === null || !current.contains(to))) clearCurrent();
  });
  window.addEventListener('scroll', function(){ if (current) place(current); }, { passive: true });
  // Map the clicked element to an editor field hint (heading/link/image/text).
  function hintFor(el, sec){
    var node = el;
    while (node && node !== sec){
      var tag = node.tagName;
      if (tag === 'A' || tag === 'BUTTON') return 'link';
      if (tag === 'IMG') return 'image';
      if (/^H[1-6]$/.test(tag)) return 'heading';
      node = node.parentElement;
    }
    if (el.closest && el.closest('p')) return 'text';
    return null; // → section-level edit
  }
  function sendEdit(sec, field){
    var id = sec.id.replace('ai-sec-','');
    try { window.parent.postMessage({ source: 'caddisfly-preview', type: 'edit-section', sectionId: id, field: field || null }, '*'); } catch (err) {}
  }
  // The pill = section-level edit.
  pill.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); if (current) sendEdit(current, null); });
  // Clicking the content itself = element-level edit (deep-links the field).
  // Capture phase + preventDefault so links don't navigate inside the builder.
  document.addEventListener('click', function(e){
    if (e.target === pill) return;
    var sec = sectionFor(e.target);
    if (!sec) return;
    e.preventDefault(); e.stopPropagation();
    sendEdit(sec, hintFor(e.target, sec));
  }, true);
  document.body.appendChild(pill);
})();
</script>`;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  if (!text) return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color code
 * @returns {string} RGB values (e.g., "102, 126, 234")
 */
export function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `${r}, ${g}, ${b}`;
}

/**
 * Pick a readable foreground (white or near-black) for text/icons placed ON a
 * solid brand color — so an auto-detected mid-tone (e.g. copper #b87333, where
 * white is only 3.79:1) flips to dark text and clears WCAG AA. Exposed as the
 * `--on-primary` CSS var; buttons use `color: var(--on-primary, #fff)`.
 */
export function readableOn(hex) {
  const h = String(hex || '').replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return '#ffffff';
  const lin = (c) => {
    c = parseInt(c, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(h.substring(0, 2)) + 0.7152 * lin(h.substring(2, 4)) + 0.0722 * lin(h.substring(4, 6));
  const onWhite = (1.05) / (L + 0.05); // contrast vs #fff
  const onBlack = (L + 0.05) / 0.05; // contrast vs #000
  return onWhite >= onBlack ? '#ffffff' : '#1a202c';
}

/**
 * Deduplicate CSS from multiple sections
 * Note: Current implementation keeps CSS in each section for simplicity
 * Future optimization: extract and deduplicate CSS into <head>
 * @param {string} html - HTML with inline styles
 * @returns {string} HTML with deduplicated styles
 */
export function deduplicateCSS(html) {
  // For now, return as-is
  // Future: parse <style> tags, deduplicate rules, move to <head>
  return html;
}

/**
 * Generate preview HTML (similar to full page but with preview notice)
 * @param {array} sections - Array of section objects
 * @param {object} config - Website configuration
 * @param {object} project - AI project object
 * @returns {string} Preview HTML
 */
export function generatePreview(sections, config, project, opts = {}) {
  const pageHtml = assemblePage(sections, config, project, opts);

  // Optional "Add your details" link → opens the detailed form (Phase 7), so a
  // refactor owner can supply real history/founder/social/photos and rebuild.
  const detailsLink = opts.detailedLink
    ? `<a href="/ai-builder/detailed/${project.project_id}" style="color: white; text-decoration: underline; margin-left: 1rem;">✨ Add your details</a>`
    : '';

  // Add preview banner with project ID
  const previewBanner = `
<div style="position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, ${config.primary_color} 0%, ${config.secondary_color} 100%); color: white; padding: 0.75rem 1rem; text-align: center; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.1); font-size: 0.875rem;">
  <strong>Preview Mode</strong> - This is a preview of your website. <a href="/ai-builder/customize/${project.project_id}" style="color: white; text-decoration: underline; margin-left: 1rem;">Customize</a>${detailsLink}
</div>
<div style="height: 50px;"></div>
`;

  // Insert preview banner after <body> tag
  return pageHtml.replace('<body>', `<body>\n${previewBanner}`);
}

/**
 * Minify HTML (basic minification)
 * @param {string} html - HTML to minify
 * @returns {string} Minified HTML
 */
export function minifyHTML(html) {
  return (
    html
      // Remove comments (except IE conditional comments)
      .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
      // Remove whitespace between tags
      .replace(/>\s+</g, '><')
      // Remove leading/trailing whitespace
      .trim()
  );
}
