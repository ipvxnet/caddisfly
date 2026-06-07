// GET /speed — published Core Web Vitals benchmark (marketing; Wix-research
// Tier-3 item). Numbers below are REAL Lighthouse measurements of a published
// customer site (June 2026) — re-measure and update when the stack changes
// meaningfully. The page deliberately links Google's public CrUX Technology
// Report + PageSpeed Insights so visitors can verify everything themselves.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { translator, tArr } from '../../i18n/index.js';

// Measured 2026-06 (Lighthouse 12, ipvxnet build): update alongside re-runs.
const METRICS = { desktop: 98, mobile: 88, tbt: '0 ms', cls: '0.00', lcp: '0.9 s' };

export async function handleSpeed(ctx) {
  const lang = (ctx && ctx.lang) || 'en';
  const tr = (k, v) => translator(lang)(k, v);
  const origin = ctx.url.origin;

  const whyCards = tArr(lang, 'speed.why')
    .map(([ic, t, d]) => `<div class="feat"><div class="ic">${ic}</div><h4>${t}</h4><p>${d}</p></div>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('speed.meta_title'), description: tr('speed.meta_desc'), origin, path: '/speed' })}
  <style>
    ${baseCss()}
    .hero{position:relative;text-align:center;padding:4.5rem 0 3rem}
    .hero h1{font-size:clamp(2rem,5vw,3rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .hero .sub{max-width:640px;margin:1rem auto 0;color:var(--body);font-size:1.08rem}
    section.block{padding:3.4rem 0}
    .sec-head{text-align:center;margin-bottom:2rem}
    .sec-head h2{font-size:clamp(1.5rem,3vw,2rem);font-weight:800;color:var(--ink)}
    .metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:1rem}
    .metric{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.3rem 1rem;text-align:center}
    .metric .v{font-size:clamp(1.6rem,3.4vw,2.3rem);font-weight:900;color:var(--ink)}
    .metric .v.good{color:#059669}
    .metric .l{color:var(--muted);font-size:.84rem;margin-top:.3rem;line-height:1.35}
    .mnote{max-width:720px;margin:1.2rem auto 0;color:var(--muted);font-size:.86rem;text-align:center;line-height:1.6}
    .feats{display:grid;grid-template-columns:repeat(2,1fr);gap:1.2rem}
    .feat{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem}
    .feat .ic{font-size:1.5rem;margin-bottom:.6rem}
    .feat h4{color:var(--ink);font-size:1.05rem;font-weight:700;margin-bottom:.3rem}
    .feat p{font-size:.92rem}
    .industry{background:var(--soft);border:1px solid var(--line);border-radius:16px;padding:1.6rem 1.8rem;max-width:760px;margin:0 auto;line-height:1.7}
    .industry a{color:var(--p2);font-weight:600}
    .verify{text-align:center}
    .verify p{max-width:560px;margin:0 auto 1.2rem}
    .xlink{display:block;text-align:center;margin-top:2.2rem}
    .xlink a{color:var(--p2);font-weight:700}
    .cta-band{background:var(--grad);border-radius:20px;text-align:center;padding:3rem 1.5rem;color:#fff}
    .cta-band h2{font-size:clamp(1.5rem,3vw,2rem);font-weight:800;margin-bottom:1.2rem}
    .cta-band .btn{background:#fff;color:var(--p2)}
    @media (max-width:900px){.metrics{grid-template-columns:repeat(2,1fr)}.metric:last-child{grid-column:span 2}}
    @media (max-width:640px){.feats{grid-template-columns:1fr}}
  </style>
</head>
<body>
  ${siteHeader('', { lang })}
  <main>
    <section class="hero"><div class="wrap">
      <h1>${tr('speed.h1')} <span class="grad-text">${tr('speed.h1_accent')}</span></h1>
      <p class="sub">${tr('speed.hero_p')}</p>
    </div></section>

    <section class="block"><div class="wrap">
      <div class="sec-head"><h2>${tr('speed.measured_title')}</h2></div>
      <div class="metrics">
        <div class="metric"><div class="v good">${METRICS.desktop}<span style="font-size:.55em">/100</span></div><div class="l">${tr('speed.m_desktop')}</div></div>
        <div class="metric"><div class="v good">${METRICS.mobile}<span style="font-size:.55em">/100</span></div><div class="l">${tr('speed.m_mobile')}</div></div>
        <div class="metric"><div class="v good">${METRICS.tbt}</div><div class="l">${tr('speed.m_tbt')}</div></div>
        <div class="metric"><div class="v good">${METRICS.cls}</div><div class="l">${tr('speed.m_cls')}</div></div>
        <div class="metric"><div class="v good">${METRICS.lcp}</div><div class="l">${tr('speed.m_lcp')}</div></div>
      </div>
      <p class="mnote">${tr('speed.measured_note')}</p>
    </div></section>

    <section class="block" style="background:var(--soft);border-top:1px solid var(--line);border-bottom:1px solid var(--line)"><div class="wrap">
      <div class="sec-head"><h2>${tr('speed.why_title')}</h2></div>
      <div class="feats">${whyCards}</div>
    </div></section>

    <section class="block"><div class="wrap">
      <div class="sec-head"><h2>${tr('speed.industry_title')}</h2></div>
      <div class="industry"><p>${tr('speed.industry_p')}</p></div>
    </div></section>

    <section class="block verify" style="padding-top:0"><div class="wrap">
      <div class="sec-head"><h2>${tr('speed.verify_title')}</h2></div>
      <p>${tr('speed.verify_p')}</p>
      <a class="btn btn-primary" href="https://pagespeed.web.dev/" target="_blank" rel="noopener">${tr('speed.verify_btn')}</a>
      <span class="xlink"><a href="/compare">${tr('speed.compare_link')}</a></span>
    </div></section>

    <section class="block"><div class="wrap">
      <div class="cta-band">
        <h2>${tr('speed.cta_title')}</h2>
        <a class="btn" href="/ai-builder">${tr('speed.cta_btn')}</a>
      </div>
    </div></section>
  </main>
  ${siteFooter({ lang })}
</body>
</html>`;

  return htmlResponse(html);
}
