// Blog rendering glue: blog_posts rows -> SYNTHETIC section objects that flow
// through the normal assemblePage pipeline (header + synthetic body + footer).
// Used by deploy.js (baking static R2 copies) and the /ai-preview blog routes.

import { mdLiteToHtml, mdLiteExcerpt } from './md-lite.js';
import { t } from '../i18n/index.js';

/** Synthetic nav entry so the navbar shows a Blog link (slug drives the href). */
export function blogNavPage(lang = 'en') {
  return { slug: 'blog', title: t(lang, 'blogw.nav_title'), is_visible: 1, is_home: 0 };
}

/** Synthetic blog_list section for the blog index page. */
export function blogListSection(posts, base, lang = 'en') {
  const data = {
    heading: t(lang, 'blogw.list_heading'),
    base,
    posts: posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || mdLiteExcerpt(p.content),
      cover_image: p.cover_image || '',
      published_at: p.published_at,
    })),
  };
  return {
    section_type: 'blog_list',
    html_template: 'default',
    content_json: JSON.stringify(data),
    is_visible: 1,
    id: null,
    section_order: 1,
  };
}

/** Synthetic blog_post section for one post page. */
export function blogPostSection(post, base, { canonicalUrl = null, businessName = '' } = {}) {
  const data = {
    title: post.title,
    excerpt: post.excerpt || mdLiteExcerpt(post.content),
    html: mdLiteToHtml(post.content),
    cover_image: post.cover_image || '',
    published_at: post.published_at,
    base,
    canonicalUrl,
    business_name: businessName,
  };
  return {
    section_type: 'blog_post',
    html_template: 'default',
    content_json: JSON.stringify(data),
    is_visible: 1,
    id: null,
    section_order: 1,
  };
}
