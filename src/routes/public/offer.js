// /offer[?code=XYZ] — "good enough" campaign landing page for outbound outreach
// (Orlando + Melbourne FL local businesses). Shows the promo + Caddisfly benefits
// and sends them into the builder. The code is displayed + carried into signup;
// Stripe Checkout already accepts promotion codes (allow_promotion_codes:true).

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const BENEFITS = [
  ['⚡', 'Live in minutes', 'Describe your business and AI builds a complete, professional site — copy, photos, and layout done for you.'],
  ['🎨', 'Looks designed, not DIY', '100+ industry templates tuned for restaurants, salons, trades, clinics and more — mobile-fast and Google-friendly.'],
  ['🛒', 'Sell & take bookings', 'Built-in online store, appointment booking, and contact forms — no plugins, no extra tools.'],
  ['🌐', 'Your own domain + email', 'Connect a custom domain in a click; we handle hosting, SSL, and speed automatically.'],
  ['✏️', 'Edit by just asking', 'Change anything by typing what you want — or tweak it yourself. No code, ever.'],
  ['🆓', 'Free to start', 'Build and preview your whole site before you pay a cent. Keep it when you love it.'],
];

export function handleOffer(ctx) {
  const { url } = ctx;
  const origin = (ctx.env && ctx.env.APP_URL) || url.origin;
  const code = (url.searchParams.get('code') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  const startHref = '/ai-builder' + (code ? `?promo=${encodeURIComponent(code)}` : '');

  const promo = code
    ? `<div class="offer-promo">
         <div class="offer-promo-label">Your promo code</div>
         <div class="offer-code" id="offer-code">${esc(code)}</div>
         <button class="offer-copy" type="button" onclick="(function(b){navigator.clipboard&&navigator.clipboard.writeText('${esc(code)}');b.textContent='Copied ✓';setTimeout(function(){b.textContent='Copy';},1500);})(this)">Copy</button>
         <div class="offer-promo-hint">Apply it at checkout when you’re ready to publish.</div>
       </div>`
    : '';

  const benefits = BENEFITS.map(([i, t, d]) =>
    `<div class="offer-b"><div class="offer-b-i">${i}</div><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></div>`).join('');

  const inner = `
  <section class="offer-hero">
    <div class="offer-wrap">
      <div class="offer-eyebrow">For local businesses in Orlando &amp; Melbourne, FL</div>
      <h1>A professional website for your business — built by AI in minutes.</h1>
      <p class="offer-sub">No designers, no agencies, no months of waiting. Tell Caddisfly about your business and get a polished, mobile-fast site you can publish today.</p>
      ${promo}
      <div class="offer-cta-row">
        <a class="offer-cta" href="${esc(startHref)}">Build my free site →</a>
        <a class="offer-cta2" href="/templates">See examples</a>
      </div>
      <div class="offer-trust">Free to build &amp; preview · Keep your own domain · Cancel anytime</div>
    </div>
  </section>
  <section class="offer-wrap offer-benefits">${benefits}</section>
  <section class="offer-wrap offer-final">
    <h2>Ready in less time than a coffee break.</h2>
    <a class="offer-cta" href="${esc(startHref)}">Start free →</a>
  </section>`;

  const css = `
  .offer-wrap{max-width:1040px;margin:0 auto;padding:0 1.4rem}
  .offer-hero{padding:3.5rem 0 2.5rem;text-align:center;background:linear-gradient(180deg,#f6f5ff,#fff)}
  .offer-eyebrow{display:inline-block;font-size:.78rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#6d28d9;background:#ede9fe;border-radius:999px;padding:.35rem .8rem;margin-bottom:1rem}
  .offer-hero h1{font-size:clamp(1.9rem,4.5vw,3rem);font-weight:900;line-height:1.1;color:#1a202c;max-width:780px;margin:0 auto}
  .offer-sub{font-size:1.12rem;color:#4a5568;max-width:640px;margin:1.1rem auto 0;line-height:1.6}
  .offer-promo{margin:1.8rem auto 0;max-width:360px;background:#fff;border:2px dashed #7c3aed;border-radius:16px;padding:1.1rem}
  .offer-promo-label{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7c3aed}
  .offer-code{font-size:1.7rem;font-weight:900;letter-spacing:.08em;color:#1a202c;margin:.3rem 0}
  .offer-copy{font-size:.8rem;font-weight:700;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;padding:.3rem .7rem;cursor:pointer}
  .offer-promo-hint{font-size:.8rem;color:#718096;margin-top:.5rem}
  .offer-cta-row{display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap;margin-top:1.8rem}
  .offer-cta{background:#7c3aed;color:#fff;font-weight:800;text-decoration:none;padding:.85rem 1.6rem;border-radius:12px;font-size:1.02rem;box-shadow:0 8px 24px rgba(124,58,237,.28)}
  .offer-cta2{color:#5a3da8;font-weight:700;text-decoration:none;padding:.85rem 1.2rem;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff}
  .offer-trust{font-size:.85rem;color:#94a3b8;margin-top:1.2rem}
  .offer-benefits{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.3rem;padding-top:3rem;padding-bottom:1rem}
  .offer-b{display:flex;gap:.9rem;align-items:flex-start}
  .offer-b-i{font-size:1.7rem;line-height:1}.offer-b h3{font-size:1.05rem;color:#1a202c;margin:0 0 .25rem}.offer-b p{font-size:.92rem;color:#4a5568;line-height:1.55;margin:0}
  .offer-final{text-align:center;padding:3.5rem 1.4rem 4.5rem}.offer-final h2{font-size:clamp(1.5rem,3vw,2.1rem);font-weight:900;color:#1a202c;margin:0 0 1.4rem}
  `;

  return htmlResponse(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Get your business online with Caddisfly — free to build', description: 'AI-built professional websites for local businesses in Orlando & Melbourne, FL. Live in minutes, free to start.', origin, path: '/offer' })}
  <style>${baseCss()}${css}</style></head>
  <body>${siteHeader('/offer')}<main>${inner}</main>${siteFooter({ lang: 'en' })}</body></html>`);
}
