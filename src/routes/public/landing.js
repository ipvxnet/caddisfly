// Landing / home page — marketing home with two paths: Build with AI + Refactor.

import { htmlResponse } from '../../utils/response.js';
import { headTags } from '../../components/brand.js';

// Inline brand mark (continuous-wing "C", brand gradient). Reused in header/hero/footer.
function brandMark(id, cls = '', animated = false) {
  const anim = animated
    ? `<style>
        @keyframes ${id}-draw{0%{stroke-dashoffset:520}45%{stroke-dashoffset:0}80%{stroke-dashoffset:0}100%{stroke-dashoffset:520}}
        @keyframes ${id}-pop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
        #${id} .w,#${id} .v{stroke-dasharray:520;animation:${id}-draw 3.4s ease-in-out infinite}
        #${id} .v{animation-delay:.15s}
        #${id} .d{transform-box:fill-box;transform-origin:center;animation:${id}-pop 3.4s ease infinite}
        #${id} .a{transform-box:fill-box;transform-origin:center;animation:${id}-pop 3.4s ease infinite;animation-delay:.25s}
        @media (prefers-reduced-motion:reduce){#${id} .w,#${id} .v,#${id} .d,#${id} .a{animation:none;stroke-dashoffset:0;opacity:1;transform:none}}
      </style>`
    : '';
  return `<svg id="${id}" class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Caddisfly">
    <defs><linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#667eea"/><stop offset="0.55" stop-color="#764ba2"/><stop offset="1" stop-color="#f093fb"/>
    </linearGradient>${anim}</defs>
    <path class="w" d="M88 34 C 58 18, 26 34, 26 64 C 26 92, 56 104, 84 92" fill="none" stroke="url(#${id}-g)" stroke-width="9" stroke-linecap="round"/>
    <path class="v" d="M40 58 C 56 64, 70 70, 84 80" fill="none" stroke="url(#${id}-g)" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
    <circle class="d" cx="92" cy="30" r="6.5" fill="url(#${id}-g)"/>
    <path class="a" d="M92 24 C 96 14, 102 11, 108 11" fill="none" stroke="url(#${id}-g)" stroke-width="3.4" stroke-linecap="round"/>
  </svg>`;
}

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23667eea'/%3E%3Cstop offset='.55' stop-color='%23764ba2'/%3E%3Cstop offset='1' stop-color='%23f093fb'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M88 34 C 58 18, 26 34, 26 64 C 26 92, 56 104, 84 92' fill='none' stroke='url(%23g)' stroke-width='9' stroke-linecap='round'/%3E%3Ccircle cx='92' cy='30' r='6.5' fill='url(%23g)'/%3E%3Cpath d='M92 24 C 96 14, 102 11, 108 11' fill='none' stroke='url(%23g)' stroke-width='3.4' stroke-linecap='round'/%3E%3C/svg%3E";

/**
 * Handle landing page
 * @param {object} ctx - Request context
 * @returns {Response} HTML response
 */
