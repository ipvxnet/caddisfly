// Faithful Import — turn an EXISTING site's rendered HTML into Caddisfly section
// content, preserving the real copy + photos (vs the default AI regeneration).
// Server-side, regex-based (Workers has no DOM). Builder sites (GoDaddy W+M, Wix,
// Duda) render client-side, so the input here must be BROWSER-RENDERED HTML
// (Zyte) — a static fetch is a JS shell. See FAITHFUL_IMPORT_DESIGN.md.

const ABS = (u, base) => {
  if (!u) return '';
  u = u.trim().replace(/&amp;/g, '&');
  if (u.startsWith('//')) return 'https:' + u;
  if (/^https?:\/\//i.test(u)) return u;
  try { return new URL(u, base).href; } catch { return ''; }
};

const stripTags = (h) =>
  String(h || '')
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

// Reject logos/icons/sprites/avatars/placeholders + likely-tiny assets.
const JUNK_IMG = /(logo|favicon|icon|sprite|emoji|avatar|placeholder|1x1|spacer|pixel|loading)/i;
function imagesIn(html, base) {
  const out = [];
  const seen = new Set();
  const push = (u) => { const a = ABS(u, base); if (a && !JUNK_IMG.test(a) && !a.startsWith('data:') && !seen.has(a)) { seen.add(a); out.push(a); } };
  let m;
  const imgRe = /<img\b[^>]*?>/gi;
  while ((m = imgRe.exec(html))) {
    const t = m[0];
    const ss = (t.match(/\bsrcset=["']([^"']+)["']/i) || [])[1];
    if (ss) { const last = ss.split(',').pop().trim().split(/\s+/)[0]; push(last); }
    const src = (t.match(/\b(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i) || [])[1];
    if (src) push(src);
  }
  const bgRe = /background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/gi;
  while ((m = bgRe.exec(html))) push(m[2]);
  return out;
}

/**
 * Split rendered HTML into ordered content blocks. Prefers <section> elements
 * (what builder platforms emit); falls back to heading-led splitting, then the
 * whole body. Each block: { heading, text, images:[absUrl] }.
 */
export function extractBlocks(html, baseUrl = '') {
  if (!html) return [];
  // Drop obvious chrome so it doesn't pollute blocks.
  const body = String(html)
    .replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' ');

  // Depth-aware <section> splitter (handles nested sections).
  const chunks = [];
  const re = /<section\b[^>]*>|<\/section>/gi;
  let depth = 0, start = -1, m;
  while ((m = re.exec(body))) {
    if (/^<section/i.test(m[0])) { if (depth === 0) start = m.index + m[0].length; depth++; }
    else if (depth > 0) { depth--; if (depth === 0 && start >= 0) { chunks.push(body.slice(start, m.index)); start = -1; } }
  }
  let raw = chunks;
  if (raw.length < 2) {
    // Fallback: split on headings (h1-h3 or role=heading) keeping each heading with its following content.
    const parts = body.split(/(?=<h[1-3]\b)/i);
    raw = parts.length > 1 ? parts : [body];
  }

  const headRe = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i;
  return raw
    .map((c) => {
      const h = stripTags((c.match(headRe) || [])[1] || '');
      const text = stripTags(c);
      return { heading: h.slice(0, 120), text: text.slice(0, 1200), images: imagesIn(c, baseUrl).slice(0, 12) };
    })
    .filter((b) => b.text.length > 8 || b.images.length > 0);
}

// ---- classification --------------------------------------------------------

const CONTACT_RE = /(\+?\d[\d\s().-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.-]+)|(\b\d{1,5}\s+[A-Za-z].{3,40}(street|st\.?|ave|avenue|road|rd\.?|blvd|suite|drive|dr\.?)\b)/i;
const QUOTE_RE = /^["“'][^"”']{12,}/;

/** Heuristic: tag each block with a Caddisfly section type + confidence. */
export function classifyBlocks(blocks) {
  const n = blocks.length;
  let heroAssigned = false;
  return blocks.map((b, i) => {
    const tl = b.text.length;
    const imgs = b.images.length;
    // a list-ish block: several short comma/newline/segment phrases
    const segs = b.text.split(/[|·•\n]| {2,}/).map((s) => s.trim()).filter((s) => s.length > 2 && s.length < 60);
    let type = 'about', conf = 0.5;
    if (imgs >= 3 && tl < 120) { type = 'gallery'; conf = 0.9; }
    else if (CONTACT_RE.test(b.text) && tl < 400) { type = 'contact'; conf = 0.85; }
    else if (!heroAssigned && i <= 1 && tl < 320) { type = 'hero'; conf = 0.7; heroAssigned = true; }
    else if (segs.length >= 3 && tl < 600 && segs.length / Math.max(1, tl / 40) > 0.3) { type = 'services'; conf = 0.75; }
    else if (QUOTE_RE.test(b.text) || tl < 200) { type = 'about'; conf = 0.6; }
    return { ...b, type, conf, segs };
  });
}

// ---- build Caddisfly section content from blocks ---------------------------

const T = {
  en: { gallery: 'Gallery', about: 'About Us', story: 'Our Story', services: 'What We Offer' },
  es: { gallery: 'Galería', about: 'Sobre Nosotros', story: 'Nuestra Historia', services: 'Lo Que Ofrecemos' },
  pt: { gallery: 'Galeria', about: 'Sobre Nós', story: 'Nossa História', services: 'O Que Oferecemos' },
};

/**
 * Build a map of { sectionType: content_json } from pre-extracted blocks (see
 * extractBlocks — run at scrape time and stored on the profile), preserving the
 * site's real copy + photos. Used in faithful import mode in place of AI for
 * hero/services/gallery/about; contact/testimonials still come from hard facts.
 * @param {Array} rawBlocks - output of extractBlocks()
 * @returns {{ content: Record<string,object>, debug: object }}
 */
export function buildFaithfulContent(rawBlocks, { profile = {}, photoPool = [], lang = 'en' } = {}) {
  const tr = T[lang] || T.en;
  const blocks = classifyBlocks(Array.isArray(rawBlocks) ? rawBlocks : []);
  const content = {};
  const name = profile.name || profile.business_name || '';
  // Every real photo we found (blocks + pool), deduped — the shared image source.
  const allImgs = [...new Set([].concat(...blocks.map((b) => b.images), photoPool.map((p) => p.url)))].filter(Boolean);

  // HERO — first hero-tagged block (or the first block), real headline + a photo.
  const hero = blocks.find((b) => b.type === 'hero') || blocks[0];
  if (hero) {
    const lines = hero.text.split(/(?<=[.!?])\s+|\s{2,}|\|/).map((s) => s.trim()).filter(Boolean);
    content.hero = {
      heading: name || hero.heading || lines[0] || '',
      subheading: (hero.heading && hero.text !== hero.heading ? hero.text : lines.slice(name ? 0 : 1).join(' ')).slice(0, 200),
      cta_text: 'Contact us', cta_link: '#contact',
      background_image: (hero.images[0] || (photoPool[0] && photoPool[0].url) || allImgs[0] || ''),
    };
  }

  // SERVICES — the strongest list-like block becomes service cards (real labels).
  const svc = blocks.filter((b) => b.type === 'services').sort((a, b) => b.segs.length - a.segs.length)[0];
  if (svc && svc.segs.length >= 2) {
    content.services = {
      heading: svc.heading || tr.services,
      services: svc.segs.slice(0, 8).map((title) => ({ title, description: '', icon: '✓' })),
    };
  }

  // GALLERY — every real photo we found (computed above), deduped.
  if (allImgs.length >= 3) {
    content.gallery = { heading: tr.gallery, images: allImgs.slice(0, 12).map((url) => ({ url, alt: name || '' })) };
  }

  // ABOUT — verbatim identity copy: the owner's story if provided, else the most
  // distinctive non-hero/services text block (quotes, slogans, mission).
  const ownerStory = [profile.history, profile.founder].filter((s) => s && String(s).trim()).join('\n\n').trim();
  const identityBlock = blocks
    .filter((b) => !['hero', 'gallery', 'contact'].includes(b.type) && b.text.length > 20)
    .sort((a, b) => (QUOTE_RE.test(b.text) ? 1 : 0) - (QUOTE_RE.test(a.text) ? 1 : 0) || b.text.length - a.text.length)[0];
  const story = ownerStory || (identityBlock ? identityBlock.text : '');
  if (story) {
    content.about = { heading: tr.about, subheading: tr.story, story: story.slice(0, 1500) };
  }

  return { content, debug: { blockCount: blocks.length, types: blocks.map((b) => b.type) } };
}
