// GET /compare — honest side-by-side vs Wix (marketing; Wix-research Tier-3
// "transparent pricing comparison"). All vendor claims trace to the verified
// research in WIX_COMPETITIVE_ANALYSIS.md (wix.com pricing/support pages,
// June 2026) and are dated + disclaimed in the notes block. Re-verify rows
// when vendors change pricing.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { translator, tArr } from '../../i18n/index.js';

export async function handleCompare(ctx) {
  const lang = (ctx && ctx.lang) || 'en';
  const tr = (k, v) => translator(lang)(k, v);
  const origin = ctx.url.origin;

  const rows = tArr(lang, 'cmp.rows')
    .map(([feature, us, wix]) => `
      <tr>
        <th scope="row">${feature}</th>
        <td class="us">${us}</td>
        <td>${wix}</td>
      </tr>`)
    .join('');

  const notes = tArr(lang, 'cmp.notes').map((n) => `<li>${n}</li>`).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('cmp.meta_title'), description: tr('cmp.meta_desc'), origin, path: '/compare' })}
  <style>
    ${baseCss()}
    .hero{text-align:center;padding:4.5rem 0 2.6rem}
    .hero h1{font-size:clamp(2rem,5vw,3rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .hero .sub{max-width:620px;margin:1rem auto 0;color:var(--body);font-size:1.08rem}
    section.block{padding:2.6rem 0}
    .cmp-wrap{overflow-x:auto}
    table.cmp{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;min-width:640px}
    .cmp th,.cmp td{padding:1rem 1.2rem;text-align:left;font-size:.95rem;border-bottom:1px solid var(--line);vertical-align:top}
    .cmp thead th{background:var(--soft);font-size:.9rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
    .cmp thead th.us-h{color:var(--p2)}
    .cmp tbody th{font-weight:700;color:var(--ink);width:24%}
    .cmp td.us{background:#f5f3ff;font-weight:600;color:var(--ink);width:38%}
    .cmp tr:last-child th,.cmp tr:last-child td{border-bottom:none}
    .cmp a{color:var(--p2);font-weight:600}
    .notes{max-width:760px;margin:0 auto;color:var(--muted);font-size:.85rem;line-height:1.65}
    .notes h3{color:var(--ink);font-size:1rem;margin-bottom:.5rem}
    .notes li{margin-bottom:.45rem;margin-left:1.1rem}
    .xlink{display:block;text-align:center;margin-top:1.6rem}
    .xlink a{color:var(--p2);font-weight:700}
    .cta-band{background:var(--grad);border-radius:20px;text-align:center;padding:3rem 1.5rem;color:#fff}
    .cta-band h2{font-size:clamp(1.5rem,3vw,2rem);font-weight:800;margin-bottom:1.2rem}
    .cta-band .btn{background:#fff;color:var(--p2)}
  </style>
</head>
<body>
  ${siteHeader('', { lang })}
  <main>
    <section class="hero"><div class="wrap">
      <h1>${tr('cmp.h1')} <span class="grad-text">${tr('cmp.h1_accent')}</span></h1>
      <p class="sub">${tr('cmp.hero_p')}</p>
    </div></section>

    <section class="block"><div class="wrap">
      <div class="cmp-wrap">
      <table class="cmp">
        <thead><tr><th></th><th class="us-h">${tr('cmp.col_us')}</th><th>${tr('cmp.col_wix')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
      <span class="xlink"><a href="/speed">${tr('cmp.speed_link')}</a></span>
    </div></section>

    <section class="block"><div class="wrap">
      <div class="notes">
        <h3>${tr('cmp.notes_title')}</h3>
        <ul>${notes}</ul>
      </div>
    </div></section>

    <section class="block"><div class="wrap">
      <div class="cta-band">
        <h2>${tr('cmp.cta_title')}</h2>
        <a class="btn" href="/ai-builder">${tr('cmp.cta_btn')}</a>
      </div>
    </div></section>
  </main>
  ${siteFooter({ lang })}
</body>
</html>`;

  return htmlResponse(html);
}
