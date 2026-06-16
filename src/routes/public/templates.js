// GET /templates           -> public template showcase (live mini-previews)
// GET /templates/:key       -> full live demo page for one template
//
// Previews are REAL rendered pages (see template-demo.js), so the showcase
// always matches the current design system — no screenshots to maintain.

import { renderTemplateDemo, demoTemplates } from '../../utils/template-demo.js';
import { brandMark } from './landing.js';
import { headTags } from '../../components/brand.js';
import { translator } from '../../i18n/index.js';
import { escapeHtml } from '../../utils/ai-page-assembler.js';

const INDUSTRY_LABEL = {
  food: 'Restaurants', cafe: 'Cafés & Coffee', bakery: 'Bakeries', winery: 'Wineries & Vineyards',
  fitness: 'Gyms & Fitness', barbershop: 'Barbershops', spa: 'Spas & Massage',
  beauty: 'Salons & Beauty', medspa: 'Med Spa & Aesthetics', tattoo: 'Tattoo Studios', dental: 'Dental & Clinics',
  veterinary: 'Veterinary', menshealth: 'Men’s Health', health: 'Healthcare', finance: 'Finance & Accounting',
  legal: 'Law & Professional', realestate: 'Real Estate', construction: 'Construction',
  home: 'Home Services', automotive: 'Automotive', pet: 'Pet Services',
  florist: 'Florists', travel: 'Travel & Tourism', events: 'Weddings & Events',
  childcare: 'Childcare & Preschool', education: 'Education', nonprofit: 'Nonprofits', museum: 'Museums & Culture',
  landscaping: 'Landscaping & Lawn', architecture: 'Architecture',
  interior: 'Interior Design', coaching: 'Coaching', church: 'Faith & Community',
  photography: 'Photography', creative: 'Creative & Agencies', jeweler: 'Jewelry',
  retail: 'Retail & Boutiques', dispensary: 'Dispensaries', tech: 'Tech & SaaS',
  general: 'Any Business',
};