export async function handleLanding(ctx) {
  const origin = (ctx && ctx.url && ctx.url.origin) || (ctx && ctx.env && ctx.env.APP_URL) || '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({
    title: 'Caddisfly — Build a beautiful website with AI',
    description: 'Build a brand-new website by chatting with AI, or instantly refactor your existing site into a clean, modern design. Multi-page, on-brand, SEO-ready, and ready to publish.',
    origin,
    path: '/',
  })}
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{
      --p1:#667eea; --p2:#764ba2; --p3:#f093fb;
      --grad:linear-gradient(135deg,var(--p1) 0%,var(--p2) 55%,var(--p3) 100%);
      --ink:#0f1222; --body:#475067; --muted:#8a93a8; --line:#e9ecf5; --bg:#ffffff; --soft:#f7f8fc;
    }
    html{scroll-behavior:smooth}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--body);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
    a{color:inherit;text-decoration:none}
    .wrap{max-width:1140px;margin:0 auto;padding:0 1.5rem}
    .grad-text{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}

    /* Header */
    header.site{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.82);backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--line)}
    .nav{display:flex;align-items:center;justify-content:space-between;height:68px}
    .brand{display:flex;align-items:center;gap:.55rem;font-weight:800;font-size:1.15rem;color:var(--ink)}
    .brand svg{width:30px;height:30px}
    .brand .ai{color:var(--muted);font-weight:700}
    .nav-links{display:flex;align-items:center;gap:1.75rem}
    .nav-links a{font-weight:600;font-size:.93rem;color:var(--body)}
    .nav-links a:hover{color:var(--ink)}
    .btn{display:inline-flex;align-items:center;gap:.45rem;font-weight:700;border-radius:11px;padding:.7rem 1.25rem;cursor:pointer;border:none;font-size:.95rem;transition:transform .15s,box-shadow .15s,filter .15s;font-family:inherit}
    .btn-primary{background:var(--grad);color:#fff;box-shadow:0 8px 22px rgba(118,75,162,.28)}
    .btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(118,75,162,.36)}
    .btn-ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line)}
    .btn-ghost:hover{border-color:var(--p1);color:var(--p2)}
    .nav .btn{padding:.55rem 1.05rem}

    /* Hero */
    .hero{position:relative;text-align:center;padding:5.5rem 0 4rem;overflow:hidden}
    .hero::before{content:'';position:absolute;inset:-30% 0 auto 0;height:600px;background:
      radial-gradient(540px 340px at 50% 0,rgba(118,75,162,.16),transparent 70%),
      radial-gradient(420px 300px at 80% 10%,rgba(240,147,251,.14),transparent 70%),
      radial-gradient(420px 300px at 18% 12%,rgba(102,126,234,.16),transparent 70%);
      z-index:-1}
    .hero .mark{width:84px;height:84px;margin:0 auto 1.4rem;display:block}
    .eyebrow{display:inline-block;font-weight:700;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--p2);background:rgba(118,75,162,.08);border:1px solid rgba(118,75,162,.16);padding:.35rem .8rem;border-radius:999px;margin-bottom:1.3rem}
    .hero h1{font-size:clamp(2.4rem,5.6vw,4rem);line-height:1.07;font-weight:900;color:var(--ink);letter-spacing:-.02em;margin-bottom:1.1rem}
    .hero p.sub{font-size:clamp(1.05rem,2.2vw,1.3rem);color:var(--body);max-width:680px;margin:0 auto 2rem}
    .hero-cta{display:flex;gap:.85rem;justify-content:center;flex-wrap:wrap}
    .hero-cta .btn{padding:.9rem 1.6rem;font-size:1.02rem}
    .trust{margin-top:1.6rem;color:var(--muted);font-size:.86rem}

    /* Section shell */
    section.block{padding:4.5rem 0}
    .sec-head{text-align:center;max-width:680px;margin:0 auto 2.6rem}
    .sec-head h2{font-size:clamp(1.8rem,3.4vw,2.5rem);font-weight:800;color:var(--ink);letter-spacing:-.01em;margin-bottom:.7rem}
    .sec-head p{font-size:1.08rem;color:var(--body)}

    /* Two paths */
    #paths{background:var(--soft);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .paths{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}
    .card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:2.1rem;display:flex;flex-direction:column;box-shadow:0 2px 14px rgba(15,18,34,.04)}
    .card .tag{align-self:flex-start;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--grad);padding:.3rem .7rem;border-radius:999px;margin-bottom:1rem}
    .card .tag.alt{color:var(--p2);background:rgba(118,75,162,.1)}
    .card h3{font-size:1.5rem;font-weight:800;color:var(--ink);margin-bottom:.5rem}
    .card .lead{color:var(--body);margin-bottom:1.4rem;flex:0 0 auto}
    .card ul{list-style:none;margin:0 0 1.6rem;display:grid;gap:.55rem}
    .card li{position:relative;padding-left:1.6rem;font-size:.95rem}
    .card li::before{content:'✓';position:absolute;left:0;color:var(--p2);font-weight:800}
    .card .spacer{flex:1 1 auto}
    .field{margin-bottom:.9rem}
    .field label{display:block;font-weight:600;font-size:.85rem;color:var(--ink);margin-bottom:.35rem}
    .field input{width:100%;padding:.8rem .9rem;border:1.5px solid var(--line);border-radius:10px;font-size:1rem;font-family:inherit;transition:border-color .15s}
    .field input:focus{outline:none;border-color:var(--p1)}
    .field input.error{border-color:#e53e3e}
    .err{color:#e53e3e;font-size:.82rem;margin-top:.3rem;display:none}
    .err.show{display:block}
    .btn-full{width:100%;justify-content:center}
    .form-note{font-size:.82rem;color:var(--muted);margin-top:.7rem;text-align:center}
    .alert{border-radius:11px;padding:.9rem 1rem;font-size:.92rem;margin-top:1rem;display:none}
    .alert.show{display:block}
    .alert.ok{background:#f0fff4;border:1px solid #9ae6b4;color:#22543d}
    .alert.bad{background:#fff5f5;border:1px solid #feb2b2;color:#822727}
    .spin{display:none;width:18px;height:18px;border:2.5px solid rgba(255,255,255,.5);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite}
    .spin.show{display:inline-block}
    @keyframes spin{to{transform:rotate(360deg)}}

    /* Steps */
    .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}
    .step{text-align:center;padding:1rem}
    .step .n{width:46px;height:46px;border-radius:13px;background:var(--grad);color:#fff;font-weight:800;font-size:1.2rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem}
    .step h4{color:var(--ink);font-size:1.15rem;font-weight:700;margin-bottom:.35rem}

    /* Features */
    #features{background:var(--soft);border-top:1px solid var(--line)}
    .feats{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2rem}
    .feat{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem}
    .feat .ic{font-size:1.5rem;margin-bottom:.6rem}
    .feat h4{color:var(--ink);font-size:1.05rem;font-weight:700;margin-bottom:.3rem}
    .feat p{font-size:.92rem}

    /* CTA banner */
    .cta-band{background:var(--grad);border-radius:24px;padding:3rem 2rem;text-align:center;color:#fff;margin:1rem 0}
    .cta-band h2{font-size:clamp(1.7rem,3.2vw,2.3rem);font-weight:800;margin-bottom:.5rem}
    .cta-band p{opacity:.92;margin-bottom:1.6rem;font-size:1.05rem}
    .cta-band .btn{background:#fff;color:var(--p2)}
    .cta-band .btn:hover{transform:translateY(-2px)}

    /* Footer */
    footer.site{border-top:1px solid var(--line);padding:2.2rem 0;color:var(--muted);font-size:.9rem}
    .foot{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
    .foot .brand{font-size:1rem;color:var(--ink)}
    .foot .brand svg{width:24px;height:24px}
    .foot-links a{color:var(--body);font-weight:600}.foot-links a:hover{color:var(--p2)}

    @media (max-width:820px){
      .nav-links a:not(.btn){display:none}
      .paths,.steps,.feats{grid-template-columns:1fr}
      section.block{padding:3.2rem 0}
      .hero{padding:3.5rem 0 2.5rem}
    }
  </style>
</head>
<body>
  <header class="site">
    <div class="wrap nav">
      <a class="brand" href="/">${brandMark('m-hd')}<span>caddisfly<span class="ai">.ai</span></span></a>
      <nav class="nav-links">
        <a href="#paths">How it works</a>
        <a href="/pricing">Pricing</a>
        <a href="#features">Features</a>
        <a href="/dashboard">Dashboard</a>
        <a class="btn btn-primary" href="/ai-builder">Build with AI →</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="wrap">
        <div class="mark">${brandMark('m-hero', '', true)}</div>
        <span class="eyebrow">AI website builder</span>
        <h1>Launch a <span class="grad-text">beautiful website</span><br>in minutes — with AI.</h1>
        <p class="sub">Chat with AI to build a brand-new, multi-page site — or instantly refactor your existing website into a clean, modern design. On-brand, customizable, ready to publish.</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="/ai-builder">✨ Build with AI</a>
          <a class="btn btn-ghost" href="#refactor">Refactor my site</a>
        </div>
        <div class="trust">No code. No templates to wrestle with. Free preview.</div>
      </div>
    </section>

    <section id="paths" class="block">
      <div class="wrap">
        <div class="sec-head">
          <h2>Two ways to get a great site</h2>
          <p>Start from a conversation, or start from your current site. Either way you get a modern, editable result.</p>
        </div>
        <div class="paths">
          <div class="card">
            <span class="tag">Showcase</span>
            <h3>Build with AI</h3>
            <p class="lead">Describe your business in plain words. AI asks a few smart questions, then generates a full multi-page website — copy, layout, and real photos included.</p>
            <ul>
              <li>Conversational, no forms to fill in</li>
              <li>Multi-page with real navigation</li>
              <li>Live editing &amp; AI tweaks per section</li>
              <li>Themes, fonts &amp; colors in a click</li>
              <li>🔎 Auto-SEO — titles, descriptions &amp; markup written for you</li>
            </ul>
            <div class="spacer"></div>
            <a class="btn btn-primary btn-full" href="/ai-builder">Start building →</a>
            <p class="form-note">Takes about a minute to first preview.</p>
          </div>

          <div class="card" id="refactor">
            <span class="tag alt">Refactor</span>
            <h3>Refactor your site</h3>
            <p class="lead">Already have a website? Paste your URL and we'll rebuild it into a clean, modern design using your real business details — with SEO generated automatically.</p>
            <form id="refactor-form" novalidate>
              <div class="field">
                <label for="email">Your email</label>
                <input type="email" id="email" name="email" placeholder="you@example.com" autocomplete="email">
                <div class="err" id="email-err"></div>
              </div>
              <div class="field">
                <label for="website">Your website URL</label>
                <input type="text" id="website" name="website" placeholder="https://yourbusiness.com" autocomplete="url">
                <div class="err" id="website-err"></div>
              </div>
              <div class="field" style="display:flex;align-items:flex-start;gap:.5rem">
                <input type="checkbox" id="refactor-agree" style="width:auto;margin-top:.25rem;flex:none">
                <label for="refactor-agree" style="font-weight:500;margin:0;cursor:pointer;font-size:.9rem">I agree to the <a href="/terms" target="_blank">Terms of Service</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</label>
              </div>
              <button type="submit" class="btn btn-primary btn-full" id="refactor-btn">
                <span id="refactor-label">Get my free preview</span>
                <span class="spin" id="refactor-spin"></span>
              </button>
              <p class="form-note">We'll email you a link to confirm and build your preview.</p>
            </form>
            <div class="alert ok" id="refactor-ok"></div>
            <div class="alert bad" id="refactor-bad"></div>
          </div>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="wrap">
        <div class="sec-head"><h2>How it works</h2></div>
        <div class="steps">
          <div class="step"><div class="n">1</div><h4>Tell us about you</h4><p>Answer a few questions, or paste your existing site.</p></div>
          <div class="step"><div class="n">2</div><h4>AI builds your pages</h4><p>A full multi-page site with on-brand copy, layout &amp; images.</p></div>
          <div class="step"><div class="n">3</div><h4>Customize &amp; publish</h4><p>Tweak anything with live AI editing, then go live in one click.</p></div>
        </div>
      </div>
    </section>

    <section id="features" class="block">
      <div class="wrap">
        <div class="sec-head"><h2>Everything you need to ship</h2></div>
        <div class="feats">
          <div class="feat"><div class="ic">🗂️</div><h4>Multi-page sites</h4><p>Home, About, Services, Contact &amp; more — with real navigation.</p></div>
          <div class="feat"><div class="ic">🔎</div><h4>Auto-SEO</h4><p>Every site ships search-ready — page titles, meta descriptions, social cards, sitemaps &amp; Google business markup, generated automatically. Tweak any page, or let it run on autopilot.</p></div>
          <div class="feat"><div class="ic">✨</div><h4>AI section editing</h4><p>Chat to rewrite copy or generate new images, right in the editor.</p></div>
          <div class="feat"><div class="ic">🎨</div><h4>Themes &amp; fonts</h4><p>Switch the whole look — light, dark, gold — in a single click.</p></div>
          <div class="feat"><div class="ic">🖼️</div><h4>Real photos</h4><p>On-brand imagery pulled in automatically, or generate your own.</p></div>
          <div class="feat"><div class="ic">📱</div><h4>Responsive</h4><p>Looks sharp on every screen, out of the box.</p></div>
          <div class="feat"><div class="ic">🚀</div><h4>One-click publish</h4><p>Push your site live to a shareable URL when you're ready.</p></div>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="wrap">
        <div class="cta-band">
          <h2>Ready to build?</h2>
          <p>Start with AI in under a minute — completely free to preview.</p>
          <a class="btn" href="/ai-builder">✨ Build with AI</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="site">
    <div class="wrap foot">
      <a class="brand" href="/">${brandMark('m-ft')}<span>caddisfly<span class="ai">.ai</span></span></a>
      <span class="foot-links"><a href="/pricing">Pricing</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/billing">Billing</a></span>
      <span>© 2026 Caddisfly. Build beautiful websites with AI.</span>
    </div>
  </footer>

  <script>
    (function(){
      var form = document.getElementById('refactor-form');
      if (!form) return;
      var emailInput = document.getElementById('email');
      var siteInput = document.getElementById('website');
      var emailErr = document.getElementById('email-err');
      var siteErr = document.getElementById('website-err');
      var btn = document.getElementById('refactor-btn');
      var label = document.getElementById('refactor-label');
      var spin = document.getElementById('refactor-spin');
      var ok = document.getElementById('refactor-ok');
      var bad = document.getElementById('refactor-bad');

      function isEmail(v){ return v && v.indexOf('@') > 0 && v.length > 3; }
      function isUrl(v){
        try { var u = new URL(v.indexOf('http') === 0 ? v : 'https://' + v); return u.protocol === 'http:' || u.protocol === 'https:'; }
        catch(e){ return false; }
      }

      form.addEventListener('submit', async function(e){
        e.preventDefault();
        [emailErr, siteErr].forEach(function(el){ el.classList.remove('show'); });
        [emailInput, siteInput].forEach(function(el){ el.classList.remove('error'); });
        ok.classList.remove('show'); bad.classList.remove('show');

        var email = emailInput.value.trim();
        var website = siteInput.value.trim();
        var bad1 = false;
        if (!isEmail(email)) { emailErr.textContent = 'Please enter a valid email.'; emailErr.classList.add('show'); emailInput.classList.add('error'); bad1 = true; }
        if (!isUrl(website)) { siteErr.textContent = 'Please enter a valid website URL.'; siteErr.classList.add('show'); siteInput.classList.add('error'); bad1 = true; }
        if (!document.getElementById('refactor-agree').checked) { bad.textContent = 'Please agree to the Terms of Service and Privacy Policy to continue.'; bad.classList.add('show'); bad1 = true; }
        if (bad1) return;

        btn.disabled = true; label.textContent = 'Sending…'; spin.classList.add('show');
        try {
          var res = await fetch('/api/preview/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, website: website, use_templates: 1, accepted_terms: true })
          });
          var data = await res.json();
          if (data.success) {
            var html = data.message || 'Check your email to confirm and build your preview.';
            if (data.previewUrl) { html += '<br><br><a href="' + data.previewUrl + '" target="_blank" style="font-weight:700;color:#22543d">View your preview now →</a>'; }
            ok.innerHTML = html; ok.classList.add('show');
            form.reset();
          } else {
            bad.textContent = data.error || 'Something went wrong. Please try again.';
            bad.classList.add('show');
          }
        } catch(err) {
          bad.textContent = 'Network error. Please check your connection and try again.';
          bad.classList.add('show');
        } finally {
          btn.disabled = false; label.textContent = 'Get my free preview'; spin.classList.remove('show');
        }
      });
    })();
  </script>
</body>
</html>`;

  return htmlResponse(html);
}
