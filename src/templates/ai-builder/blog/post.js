// Blog post body — renders one post from SYNTHETIC section data built at
// deploy/preview time. data: { title, excerpt, html (pre-rendered safe HTML
// from md-lite), cover_image, published_at, base, canonicalUrl, business_name }.
// Emits Article JSON-LD inline (buildHTMLDocument's LocalBusiness JSON-LD is
// site-level; the per-post Article belongs with the post).

import { t } from '../../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(ts, lang) {
  if (!ts) return '';
  try {
    return new Date(ts * 1000).toLocaleDateString(lang, { dateStyle: 'long' });
  } catch {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }
}

export function blogPostTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const base = data.base || '';

  let jsonLd = '';
  if (data.title) {
    const obj = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.title,
      ...(data.excerpt ? { description: data.excerpt } : {}),
      ...(data.cover_image ? { image: data.cover_image } : {}),
      ...(data.published_at ? { datePublished: new Date(data.published_at * 1000).toISOString() } : {}),
      ...(data.canonicalUrl ? { mainEntityOfPage: data.canonicalUrl } : {}),
      ...(data.business_name ? { publisher: { '@type': 'Organization', name: data.business_name } } : {}),
    };
    jsonLd = `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
  }

  return `
<section class="blog-post-section">
  <article class="blog-post">
    <a class="blog-post-back" href="${esc(`${base}/blog`)}">← ${t(lang, 'blogw.back_to_blog')}</a>
    <h1 class="blog-post-title">${esc(data.title)}</h1>
    ${data.published_at ? `<div class="blog-post-date">${fmtDate(data.published_at, lang)}</div>` : ''}
    ${data.cover_image ? `<img class="blog-post-cover" src="${esc(data.cover_image)}" alt="${esc(data.title)}">` : ''}
    <div class="blog-post-body">
      ${data.html || ''}
    </div>
  </article>
  ${jsonLd}
</section>

<style>
.blog-post-section { padding: 4rem 2rem 5rem; background: #fff; }
.blog-post { max-width: 760px; margin: 0 auto; }
.blog-post-back { display: inline-block; color: ${primary_color}; text-decoration: none; font-weight: 600; font-size: .92rem; margin-bottom: 1.6rem; }
.blog-post-back:hover { text-decoration: underline; }
.blog-post-title { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 4vw, 2.8rem); font-weight: 800; color: #1a202c; line-height: 1.2; }
.blog-post-date { color: #718096; font-size: .92rem; margin: .8rem 0 1.8rem; }
.blog-post-cover { width: 100%; border-radius: 12px; margin-bottom: 2rem; }
.blog-post-body { color: #2d3748; font-size: 1.08rem; line-height: 1.75; }
.blog-post-body h2 { font-family: ${font_heading}, sans-serif; font-size: 1.6rem; color: #1a202c; margin: 2rem 0 .8rem; }
.blog-post-body h3 { font-family: ${font_heading}, sans-serif; font-size: 1.25rem; color: #1a202c; margin: 1.6rem 0 .6rem; }
.blog-post-body p { margin-bottom: 1.1rem; }
.blog-post-body ul { margin: 0 0 1.1rem 1.4rem; }
.blog-post-body li { margin-bottom: .4rem; }
.blog-post-body blockquote { border-left: 4px solid ${primary_color}; margin: 1.4rem 0; padding: .4rem 0 .4rem 1.2rem; color: #4a5568; font-style: italic; }
.blog-post-body img { border-radius: 10px; margin: 1.4rem 0; }
.blog-post-body a { color: ${primary_color}; }
@media (max-width: 768px) { .blog-post-section { padding: 3rem 1.5rem 4rem; } }
</style>
  `.trim();
}
