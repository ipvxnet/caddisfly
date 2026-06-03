// GET /help — public documentation + FAQ. Covers building, customizing,
// publishing, custom domains/DNS, plans, and teams. Reuses the brand shell.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';

const TOC = [
  ['getting-started', 'Getting started'],
  ['customizing', 'Customizing your site'],
  ['publishing', 'Publishing'],
  ['custom-domains', 'Custom domains & DNS'],
  ['plans', 'Plans, credits & billing'],
  ['team', 'Team members'],
  ['faq', 'FAQ'],
];

const FAQS = [
  ['Is Caddisfly free to use?', 'Yes — you can build and preview a site for free, and publish one site on a free <code>*.caddisfly.app</code> subdomain. Paid plans add more sites, AI credits, custom domains, and team seats.'],
  ['How do I edit the text and images on my site?', 'Open <strong>Customize</strong> on your site, click a section, then <strong>✨ Edit</strong>. You can edit text directly, upload your own images, or describe a change and let AI apply it. Gallery photos can be reordered (drag), replaced, or removed individually.'],
  ['Can I add or remove sections?', 'Yes. In Customize, use <strong>+ Add section</strong> to add a new section (and pick its layout), or select a section and use the 🗑 button to remove it. Header and footer are shared across pages and can\'t be removed.'],
  ['How do I connect my own domain?', 'On a published site, open <strong>🌐 Custom domain</strong> (in Customize or on your Dashboard), enter a subdomain like <code>www.yourbusiness.com</code>, and add the single <strong>CNAME</strong> record we show you at your DNS provider. Your SSL certificate is issued automatically — see <a href="#custom-domains">Custom domains &amp; DNS</a>.'],
  ['Why should I use a subdomain (www) instead of my root domain?', 'A subdomain (<code>www.</code>, <code>shop.</code>, etc.) works at every DNS provider with a simple CNAME. A bare root domain (<code>yourbusiness.com</code>) can\'t use a CNAME by DNS rules — it needs ALIAS/CNAME-flattening, which some providers (e.g. GoDaddy, Namecheap) don\'t offer. If you only have the root, point <code>www</code> to us and set a redirect from the root to <code>www</code>.'],
  ['How long until my custom domain works?', 'After you add the CNAME, DNS propagation and SSL issuance usually take a few minutes. Click <strong>Check status</strong> in the domain panel; once it shows <strong>Active</strong>, your site is live over HTTPS.'],
  ['What are Caddi Credits?', 'Credits are spent on AI actions (generating content, AI image creation, AI edits). Each plan includes a monthly allotment that resets every month, plus you can buy one-time top-up credits that never expire.'],
  ['How do team members work?', 'Invite teammates by email from your <strong>Dashboard</strong>. They get a link that signs them in and joins your team, where they can access your websites. You (the owner) and any admins can invite, promote, or remove members. Seat limits: Starter 5, Pro 15, Agency 50 (including you).'],
  ['Can I get a refund?', 'Subscriptions can be cancelled anytime from <strong>Billing</strong> (you keep access until the period ends). For-convenience terminations are pro-rated per our <a href="/terms">Terms</a>.'],
  ['I need help or found a bug.', 'Open a ticket from <a href="/support">Support</a> — describe the issue or request and we\'ll get back to you by email.'],
];

function section(id, title, body) {
  return `<section id="${id}" class="hsec"><h2>${title}</h2>${body}</section>`;
}

