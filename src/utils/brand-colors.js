// Auto-detect a site's real brand colors by RENDERING it in a real browser
// (Cloudflare browser binding) and reading computed styles. Colors live in
// external CSS / the rendered page — not the HTML — so this is the only reliable
// automatic source. Returns null on any failure (caller falls back to template
// colors or the owner's manual picks).

import puppeteer from '@cloudflare/puppeteer';

function parseColor(s) {
  const m = String(s || '').match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x.trim()));
  if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
  const a = p.length >= 4 ? p[3] : 1;
  if (a < 0.4) return null; // mostly transparent — ignore
  return { r: p[0], g: p[1], b: p[2] };
}
function sl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}
function toHex({ r, g, b }) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function isNeutral(c) { const { s, l } = sl(c); return s < 0.18 || l > 0.93 || l < 0.05; }

/**
 * @returns {Promise<{primary:string, accent:string, dark:boolean}|null>}
 */
export async function extractBrandColors(env, url) {
  if (!env.BROWSER || !url) return null;
  let browser;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1400 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 });
    const raw = await page.evaluate(() => {
      const cs = (el, p) => getComputedStyle(el)[p];
      const acc = {}; // color string -> weight
      const add = (c, w) => { if (c) acc[c] = (acc[c] || 0) + w; };
      // Buttons/CTAs carry the brand accent most reliably.
      document.querySelectorAll('button, .btn, a.btn, [class*="button"], [class*="btn"], .elementor-button, [role="button"]')
        .forEach((el) => { add(cs(el, 'backgroundColor'), 4); add(cs(el, 'color'), 1); });
      document.querySelectorAll('a').forEach((el) => add(cs(el, 'color'), 1));
      document.querySelectorAll('h1, h2, h3').forEach((el) => add(cs(el, 'color'), 1));
      const header = document.querySelector('header, [role="banner"], nav, .header, [class*="header"]');
      if (header) add(cs(header, 'backgroundColor'), 3);
      return { acc, bodyBg: cs(document.body, 'backgroundColor') };
    });
    await browser.close();
    browser = null;

    const weighted = Object.entries(raw.acc)
      .map(([c, w]) => ({ w, rgb: parseColor(c) }))
      .filter((x) => x.rgb && !isNeutral(x.rgb))
      .sort((a, b) => b.w - a.w);
    if (!weighted.length) return null;
    const primary = toHex(weighted[0].rgb);
    // accent = next color whose hue/lightness differs enough from primary
    const p0 = weighted[0].rgb;
    const second = weighted.slice(1).find((x) => Math.abs(sl(x.rgb).l - sl(p0).l) > 0.12
      || Math.abs(x.rgb.r - p0.r) + Math.abs(x.rgb.g - p0.g) + Math.abs(x.rgb.b - p0.b) > 120);
    const bodyRgb = parseColor(raw.bodyBg);
    const dark = bodyRgb ? sl(bodyRgb).l < 0.3 : false;
    return { primary, accent: second ? toHex(second.rgb) : '', dark };
  } catch (e) {
    console.error(`Brand color extract failed for ${url}: ${e.message}`);
    try { if (browser) await browser.close(); } catch { /* ignore */ }
    return null;
  }
}
