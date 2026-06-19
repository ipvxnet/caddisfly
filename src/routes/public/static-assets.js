// Serves brand static assets (favicon set, webmanifest) inlined as base64, plus a
// dynamically-rendered Open Graph image. No static-file infra needed; works in
// every env (bundled with the worker).

import puppeteer from '@cloudflare/puppeteer';
import { STATIC_ASSETS } from '../../assets/favicons.js';
import { VERTICAL_SLUGS } from '../../utils/seo-verticals.js';

function bytesFromB64(b64) {
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Serve a favicon/icon by its request path (e.g. /favicon.ico, /favicon-32x32.png). */
export async function handleStaticAsset(ctx) {
  const name = (ctx.pathname || '').replace(/^\//, '');
  const asset = STATIC_ASSETS[name];
  if (!asset) return new Response('Not found', { status: 404 });
  return new Response(bytesFromB64(asset.b64), {
    status: 200,
    headers: { 'Content-Type': asset.type, 'Cache-Control': IMMUTABLE },
  });
}

/** PWA web app manifest. */
export async function handleWebmanifest() {
  const manifest = {
    name: 'Caddisfly',
    short_name: 'Caddisfly',
    description: 'Build a beautiful website with AI.',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#764ba2',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=86400' },
  });
}

function appOrigin(ctx) {
  return (ctx.url && ctx.url.origin) || (ctx.env && ctx.env.APP_URL) || 'https://caddisfly.ai';
}

/** GET /robots.txt — allow public pages, keep private/app surfaces out of the index. */
export async function handleRobots(ctx) {
  const body =
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api',
      'Disallow: /billing',
      'Disallow: /dashboard',
      'Disallow: /support',
      'Disallow: /logout',
      'Disallow: /auth',
      '',
      `Sitemap: ${appOrigin(ctx)}/sitemap.xml`,
      '',
    ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}

// Public, indexable marketing/product pages.
const APP_PAGES = [
  { path: '/', priority: '1.0' },
  { path: '/ai-builder', priority: '0.9' },
  { path: '/templates', priority: '0.9' },
  { path: '/website-builder', priority: '0.8' },
  ...VERTICAL_SLUGS.map((slug) => ({ path: `/website-builder/${slug}`, priority: '0.8' })),
  { path: '/pricing', priority: '0.8' },
  { path: '/showcase', priority: '0.7' },
  { path: '/compare', priority: '0.7' },
  { path: '/speed', priority: '0.7' },
  { path: '/help', priority: '0.6' },
  { path: '/terms', priority: '0.3' },
  { path: '/privacy', priority: '0.3' },
];

/** GET /sitemap.xml — the app's own public pages (customer sites have their own). */
export async function handleSitemap(ctx) {
  const origin = appOrigin(ctx);
  const urls = APP_PAGES.map(
    (p) => `  <url><loc>${origin}${p.path}</loc><changefreq>weekly</changefreq><priority>${p.priority}</priority></url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}

// 1200x630 branded share card. White mark on the brand gradient.
const OG_HTML = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;800;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden}
  body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 55%,#f093fb 100%);
    color:#fff;display:flex;flex-direction:column;justify-content:center;padding:96px}
  .row{display:flex;align-items:center;gap:24px;margin-bottom:34px}
  .mark{background:rgba(255,255,255,.16);border-radius:22px;padding:12px;display:flex}
  .mark svg{width:72px;height:72px;display:block}
  .brand{font-weight:800;font-size:42px;letter-spacing:-.5px}
  h1{font-size:82px;line-height:1.04;font-weight:900;letter-spacing:-2.5px;max-width:1010px}
  p{font-size:34px;margin-top:28px;opacity:.94;font-weight:600;max-width:920px}
</style></head><body>
  <div class="row">
    <div class="mark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <path d="M88 34 C 58 18, 26 34, 26 64 C 26 92, 56 104, 84 92" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
      <path d="M40 58 C 56 64, 70 70, 84 80" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
      <circle cx="92" cy="30" r="6.5" fill="#fff"/>
      <path d="M92 24 C 96 14, 102 11, 108 11" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
    </svg></div>
    <span class="brand">caddisfly.ai</span>
  </div>
  <h1>Build a beautiful website with AI.</h1>
  <p>Chat to build a brand-new site — or instantly refactor your existing one.</p>
</body></html>`;

/**
 * Render the OG share image (1200x630) via the browser binding. Cached hard at
 * the edge. Falls back to the 512 icon if rendering is unavailable.
 */
export async function handleOgImage(ctx) {
  const { env } = ctx;
  try {
    if (!env.BROWSER) throw new Error('No BROWSER binding');
    const browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(OG_HTML, { waitUntil: 'networkidle0' });
    const buf = await page.screenshot({ type: 'png' });
    await browser.close();
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (e) {
    console.error('OG render failed, falling back to icon:', e.message);
    const fallback = new URL('/android-chrome-512x512.png', ctx.url).toString();
    return Response.redirect(fallback, 302);
  }
}
