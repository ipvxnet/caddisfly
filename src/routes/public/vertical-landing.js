// Programmatic per-vertical SEO landing pages.
//
//   GET /website-builder            → hub listing every industry
//   GET /website-builder/:vertical  → an industry-specific landing page
//
// Each vertical page targets queries like "AI website builder for restaurants"
// with genuinely unique copy (see seo-verticals.js), real industry templates,
// and SoftwareApplication + FAQPage + BreadcrumbList structured data. Shared
// chrome (header/footer/buttons/tokens) comes from components/brand.js.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { translator } from '../../i18n/index.js';
import { getVertical, listVerticals, vt, VERTICAL_SLUGS } from '../../utils/seo-verticals.js';
import { templatesForIndustry, listThemes } from '../../utils/site-themes.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Section CSS shared by the hub and vertical pages (chrome comes from baseCss). */
function verticalCss() {
  return `
    main{display:block}
    .hero{position:relative;text-align:center;padding:5rem 0 3.5rem;overflow:hidden}
    .hero::before{content:'';position:absolute;inset:-30% 0 auto 0;height:560px;z-index:-1;background:
      radial-gradient(540px 340px at 50% 0,rgba(118,75,162,.16),transparent 70%),
      radial-gradient(420px 300px at 80% 10%,rgba(240,147,251,.14),transparent 70%),
      radial-gradient(420px 300px at 18% 12%,rgba(102,126,234,.16),transparent 70%)}
    .eyebrow{display:inline-block;font-weight:700;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--p2);background:rgba(118,75,162,.08);border:1px solid rgba(118,75,162,.16);padding:.35rem .8rem;border-radius:999px;margin-bottom:1.2rem}
    .hero h1{font-size:clamp(2.2rem,5.2vw,3.6rem);line-height:1.08;font-weight:900;color:var(--ink);letter-spacing:-.02em;margin-bottom:1rem}
    .hero p.sub{font-size:clamp(1.02rem,2.1vw,1.25rem);color:var(--body);max-width:680px;margin:0 auto 1.8rem}
    .hero-cta{display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap}
    .hero-cta .btn{padding:.9rem 1.6rem;font-size:1.02rem}
    .trust{margin-top:1.4rem;color:var(--muted);font-size:.86rem}
    section.block{padding:4rem 0}
    section.alt{background:var(--soft);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .sec-head{text-align:center;max-width:680px;margin:0 auto 2.4rem}
    .sec-head h2{font-size:clamp(1.7rem,3.2vw,2.4rem);font-weight:800;color:var(--ink);letter-spacing:-.01em;margin-bottom:.6rem}
    .sec-head p{font-size:1.05rem;color:var(--body)}
    .intro{max-width:760px;margin:0 auto;text-align:center;font-size:1.12rem;color:var(--body)}
    .benefits{display:grid;grid-template-columns:repeat(2,1fr);gap:1.2rem;max-width:920px;margin:0 auto}
    .benefit{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.5rem;box-shadow:0 2px 14px rgba(15,18,34,.04)}
    .benefit h3{color:var(--ink);font-size:1.12rem;font-weight:700;margin-bottom:.4rem}
    .benefit p{font-size:.95rem}
    .tpls{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2rem}
    .tpl{display:block;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;color:inherit;transition:transform .18s,box-shadow .18s,border-color .18s}
    .tpl:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(15,18,34,.08);border-color:var(--p1)}
    .tpl .swatch{height:110px}
    .tpl .body{padding:1.1rem 1.2rem}
    .tpl h3{color:var(--ink);font-size:1.05rem;font-weight:700;margin-bottom:.25rem}
    .tpl p{font-size:.88rem;color:var(--body)}
    .tpls-more{text-align:center;margin-top:1.8rem}
    .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}
    .step{text-align:center;padding:1rem}
    .step .n{width:46px;height:46px;border-radius:13px;background:var(--grad);color:#fff;font-weight:800;font-size:1.2rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem}
    .step h4{color:var(--ink);font-size:1.12rem;font-weight:700;margin-bottom:.35rem}
    .faqs{max-width:760px;margin:0 auto;display:grid;gap:.7rem}
    .faq{background:#fff;border:1px solid var(--line);border-radius:12px;padding:.2rem 1.1rem}
    .faq summary{cursor:pointer;font-weight:700;color:var(--ink);padding:.95rem 0;list-style:none}
    .faq summary::-webkit-details-marker{display:none}
    .faq summary::after{content:'+';float:right;color:var(--p2);font-weight:800}
    .faq[open] summary::after{content:'–'}
    .faq p{padding:0 0 1rem;font-size:.95rem}
    .cta-band{background:var(--grad);border-radius:24px;padding:3rem 2rem;text-align:center;color:#fff}
    .cta-band h2{font-size:clamp(1.6rem,3.2vw,2.2rem);font-weight:800;margin-bottom:.5rem}
    .cta-band p{opacity:.92;margin-bottom:1.5rem;font-size:1.05rem}
    .cta-band .btn{background:#fff;color:var(--p2)}
    .cta-band .btn:hover{transform:translateY(-2px)}
    .others{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:center;max-width:880px;margin:0 auto}
    .chip{display:inline-block;background:#fff;border:1px solid var(--line);border-radius:999px;padding:.5rem 1rem;font-weight:600;font-size:.92rem;color:var(--body);transition:border-color .15s,color .15s}
    .chip:hover{border-color:var(--p1);color:var(--p2)}
    @media (max-width:820px){.benefits,.tpls,.steps{grid-template-columns:1fr}section.block{padding:3rem 0}.hero{padding:3.5rem 0 2.5rem}}`;
}

