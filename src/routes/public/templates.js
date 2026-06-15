// GET /templates           -> public template showcase (live mini-previews)
// GET /templates/:key       -> full live demo page for one template
//
// Previews are REAL rendered pages (see template-demo.js), so the showcase
// always matches the current design system — no screenshots to maintain.

import { renderTemplateDemo, demoTemplates } from '../../utils/template-demo.js';
import { brandMark, FAVICON } from './landing.js';
import { translator } from '../../i18n/index.js';
import { escapeHtml } from '../../utils/ai-page-assembler.js';

const INDUSTRY_LABEL = {
  food: 'Restaurants & Cafés', fitness: 'Gyms & Fitness', barbershop: 'Barbershops',
  beauty: 'Salons & Spas', dental: 'Dental & Clinics', health: 'Healthcare',
  finance: 'Finance & Accounting', legal: 'Law & Professional', realestate: 'Real Estate',
  construction: 'Construction', home: 'Home Services', automotive: 'Automotive',
  pet: 'Pet Services', travel: 'Travel & Tourism', events: 'Weddings & Events',
  education: 'Education', nonprofit: 'Nonprofits', photography: 'Photography',
  creative: 'Creative & Agencies', retail: 'Retail & Boutiques', tech: 'Tech & SaaS',
  general: 'Any Business',
};

