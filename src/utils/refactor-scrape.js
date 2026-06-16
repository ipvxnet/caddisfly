// Best-effort scrape for the refactor flow: read the site's root and, if it's a
// thin/"under construction" placeholder (common for the very sites people want
// to rebuild), probe common content paths and keep the richest page. No paid
// calls. Shared by preview/create.js and preview/search.js.

import { scrapeWebsite } from './scraper.js';
import { extractScrapeSignal } from './company-profile.js';

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
 * @returns {Promise<object|null>} the richest scrape signal found, or null
 */
export async function scrapeBestSignal(website) {
  const base = String(website || '').replace(/\/$/, '');
  if (!base) return null;
  let best = null;
  let bestScore = -1;
  try {
    const pages = await scrapeWebsite(base, 1);
    if (pages.length > 0) {
      best = extractScrapeSignal(pages[0].html, pages[0].url);
      bestScore = scoreSignal(best);
    }
  } catch (e) {
    console.log(`Root scrape failed for ${base}: ${e.message}`);
  }
  if (best && !looksPlaceholder(best)) return best;

  for (const path of CONTENT_PATHS) {
    try {
      const pages = await scrapeWebsite(base + path, 1);
      if (!pages.length) continue;
      const sig = extractScrapeSignal(pages[0].html, pages[0].url);
      const sc = scoreSignal(sig);
      if (sc > bestScore) {
        best = sig;
        bestScore = sc;
        if (sc >= 8) break; // rich enough, stop probing
      }
    } catch { /* try next path */ }
  }
  return best;
}
