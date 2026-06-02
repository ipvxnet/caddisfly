// Privacy Policy (/privacy). Companion to /terms. Industry-standard SaaS
// privacy notice. NOTE: a practical template, not legal advice — have counsel
// review and confirm your processors, jurisdiction, and retention periods.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';

const LAST_UPDATED = 'June 1, 2026';

export async function handlePrivacy(ctx) {
  const origin = (ctx && ctx.url && ctx.url.origin) || (ctx && ctx.env && ctx.env.APP_URL) || '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Privacy Policy — Caddisfly', description: 'How Caddisfly collects, uses, shares, and protects your personal information.', origin })}
  <style>
    ${baseCss()}
    .legal{max-width:820px;margin:0 auto;padding:3rem 1.5rem 4rem}
    .legal h1{font-size:clamp(2rem,4vw,2.8rem);font-weight:900;color:var(--ink);letter-spacing:-.02em;margin-bottom:.4rem}
    .legal .updated{color:var(--muted);font-size:.92rem;margin-bottom:2rem}
    .legal h2{font-size:1.3rem;font-weight:800;color:var(--ink);margin:2rem 0 .6rem;scroll-margin-top:80px}
    .legal h3{font-size:1.05rem;font-weight:700;color:var(--ink);margin:1.2rem 0 .4rem}
    .legal p,.legal li{color:var(--body);font-size:.97rem;line-height:1.7}
    .legal ul{margin:.5rem 0 .5rem 1.3rem}
    .legal li{margin-bottom:.35rem}
    .legal strong{color:var(--ink)}
    .legal a{color:var(--p2);font-weight:600}
    .legal table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.92rem}
    .legal th,.legal td{border:1px solid var(--line);padding:.6rem .7rem;text-align:left;vertical-align:top}
    .legal th{background:var(--soft);color:var(--ink);font-weight:700}
    .toc{background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:1.2rem 1.4rem;margin-bottom:2rem}
    .toc h2{margin:0 0 .5rem;font-size:1rem}
    .toc ol{margin-left:1.2rem}
    .toc a{font-size:.92rem}
    .callout{border-left:4px solid var(--p2);background:#faf8ff;border-radius:8px;padding:1rem 1.2rem;margin:1rem 0}
  </style>
</head>
<body>
  ${siteHeader('/privacy')}
  <main><div class="legal">
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: ${LAST_UPDATED}</p>

    <div class="callout">This Policy explains what personal information Caddisfly collects, how we use and share it, and the choices you have. It applies to our website, builder, hosting, and APIs (the "Service"). It works alongside our <a href="/terms">Terms of Service</a>.</div>

    <div class="toc">
      <h2>Contents</h2>
      <ol>
        <li><a href="#collect">Information we collect</a></li>
        <li><a href="#use">How we use information</a></li>
        <li><a href="#ai">AI processing</a></li>
        <li><a href="#cookies">Cookies &amp; analytics</a></li>
        <li><a href="#share">How we share information</a></li>
        <li><a href="#processors">Our service providers</a></li>
        <li><a href="#retention">Data retention</a></li>
        <li><a href="#rights">Your privacy rights</a></li>
        <li><a href="#security">Security</a></li>
        <li><a href="#intl">International transfers</a></li>
        <li><a href="#children">Children</a></li>
        <li><a href="#sites">Sites you build &amp; your visitors</a></li>
        <li><a href="#changes">Changes to this Policy</a></li>
        <li><a href="#contact">Contact</a></li>
      </ol>
    </div>

    <h2 id="collect">1. Information we collect</h2>
    <h3>Information you provide</h3>
    <ul>
      <li><strong>Account &amp; contact:</strong> your email address, used to create sites, sign in via magic link, and receive service emails.</li>
      <li><strong>Content:</strong> the prompts, text, images, files, and business details you enter or upload to build and customize your sites.</li>
      <li><strong>Refactor input:</strong> a website URL you ask us to analyze, and business details we retrieve to improve your site (see "From other sources").</li>
      <li><strong>Payment information:</strong> when you subscribe or buy credits, our payment processor (Stripe) collects your card and billing details. <strong>We do not store full card numbers</strong>; we receive limited information such as your billing email, plan, and payment status.</li>
      <li><strong>Communications:</strong> messages you send us (e.g., support or abuse reports).</li>
    </ul>
    <h3>Information collected automatically</h3>
    <ul>
      <li><strong>Usage &amp; log data:</strong> pages viewed, features used, requests, timestamps, and approximate location derived from IP address.</li>
      <li><strong>Device data:</strong> browser type, device, and similar technical information.</li>
      <li><strong>Cookies:</strong> essential cookies for sign-in/session and billing, and limited analytics — see <a href="#cookies">Cookies &amp; analytics</a>.</li>
    </ul>
    <h3>From other sources</h3>
    <ul>
      <li><strong>Business data providers:</strong> when you request site generation or enrichment, we may retrieve public business information (e.g., from Google Places) such as name, address, hours, photos, and reviews to populate your site.</li>
      <li><strong>Authentication providers:</strong> if you sign in as an administrator with Google, we receive basic profile information (name, email, avatar).</li>
    </ul>

    <h2 id="use">2. How we use information</h2>
    <ul>
      <li>Provide, operate, and maintain the Service, including generating and hosting your sites.</li>
      <li>Process payments, manage subscriptions, and meter AI credit usage.</li>
      <li>Communicate with you about your account, security, and updates.</li>
      <li>Protect the Service: detect, prevent, and respond to fraud, abuse, and security or Acceptable-Use violations.</li>
      <li>Analyze and improve the Service, including aggregate usage analytics.</li>
      <li>Comply with legal obligations and enforce our <a href="/terms">Terms</a>.</li>
    </ul>

    <h2 id="ai">3. AI processing</h2>
    <p>The Service uses AI models to generate text, images, and layouts from the prompts and content you provide. Your inputs are processed by our AI infrastructure (currently Cloudflare Workers AI) to produce output for your site. We screen prompts for prohibited content per our <a href="/terms#aup">Acceptable Use Policy</a>. Do not submit sensitive personal information you don't want processed to generate a website.</p>

    <h2 id="cookies">4. Cookies &amp; analytics</h2>
    <ul>
      <li><strong>Essential cookies</strong> keep you signed in (admin sessions and the billing sign-in cookie) and are required for the Service to work.</li>
      <li><strong>Analytics:</strong> we use privacy-respecting analytics to understand aggregate usage (such as page views and feature use) and improve the Service. We aim to use measurement that does not build advertising profiles of you.</li>
      <li>You can control cookies through your browser settings; blocking essential cookies may break sign-in.</li>
    </ul>

    <h2 id="share">5. How we share information</h2>
    <p>We do <strong>not sell</strong> your personal information. We share it only:</p>
    <ul>
      <li><strong>With service providers</strong> who process data on our behalf to run the Service (see below), under appropriate confidentiality and data-processing terms.</li>
      <li><strong>For legal reasons</strong> — to comply with law, respond to lawful requests, or protect the rights, safety, and security of users, the public, or Caddisfly (including reporting child-exploitation content to authorities).</li>
      <li><strong>In a business transfer</strong> — if Caddisfly is involved in a merger, acquisition, or sale of assets, subject to this Policy.</li>
      <li><strong>With your direction</strong> — for example, content you choose to publish on your live site.</li>
    </ul>

    <h2 id="processors">6. Our service providers</h2>
    <table>
      <tr><th>Provider</th><th>Purpose</th></tr>
      <tr><td>Cloudflare</td><td>Hosting, edge delivery, storage, and AI model inference</td></tr>
      <tr><td>Stripe</td><td>Payment processing and subscription billing</td></tr>
      <tr><td>Resend</td><td>Transactional &amp; sign-in emails</td></tr>
      <tr><td>Google (Places)</td><td>Public business information for site generation/enrichment</td></tr>
      <tr><td>Pexels</td><td>Stock imagery used in generated sites</td></tr>
      <tr><td>Google (OAuth)</td><td>Optional administrator sign-in</td></tr>
    </table>
    <p>These providers process information under their own terms and privacy policies. We work to use reputable providers with appropriate safeguards.</p>

    <h2 id="retention">7. Data retention</h2>
    <p>We retain your information for as long as your account is active or as needed to provide the Service, and afterwards as required to comply with legal obligations, resolve disputes, and enforce our agreements. When you delete your account or we terminate it, we delete or de-identify your personal information and site content within a reasonable period, except where retention is legally required. Please export anything you wish to keep before closing your account.</p>

    <h2 id="rights">8. Your privacy rights</h2>
    <p>Depending on where you live, you may have rights to:</p>
    <ul>
      <li>Access the personal information we hold about you, and request a copy (portability).</li>
      <li>Correct inaccurate information.</li>
      <li>Delete your information.</li>
      <li>Object to or restrict certain processing, and withdraw consent where processing is based on consent.</li>
      <li>Not be discriminated against for exercising your rights.</li>
    </ul>
    <p>If you are in the EEA/UK, we process personal data under legal bases including performance of a contract, legitimate interests, consent, and legal obligation. If you are a California resident, we do not sell or "share" your personal information for cross-context behavioral advertising. To exercise any right, contact us at <a href="mailto:privacy@caddisfly.ai">privacy@caddisfly.ai</a>; we may need to verify your identity.</p>

    <h2 id="security">9. Security</h2>
    <p>We use technical and organizational measures designed to protect your information, including encryption in transit and access controls. No method of transmission or storage is completely secure, and we cannot guarantee absolute security. Keep your email account secure, since magic-link sign-in relies on it.</p>

    <h2 id="intl">10. International transfers</h2>
    <p>Caddisfly runs on globally distributed infrastructure, so your information may be processed in countries other than your own. Where required, we rely on appropriate safeguards (such as standard contractual clauses) for international transfers.</p>

    <h2 id="children">11. Children</h2>
    <p>The Service is not directed to children, and you must be at least 18 (or the age of majority in your jurisdiction) to use it. We do not knowingly collect personal information from children. If you believe a child has provided us information, contact us and we will delete it.</p>

    <h2 id="sites">12. Sites you build &amp; your visitors</h2>
    <p>When you publish a site with Caddisfly, you are responsible for the content of that site and for any personal information you collect from your visitors. For data you collect through your own site, you are the data controller and must provide your own privacy notices and comply with applicable laws. Caddisfly acts as a processor/host for that content.</p>

    <h2 id="changes">13. Changes to this Policy</h2>
    <p>We may update this Policy from time to time. We will update the "Last updated" date and, for material changes, provide additional notice where appropriate. Your continued use of the Service after changes take effect constitutes acceptance.</p>

    <h2 id="contact">14. Contact</h2>
    <p>Questions or requests regarding privacy: <a href="mailto:privacy@caddisfly.ai">privacy@caddisfly.ai</a>.</p>

    <p class="updated" style="margin-top:2.5rem">See also our <a href="/terms">Terms of Service</a>.</p>
  </div></main>
  ${siteFooter()}
</body>
</html>`;

  return htmlResponse(html);
}
