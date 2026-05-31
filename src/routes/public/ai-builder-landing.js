// GET /ai-builder
// Landing page for AI website builder

/**
 * Handle AI builder landing page
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderLanding(ctx) {
  const html = `
<!DOCTYPE html>
<html lang="en">
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
  <section class="hero">
    <div class="hero-content">
      <h1>Build Your Website with AI</h1>
      <p class="subtitle">Just describe your business. AI handles the rest. Get a professional website in minutes.</p>

      <div class="cta-form">
        <h2>Get Started Now</h2>
        <div id="error" class="error"></div>
        <div id="success" class="success"></div>
        <form id="start-form">
          <div class="form-group">
            <label for="email">Your Email</label>
            <input type="email" id="email" name="email" required placeholder="you@example.com">
          </div>
          <div class="form-group">
            <label for="prompt">What kind of website do you need?</label>
            <textarea id="prompt" name="prompt" required placeholder="e.g., I need a website for my bakery with an online menu and contact form..."></textarea>
          </div>
          <button type="submit" class="submit-btn" id="submit-btn">Start Building →</button>
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

      const email = document.getElementById('email').value;
      const prompt = document.getElementById('prompt').value;

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
