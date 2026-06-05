// caddisfly-sites — the lean worker that serves published CUSTOMER sites on
// *.caddisfly.app. It is intentionally minimal: R2 read-only, NO database, NO
// secrets, NO AI/browser. It maps the request Host's subdomain to R2 objects
// written by the app worker's deploy step (sites/<subdomain>/<slug>.html) and
// serves their assets (assets/<id>/<file>). DB-free by design.

const APP_ORIGIN = 'https://caddisfly.ai';
const APEX_HOSTS = new Set(['caddisfly.app', 'www.caddisfly.app']);

function notFound() {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Site not found</title>
     <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;color:#4a5568;text-align:center}</style>
     </head><body><div><h1 style="margin:0 0 .5rem">Site not found</h1>
     <p style="color:#718096">This address isn't hosting a published site.</p>
     <p style="margin-top:1.5rem"><a href="${APP_ORIGIN}" style="color:#764ba2;font-weight:600;text-decoration:none">Build one with Caddisfly →</a></p></div></body></html>`,
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// Resolve the site's subdomain from the request:
//   ?site=<sub>            -> override (workers.dev testing)
//   <sub>.caddisfly.app    -> "<sub>"
//   any other host         -> custom domain: R2 pointer domains/<host> -> "<sub>"
async function resolveSubdomain(env, url, host) {
  const override = url.searchParams.get('site');
  if (override) return override.toLowerCase();
  if (!host) return null;
  const h = host.split(':')[0].toLowerCase();
  if (APEX_HOSTS.has(h)) return null; // apex/www handled by the caller
  if (h.endsWith('.caddisfly.app')) {
    let label = h.slice(0, -'.caddisfly.app'.length).split('.')[0];
    // Preview-env convention: <sub>-preview.caddisfly.app (route owned by the
    // preview worker) resolves to the same R2 layout as <sub> in its bucket.
    if (label.endsWith('-preview')) label = label.slice(0, -'-preview'.length);
    return label;
  }
  // Custom domain — look up the pointer written when the domain went active.
  const ptr = await env.STORAGE.get(`domains/${h}`);
  if (ptr) return (await ptr.text()).trim();
  return null;
}

function safeLabel(s) {
  return typeof s === 'string' && /^[a-z0-9-]{1,63}$/.test(s) ? s : null;
}

async function serveAsset(env, pathname) {
  // /preview-asset/<id>/<file> -> R2 assets/<id>/<file>
  const m = pathname.match(/^\/preview-asset\/([^/]+)\/([^/]+)$/);
  if (!m) return null;
  const [, id, file] = m;
  if (file.includes('..')) return notFound();
  const obj = await env.STORAGE.get(`assets/${id}/${file}`);
  if (!obj) return notFound();
  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// Per-site robots.txt (host-aware so custom domains advertise their own sitemap).
function robotsTxt(host) {
  const body = `User-agent: *\nAllow: /\nSitemap: https://${host}/sitemap.xml\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

// Per-site sitemap.xml built by listing the site's pages in R2, using the
// REQUEST host so a custom domain gets a sitemap of its own URLs.
async function sitemapXml(env, sub, host) {
  const prefix = `sites/${sub}/`;
  const listed = await env.STORAGE.list({ prefix });
  const slugs = (listed.objects || [])
    .map((o) => o.key.slice(prefix.length).replace(/\.html$/, ''))
    .filter((s) => s && s !== 'index');
  const paths = ['/'].concat(slugs.map((s) => `/${s}`));
  const urls = [...new Set(paths)].map((p) => `  <url><loc>https://${host}${p}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

// When a page is served on a CUSTOM domain, the baked canonical/og:url point at
// the .caddisfly.app subdomain. Rewrite them to the custom host so the customer's
// own domain ranks as itself (host-aware self-canonical).
function rewriteCanonicalHost(resp, host, slug) {
  const canonical = `https://${host}${slug === 'index' ? '/' : `/${slug}`}`;
  return new HTMLRewriter()
    .on('link[rel="canonical"]', { element(el) { el.setAttribute('href', canonical); } })
    .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', canonical); } })
    .transform(resp);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // ?host= overrides the Host for testing the custom-domain path on workers.dev
    // (Cloudflare rejects spoofed Host headers there). Harmless: sites are public.
    const host = url.searchParams.get('host') || request.headers.get('Host') || url.host;

    // Apex / www -> send to the marketing app.
    if (APEX_HOSTS.has(host.split(':')[0].toLowerCase()) && !url.searchParams.get('site')) {
      return Response.redirect(APP_ORIGIN, 302);
    }

    // Assets first (images referenced by published pages).
    if (url.pathname.startsWith('/preview-asset/')) {
      const asset = await serveAsset(env, url.pathname);
      if (asset) return asset;
    }

    const sub = safeLabel(await resolveSubdomain(env, url, host));
    if (!sub) return notFound();

    const hostNoPort = host.split(':')[0].toLowerCase();
    const isCustomDomain = !hostNoPort.endsWith('.caddisfly.app');

    // Per-site SEO files (built from R2 listing; host-aware).
    if (url.pathname === '/robots.txt') return robotsTxt(hostNoPort);
    if (url.pathname === '/sitemap.xml') return await sitemapXml(env, sub, hostNoPort);

    // "/" -> index; "/slug" -> slug (no DB; home was written as index.html).
    // One nested level is allowed for blog posts ("/blog/<post-slug>").
    let slug = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!slug) slug = 'index';
    if (!/^[a-z0-9-]{1,60}(\/[a-z0-9-]{1,60})?$/.test(slug)) return notFound();

    let html = await env.STORAGE.get(`sites/${sub}/${slug}.html`);
    let servedSlug = slug;
    if (!html) { html = await env.STORAGE.get(`sites/${sub}/index.html`); servedSlug = 'index'; } // unknown slug -> home
    if (!html) return notFound();

    const resp = new Response(html.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
    // On a custom domain, rewrite canonical/og:url to that host.
    return isCustomDomain ? rewriteCanonicalHost(resp, hostNoPort, servedSlug) : resp;
  },
};