export function handleHelp(ctx) {
  const origin = ctx.url.origin;

  const toc = `<nav class="htoc">${TOC.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>`;

  const faq = FAQS.map(
    ([q, a]) => `<details class="faq"><summary>${q}</summary><div class="faq-a">${a}</div></details>`
  ).join('');

  const inner = `
    <div class="hhead">
      <h1>Help &amp; documentation</h1>
      <p class="sub">Everything you need to build, customize, publish, and grow your site. Stuck? <a href="/support">Open a support ticket</a>.</p>
    </div>
    ${toc}

    ${section('getting-started', 'Getting started', `
      <p>There are two ways to create a site:</p>
      <ul>
        <li><strong>Build with AI</strong> — describe your business and AI generates a complete, on-brand website. Start at <a href="/ai-builder">Build with AI</a>.</li>
        <li><strong>Refactor an existing site</strong> — enter your current website URL and we rebuild it cleaner. You'll confirm your email, then we generate a preview.</li>
      </ul>
      <p>Both land you in the <strong>Customize</strong> editor with a live preview.</p>`)}

    ${section('customizing', 'Customizing your site', `
      <ul>
        <li><strong>Sections</strong> — click a section to select it, then <strong>✨ Edit</strong> (text, images, or AI-assisted changes). Drag the ⋮⋮ handle to reorder.</li>
        <li><strong>Add / remove</strong> — <strong>+ Add section</strong> adds a section and lets you choose its layout; the 🗑 button removes one. Header &amp; footer are site-wide.</li>
        <li><strong>Pages</strong> — add pages with the <strong>+ Page</strong> tab and move sections between them.</li>
        <li><strong>Gallery</strong> — open a gallery's editor to drag-reorder, replace, remove, or add individual photos (no AI re-roll needed).</li>
        <li><strong>Design</strong> — the 🎨 Design panel switches the whole-site theme, colors, and fonts at once.</li>
      </ul>`)}

    ${section('publishing', 'Publishing', `
      <p>Click <strong>Deploy Website</strong> in Customize. Your site goes live on a free address like <code>yourbusiness.caddisfly.app</code>, and we show you a clickable link. Re-deploy any time after making changes — re-publishing on a paid plan also removes the "Built with Caddisfly" badge.</p>`)}

    ${section('custom-domains', 'Custom domains & DNS', `
      <p>On a paid plan you can point your own domain at your site. Open <strong>🌐 Custom domain</strong> (in Customize or on your <a href="/dashboard">Dashboard</a>) and enter a domain.</p>
      <ol>
        <li><strong>Use a subdomain</strong> like <code>www.yourbusiness.com</code> — it works at any DNS provider.</li>
        <li>Add the single <strong>CNAME</strong> record we show you at your DNS provider (GoDaddy, Namecheap, Route 53, Cloudflare, etc.): <br>
          <code>www</code> &nbsp;→&nbsp; <code>sites.caddisfly.app</code></li>
        <li>That's it — your <strong>SSL certificate is issued automatically</strong> once the record is live (usually a few minutes). Click <strong>Check status</strong>; when it reads <strong>Active</strong>, you're live over HTTPS.</li>
      </ol>
      <p><strong>Root domains:</strong> a bare <code>yourbusiness.com</code> can't use a CNAME by DNS rules. If your provider supports ALIAS/ANAME or CNAME-flattening (Cloudflare, Route 53, DNSimple) you can use it; otherwise point <code>www</code> to us and redirect the root to <code>www</code> at your registrar.</p>`)}

    ${section('plans', 'Plans, credits & billing', `
      <ul>
        <li><strong>Plans</strong> — Free, Starter, Pro, Agency. Higher tiers add sites, AI credits, custom domains, and team seats. See <a href="/pricing">Pricing</a>.</li>
        <li><strong>Caddi Credits</strong> — spent on AI actions. Each plan includes a monthly allotment (resets monthly); one-time top-ups never expire.</li>
        <li><strong>Manage</strong> — upgrade, change plan, or cancel anytime from <a href="/billing">Billing</a>.</li>
      </ul>`)}

    ${section('team', 'Team members', `
      <p>Invite teammates from your <a href="/dashboard">Dashboard</a> → <strong>Team</strong>. They get an email link that signs them in and joins your team, where they can work on your websites.</p>
      <ul>
        <li><strong>Roles</strong> — the owner is admin; admins can invite, promote (member ↔ admin), and remove members.</li>
        <li><strong>Seats</strong> (including you): Starter 5 · Pro 15 · Agency 50.</li>
      </ul>`)}

    ${section('faq', 'FAQ', faq)}

    <div class="hcta">
      <p>Didn't find what you need?</p>
      <a class="btn btn-primary" href="/support">Open a support ticket →</a>
    </div>
  `;

  return htmlResponse(pageShell(origin, inner));
}

function pageShell(origin, inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Help & Docs — Caddisfly', description: 'Guides and FAQ for building, customizing, publishing, custom domains, plans, and teams on Caddisfly.', origin })}
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
  ${siteHeader('/help')}
  <main><div class="hwrap">${inner}</div></main>
  ${siteFooter()}
</body>
</html>`;
}