// Coarse categories for the filter bar (keeps the chip row short at 100 templates).
const CATEGORY = {
  food: 'Food & Drink', cafe: 'Food & Drink', bakery: 'Food & Drink', winery: 'Food & Drink',
  fitness: 'Health & Wellness', beauty: 'Health & Wellness', spa: 'Health & Wellness', medspa: 'Health & Wellness',
  dental: 'Health & Wellness', health: 'Health & Wellness', veterinary: 'Health & Wellness',
  menshealth: 'Health & Wellness', pet: 'Health & Wellness',
  barbershop: 'Personal Services', tattoo: 'Personal Services',
  events: 'Personal Services', florist: 'Personal Services', photography: 'Creative',
  creative: 'Creative', architecture: 'Creative', interior: 'Creative',
  tech: 'Tech & Startups', finance: 'Professional', legal: 'Professional',
  realestate: 'Professional', education: 'Professional', nonprofit: 'Professional',
  coaching: 'Professional', church: 'Professional', museum: 'Professional', childcare: 'Professional',
  construction: 'Home & Trades', home: 'Home & Trades', landscaping: 'Home & Trades',
  automotive: 'Home & Trades', retail: 'Retail',
  jeweler: 'Retail', dispensary: 'Retail', travel: 'Travel & Leisure',
  general: 'Other',
};
const CATEGORY_ORDER = ['Food & Drink', 'Health & Wellness', 'Personal Services', 'Home & Trades', 'Professional', 'Creative', 'Tech & Startups', 'Retail', 'Travel & Leisure', 'Other'];
const STYLE_LABEL = { modern: 'Modern', classic: 'Classic', minimal: 'Minimal', bold: 'Bold', elegant: 'Elegant', luxe: 'Luxe', playful: 'Playful' };

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
  const origin = (ctx && ctx.url && ctx.url.origin) || (ctx && ctx.env && ctx.env.APP_URL) || '';
  const templates = demoTemplates();

  // ItemList structured data so search engines understand this is a gallery of
  // templates (each links to its live demo) — helps rich-result eligibility.
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: tr('tplpage.meta_title'),
    numberOfItems: templates.length,
    itemListElement: templates.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.label,
      url: `${origin}/templates/${t.key}`,
    })),
  };

  // Load every heading + body font the showcase labels render in.
  const fams = new Set();
  templates.forEach((t) => { fams.add(t.fonts.heading); fams.add(t.fonts.body); });
  const fontsHref = `https://fonts.googleapis.com/css2?${[...fams].map((f) => `family=${f.trim().replace(/ /g, '+')}:wght@400;600;700`).join('&')}&display=swap`;

  const cards = templates.map((t) => {
    const dots = [t.colors.primary, t.colors.secondary, t.colors.accent]
      .map((c) => `<span class="dot" style="background:${escapeHtml(c)}"></span>`).join('');
    const cat = CATEGORY[t.industry] || CATEGORY.general;
    const search = `${t.label} ${INDUSTRY_LABEL[t.industry] || ''} ${cat} ${t.style} ${t.description}`.toLowerCase();
    return `
    <article class="card${t.dark ? ' dark' : ''}" data-cat="${escapeHtml(cat)}" data-style="${escapeHtml(t.style)}" data-search="${escapeHtml(search)}">
      <a class="frame" href="/templates/${t.key}" target="_blank" rel="noopener" aria-label="Live preview of ${escapeHtml(t.label)}">
        <iframe data-src="/templates/${t.key}?embed=1" title="${escapeHtml(t.label)} preview" loading="lazy" tabindex="-1" scrolling="no"></iframe>
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

  // Filter bar: category chips (only those present) + style chips + search.
  const presentCats = CATEGORY_ORDER.filter((c) => templates.some((t) => (CATEGORY[t.industry] || CATEGORY.general) === c));
  const presentStyles = Object.keys(STYLE_LABEL).filter((s) => templates.some((t) => t.style === s));
  const catChips = [`<button class="chip active" data-filter="cat" data-val="">${tr('tplpage.all')}</button>`]
    .concat(presentCats.map((c) => `<button class="chip" data-filter="cat" data-val="${escapeHtml(c)}">${escapeHtml(c)}</button>`)).join('');
  const styleChips = [`<button class="chip active" data-filter="style" data-val="">${tr('tplpage.all_styles')}</button>`]
    .concat(presentStyles.map((s) => `<button class="chip" data-filter="style" data-val="${s}">${escapeHtml(STYLE_LABEL[s])}</button>`)).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('tplpage.meta_title'), description: tr('tplpage.meta_desc'), origin, path: '/templates', jsonLd: itemList })}
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
    .filterbar{display:flex;flex-direction:column;gap:.7rem;padding:.5rem 0 1.5rem;position:sticky;top:66px;z-index:20;background:linear-gradient(var(--bg) 70%,transparent)}
    .search{width:100%;max-width:420px;padding:.6rem .9rem;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:.92rem;background:#fff}
    .search:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(102,126,234,.15)}
    .chips{display:flex;flex-wrap:wrap;gap:.4rem}
    .chip{font:inherit;font-size:.8rem;font-weight:600;color:var(--body);background:#fff;border:1px solid var(--line);border-radius:999px;padding:.34rem .8rem;cursor:pointer;transition:all .15s}
    .chip:hover{border-color:var(--brand);color:var(--ink)}
    .chip.active{background:var(--ink);border-color:var(--ink);color:#fff}
    #style-chips .chip.active{background:var(--brand);border-color:var(--brand)}
    .card[hidden]{display:none}
    .noresults{text-align:center;color:var(--body);padding:3rem 0}
    @media(max-width:480px){.grid{grid-template-columns:1fr}.filterbar{position:static}}
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
      <div class="filterbar">
        <input type="search" id="tpl-search" class="search" placeholder="${tr('tplpage.search_ph')}" aria-label="${tr('tplpage.search_ph')}">
        <div class="chips" id="cat-chips">${catChips}</div>
        <div class="chips" id="style-chips">${styleChips}</div>
      </div>
      <div class="grid" id="tpl-grid">${cards}</div>
      <p class="noresults" id="noresults" hidden>${tr('tplpage.no_results')}</p>
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
    (function () {
      var BASE = 1280;
      // Scale each preview iframe to exactly fill its card width (rendered at a
      // fixed 1280px, then scaled) — no horizontal clipping at any viewport.
      function fit() {
        document.querySelectorAll('.frame').forEach(function (f) {
          var ifr = f.querySelector('iframe');
          if (ifr) ifr.style.transform = 'scale(' + (f.clientWidth / BASE) + ')';
        });
      }
      window.addEventListener('resize', fit);
      window.addEventListener('load', fit);

      // Lazy-load previews: only request a demo when its card nears the viewport,
      // so 100 templates don't fire 100 worker requests at once.
      var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var ifr = e.target.querySelector('iframe[data-src]');
          if (ifr) { ifr.src = ifr.getAttribute('data-src'); ifr.removeAttribute('data-src'); }
          io.unobserve(e.target);
        });
      }, { rootMargin: '400px 0px' }) : null;
      function observe(card) {
        if (card.hidden) return;
        if (io) io.observe(card);
        else { var ifr = card.querySelector('iframe[data-src]'); if (ifr) { ifr.src = ifr.getAttribute('data-src'); ifr.removeAttribute('data-src'); } }
      }
      var cards = [].slice.call(document.querySelectorAll('.card'));
      cards.forEach(observe);
      fit();

      // Filtering: category chip + style chip + search, all combined.
      var state = { cat: '', style: '', q: '' };
      function apply() {
        var shown = 0;
        cards.forEach(function (c) {
          var ok = (!state.cat || c.dataset.cat === state.cat)
            && (!state.style || c.dataset.style === state.style)
            && (!state.q || c.dataset.search.indexOf(state.q) !== -1);
          c.hidden = !ok;
          if (ok) { shown++; observe(c); }
        });
        document.getElementById('noresults').hidden = shown > 0;
        fit();
      }
      document.querySelectorAll('.chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var grp = chip.dataset.filter;
          document.querySelectorAll('.chip[data-filter="' + grp + '"]').forEach(function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
          state[grp] = chip.dataset.val;
          apply();
        });
      });
      var search = document.getElementById('tpl-search');
      search.addEventListener('input', function () { state.q = search.value.trim().toLowerCase(); apply(); });
    })();
  </script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
