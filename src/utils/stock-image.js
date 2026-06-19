// Optimize hotlinked stock-photo URLs (Unsplash / Pexels) for delivery.
//
// Unsplash/Pexels images are loaded straight from their CDNs, so they bypass our
// same-origin R2 image resizer (sites-worker `serveAsset`). Left alone, Unsplash
// serves full-size JPEG (no WebP/AVIF) — e.g. a 1200px hero comes back ~180 KiB.
// Both CDNs are imgix-based: adding `auto=format` (Unsplash) / `auto=compress`
// (Pexels) makes them serve AVIF/WebP to supporting browsers, and a width cap
// keeps a phone from downloading a 1920px bitmap. `auto=format` alone is the big
// win (~70% smaller); the width cap trims oversized hero defaults.

const STOCK_URL_RE = /https?:\/\/images\.(?:unsplash|pexels)\.com\/[^\s"'<>)\\]+/g;
const MAX_WIDTH = 1280;

/** Normalize a single Unsplash/Pexels URL for modern-format, capped-width delivery. */
export function optimizeStockUrl(url) {
  if (typeof url !== 'string' || !/images\.(unsplash|pexels)\.com/.test(url)) return url;
  // Preserve the URL's existing ampersand encoding (&amp; in HTML attributes, & in raw).
  const amp = url.includes('&amp;') ? '&amp;' : '&';
  const qIdx = url.indexOf('?');
  const base = qIdx === -1 ? url : url.slice(0, qIdx);
  const rawQuery = qIdx === -1 ? '' : url.slice(qIdx + 1);

  const params = new Map();
  for (const part of rawQuery.split(/&amp;|&/).filter(Boolean)) {
    const eq = part.indexOf('=');
    if (eq === -1) params.set(part, '');
    else params.set(part.slice(0, eq), part.slice(eq + 1));
  }

  // Cap width (keep a smaller existing width; default to the cap when absent).
  let w = parseInt(params.get('w') || '', 10);
  if (!Number.isFinite(w) || w <= 0 || w > MAX_WIDTH) w = MAX_WIDTH;
  params.set('w', String(w));

  if (base.includes('images.unsplash.com')) {
    params.set('auto', 'format'); // serve AVIF/WebP to capable browsers
    if (!params.has('q')) params.set('q', '70');
  } else {
    // Pexels (imgix): already AVIF-capable with these flags; ensure + cap width.
    if (!params.has('auto')) params.set('auto', 'compress');
    if (!params.has('cs')) params.set('cs', 'tinysrgb');
  }

  const query = [...params].map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join(amp);
  return `${base}?${query}`;
}

/** Rewrite every Unsplash/Pexels URL found in an HTML string (src, srcset, style url()). */
export function optimizeStockImages(html) {
  if (typeof html !== 'string' || !html) return html;
  return html.replace(STOCK_URL_RE, (u) => optimizeStockUrl(u));
}
