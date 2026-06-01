// Pricing page — Free / Starter $9 / Pro $19 / Agency $49 (see memory/pricing.md).
// Differentiates on AI + storage + price vs Wix. No Stripe yet — CTAs start free.

import { htmlResponse } from '../../utils/response.js';
import { brandMark, headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';

const PLANS = [
  {
    key: 'free', name: 'Free', mo: 0, yr: 0, tagline: 'Try it, ship a site.',
    cta: 'Start free', highlight: false,
    features: ['1 published site', '1 GB storage', '50 AI credits / mo', 'caddisfly.site subdomain', 'AI builder + 1 refactor', 'Community support'],
  },
  {
    key: 'starter', name: 'Starter', mo: 9, yr: 7, tagline: 'For a polished personal or small-biz site.',
    cta: 'Get Starter', highlight: false,
    features: ['3 published sites', '<strong>25 GB</strong> storage', '500 AI credits / mo', '1 custom domain', 'Remove “Built with Caddisfly”', 'AI image generation', 'Email support'],
  },
  {
    key: 'pro', name: 'Pro', mo: 19, yr: 15, tagline: 'For freelancers & growing businesses.',
    cta: 'Get Pro', highlight: true,
    features: ['15 published sites', '<strong>100 GB</strong> storage', '2,000 AI credits / mo', '5 custom domains', 'Priority AI image generation', 'Everything in Starter', 'Priority support'],
  },
  {
    key: 'agency', name: 'Agency', mo: 49, yr: 39, tagline: 'For studios building many sites.',
    cta: 'Get Agency', highlight: false,
    features: ['Unlimited sites', '<strong>500 GB+</strong> storage', '8,000 AI credits / mo', 'Unlimited custom domains', 'Bulk refactor', 'Everything in Pro', 'Priority+ support'],
  },
];

export async function handlePricing(ctx) {
  const origin = (ctx && ctx.url && ctx.url.origin) || (ctx && ctx.env && ctx.env.APP_URL) || '';

  const card = (p) => `
    <div class="plan${p.highlight ? ' featured' : ''}">
      ${p.highlight ? '<span class="badge">Most popular</span>' : ''}
      <h3>${p.name}</h3>
      <p class="tag">${p.tagline}</p>
      <div class="price">
        <span class="cur">$</span><span class="amt" data-mo="${p.mo}" data-yr="${p.yr}">${p.mo}</span><span class="per">/mo</span>
      </div>
      <p class="billed" data-mo="&nbsp;" data-yr="billed annually">&nbsp;</p>
      <a class="btn ${p.highlight ? 'btn-primary' : 'btn-ghost'} btn-full" href="/ai-builder">${p.cta}</a>
      <ul>${p.features.map((f) => `<li>${f}</li>`).join('')}</ul>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Pricing — Caddisfly', description: 'Simple, honest pricing. More storage, way cheaper than the big builders — powered by AI. Free to start.', origin })}
  <style>
    ${baseCss()}
    .hero{text-align:center;padding:4.5rem 0 1rem;position:relative;overflow:hidden}
    .hero::before{content:'';position:absolute;inset:-40% 0 auto 0;height:520px;background:radial-gradient(520px 320px at 50% 0,rgba(118,75,162,.14),transparent 70%);z-index:-1}
    .hero h1{font-size:clamp(2.2rem,5vw,3.4rem);font-weight:900;color:var(--ink);letter-spacing:-.02em;margin-bottom:.8rem}
    .hero p{font-size:1.15rem;color:var(--body);max-width:620px;margin:0 auto}
    .toggle{display:inline-flex;align-items:center;gap:.6rem;margin:1.8rem auto 0;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.35rem}
    .toggle button{border:none;background:transparent;font-family:inherit;font-weight:700;font-size:.9rem;color:var(--body);padding:.5rem 1.1rem;border-radius:999px;cursor:pointer}
    .toggle button.on{background:#fff;color:var(--p2);box-shadow:0 2px 8px rgba(15,18,34,.08)}
    .toggle .save{font-size:.78rem;font-weight:700;color:#fff;background:var(--grad);padding:.25rem .55rem;border-radius:999px}
    .plans{display:grid;grid-template-columns:repeat(4,1fr);gap:1.1rem;padding:2.5rem 0}
    .plan{background:#fff;border:1px solid var(--line);border-radius:18px;padding:1.6rem 1.4rem;display:flex;flex-direction:column;position:relative}
    .plan.featured{border:2px solid var(--p2);box-shadow:0 14px 40px rgba(118,75,162,.18);transform:translateY(-6px)}
    .badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--grad);color:#fff;font-size:.72rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:.3rem .8rem;border-radius:999px;white-space:nowrap}
    .plan h3{font-size:1.3rem;font-weight:800;color:var(--ink)}
    .plan .tag{font-size:.86rem;color:var(--muted);min-height:2.4em;margin:.25rem 0 .9rem}
    .price{display:flex;align-items:flex-start;gap:.1rem;color:var(--ink);font-weight:900;line-height:1}
    .price .cur{font-size:1.4rem;margin-top:.45rem}
    .price .amt{font-size:3.1rem;letter-spacing:-2px}
    .price .per{font-size:1rem;color:var(--muted);font-weight:700;align-self:flex-end;margin-bottom:.5rem}
    .billed{font-size:.78rem;color:var(--muted);min-height:1.1em;margin:.1rem 0 1.1rem}
    .btn-full{width:100%;justify-content:center;margin-bottom:1.2rem}
    .plan ul{list-style:none;display:grid;gap:.55rem}
    .plan li{position:relative;padding-left:1.6rem;font-size:.9rem;color:var(--body)}
    .plan li::before{content:'✓';position:absolute;left:0;color:var(--p2);font-weight:800}
    .vs{background:var(--soft);border:1px solid var(--line);border-radius:18px;padding:1.6rem;display:flex;align-items:center;justify-content:center;gap:1.2rem;flex-wrap:wrap;text-align:center;margin:1rem 0 2.5rem}
    .vs .big{font-size:1.5rem;font-weight:800;color:var(--ink)}
    .vs .big .grad-text{font-weight:900}
    .vs .small{color:var(--muted);font-size:.95rem}
    .note{text-align:center;color:var(--muted);font-size:.9rem;margin-bottom:2.5rem}
    .faq{max-width:760px;margin:0 auto;padding-bottom:1rem}
    .faq h2{text-align:center;font-size:1.8rem;font-weight:800;color:var(--ink);margin-bottom:1.6rem}
    .faq details{border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem;margin-bottom:.7rem;background:#fff}
    .faq summary{font-weight:700;color:var(--ink);cursor:pointer;list-style:none}
    .faq summary::-webkit-details-marker{display:none}
    .faq summary::before{content:'+ ';color:var(--p2);font-weight:800}
    .faq details[open] summary::before{content:'– '}
    .faq p{margin-top:.7rem;font-size:.95rem}
    @media (max-width:980px){.plans{grid-template-columns:repeat(2,1fr)}.plan.featured{transform:none}}
    @media (max-width:560px){.plans{grid-template-columns:1fr}}
  </style>
</head>
<body>
  ${siteHeader('/pricing')}
  <main>
    <section class="hero"><div class="wrap">
      <h1>Simple pricing. <span class="grad-text">More for less.</span></h1>
      <p>AI builds your site — and you get far more storage for far less than the big builders. Start free, upgrade when you grow.</p>
      <div class="toggle" role="group" aria-label="Billing period">
        <button id="t-mo" class="on" onclick="setBilling('mo')">Monthly</button>
        <button id="t-yr" onclick="setBilling('yr')">Annual <span class="save">save ~20%</span></button>
      </div>
    </div></section>

    <section><div class="wrap">
      <div class="plans">${PLANS.map(card).join('')}</div>
      <div class="vs">
        <div class="big"><span class="grad-text">25 GB for $9</span></div>
        <div class="small">— where the big builders give you <strong>2 GB for $17</strong>. Built on Cloudflare R2, so storage is cheap and we pass it on.</div>
      </div>
      <p class="note">All plans include the AI builder, multi-page sites, live editing, themes &amp; one-click publish. Cancel anytime.</p>
    </div></section>

    <section><div class="wrap faq">
      <h2>Questions</h2>
      <details><summary>What's an “AI credit”?</summary><p>Credits cover the AI work behind your site. Roughly: a full AI site build ≈ 20 credits, an AI text edit ≈ 1, an AI-generated image ≈ 5, refactoring an existing site ≈ 10. Your monthly allotment resets each cycle.</p></details>
      <details><summary>Is there really a free plan?</summary><p>Yes — build and publish 1 site on a caddisfly subdomain with a small monthly AI allotment, free forever. No card required.</p></details>
      <details><summary>Can I use my own domain?</summary><p>Custom domains are included on paid plans (1 on Starter, 5 on Pro, unlimited on Agency). Free sites get a caddisfly subdomain. <em>Custom-domain connection is rolling out soon.</em></p></details>
      <details><summary>How is this cheaper than Wix &amp; co?</summary><p>We're AI-native and run on Cloudflare's edge — storage and bandwidth cost us a fraction, so we give you more and charge less. We don't bundle e-commerce add-ons you may not need.</p></details>
      <details><summary>Can I cancel or switch plans?</summary><p>Anytime — upgrade, downgrade, or cancel from your account. No long-term contracts.</p></details>
    </div></section>

    <section><div class="wrap">
      <div style="background:var(--grad);border-radius:24px;padding:3rem 2rem;text-align:center;color:#fff;margin:1rem 0 2rem">
        <h2 style="font-size:clamp(1.7rem,3.2vw,2.3rem);font-weight:800;margin-bottom:.5rem">Start building — free</h2>
        <p style="opacity:.92;margin-bottom:1.6rem;font-size:1.05rem">Your first site is a minute away.</p>
        <a class="btn" style="background:#fff;color:var(--p2)" href="/ai-builder">✨ Build with AI</a>
      </div>
    </div></section>
  </main>
  ${siteFooter()}
  <script>
    function setBilling(mode){
      document.getElementById('t-mo').classList.toggle('on', mode==='mo');
      document.getElementById('t-yr').classList.toggle('on', mode==='yr');
      document.querySelectorAll('.price .amt').forEach(function(el){ el.textContent = el.getAttribute('data-'+mode); });
      document.querySelectorAll('.billed').forEach(function(el){ el.innerHTML = el.getAttribute('data-'+mode); });
    }
  </script>
</body>
</html>`;

  return htmlResponse(html);
}
