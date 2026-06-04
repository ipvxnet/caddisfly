// GET /help — public documentation + FAQ. Covers building, customizing,
// publishing, custom domains/DNS, plans, and teams. Reuses the brand shell.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { translator, tArr } from '../../i18n/index.js';

function section(id, title, body) {
  return `<section id="${id}" class="hsec"><h2>${title}</h2>${body}</section>`;
}

export function handleHelp(ctx) {
  const origin = ctx.url.origin;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);

  const toc = `<nav class="htoc">${tArr(lang, 'help.toc').map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}</nav>`;
  const sections = tArr(lang, 'help.sections').map(([id, title, body]) => section(id, title, body)).join('');
  const faq = tArr(lang, 'help.faqs')
    .map(([q, a]) => `<details class="faq"><summary>${q}</summary><div class="faq-a">${a}</div></details>`)
    .join('');
  const faqLabel = (tArr(lang, 'help.toc').find(([id]) => id === 'faq') || [, 'FAQ'])[1];

  const inner = `
    <div class="hhead">
      <h1>${tr('help.h1')}</h1>
      <p class="sub">${tr('help.sub', { support: `<a href="/support">${tr('help.open_ticket')}</a>` })}</p>
    </div>
    ${toc}
    ${sections}
    ${section('faq', faqLabel, faq)}

    <div class="hcta">
      <p>${tr('help.cta_q')}</p>
      <a class="btn btn-primary" href="/support">${tr('help.cta_btn')}</a>
    </div>
  `;

  return htmlResponse(pageShell(origin, inner, lang, tr));
}

function pageShell(origin, inner, lang = 'en', tr = (k) => k) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({
    title: tr('help.meta_title'),
    description: 'Guides and FAQ for building, customizing, publishing, custom domains, plans, and teams on Caddisfly.',
    origin,
    path: '/help',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: tArr(lang, 'help.faqs').map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() },
      })),
    },
  })}
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .hwrap{max-width:820px;margin:0 auto;padding:3rem 1.5rem}
    .hhead h1{font-size:clamp(1.9rem,4vw,2.6rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .hhead .sub{color:var(--body);margin:.4rem 0 1.6rem;line-height:1.6}
    .htoc{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:2rem;padding-bottom:1.4rem;border-bottom:1px solid var(--line)}
    .htoc a{font-size:.85rem;font-weight:700;color:var(--p2);background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.3rem .8rem;text-decoration:none}
    .htoc a:hover{border-color:var(--p1)}
    .hsec{margin-bottom:2.2rem;scroll-margin-top:90px}
    .hsec h2{font-size:1.3rem;color:var(--ink);margin-bottom:.7rem;font-weight:800}
    .hsec p{color:var(--body);line-height:1.7;margin-bottom:.7rem}
    .hsec ul,.hsec ol{color:var(--body);line-height:1.8;padding-left:1.3rem;margin-bottom:.7rem}
    .hsec li{margin-bottom:.3rem}
    .hsec code{background:#f1f5f9;border:1px solid var(--line);border-radius:5px;padding:.06rem .35rem;font-size:.86em}
    .hsec a{color:var(--p2);font-weight:600}
    .faq{border:1px solid var(--line);border-radius:12px;padding:.2rem .9rem;margin-bottom:.6rem;background:#fff}
    .faq > summary{cursor:pointer;font-weight:700;color:var(--ink);padding:.8rem 0;list-style:none}
    .faq > summary::-webkit-details-marker{display:none}
    .faq > summary::before{content:'＋ ';color:var(--p1);font-weight:800}
    .faq[open] > summary::before{content:'－ '}
    .faq-a{color:var(--body);line-height:1.7;padding:0 0 .9rem;font-size:.95rem}
    .hcta{text-align:center;background:linear-gradient(135deg,#eef2ff,#faf5ff);border:1px solid #e0e7ff;border-radius:16px;padding:2rem;margin-top:1rem}
    .hcta p{color:var(--ink);font-weight:700;margin-bottom:.9rem}
  </style>
</head>
<body>
  ${siteHeader('/help', { lang })}
  <main><div class="hwrap">${inner}</div></main>
  ${siteFooter({ lang })}
</body>
</html>`;
}
