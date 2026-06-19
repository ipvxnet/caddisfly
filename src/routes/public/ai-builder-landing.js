// GET /ai-builder
// Landing page for AI website builder

import { translator } from '../../i18n/index.js';

/**
 * Handle AI builder landing page
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderLanding(ctx) {
  // Signed-in users (billing session) skip the email field — the server uses
  // their session identity in /api/ai-builder/create.
  const signedInEmail = ctx.billingEmail || '';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  // Optional prompt prefill (e.g. from a per-vertical SEO landing page).
  const prefill = (() => {
    try { return (ctx.url && ctx.url.searchParams.get('prefill')) || ''; } catch { return ''; }
  })().slice(0, 400);
  const html = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Website Builder - Caddisfly</title>
  <meta name="description" content="Build a professional website in minutes with AI. Just describe your business and let AI do the rest.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #2d3748;
    }

    .site-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem 2rem;
    }

    .site-header a {
      display: inline-flex;
      line-height: 0;
    }

    .site-header .nav-link {
      line-height: 1;
      color: #fff;
      font-weight: 600;
      font-size: .95rem;
      text-decoration: none;
      opacity: .92;
    }
    .site-header .nav-link:hover { opacity: 1; text-decoration: underline; }

    .site-header .logo {
      height: 40px;
      width: auto;
      display: block;
    }

    @keyframes cf-draw { 0% { stroke-dashoffset: 520 } 45% { stroke-dashoffset: 0 } 80% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: 520 } }
    @keyframes cf-pop { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
    .cf-wing { stroke-dasharray: 520; animation: cf-draw 3.4s ease-in-out infinite }
    .cf-vein { stroke-dasharray: 520; animation: cf-draw 3.4s ease-in-out infinite; animation-delay: .15s }
    .cf-dot { transform-box: fill-box; transform-origin: center; animation: cf-pop 3.4s ease infinite }
    .cf-ant { transform-box: fill-box; transform-origin: center; animation: cf-pop 3.4s ease infinite; animation-delay: .25s }
    @media (prefers-reduced-motion: reduce) {
      .cf-wing, .cf-vein, .cf-dot, .cf-ant { animation: none; stroke-dashoffset: 0; opacity: 1; transform: none }
    }

    .hero {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 2rem;
    }

    .hero-content {
      max-width: 800px;
    }

    h1 {
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 700;
      margin-bottom: 1.5rem;
      line-height: 1.2;
    }

    .subtitle {
      font-size: clamp(1.125rem, 2vw, 1.5rem);
      margin-bottom: 3rem;
      opacity: 0.95;
    }

    .cta-form {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 600px;
      margin: 0 auto;
    }

    .cta-form h2 {
      color: #1a202c;
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
      text-align: left;
    }

    .form-group label {
      display: block;
      color: #2d3748;
      font-weight: 600;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }

    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 0.875rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
      transition: border-color 0.3s;
    }

    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    .form-group textarea {
      resize: vertical;
      min-height: 100px;
    }

    .submit-btn {
      width: 100%;
      padding: 1rem 2rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1.125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    .submit-btn:hover {
      background: #5568d3;
      transform: translateY(-2px);
    }

    .submit-btn:disabled {
      background: #cbd5e0;
      cursor: not-allowed;
      transform: none;
    }

    .features {
      padding: 5rem 2rem;
      background: white;
      text-align: center;
    }

    .features h2 {
      font-size: 2.5rem;
      margin-bottom: 3rem;
      color: #1a202c;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .feature {
      padding: 2rem;
    }

    .feature-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .feature h3 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
      color: #1a202c;
    }

    .feature p {
      color: #4a5568;
    }

    .error {
      color: #e53e3e;
      background: #fff5f5;
      padding: 0.75rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      display: none;
    }

    .success {
      color: #38a169;
      background: #f0fff4;
      padding: 0.75rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      display: none;
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a href="/ai-builder" aria-label="Caddisfly home">
      <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 140" role="img" aria-label="caddisfly.ai">
        <g transform="translate(6 10)">
          <path class="cf-wing" d="M88 34 C 58 18, 26 34, 26 64 C 26 92, 56 104, 84 92" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/>
          <path class="cf-vein" d="M40 58 C 56 64, 70 70, 84 80" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.65"/>
          <circle class="cf-dot" cx="92" cy="30" r="6.5" fill="#ffffff"/>
          <path class="cf-ant" d="M92 24 C 96 14, 102 11, 108 11" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round"/>
        </g>
        <text x="146" y="95" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="66" font-weight="800" letter-spacing="-2.5">
          <tspan fill="#ffffff">caddisfly</tspan><tspan fill="#ffffff" opacity="0.7">.ai</tspan>
        </text>
      </svg>
    </a>
    <a class="nav-link" href="/dashboard">🏠 Dashboard</a>
  </header>
  <section class="hero">
    <div class="hero-content">
      <h1>${tr('builder.title')}</h1>
      <p class="subtitle">${tr('builder.subtitle')}</p>

      <div class="cta-form">
        <h2>${tr('builder.get_started')}</h2>
        <div id="error" class="error"></div>
        <div id="success" class="success"></div>
        <form id="start-form">
          ${signedInEmail ? `
          <div class="form-group">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:.7rem .9rem;font-size:.92rem;color:#166534">
              ✓ ${tr('builder.signed_in_as')} <strong>${esc(signedInEmail)}</strong>
            </div>
          </div>` : `
          <div class="form-group">
            <label for="email">${tr('builder.email_label')}</label>
            <input type="email" id="email" name="email" required placeholder="${tr('builder.email_ph')}">
          </div>`}
          <div class="form-group">
            <label for="prompt">${tr('builder.prompt_label')}</label>
            <textarea id="prompt" name="prompt" required placeholder="${tr('builder.prompt_ph')}">${esc(prefill)}</textarea>
          </div>
          <div class="form-group">
            <label for="site-lang">${tr('builder.lang_label')}</label>
            <select id="site-lang" name="site-lang" style="width:100%;padding:.75rem;border:2px solid #e2e8f0;border-radius:10px;font:inherit;background:#fff">
              <option value="en"${lang === 'en' ? ' selected' : ''}>English</option>
              <option value="es"${lang === 'es' ? ' selected' : ''}>Español</option>
              <option value="pt"${lang === 'pt' ? ' selected' : ''}>Português</option>
            </select>
          </div>
          <div class="form-group consent" style="display:flex;align-items:flex-start;gap:.55rem">
            <input type="checkbox" id="agree" name="agree" required style="width:auto;margin-top:.25rem;flex:none">
            <label for="agree" style="font-weight:500;margin:0;cursor:pointer">${tr('landing.refactor_agree', { terms: `<a href="/terms" target="_blank" style="color:#764ba2;font-weight:700">${tr('footer.terms')}</a>`, privacy: `<a href="/privacy" target="_blank" style="color:#764ba2;font-weight:700">${tr('footer.privacy')}</a>` })}</label>
          </div>
          <button type="submit" class="submit-btn" id="submit-btn">${tr('builder.submit')}</button>
        </form>
      </div>
    </div>
  </section>

  <section class="features">
    <h2>How It Works</h2>
    <div class="features-grid">
      <div class="feature">
        <div class="feature-icon">💬</div>
        <h3>1. Describe Your Business</h3>
        <p>Answer a few simple questions about your business and goals</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🤖</div>
        <h3>2. AI Generates Content</h3>
        <p>Our AI creates professional content and design for your website</p>
      </div>
      <div class="feature">
        <div class="feature-icon">✨</div>
        <h3>3. Customize & Deploy</h3>
        <p>Tweak the design, add your images, and publish instantly</p>
      </div>
    </div>
  </section>

  <script>
    const form = document.getElementById('start-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailEl = document.getElementById('email');
      const email = emailEl ? emailEl.value : ''; // signed-in: server uses the session
      const prompt = document.getElementById('prompt').value;
      const siteLang = document.getElementById('site-lang').value;
      const agreed = document.getElementById('agree').checked;

      if (!agreed) {
        errorDiv.textContent = 'Please agree to the Terms of Service and Privacy Policy to continue.';
        errorDiv.style.display = 'block';
        return;
      }

      // Hide messages
      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';

      // Disable button
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating your project...';

      try {
        const response = await fetch('/api/ai-builder/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            initial_prompt: prompt,
            accepted_terms: true,
            language: siteLang,
          }),
        });

        const data = await response.json();

        if (data.success) {
          successDiv.textContent = 'Project created! Starting conversation...';
          successDiv.style.display = 'block';

          // Redirect to chat interface
          setTimeout(() => {
            window.location.href = \`/ai-builder/chat/\${data.project_id}\`;
          }, 1000);
        } else {
          throw new Error(data.error || 'Failed to create project');
        }
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Start Building →';
      }
    });
  </script>
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
