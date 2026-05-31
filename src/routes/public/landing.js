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

        <div class="admin-link">
          <p>Admin? <a href="/login">Sign in here</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return htmlResponse(html);
}
