// Terms of Service + Acceptable Use Policy (/terms).
// Industry-standard SaaS website-builder terms. NOTE: this is a practical
// template, not legal advice — have counsel review before relying on it.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';

const LAST_UPDATED = 'June 1, 2026';

export async function handleTerms(ctx) {
  const origin = (ctx && ctx.url && ctx.url.origin) || (ctx && ctx.env && ctx.env.APP_URL) || '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Terms of Service — Caddisfly', description: 'The terms governing your use of Caddisfly, including our Acceptable Use Policy, billing, and account terms.', origin })}
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
    .toc{background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:1.2rem 1.4rem;margin-bottom:2rem}
    .toc h2{margin:0 0 .5rem;font-size:1rem}
    .toc ol{margin-left:1.2rem}
    .toc a{font-size:.92rem}
    .callout{border-left:4px solid var(--p2);background:#faf8ff;border-radius:8px;padding:1rem 1.2rem;margin:1rem 0}
    .danger{border-left:4px solid #dc2626;background:#fef2f2;border-radius:8px;padding:1rem 1.2rem;margin:1rem 0}
    .danger strong{color:#991b1b}
  </style>
</head>
<body>
  ${siteHeader('/terms')}
  <main><div class="legal">
    <h1>Terms of Service</h1>
    <p class="updated">Last updated: ${LAST_UPDATED}</p>

    <div class="callout">These Terms govern your access to and use of Caddisfly. By creating a site, signing in, or purchasing a plan, you agree to them. Please read the <a href="#aup">Acceptable Use Policy</a> carefully — it lists content and conduct that is strictly prohibited.</div>

    <div class="toc">
      <h2>Contents</h2>
      <ol>
        <li><a href="#acceptance">Acceptance of these Terms</a></li>
        <li><a href="#service">The service</a></li>
        <li><a href="#accounts">Accounts &amp; eligibility</a></li>
        <li><a href="#aup">Acceptable Use Policy</a></li>
        <li><a href="#ai">AI-generated content</a></li>
        <li><a href="#content">Your content &amp; ownership</a></li>
        <li><a href="#billing">Plans, billing &amp; AI credits</a></li>
        <li><a href="#free">Free accounts, fair use &amp; rate limits</a></li>
        <li><a href="#termination">Suspension, termination &amp; refunds</a></li>
        <li><a href="#dmca">Copyright &amp; DMCA</a></li>
        <li><a href="#warranty">Disclaimers</a></li>
        <li><a href="#liability">Limitation of liability</a></li>
        <li><a href="#indemnity">Indemnification</a></li>
        <li><a href="#privacy">Privacy</a></li>
        <li><a href="#changes">Changes to these Terms</a></li>
        <li><a href="#law">Governing law &amp; disputes</a></li>
        <li><a href="#contact">Contact</a></li>
      </ol>
    </div>

    <h2 id="acceptance">1. Acceptance of these Terms</h2>
    <p>These Terms of Service ("Terms") are a binding agreement between you and Caddisfly ("Caddisfly", "we", "us"). By accessing or using our websites, builder, hosting, APIs, and related services (collectively, the "Service"), you agree to these Terms and our <a href="#privacy">Privacy practices</a>. If you are using the Service on behalf of an organization, you represent that you are authorized to bind that organization.</p>

    <h2 id="service">2. The service</h2>
    <p>Caddisfly is an AI-assisted website builder and hosting platform. We let you generate, customize, publish, and host websites, including on Caddisfly subdomains and (on eligible plans) your own custom domains. We may add, change, or remove features at any time. We strive for high availability but do not guarantee the Service will be uninterrupted or error-free.</p>

    <h2 id="accounts">3. Accounts &amp; eligibility</h2>
    <ul>
      <li>You must be at least 18 years old, or the age of majority in your jurisdiction, to enter into these Terms.</li>
      <li>You are responsible for activity that occurs under your account and for keeping your sign-in (including magic-link email access) secure.</li>
      <li>You must provide accurate information and a valid email address. One person or entity may not maintain multiple free accounts to evade limits.</li>
      <li>You are responsible for the sites you publish, including their content, the products or services they advertise, and their compliance with applicable laws.</li>
    </ul>

    <h2 id="aup">4. Acceptable Use Policy</h2>
    <p>You agree not to use the Service — including the AI builder, hosting, or published sites — to create, store, distribute, promote, facilitate, or link to any of the following. We may screen prompts and content, and our AI will refuse requests that violate this policy.</p>

    <div class="danger"><strong>Zero tolerance — child sexual abuse material (CSAM) &amp; child exploitation.</strong> Any content that sexualizes, exploits, or endangers minors is absolutely prohibited. We will immediately terminate the account, preserve evidence, and report to law enforcement and the National Center for Missing &amp; Exploited Children (NCMEC) or equivalent authorities. No refund applies.</div>

    <h3>Strictly prohibited content</h3>
    <ul>
      <li><strong>Child exploitation</strong> of any kind, as described above.</li>
      <li><strong>Pornographic or sexually explicit material</strong>, adult-content services, escort or prostitution services, or other "adult"/NSFW content.</li>
      <li><strong>Illegal drugs and controlled substances</strong> — the sale, distribution, advertising, or facilitation of illegal drugs, drug paraphernalia, or unapproved/controlled pharmaceuticals.</li>
      <li><strong>Weapons</strong> — the unlicensed sale or distribution of firearms, ammunition, explosives, or other regulated weapons.</li>
      <li><strong>Hate, harassment &amp; violence</strong> — content that promotes hatred, harassment, or violence against people based on race, ethnicity, religion, gender, sexual orientation, disability, or other protected characteristics; or that incites, threatens, or glorifies violence, terrorism, or self-harm.</li>
      <li><strong>Illegal &amp; fraudulent activity</strong> — anything unlawful, including fraud, scams, phishing, pyramid or Ponzi schemes, money laundering, or the sale of stolen or counterfeit goods.</li>
      <li><strong>Malicious technology</strong> — malware, ransomware, spyware, or content designed to disrupt, gain unauthorized access to, or harm any system or data; and unsolicited bulk email (spam).</li>
      <li><strong>Intellectual-property infringement</strong> — content that infringes others' copyrights, trademarks, or other rights.</li>
      <li><strong>Regulated activities</strong> — unlicensed gambling, financial, legal, or medical services where prohibited by law.</li>
      <li><strong>Privacy violations</strong> — publishing others' personal or confidential information without authorization (doxxing).</li>
      <li><strong>Impersonation &amp; deception</strong> — impersonating a person or organization, or misrepresenting your affiliation.</li>
    </ul>

    <h3>Prohibited conduct</h3>
    <ul>
      <li>Attempting to bypass, disable, or circumvent usage limits, rate limits, billing, or security controls.</li>
      <li>Reverse engineering, scraping, or overloading the Service, or using it to build a competing product.</li>
      <li>Reselling, sublicensing, or providing the Service to third parties except as expressly permitted by your plan.</li>
      <li>Using automated means to abuse free credits, free accounts, or trials.</li>
    </ul>
    <p>We may, at our discretion, remove content, disable sites, or suspend or terminate accounts that violate this policy, with or without notice depending on severity.</p>

    <h2 id="ai">5. AI-generated content</h2>
    <ul>
      <li>The Service uses AI models to generate text, images, and layouts based on your input. <strong>You are responsible for reviewing AI output</strong> before publishing and for ensuring it is accurate, lawful, and appropriate for your business.</li>
      <li>AI output may be inaccurate, generic, or unintentionally similar to other content. We make no warranty as to its accuracy, originality, or fitness for any purpose.</li>
      <li>We enforce the <a href="#aup">Acceptable Use Policy</a> at the prompt level: the AI will decline to generate prohibited content, and repeated attempts to elicit such content may result in suspension.</li>
      <li>Subject to your compliance with these Terms, you may use the AI output for your site; you are responsible for obtaining any rights needed for materials you supply (logos, photos, text).</li>
    </ul>

    <h2 id="content">6. Your content &amp; ownership</h2>
    <p>You retain ownership of the content you create or upload ("Your Content"). You grant Caddisfly a worldwide, non-exclusive license to host, store, reproduce, and display Your Content solely to operate and provide the Service (for example, serving your published site). You represent that you have the rights to Your Content and that it does not violate these Terms or any law.</p>

    <h2 id="billing">7. Plans, billing &amp; AI credits</h2>
    <ul>
      <li><strong>Subscriptions</strong> (Starter, Pro, Agency) are billed in advance on a recurring monthly or annual basis through our payment processor (Stripe) and <strong>renew automatically</strong> until cancelled. You can cancel anytime from the billing portal; cancellation takes effect at the end of the current period.</li>
      <li><strong>AI credits</strong> meter AI usage (site generation, AI edits, image generation, enrichment). Each plan includes a monthly allotment that resets each billing cycle and does not roll over. <strong>One-time credit top-ups</strong> are purchased separately and do not expire.</li>
      <li><strong>Taxes</strong> may apply and are your responsibility where required.</li>
      <li><strong>Price changes</strong> apply to future billing periods; we will give reasonable notice of material changes.</li>
      <li>Except as stated in Section 9 or required by law, fees are non-refundable, and partial-period subscriptions, unused credits, and add-ons are not refundable.</li>
    </ul>

    <h2 id="free">8. Free accounts, fair use &amp; rate limits</h2>
    <ul>
      <li>Free accounts are provided "as is" with limited features, storage, AI credits, and a single published site on a Caddisfly subdomain.</li>
      <li><strong>Free accounts may be rate-limited, throttled, queued, or temporarily restricted</strong> when overall traffic is high, when a site consumes disproportionate resources, or when we observe abuse, automated activity, or attempts to evade limits.</li>
      <li>Free accounts carry no uptime or support commitment, and we may modify or discontinue the free tier at any time.</li>
      <li>Fair use applies to all plans: even on paid plans, "unlimited" features are subject to reasonable, good-faith use and may be limited to prevent abuse or protect the Service.</li>
    </ul>

    <h2 id="termination">9. Suspension, termination &amp; refunds</h2>
    <ul>
      <li><strong>By you.</strong> You may stop using the Service and cancel your subscription at any time from the billing portal.</li>
      <li><strong>By us, for convenience.</strong> Caddisfly reserves the right to suspend or terminate the Service, or any account, at its discretion. <strong>If we terminate a paid subscription for our convenience (not for your breach), we will refund the unused, prepaid portion of your subscription on a pro-rata basis.</strong></li>
      <li><strong>By us, for cause.</strong> We may suspend or terminate immediately and without refund if you breach these Terms or the Acceptable Use Policy, fail to pay, or create legal or security risk. For violations involving illegal content (including child exploitation), termination is immediate and no refund applies.</li>
      <li><strong>Effect of termination.</strong> Your right to use the Service ends, and we may delete your sites, content, and data after a reasonable period. Please export anything you wish to keep before cancelling. One-time credit purchases are non-refundable except where a pro-rata subscription refund applies under this section or as required by law.</li>
    </ul>

    <h2 id="dmca">10. Copyright &amp; DMCA</h2>
    <p>We respect intellectual-property rights. If you believe content on the Service infringes your copyright, send a notice with the required details (identification of the work, the infringing material and its URL, your contact information, a good-faith statement, and a statement under penalty of perjury) to our contact address below. We will respond to valid notices and may remove infringing material and terminate repeat infringers.</p>

    <h2 id="warranty">11. Disclaimers</h2>
    <p>THE SERVICE AND ALL AI OUTPUT ARE PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. We do not warrant that the Service will be uninterrupted, secure, or error-free, or that AI output will be accurate or reliable.</p>

    <h2 id="liability">12. Limitation of liability</h2>
    <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, CADDISFLY WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO THE SERVICE WILL NOT EXCEED THE AMOUNTS YOU PAID US IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM (OR USD $100 IF YOU USE THE FREE TIER).</p>

    <h2 id="indemnity">13. Indemnification</h2>
    <p>You agree to indemnify and hold Caddisfly harmless from claims, damages, liabilities, and expenses (including reasonable legal fees) arising out of your content, your sites, your use of the Service, or your violation of these Terms or any law or third-party right.</p>

    <h2 id="privacy">14. Privacy</h2>
    <p>We process personal data as described in our Privacy Policy. We use third-party processors (for example, payment, email, and cloud infrastructure providers) to operate the Service. You are responsible for handling any personal data you collect through your own sites in compliance with applicable law.</p>

    <h2 id="changes">15. Changes to these Terms</h2>
    <p>We may update these Terms from time to time. If we make material changes, we will update the "Last updated" date and, where appropriate, provide additional notice. Your continued use of the Service after changes take effect constitutes acceptance.</p>

    <h2 id="law">16. Governing law &amp; disputes</h2>
    <p>These Terms are governed by the laws of the jurisdiction in which Caddisfly is established, without regard to conflict-of-laws rules. You agree to resolve disputes in the courts of that jurisdiction, except where applicable law gives you the right to bring claims elsewhere. <em>[Specify the governing jurisdiction and any arbitration or class-action-waiver terms here before publishing.]</em></p>

    <h2 id="contact">17. Contact</h2>
    <p>Questions about these Terms or to report a violation: <a href="mailto:legal@caddisfly.ai">legal@caddisfly.ai</a>. Abuse reports: <a href="mailto:abuse@caddisfly.ai">abuse@caddisfly.ai</a>.</p>

    <p class="updated" style="margin-top:2.5rem">By using Caddisfly, you acknowledge that you have read and agree to these Terms and the Acceptable Use Policy.</p>
  </div></main>
  ${siteFooter()}
</body>
</html>`;

  return htmlResponse(html);
}
