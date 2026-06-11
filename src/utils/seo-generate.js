// Auto-SEO for generated sites — fills ai_pages.seo_title / seo_description
// at GENERATION time (both the AI-builder and refactor flows), so sites stop
// shipping with the generic "<Business> — official website." fallback.
//
// One labeled-output LLM call covers the whole site (P1_TITLE/P1_DESC/…, the
// same parseLabeled trick as blog drafts — no JSON, small models break it).
// Everything is best-effort: any failure returns null and the caller leaves
// the fields NULL, where the render-time fallbacks still produce valid tags.
// The customize 🔎 SEO panel can override everything afterwards, and the paid
// "✨ AI SEO review" reuses generatePageSeo() for one page at a time.

import { callWorkersAI } from './ai-content-generator.js';
import { parseLabeled } from './blog-draft.js';

const LANG_NAMES = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

/** Pull human-readable text out of a section content object (recursive, capped). */
export function extractContentText(content, cap = 400) {
  const parts = [];
  const walk = (v) => {
    if (parts.join(' ').length > cap) return;
    if (typeof v === 'string') {
      // Skip URLs/paths/colors — only prose helps the SEO prompt.
      const s = v.trim();
      if (s && !/^(https?:\/\/|\/|#|data:)/.test(s) && !/\.(jpg|jpeg|png|webp|svg|mp4|webm)$/i.test(s)) parts.push(s);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (!k.startsWith('_')) walk(x); });
  };
  walk(content);
  return parts.join(' · ').slice(0, cap);
}

/**
 * Generate SEO for a set of pages in ONE call.
 * @param {object} env
 * @param {object} site { businessName, industry, language, description }
 * @param {Array}  pages [{ pageId, slug, title, contentText }]
 * @returns {Promise<Map<pageId, {seo_title, seo_description}>|null>} null on any failure
 */
export async function generateSiteSeo(env, site, pages) {
  try {
    const list = (pages || []).filter((p) => p.pageId != null).slice(0, 12);
    if (!list.length) return null;
    const langName = LANG_NAMES[site.language] || 'English';

    const pageLines = list.map((p, i) =>
      `Page ${i + 1} ("${p.title || p.slug}"): ${p.contentText || '(no content yet)'}`).join('\n');
    const labels = list.flatMap((_, i) => [`P${i + 1}_TITLE`, `P${i + 1}_DESC`]);
    const format = list.map((_, i) => `P${i + 1}_TITLE: the page ${i + 1} title\nP${i + 1}_DESC: the page ${i + 1} description`).join('\n');

    const prompt = `You are writing SEO metadata for a small business website.
Business: "${site.businessName}"${site.industry ? ` — ${site.industry}` : ''}${site.description ? `\nAbout: ${site.description.slice(0, 300)}` : ''}

Pages and their content:
${pageLines}

For EACH page write, ALL in ${langName}:
- a TITLE: max 60 characters, specific to that page's content, naturally including the business name and a relevant search keyword. No quotes, no ALL CAPS, no keyword stuffing.
- a DESC: a meta description of 140-160 characters that makes someone want to click, mentioning what the business offers and the page's focus. Plain sentences, no quotes.

Respond in EXACTLY this format (plain text, no JSON, no commentary, keep the uppercase labels):
${format}`;

    const raw = await callWorkersAI(env, prompt, { max_tokens: 220 * list.length, temperature: 0.4, system_message: 'You are an SEO copywriter for small businesses.' });
    const pack = parseLabeled(raw, labels);
    if (!pack) return null;

    const out = new Map();
    list.forEach((p, i) => {
      const title = sanitize(pack[`p${i + 1}_title`], 70);
      const desc = sanitize(pack[`p${i + 1}_desc`], 180);
      if (title && desc) out.set(p.pageId, { seo_title: title, seo_description: desc });
    });
    return out.size ? out : null;
  } catch (e) {
    console.error('auto-seo generation failed:', e.message);
    return null;
  }
}

/** SEO for ONE page (the paid "✨ AI SEO review"). Returns {seo_title, seo_description} or null. */
export async function generatePageSeo(env, site, page) {
  const map = await generateSiteSeo(env, site, [{ ...page, pageId: page.pageId != null ? page.pageId : 0 }]);
  if (!map) return null;
  return map.values().next().value || null;
}

function sanitize(s, max) {
  const t = String(s || '').replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}