/** Swatch-style template cards for an industry (real designs, internal links). */
function templateCards(industry) {
  let themes = templatesForIndustry(industry);
  if (!themes.length) themes = listThemes();
  return themes.slice(0, 3).map((t) => `
    <a class="tpl" href="/templates/${esc(t.key)}">
      <div class="swatch" style="background:${esc(t.accent || 'var(--grad)')}"></div>
      <div class="body">
        <h3>${esc(t.label || t.key)}</h3>
        <p>${esc(t.description || '')}</p>
      </div>
    </a>`).join('');
}

function pageShell({ lang, title, description, path, jsonLd, body }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title, description, origin: '', path, jsonLd })}
  <style>${baseCss()}${verticalCss()}</style>
</head>
<body>
  ${siteHeader('', { lang })}
  ${body}
  ${siteFooter({ lang })}
</body>
</html>`;
}

/** GET /website-builder/:vertical */
export async function handleVerticalLanding(ctx) {
  const slug = ctx.params && ctx.params.vertical;
  const v = getVertical(slug);
  if (!v) return redirect('/website-builder');

  const origin = (ctx && ctx.url && ctx.url.origin) || (ctx && ctx.env && ctx.env.APP_URL) || '';
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const path = `/website-builder/${slug}`;
  const label = vt(v.label, lang);
  const sub = vt(v.sub, lang);
  const title = tr('vertical.seo_title', { label });
  const prefill = encodeURIComponent(tr('vertical.prefill', { label: label.toLowerCase() }));
  const buildHref = `/ai-builder?prefill=${prefill}`;

  const benefits = (v.benefits && (v.benefits[lang] || v.benefits.en)) || [];
  const faqs = (v.faqs && (v.faqs[lang] || v.faqs.en)) || [];

  // Structured data.
  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Caddisfly',
    applicationCategory: 'WebApplication',
    operatingSystem: 'Web',
    url: `${origin || 'https://caddisfly.ai'}${path}`,
    description: sub,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const faqLd = faqs.length
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
    : null;
  const base = origin || 'https://caddisfly.ai';
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Caddisfly', item: base },
      { '@type': 'ListItem', position: 2, name: tr('vertical.hub_crumb'), item: `${base}/website-builder` },
      { '@type': 'ListItem', position: 3, name: label, item: `${base}${path}` },
    ],
  };

  const others = listVerticals(lang).filter((o) => o.slug !== slug);

  const body = `
  <main>
    <section class="hero">
      <div class="wrap">
        <span class="eyebrow">${esc(tr('vertical.eyebrow'))}</span>
        <h1>${esc(vt(v.h1, lang))}</h1>
        <p class="sub">${esc(sub)}</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="${buildHref}">${esc(tr('vertical.hero_cta', { label }))}</a>
          <a class="btn btn-ghost" href="#templates">${esc(tr('vertical.hero_cta2'))}</a>
        </div>
        <div class="trust">${esc(tr('vertical.trust'))}</div>
      </div>
    </section>

    <section class="block">
      <div class="wrap"><p class="intro">${esc(vt(v.intro, lang))}</p></div>
    </section>

    <section class="block alt">
      <div class="wrap">
        <div class="sec-head"><h2>${esc(tr('vertical.why_title', { label }))}</h2></div>
        <div class="benefits">
          ${benefits.map(([t, d]) => `<div class="benefit"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}
        </div>
      </div>
    </section>

    <section id="templates" class="block">
      <div class="wrap">
        <div class="sec-head"><h2>${esc(tr('vertical.templates_title', { label }))}</h2><p>${esc(tr('vertical.templates_sub'))}</p></div>
        <div class="tpls">${templateCards(v.industry)}</div>
        <div class="tpls-more"><a class="btn btn-ghost" href="/templates">${esc(tr('vertical.templates_all'))}</a></div>
      </div>
    </section>

    <section class="block alt">
      <div class="wrap">
        <div class="sec-head"><h2>${esc(tr('vertical.how_title'))}</h2></div>
        <div class="steps">
          <div class="step"><div class="n">1</div><h4>${esc(tr('vertical.step1_t'))}</h4><p>${esc(tr('vertical.step1_d'))}</p></div>
          <div class="step"><div class="n">2</div><h4>${esc(tr('vertical.step2_t'))}</h4><p>${esc(tr('vertical.step2_d'))}</p></div>
          <div class="step"><div class="n">3</div><h4>${esc(tr('vertical.step3_t'))}</h4><p>${esc(tr('vertical.step3_d'))}</p></div>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="wrap">
        <div class="sec-head"><h2>${esc(tr('vertical.faq_title'))}</h2></div>
        <div class="faqs">
          ${faqs.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
        </div>
      </div>
    </section>

    <section class="block">
      <div class="wrap">
        <div class="cta-band">
          <h2>${esc(tr('vertical.cta_title', { label }))}</h2>
          <p>${esc(tr('vertical.cta_sub'))}</p>
          <a class="btn" href="${buildHref}">${esc(tr('vertical.cta_btn'))}</a>
        </div>
      </div>
    </section>

    <section class="block alt">
      <div class="wrap">
        <div class="sec-head"><h2>${esc(tr('vertical.others_title'))}</h2></div>
        <div class="others">
          ${others.map((o) => `<a class="chip" href="/website-builder/${o.slug}">${esc(o.label)}</a>`).join('')}
        </div>
      </div>
    </section>
  </main>`;

  return htmlResponse(pageShell({ lang, title, description: sub, path, jsonLd: [softwareLd, faqLd, crumbLd].filter(Boolean), body }));
}

/** GET /website-builder — hub linking to every vertical. */
export async function handleVerticalHub(ctx) {
  const origin = (ctx && ctx.url && ctx.url.origin) || (ctx && ctx.env && ctx.env.APP_URL) || '';
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const verticals = listVerticals(lang);

  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Caddisfly',
    applicationCategory: 'WebApplication',
    operatingSystem: 'Web',
    url: `${origin || 'https://caddisfly.ai'}/website-builder`,
    description: tr('vertical.hub_seo_desc'),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  const body = `
  <main>
    <section class="hero">
      <div class="wrap">
        <span class="eyebrow">${esc(tr('vertical.eyebrow'))}</span>
        <h1>${esc(tr('vertical.hub_h1'))}</h1>
        <p class="sub">${esc(tr('vertical.hub_sub'))}</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="/ai-builder">${esc(tr('vertical.cta_btn'))}</a>
          <a class="btn btn-ghost" href="#industries">${esc(tr('vertical.hub_pick'))}</a>
        </div>
      </div>
    </section>

    <section id="industries" class="block alt">
      <div class="wrap">
        <div class="sec-head"><h2>${esc(tr('vertical.hub_pick'))}</h2></div>
        <div class="benefits">
          ${verticals.map((v) => `
          <a class="benefit" href="/website-builder/${v.slug}" style="display:block;color:inherit">
            <h3>${esc(v.label)} →</h3>
            <p>${esc(tr('vertical.hub_card', { kw: v.keyword }))}</p>
          </a>`).join('')}
        </div>
      </div>
    </section>

    <section class="block">
      <div class="wrap">
        <div class="cta-band">
          <h2>${esc(tr('vertical.hub_cta_title'))}</h2>
          <p>${esc(tr('vertical.cta_sub'))}</p>
          <a class="btn" href="/ai-builder">${esc(tr('vertical.cta_btn'))}</a>
        </div>
      </div>
    </section>
  </main>`;

  return htmlResponse(pageShell({
    lang,
    title: tr('vertical.hub_seo_title'),
    description: tr('vertical.hub_seo_desc'),
    path: '/website-builder',
    jsonLd: [softwareLd],
    body,
  }));
}

export { VERTICAL_SLUGS };
