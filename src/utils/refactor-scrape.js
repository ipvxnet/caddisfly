// Best-effort scrape for the refactor flow: read the site's root and, if it's a
// thin/"under construction" placeholder (common for the very sites people want
// to rebuild), probe common content paths and keep the richest page. No paid
// calls. Shared by preview/create.js and preview/search.js.

import { scrapeWebsite } from './scraper.js';
import { extractScrapeSignal } from './company-profile.js';
import { zyteEnabled, zyteBrowserHtml, zytePrimary } from './zyte-scraper.js';

const PLACEHOLDER_RE = /(em desenvolvimento|under construction|coming soon|em breve|em manuten|site em constru|under maintenance|comingsoon|stay tuned)/i;
const CONTENT_PATHS = ['/home', '/home/', '/inicio', '/inicio/', '/pt', '/pt-br', '/index.html'];

export function looksPlaceholder(sig) {
  if (!sig) return true;
  if (PLACEHOLDER_RE.test(`${sig.title || ''} ${sig.sampleText || ''}`)) return true;
  return (sig.images || []).length < 2 && (sig.headings || []).length < 2;
}

export function scoreSignal(sig) {
  if (!sig) return -1;
  return (sig.headings || []).length + Math.min(6, (sig.images || []).length) +
    ((sig.sampleText || '').length > 300 ? 3 : 0) + (sig.title ? 1 : 0);
}

/**
 * @param {string} website - Normalized site URL
 * @param {object} [env] - bindings (for the Zyte browser fallback)
 * @param {object} [opts] - { browser } : allow the PAID Zyte browser fallback
 *   (callers behind a cap pass browser:true; uncapped paths leave it off)
 * @returns {Promise<object|null>} the richest scrape signal found, or null
 */
export async function scrapeBestSignal(website, env = null, opts = {}) {
  const base = String(website || '').replace(/\/$/, '');
  if (!base) return null;
  let best = null;
  let bestScore = -1;

  const consider = (html, url) => {
    if (!html) return;
    const sig = extractScrapeSignal(html, url);
    const sc = scoreSignal(sig);
    if (sc > bestScore) { best = sig; bestScore = sc; }
  };
  const browserOK = opts.browser && zyteEnabled(env);
  async function tryZyte() {
    for (const path of ['', '/home', '/inicio']) {
      const url = base + path;
      consider(await zyteBrowserHtml(env, url), url);
      if (bestScore >= 8) break;
    }
  }

  // Zyte PRIMARY (preview testing): render first for the cleanest capture.
  if (browserOK && zytePrimary(env)) {
    await tryZyte();
    if (best && !looksPlaceholder(best)) return best;
  }

  // 1) Cheap static fetch of the root.
  try {
    const pages = await scrapeWebsite(base, 1);
    if (pages.length > 0) consider(pages[0].html, pages[0].url);
  } catch (e) {
    console.log(`Root scrape failed for ${base}: ${e.message}`);
  }
  if (best && !looksPlaceholder(best)) return best;

  // 2) Static content paths (root was thin/placeholder).
  for (const path of CONTENT_PATHS) {
    try {
      const pages = await scrapeWebsite(base + path, 1);
      if (pages.length) consider(pages[0].html, pages[0].url);
      if (bestScore >= 8) return best; // rich enough
    } catch { /* try next path */ }
  }
  if (best && !looksPlaceholder(best)) return best;

  // 3) Still thin/blocked → PAID browser render via Zyte (fallback; skipped if
  //    already tried as primary above).
  if (browserOK && !zytePrimary(env)) {
    await tryZyte();
  }
  return best;
}