/** GET /templates/:key — full live demo. */
export function handleTemplateDemo(ctx) {
  const { params, query, url } = ctx;
  const key = params.key;
  const appOrigin = (url && url.origin) || '';
  const html = renderTemplateDemo(key, { lang: (ctx && ctx.lang) || 'en', embed: query && query.embed === '1', appOrigin });
  if (!html) return new Response('Template not found', { status: 404 });
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

/** GET /templates — showcase grid. */
export function handleTemplatesShowcase(ctx) {
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const templates = demoTemplates();

  // Load every heading + body font the showcase labels render in.
  const fams = new Set();
  templates.forEach((t) => { fams.add(t.fonts.heading); fams.add(t.fonts.body); });
  const fontsHref = `https://fonts.googleapis.com/css2?${[...fams].map((f) => `family=${f.trim().replace(/ /g, '+')}:wght@400;600;700`).join('&')}&display=swap`;

  const cards = templates.map((t) => {
    const dots = [t.colors.primary, t.colors.secondary, t.colors.accent]
      .map((c) => `<span class="dot" style="background:${escapeHtml(c)}"></span>`).join('');
    return `
    <article class="card${t.dark ? ' dark' : ''}">
      <a class="frame" href="/templates/${t.key}" target="_blank" rel="noopener" aria-label="Live preview of ${escapeHtml(t.label)}">
        <iframe src="/templates/${t.key}?embed=1" title="${escapeHtml(t.label)} preview" loading="lazy" tabindex="-1" scrolling="no"></iframe>
        <span class="frame-cta">${tr('tplpage.live_preview')} ↗</span>
      </a>
      <div class="meta">
        <div class="meta-top">
          <h3 style="font-family:'${escapeHtml(t.fonts.heading)}',serif">${escapeHtml(t.label)}</h3>
          <span class="dots">${dots}</span>
        </div>
        <span class="pill">${escapeHtml(INDUSTRY_LABEL[t.industry] || INDUSTRY_LABEL.general)}</span>
        <p class="desc">${escapeHtml(t.description)}</p>
        <div class="meta-foot">
          <span class="fonts">${escapeHtml(t.fonts.heading)} · ${escapeHtml(t.fonts.body)}</span>
          <a class="use" href="/ai-builder">${tr('tplpage.use_style')} →</a>
        </div>
      </div>
    </article>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tr('tplpage.meta_title')}</title>
  <meta name="description" content="${tr('tplpage.meta_desc')}">
  <link rel="icon" href="${FAVICON}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="${fontsHref}" rel="stylesheet">
  <style>
    :root{--ink:#0f172a;--body:#475569;--line:#e2e8f0;--bg:#f8fafc;--brand:#667eea}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--body);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:1240px;margin:0 auto;padding:0 1.25rem}
    header.site{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.85);backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--line)}
    .nav{display:flex;align-items:center;justify-content:space-between;height:66px}
    .brand{display:flex;align-items:center;gap:.5rem;font-weight:800;font-size:1.1rem;color:var(--ink)}
    .brand svg{width:30px;height:30px}.brand .ai{background:linear-gradient(135deg,#667eea,#764ba2,#f093fb);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
    .nav-links{display:flex;align-items:center;gap:1.4rem}
    .nav-links a{font-weight:600;font-size:.93rem}.nav-links a:hover{color:var(--ink)}
    .btn{display:inline-block;font-weight:700;border-radius:10px;padding:.55rem 1.05rem;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff!important;transition:transform .15s,box-shadow .15s}
    .btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(102,126,234,.35)}
    .hero{text-align:center;padding:clamp(2.5rem,6vw,4.5rem) 0 1.5rem}
    .hero .eyebrow{display:inline-block;font-weight:700;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--brand);background:#eef2ff;padding:.3rem .8rem;border-radius:999px;margin-bottom:1rem}
    .hero h1{font-size:clamp(2rem,5vw,3.1rem);color:var(--ink);line-height:1.1;letter-spacing:-.02em}
    .hero p{font-size:clamp(1rem,2.2vw,1.2rem);max-width:640px;margin:1rem auto 0}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.5rem;padding:2rem 0 4rem}
    .card{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:transform .18s,box-shadow .18s}
    .card:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(15,23,42,.12)}
    .frame{position:relative;display:block;height:260px;overflow:hidden;border-bottom:1px solid var(--line);background:#fff}
    .card.dark .frame{background:#0f0f10}
    .frame iframe{width:1280px;height:1900px;border:0;transform:scale(.297);transform-origin:top left;pointer-events:none}
    .frame-cta{position:absolute;left:50%;bottom:14px;transform:translateX(-50%) translateY(8px);opacity:0;transition:all .2s;background:rgba(15,23,42,.9);color:#fff;font-weight:700;font-size:.8rem;padding:.5rem .9rem;border-radius:999px;white-space:nowrap}
    .frame:hover .frame-cta{opacity:1;transform:translateX(-50%) translateY(0)}
    .meta{padding:1rem 1.1rem 1.1rem;display:flex;flex-direction:column;gap:.55rem;flex:1}
    .meta-top{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
    .meta-top h3{font-size:1.25rem;color:var(--ink);line-height:1.1}
    .dots{display:flex;gap:4px;flex-shrink:0}.dot{width:14px;height:14px;border-radius:50%;border:1px solid rgba(0,0,0,.08)}
    .pill{align-self:flex-start;font-size:.72rem;font-weight:700;color:var(--brand);background:#eef2ff;padding:.2rem .6rem;border-radius:999px}
    .desc{font-size:.85rem;color:var(--body);flex:1}
    .meta-foot{display:flex;align-items:center;justify-content:space-between;gap:.5rem;border-top:1px solid var(--line);padding-top:.7rem;margin-top:.2rem}
    .fonts{font-size:.72rem;color:#94a3b8}
    .use{font-weight:700;font-size:.82rem;color:var(--brand)}.use:hover{text-decoration:underline}
    .cta-band{text-align:center;background:#fff;border-top:1px solid var(--line);padding:clamp(2.5rem,6vw,4rem) 0}
    .cta-band h2{font-size:clamp(1.5rem,4vw,2.2rem);color:var(--ink)}
    .cta-band p{margin:.6rem auto 1.4rem;max-width:520px}
    @media(max-width:480px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="site">
    <div class="wrap nav">
      <a class="brand" href="/">${brandMark('m-hd')}<span>caddisfly<span class="ai">.ai</span></span></a>
      <nav class="nav-links">
        <a href="/templates">${tr('nav.templates')}</a>
        <a href="/pricing">${tr('nav.pricing')}</a>
        <a href="/dashboard">${tr('nav.dashboard')}</a>
        <a class="btn" href="/ai-builder">${tr('nav.build')} →</a>
      </nav>
    </div>
  </header>
  <main>
    <section class="hero wrap">
      <span class="eyebrow">${templates.length} ${tr('tplpage.eyebrow')}</span>
      <h1>${tr('tplpage.h1')}</h1>
      <p>${tr('tplpage.sub')}</p>
    </section>
    <section class="wrap">
      <div class="grid">${cards}</div>
    </section>
    <section class="cta-band">
      <div class="wrap">
        <h2>${tr('tplpage.cta_h2')}</h2>
        <p>${tr('tplpage.cta_sub')}</p>
        <a class="btn" href="/ai-builder">${tr('nav.build')} →</a>
      </div>
    </section>
  </main>
  <script>
    // Scale each preview iframe to exactly fill its card width (the iframe
    // renders the page at a fixed 1280px, then we scale to fit) — perfect across
    // all viewport sizes, no horizontal clipping.
    (function () {
      var BASE = 1280;
      function fit() {
        document.querySelectorAll('.frame').forEach(function (f) {
          var ifr = f.querySelector('iframe');
          if (!ifr) return;
          ifr.style.transform = 'scale(' + (f.clientWidth / BASE) + ')';
        });
      }
      window.addEventListener('resize', fit);
      window.addEventListener('load', fit);
      fit();
    })();
  </script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
