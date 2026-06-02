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

// Resolve the subdomain from Host (first DNS label), with a ?site= override for
// testing on *.workers.dev where Host isn't a real subdomain.
function resolveSubdomain(url, host) {
  const override = url.searchParams.get('site');
  if (override) return override.toLowerCase();
  if (!host) return null;
  const h = host.split(':')[0].toLowerCase();
  if (APEX_HOSTS.has(h)) return null; // apex/www handled by the caller
  // <sub>.caddisfly.app -> "<sub>"
  if (h.endsWith('.caddisfly.app')) return h.slice(0, -'.caddisfly.app'.length).split('.')[0];
  // Fallback: first label of any other host.
  return h.split('.')[0];
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = request.headers.get('Host') || url.host;

    // Apex / www -> send to the marketing app.
    if (APEX_HOSTS.has(host.split(':')[0].toLowerCase()) && !url.searchParams.get('site')) {
      return Response.redirect(APP_ORIGIN, 302);
    }

    // Assets first (images referenced by published pages).
    if (url.pathname.startsWith('/preview-asset/')) {
      const asset = await serveAsset(env, url.pathname);
      if (asset) return asset;
    }

    const sub = safeLabel(resolveSubdomain(url, host));
    if (!sub) return notFound();

    // "/" -> index; "/slug" -> slug (no DB; home was written as index.html).
    let slug = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!slug) slug = 'index';
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) return notFound();

    let html = await env.STORAGE.get(`sites/${sub}/${slug}.html`);
    if (!html) html = await env.STORAGE.get(`sites/${sub}/index.html`); // unknown slug -> home
    if (!html) return notFound();

    return new Response(html.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
  },
};
