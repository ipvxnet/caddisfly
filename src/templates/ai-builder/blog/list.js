// Blog index — card list of published posts. Rendered from SYNTHETIC section
// data built at deploy/preview time (posts are rows in blog_posts, not
// ai_sections). data: { heading, sub, posts: [{slug,title,excerpt,cover_image,
// published_at}], base } where base is the link root (previewBase-aware).

import { t } from '../../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(ts, lang) {
  if (!ts) return '';
  try {
    return new Date(ts * 1000).toLocaleDateString(lang, { dateStyle: 'medium' });
  } catch {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }
}

export function blogListTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const base = data.base || '';
  const heading = data.heading || t(lang, 'blogw.list_heading');

  const cards = posts
    .map(
      (p) => `
    <a class="blog-card" href="${esc(`${base}/blog/${p.slug}`)}">
      ${p.cover_image ? `<div class="blog-card-img" style="background-image:url('${esc(p.cover_image)}')"></div>` : '<div class="blog-card-img blog-card-img-empty"></div>'}
      <div class="blog-card-body">
        <h3>${esc(p.title)}</h3>
        ${p.excerpt ? `<p class="blog-card-excerpt">${esc(p.excerpt)}</p>` : ''}
        <div class="blog-card-meta">
          ${p.published_at ? `<span>${fmtDate(p.published_at, lang)}</span>` : ''}
          <span class="blog-card-more">${t(lang, 'blogw.read_more')} →</span>
        </div>
      </div>
    </a>`
    )
    .join('');

  return `
<section id="blog" class="blog-list-section">
  <div class="blog-list-container">
    <div class="blog-list-header">
      <h2 class="blog-list-heading">${esc(heading)}</h2>
      ${data.sub ? `<p class="blog-list-sub">${esc(data.sub)}</p>` : ''}
    </div>
    ${posts.length ? `<div class="blog-grid">${cards}</div>` : `<p class="blog-empty">${t(lang, 'blogw.no_posts')}</p>`}
  </div>
</section>

<style>
.blog-list-section { padding: 5rem 2rem; background: #f7fafc; }
.blog-list-container { max-width: 1100px; margin: 0 auto; }
.blog-list-header { text-align: center; margin-bottom: 3rem; }
.blog-list-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; }
.blog-list-sub { font-size: 1.15rem; color: #4a5568; margin-top: .6rem; }
.blog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 1.8rem; }
.blog-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.07);
  text-decoration: none; display: flex; flex-direction: column; transition: transform .25s ease, box-shadow .25s ease; }
.blog-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.12); }
.blog-card-img { height: 180px; background-size: cover; background-position: center; }
.blog-card-img-empty { background: linear-gradient(135deg, ${primary_color}22, ${primary_color}55); }
.blog-card-body { padding: 1.4rem 1.5rem 1.5rem; display: flex; flex-direction: column; gap: .6rem; flex: 1; }
.blog-card-body h3 { color: #1a202c; font-size: 1.2rem; line-height: 1.35; }
.blog-card-excerpt { color: #4a5568; font-size: .95rem; line-height: 1.55; flex: 1; }
.blog-card-meta { display: flex; justify-content: space-between; align-items: center; color: #718096; font-size: .85rem; margin-top: .4rem; }
.blog-card-more { color: ${primary_color}; font-weight: 600; }
.blog-empty { text-align: center; color: #718096; padding: 2rem 0; }
@media (max-width: 768px) { .blog-list-section { padding: 3rem 1.5rem; } }
</style>
  `.trim();
}
