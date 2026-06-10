// GET /showcase — the public showroom: a featured carousel (auto-rotates every
// 15s) over a grid of curated example sites built on the platform. Thumbnails
// reuse the dashboard's embeddable preview-iframe trick. Admin-curated (see
// /admin/showcase). Public + SEO-friendly (brand shell, in sitemap).

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { listShowcase } from '../../db/showcase.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function handleShowcase(ctx) {
  const { env, url } = ctx;
  const origin = url.origin;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const sitesBase = env.SITES_BASE || 'caddisfly.app';
  const suffix = env.SITES_PREVIEW_SUFFIX || '';

  const entries = await listShowcase(env.DB, { enabledOnly: true });
  const featured = entries.filter((e) => e.featured);
  const liveUrl = (e) => (e.subdomain ? `https://${esc(e.subdomain)}${suffix}.${sitesBase}` : '');

  const thumb = (e, cls) =>
    `<div class="show-thumb ${cls}">
       <iframe class="show-frame" src="/ai-preview/${esc(e.project_public_id)}?embed=1" loading="lazy" scrolling="no" tabindex="-1" title="${esc(e.title)}"></iframe>
       ${liveUrl(e) ? `<a class="show-cover" href="${liveUrl(e)}" target="_blank" rel="noopener" aria-label="${esc(e.title)}"></a>` : ''}
     </div>`;

  const card = (e) => `
    <div class="show-card">
      ${thumb(e, '')}
      <div class="show-body">
        <div class="show-name">${esc(e.title)}${e.category ? ` <span class="show-cat">${esc(e.category)}</span>` : ''}</div>
        ${e.blurb ? `<p class="show-blurb">${esc(e.blurb)}</p>` : ''}
        ${liveUrl(e) ? `<a class="show-visit" href="${liveUrl(e)}" target="_blank" rel="noopener">${tr('showcase.visit')}</a>` : ''}
      </div>
    </div>`;

  const slide = (e) => `
    <div class="show-slide">
      ${thumb(e, 'big')}
      <div class="show-slide-body">
        <div class="show-eyebrow">${tr('showcase.featured_eyebrow')}</div>
        <h2>${esc(e.title)}</h2>
        ${e.category ? `<span class="show-cat">${esc(e.category)}</span>` : ''}
        ${e.blurb ? `<p>${esc(e.blurb)}</p>` : ''}
        ${liveUrl(e) ? `<a class="btn btn-primary" href="${liveUrl(e)}" target="_blank" rel="noopener">${tr('showcase.visit')}</a>` : ''}
      </div>
    </div>`;

  const carousel = featured.length
    ? `<div class="show-carousel" id="carousel">
         <div class="show-track" id="track">${featured.map(slide).join('')}</div>
         ${featured.length > 1 ? `
         <button class="show-nav prev" onclick="showGo(-1)" aria-label="Previous">‹</button>
         <button class="show-nav next" onclick="showGo(1)" aria-label="Next">›</button>
         <div class="show-dots" id="dots">${featured.map((_, i) => `<button class="show-dot${i === 0 ? ' on' : ''}" onclick="showTo(${i})" aria-label="Slide ${i + 1}"></button>`).join('')}</div>` : ''}
       </div>` : '';

  const body = entries.length
    ? `${carousel}
       <div class="show-grid">${entries.map(card).join('')}</div>`
    : `<div class="show-empty"><p>${tr('showcase.empty')}</p><a class="btn btn-primary" href="/ai-builder">${tr('showcase.build_cta')}</a></div>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('showcase.meta_title'), description: tr('showcase.meta_desc'), origin, path: '/showcase' })}
  <style>
    ${baseCss()}
    .sw-wrap{max-width:1180px;margin:0 auto;padding:3rem 1.5rem 4rem}
    .sw-head{text-align:center;max-width:680px;margin:0 auto 2.4rem}
    .sw-head h1{font-size:clamp(2rem,5vw,3rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .sw-head p{color:var(--body);font-size:1.1rem;margin-top:.6rem;line-height:1.6}
    .sw-head .btn{margin-top:1.2rem}
    /* iframe rendered at ~3.33x then scaled to .3 → crisp desktop thumbnail */
    .show-thumb{position:relative;overflow:hidden;background:var(--soft,#f8f9fc);border-bottom:1px solid var(--line)}
    .show-thumb .show-frame{position:absolute;top:0;left:0;width:333.33%;height:333.33%;border:0;transform:scale(.3);transform-origin:0 0;pointer-events:none;background:#fff}
    .show-thumb .show-cover{position:absolute;inset:0;z-index:2;display:block}
    /* featured carousel */
    .show-carousel{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:18px;background:#fff;margin-bottom:2.4rem;box-shadow:0 10px 30px rgba(118,75,162,.08)}
    .show-track{display:flex;transition:transform .6s cubic-bezier(.4,0,.2,1)}
    .show-slide{min-width:100%;display:grid;grid-template-columns:1.4fr 1fr;align-items:stretch}
    .show-slide .show-thumb.big{height:420px;border-bottom:0;border-right:1px solid var(--line)}
    .show-slide-body{padding:2.2rem;display:flex;flex-direction:column;justify-content:center;gap:.5rem}
    .show-slide-body h2{font-size:clamp(1.4rem,3vw,2rem);font-weight:900;color:var(--ink);letter-spacing:-.01em}
    .show-slide-body p{color:var(--body);line-height:1.6}
    .show-slide-body .btn{align-self:flex-start;margin-top:.7rem}
    .show-eyebrow{font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--p1)}
    .show-nav{position:absolute;top:calc(210px - 22px);width:44px;height:44px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.9);color:var(--p2);font-size:1.4rem;line-height:1;cursor:pointer;z-index:4;display:flex;align-items:center;justify-content:center}
    .show-nav.prev{left:.8rem}.show-nav.next{left:calc(58.33% - 60px)}
    .show-nav:hover{border-color:var(--p1)}
    .show-dots{position:absolute;bottom:.9rem;left:0;width:58.33%;display:flex;gap:.4rem;justify-content:center;z-index:4}
    .show-dot{width:9px;height:9px;border-radius:999px;border:0;background:rgba(118,75,162,.25);cursor:pointer;padding:0}
    .show-dot.on{background:var(--p1)}
    /* grid */
    .show-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.4rem}
    .show-card{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff;display:flex;flex-direction:column;transition:box-shadow .15s,border-color .15s,transform .15s}
    .show-card:hover{box-shadow:0 10px 28px rgba(118,75,162,.14);border-color:var(--p1);transform:translateY(-2px)}
    .show-card .show-thumb{height:208px}
    .show-body{padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:.5rem}
    .show-name{font-weight:800;color:var(--ink);font-size:1.05rem}
    .show-cat{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.05rem .55rem;font-size:.72rem;font-weight:700;color:var(--p2);vertical-align:middle}
    .show-blurb{color:var(--body);font-size:.92rem;line-height:1.55;margin:0}
    .show-visit{color:var(--p2);font-weight:700;font-size:.9rem;text-decoration:none;margin-top:auto}
    .show-visit:hover{text-decoration:underline}
    .show-empty{text-align:center;padding:4rem 1rem;color:var(--muted)}
    .show-empty .btn{margin-top:1rem}
    @media (max-width:760px){
      .show-slide{grid-template-columns:1fr}
      .show-slide .show-thumb.big{height:240px;border-right:0;border-bottom:1px solid var(--line)}
      .show-nav{display:none}.show-dots{width:100%}
    }
  </style>
</head>
<body>
  ${siteHeader('/showcase', { lang })}
  <main><div class="sw-wrap">
    <div class="sw-head">
      <h1>${tr('showcase.title')}</h1>
      <p>${tr('showcase.subtitle')}</p>
      <a class="btn btn-primary" href="/ai-builder">${tr('showcase.build_cta')}</a>
    </div>
    ${body}
  </div></main>
  ${siteFooter({ lang })}
  <script>
    (function () {
      var track = document.getElementById('track');
      if (!track) return;
      var slides = track.children.length, i = 0, timer = null;
      var dots = document.querySelectorAll('#dots .show-dot');
      function render() {
        track.style.transform = 'translateX(' + (-i * 100) + '%)';
        for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('on', d === i);
      }
      window.showTo = function (n) { i = (n + slides) % slides; render(); reset(); };
      window.showGo = function (d) { window.showTo(i + d); };
      function reset() { if (timer) clearInterval(timer); if (slides > 1) timer = setInterval(function () { window.showGo(1); }, 15000); }
      reset();
    })();
  </script>
</body>
</html>`;
  return htmlResponse(html);
}
