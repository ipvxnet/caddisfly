// Landing page route

import { htmlResponse } from '../../utils/response.js';

/**
 * Handle landing page
 * @param {object} ctx - Request context
 * @returns {Response} HTML response
 */
export async function handleLanding(ctx) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Caddisfly - Modern Website Refactoring</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .container {
          max-width: 800px;
          background: white;
          border-radius: 16px;
          padding: 3rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        h1 {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .tagline {
          font-size: 1.25rem;
          color: #666;
          margin-bottom: 2rem;
        }

        .description {
          font-size: 1.1rem;
          margin-bottom: 2rem;
          color: #555;
        }

        .features {
          list-style: none;
          margin-bottom: 2rem;
        }

        .features li {
          padding: 0.75rem 0;
          padding-left: 2rem;
          position: relative;
          color: #444;
        }

        .features li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #667eea;
          font-weight: bold;
          font-size: 1.2rem;
        }

        .actions {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-top: 2rem;
        }

        .btn {
          display: inline-block;
          padding: 0.875rem 2rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.3s ease;
          font-size: 1rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: white;
          color: #667eea;
          border: 2px solid #667eea;
        }

        .btn-secondary:hover {
          background: #f8f9ff;
        }

        .admin-link {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #eee;
          text-align: center;
          font-size: 0.9rem;
          color: #888;
        }

        .admin-link a {
          color: #667eea;
          text-decoration: none;
        }

        .admin-link a:hover {
          text-decoration: underline;
        }

        /* Preview Form Styles */
        .preview-section {
          margin-top: 3rem;
          padding-top: 3rem;
          border-top: 2px solid #f0f0f0;
        }

        .preview-section h2 {
          font-size: 1.75rem;
          margin-bottom: 1rem;
          color: #333;
        }

        .preview-form {
          margin-top: 1.5rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #444;
        }

        .form-group input {
          width: 100%;
          padding: 0.875rem;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1rem;
          transition: border-color 0.3s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-group input.error {
          border-color: #dc3545;
        }

        .error-message {
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 0.25rem;
          display: none;
        }

        .error-message.show {
          display: block;
        }

        .submit-btn {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .loading.show {
          display: flex;
        }

        .spinner {
          border: 3px solid rgba(102, 126, 234, 0.3);
          border-top: 3px solid #667eea;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .success-message {
          display: none;
          padding: 1.5rem;
          background: #d4edda;
          border: 1px solid #c3e6cb;
          border-radius: 8px;
          color: #155724;
          margin-top: 1rem;
        }

        .success-message.show {
          display: block;
        }

        .success-message h3 {
          margin-bottom: 0.5rem;
          color: #155724;
        }

        .success-message a {
          color: #155724;
          font-weight: 600;
        }

        .error-alert {
          display: none;
          padding: 1.5rem;
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 8px;
          color: #721c24;
          margin-top: 1rem;
        }

        .error-alert.show {
          display: block;
        }

        @media (max-width: 640px) {
          .container {
            padding: 2rem;
          }

          h1 {
            font-size: 2rem;
          }

          .tagline {
            font-size: 1.1rem;
          }

          .actions {
            flex-direction: column;
          }

          .btn {
            text-align: center;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Caddisfly</h1>
        <p class="tagline">Transform your outdated website into a modern masterpiece</p>

        <p class="description">
          Caddisfly automatically refactors your existing website into a clean, modern design
          using the latest web technologies. Get a free 2-page preview, then choose a plan
          to refactor your entire site.
        </p>

        <ul class="features">
          <li>AI-powered design modernization</li>
          <li>Responsive, mobile-first layouts</li>
          <li>Clean, semantic HTML and CSS</li>
          <li>Custom domain deployment on Cloudflare</li>
          <li>Free 2-page preview to try it out</li>
        </ul>

        <div class="actions">
          <a href="#preview" class="btn btn-primary">Get Free Preview</a>
          <a href="#pricing" class="btn btn-secondary">View Pricing</a>
        </div>

        <!-- Preview Request Section -->
        <div id="preview" class="preview-section">
          <h2>Get Your Free 2-Page Preview</h2>
          <p class="description">
            Enter your website URL and email to receive a free preview of what your site could look like.
            We'll analyze your homepage and one additional page, then send you a comparison link.
          </p>

          <form id="preview-form" class="preview-form">
            <div class="form-group">
              <label for="email">Your Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                required
              />
              <div class="error-message" id="email-error"></div>
            </div>

            <div class="form-group">
              <label for="website">Your Website URL</label>
              <input
                type="url"
                id="website"
                name="website"
                placeholder="https://yourwebsite.com"
                required
              />
              <div class="error-message" id="website-error"></div>
            </div>

            <button type="submit" class="submit-btn" id="submit-btn">
              Generate Free Preview
            </button>

            <div class="loading" id="loading">
              <div class="spinner"></div>
              <span>Creating your preview...</span>
            </div>

            <div class="success-message" id="success-message">
              <h3>Preview Created! 🎉</h3>
              <p id="success-text"></p>
            </div>

            <div class="error-alert" id="error-alert">
              <strong>Error:</strong> <span id="error-text"></span>
            </div>
          </form>
        </div>

        <div class="admin-link">
          <p>Admin? <a href="/login">Sign in here</a></p>
        </div>
      </div>

      <script>
        // Preview form submission
        const form = document.getElementById('preview-form');
        const submitBtn = document.getElementById('submit-btn');
        const loading = document.getElementById('loading');
        const successMessage = document.getElementById('success-message');
        const errorAlert = document.getElementById('error-alert');
        const emailInput = document.getElementById('email');
        const websiteInput = document.getElementById('website');
        const emailError = document.getElementById('email-error');
        const websiteError = document.getElementById('website-error');

        form.addEventListener('submit', async (e) => {
          e.preventDefault();

          // Reset states
          emailError.classList.remove('show');
          websiteError.classList.remove('show');
          emailInput.classList.remove('error');
          websiteInput.classList.remove('error');
          successMessage.classList.remove('show');
          errorAlert.classList.remove('show');

          // Get form values
          const email = emailInput.value.trim();
          const website = websiteInput.value.trim();

          // Client-side validation
          let hasError = false;

          if (!email || !isValidEmail(email)) {
            emailError.textContent = 'Please enter a valid email address';
            emailError.classList.add('show');
            emailInput.classList.add('error');
            hasError = true;
          }

          if (!website || !isValidUrl(website)) {
            websiteError.textContent = 'Please enter a valid website URL (e.g., https://example.com)';
            websiteError.classList.add('show');
            websiteInput.classList.add('error');
            hasError = true;
          }

          if (hasError) {
            return;
          }

          // Show loading state
          submitBtn.disabled = true;
          loading.classList.add('show');

          try {
            const response = await fetch('/api/preview/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, website }),
            });

            const data = await response.json();

            if (data.success) {
              // Show success message
              successMessage.classList.add('show');
              document.getElementById('success-text').innerHTML =
                data.message + '<br><br>' +
                '<a href="' + data.previewUrl + '" target="_blank">View your preview now →</a>';

              // Reset form
              form.reset();
            } else {
              // Show error message
              errorAlert.classList.add('show');
              document.getElementById('error-text').textContent =
                data.error || 'Failed to create preview. Please try again.';

              // Show field-specific errors
              if (data.errors) {
                data.errors.forEach(error => {
                  if (error.toLowerCase().includes('email')) {
                    emailError.textContent = error;
                    emailError.classList.add('show');
                    emailInput.classList.add('error');
                  } else if (error.toLowerCase().includes('url') || error.toLowerCase().includes('website')) {
                    websiteError.textContent = error;
                    websiteError.classList.add('show');
                    websiteInput.classList.add('error');
                  }
                });
              }
            }
          } catch (error) {
            console.error('Request failed:', error);
            errorAlert.classList.add('show');
            document.getElementById('error-text').textContent =
              'Network error. Please check your connection and try again.';
          } finally {
            // Hide loading state
            submitBtn.disabled = false;
            loading.classList.remove('show');
          }
        });

        // Email validation (permissive for testing)
        function isValidEmail(email) {
          // Very permissive - just check for @ symbol
          return email && email.includes('@') && email.length > 3;
        }

        // URL validation
        function isValidUrl(url) {
          try {
            const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
          } catch (e) {
            return false;
          }
        }
      </script>
    </body>
    </html>
  `;

  return htmlResponse(html);
}
