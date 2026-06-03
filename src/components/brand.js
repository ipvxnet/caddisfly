// Shared brand assets for public marketing pages (landing, pricing).

/** Inline brand mark (continuous-wing "C", brand gradient). Unique id per use. */
export function brandMark(id, cls = '', animated = false) {
  const anim = animated
    ? `<style>
        @keyframes ${id}-draw{0%{stroke-dashoffset:520}45%{stroke-dashoffset:0}80%{stroke-dashoffset:0}100%{stroke-dashoffset:520}}
        @keyframes ${id}-pop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
        #${id} .w,#${id} .v{stroke-dasharray:520;animation:${id}-draw 3.4s ease-in-out infinite}
        #${id} .v{animation-delay:.15s}
        #${id} .d{transform-box:fill-box;transform-origin:center;animation:${id}-pop 3.4s ease infinite}
        #${id} .a{transform-box:fill-box;transform-origin:center;animation:${id}-pop 3.4s ease infinite;animation-delay:.25s}
        @media (prefers-reduced-motion:reduce){#${id} .w,#${id} .v,#${id} .d,#${id} .a{animation:none;stroke-dashoffset:0;opacity:1;transform:none}}
      </style>`
    : '';
  return `<svg id="${id}" class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Caddisfly">
    <defs><linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#667eea"/><stop offset="0.55" stop-color="#764ba2"/><stop offset="1" stop-color="#f093fb"/>
    </linearGradient>${anim}</defs>
    <path class="w" d="M88 34 C 58 18, 26 34, 26 64 C 26 92, 56 104, 84 92" fill="none" stroke="url(#${id}-g)" stroke-width="9" stroke-linecap="round"/>
    <path class="v" d="M40 58 C 56 64, 70 70, 84 80" fill="none" stroke="url(#${id}-g)" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
    <circle class="d" cx="92" cy="30" r="6.5" fill="url(#${id}-g)"/>
    <path class="a" d="M92 24 C 96 14, 102 11, 108 11" fill="none" stroke="url(#${id}-g)" stroke-width="3.4" stroke-linecap="round"/>
  </svg>`;
}

/** SVG-data-URI favicon (the mark). */
export const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23667eea'/%3E%3Cstop offset='.55' stop-color='%23764ba2'/%3E%3Cstop offset='1' stop-color='%23f093fb'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M88 34 C 58 18, 26 34, 26 64 C 26 92, 56 104, 84 92' fill='none' stroke='url(%23g)' stroke-width='9' stroke-linecap='round'/%3E%3Ccircle cx='92' cy='30' r='6.5' fill='url(%23g)'/%3E%3Cpath d='M92 24 C 96 14, 102 11, 108 11' fill='none' stroke='url(%23g)' stroke-width='3.4' stroke-linecap='round'/%3E%3C/svg%3E";

/** Shared <head> tags (fonts, favicons, OG/Twitter). */
export function headTags({ title, description, origin }) {
  return `
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${origin}/">
  <meta property="og:image" content="${origin}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${origin}/og.png">
  <meta name="theme-color" content="#764ba2">
  <link rel="icon" type="image/svg+xml" href="${FAVICON}">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">`;
}

/** Shared base CSS (tokens, layout, buttons, header, footer). */
export function baseCss() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--p1:#667eea;--p2:#764ba2;--p3:#f093fb;--grad:linear-gradient(135deg,var(--p1) 0%,var(--p2) 55%,var(--p3) 100%);
      --ink:#0f1222;--body:#475067;--muted:#8a93a8;--line:#e9ecf5;--bg:#ffffff;--soft:#f7f8fc}
    html{scroll-behavior:smooth}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--body);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
    a{color:inherit;text-decoration:none}
    .wrap{max-width:1140px;margin:0 auto;padding:0 1.5rem}
    .grad-text{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
    .btn{display:inline-flex;align-items:center;gap:.45rem;font-weight:700;border-radius:11px;padding:.7rem 1.25rem;cursor:pointer;border:none;font-size:.95rem;transition:transform .15s,box-shadow .15s,filter .15s;font-family:inherit}
    .btn-primary{background:var(--grad);color:#fff;box-shadow:0 8px 22px rgba(118,75,162,.28)}
    .btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(118,75,162,.36)}
    .btn-ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line)}
    .btn-ghost:hover{border-color:var(--p1);color:var(--p2)}
    header.site{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.82);backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--line)}
    .nav{display:flex;align-items:center;justify-content:space-between;height:68px}
    .brand{display:flex;align-items:center;gap:.55rem;font-weight:800;font-size:1.15rem;color:var(--ink)}
    .brand svg{width:30px;height:30px}.brand .ai{color:var(--muted);font-weight:700}
    .nav-links{display:flex;align-items:center;gap:1.75rem}
    .nav-links a{font-weight:600;font-size:.93rem;color:var(--body)}
    .nav-links a:hover{color:var(--ink)}
    .nav-links a.active{color:var(--p2)}
    .nav .btn{padding:.55rem 1.05rem}
    .credit-pill{display:inline-flex;align-items:center;gap:.3rem;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.4rem .85rem;font-weight:800;font-size:.9rem;color:var(--p2);line-height:1}
    .credit-pill strong{font-weight:900}
    .credit-pill:hover{border-color:var(--p1);color:var(--p1)}
    footer.site{border-top:1px solid var(--line);padding:2.2rem 0;color:var(--muted);font-size:.9rem;margin-top:2rem}
    .foot{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
    .foot .brand{font-size:1rem;color:var(--ink)}.foot .brand svg{width:24px;height:24px}
    .foot-links a{color:var(--body);font-weight:600}.foot-links a:hover{color:var(--p2)}
    @media (max-width:820px){.nav-links a:not(.btn):not(.credit-pill){display:none}}`;
}

/** Shared sticky header. activePath highlights the matching nav link.
 * opts.credits (number) renders a "✨ N" Caddi-Credits pill linking to /billing. */
export function siteHeader(activePath = '', opts = {}) {
  const a = (path) => (activePath === path ? ' class="active"' : '');
  const pill =
    opts && opts.credits != null
      ? `<a class="credit-pill" href="/billing" title="Your Caddi Credits — click to buy more">✨ <strong>${Number(opts.credits).toLocaleString()}</strong></a>`
      : '';
  return `<header class="site"><div class="wrap nav">
    <a class="brand" href="/">${brandMark('m-hd')}<span>caddisfly<span class="ai">.ai</span></span></a>
    <nav class="nav-links">
      <a href="/#paths"${a('/#paths')}>How it works</a>
      <a href="/pricing"${a('/pricing')}>Pricing</a>
      <a href="/#features">Features</a>
      <a href="/dashboard"${a('/dashboard')}>Dashboard</a>
      ${pill}
      <a class="btn btn-primary" href="/ai-builder">Build with AI →</a>
    </nav>
  </div></header>`;
}

/** Shared footer. */
export function siteFooter() {
  return `<footer class="site"><div class="wrap foot">
    <a class="brand" href="/">${brandMark('m-ft')}<span>caddisfly<span class="ai">.ai</span></span></a>
    <span class="foot-links"><a href="/pricing">Pricing</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/billing">Billing</a></span>
    <span>© 2026 Caddisfly. Build beautiful websites with AI.</span>
  </div></footer>`;
}
