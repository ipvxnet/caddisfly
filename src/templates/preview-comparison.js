/**
 * Preview comparison page template
 * Shows split-screen comparison of original vs refactored HTML
 */

/**
 * Builds the preview comparison HTML page
 * @param {Object} data - Page data
 * @param {string} data.previewId - Preview UUID
 * @param {Array} data.pages - Array of page objects with url, originalHtml, refactoredHtml
 * @param {string} data.websiteUrl - Original website URL
 * @returns {string} Complete HTML page
 */
export function buildPreviewComparisonHtml(data) {
  const { previewId, pages, websiteUrl } = data;

  // Build page tabs
  const pageTabs = pages.map((page, index) => {
    const pageLabel = index === 0 ? 'Homepage' : `Page ${index + 1}`;
    const pageUrlShort = new URL(page.url).pathname || '/';

    return `
      <button class="page-tab ${index === 0 ? 'active' : ''}" data-page-index="${index}">
        <div class="page-tab-label">${pageLabel}</div>
        <div class="page-tab-url">${pageUrlShort}</div>
      </button>
    `;
  }).join('');

  // Build page containers - full screen refactored with original link in header
  const pageContainers = pages.map((page, index) => `
    <div class="page-container ${index === 0 ? 'active' : ''}" data-page-index="${index}">
      <div class="preview-header">
        <div class="preview-info">
          <h2>Your Modernized Website</h2>
          <div class="preview-actions">
            <a href="/preview/${previewId}/html/${index}/original" target="_blank" class="btn-compare">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0z"/>
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
              </svg>
              Compare with Original
            </a>
            <a href="${page.url}" target="_blank" class="btn-live">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
              </svg>
              View Live Site
            </a>
          </div>
        </div>
      </div>

      <div class="preview-main">
        <iframe
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          src="/preview/${previewId}/html/${index}/refactored"
          title="Refactored Page ${index}"
          onerror="handleIframeError(this)"
        ></iframe>
      </div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${websiteUrl} - Caddisfly</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .header-content {
      max-width: 1800px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }

    .header-title {
      flex: 1;
    }

    .header-title h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 5px;
    }

    .header-title p {
      font-size: 14px;
      opacity: 0.9;
    }

    .header-actions {
      display: flex;
      gap: 10px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: all 0.2s;
    }

    .btn-primary {
      background: white;
      color: #667eea;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    .btn-secondary {
      background: rgba(255,255,255,0.2);
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
    }

    .btn-secondary:hover {
      background: rgba(255,255,255,0.3);
    }

    /* Page Tabs */
    .tabs-container {
      background: white;
      border-bottom: 1px solid #e0e0e0;
      padding: 0 30px;
      overflow-x: auto;
    }

    .tabs {
      max-width: 1800px;
      margin: 0 auto;
      display: flex;
      gap: 5px;
    }

    .page-tab {
      background: none;
      border: none;
      padding: 15px 20px;
      cursor: pointer;
      font-size: 14px;
      color: #666;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
      text-align: left;
    }

    .page-tab:hover {
      background: #f8f9fa;
      color: #333;
    }

    .page-tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }

    .page-tab-label {
      font-weight: 600;
      margin-bottom: 2px;
    }

    .page-tab-url {
      font-size: 12px;
      opacity: 0.7;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      padding: 30px;
      max-width: 1800px;
      margin: 0 auto;
      width: 100%;
    }

    .page-container {
      display: none;
    }

    .page-container.active {
      display: block;
    }

    /* Preview Header */
    .preview-header {
      background: white;
      border-bottom: 1px solid #e0e0e0;
      padding: 20px 30px;
    }

    .preview-info {
      max-width: 1800px;
      margin: 0 auto;
    }

    .preview-info h2 {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin-bottom: 15px;
    }

    .preview-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .btn-compare,
    .btn-live {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
      border: 1px solid #e0e0e0;
      background: white;
      color: #333;
    }

    .btn-compare {
      border-color: #667eea;
      color: #667eea;
    }

    .btn-compare:hover {
      background: #667eea;
      color: white;
    }

    .btn-live:hover {
      background: #f8f9fa;
      border-color: #667eea;
    }

    /* Preview Main - Full Screen */
    .preview-main {
      height: calc(100vh - 220px);
      min-height: 600px;
      background: white;
    }

    .preview-main iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        align-items: stretch;
      }

      .header-actions {
        flex-direction: column;
      }

      .preview-header {
        padding: 15px 20px;
      }

      .preview-info h2 {
        font-size: 18px;
      }

      .preview-actions {
        flex-direction: column;
      }

      .btn-compare,
      .btn-live {
        width: 100%;
        justify-content: center;
      }

      .preview-main {
        height: calc(100vh - 280px);
        min-height: 400px;
      }

      .main-content {
        padding: 15px;
      }

      .tabs-container {
        padding: 0 15px;
      }
    }

    /* Footer */
    .footer {
      background: white;
      border-top: 1px solid #e0e0e0;
      padding: 20px 30px;
      text-align: center;
    }

    .footer-content {
      max-width: 1800px;
      margin: 0 auto;
      color: #666;
      font-size: 14px;
    }

    .footer-content p {
      margin-bottom: 5px;
    }

    .footer-content a {
      color: #667eea;
      text-decoration: none;
    }

    .footer-content a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-content">
      <div class="header-title">
        <h1>Your Website Preview</h1>
        <p>${websiteUrl}</p>
      </div>
      <div class="header-actions">
        <a href="#" class="btn btn-primary">Upgrade to Full Site</a>
        <button class="btn btn-secondary" onclick="sharePreview()">Share Preview</button>
      </div>
    </div>
  </header>

  <div class="tabs-container">
    <div class="tabs">
      ${pageTabs}
    </div>
  </div>

  <main class="main-content">
    ${pageContainers}
  </main>

  <footer class="footer">
    <div class="footer-content">
      <p><strong>Caddisfly</strong> - Modern websites, automatically refactored</p>
      <p>This preview is valid for 30 days. <a href="#">Learn more</a></p>
    </div>
  </footer>

  <script>
    // Page tab switching
    const pageTabs = document.querySelectorAll('.page-tab');
    const pageContainers = document.querySelectorAll('.page-container');

    pageTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const pageIndex = tab.dataset.pageIndex;

        // Update active states
        pageTabs.forEach(t => t.classList.remove('active'));
        pageContainers.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.querySelector(\`.page-container[data-page-index="\${pageIndex}"]\`).classList.add('active');
      });
    });

    // Share functionality
    function sharePreview() {
      const url = window.location.href;

      if (navigator.share) {
        navigator.share({
          title: 'Check out my website preview from Caddisfly',
          url: url
        }).catch(err => console.log('Share cancelled'));
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
          alert('Preview link copied to clipboard!');
        }).catch(err => {
          console.error('Failed to copy:', err);
        });
      }
    }

    // Handle iframe errors
    function handleIframeError(iframe) {
      console.error('Iframe failed to load:', iframe.src);
      iframe.style.display = 'none';
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding: 40px; text-align: center; color: #666;';
      errorDiv.innerHTML = \`
        <h3>Preview Unavailable</h3>
        <p>This page contains JavaScript that prevents preview rendering.</p>
        <a href="\${iframe.src}" target="_blank" style="color: #667eea;">Open in new tab</a>
      \`;
      iframe.parentElement.appendChild(errorDiv);
    }

    // Catch iframe console errors
    window.addEventListener('error', function(e) {
      // Ignore iframe errors that bubble up
      if (e.target && e.target.tagName === 'IFRAME') {
        e.preventDefault();
        console.log('Iframe error caught and suppressed');
      }
    }, true);

    // Prevent unhandled promise rejections from breaking the page
    window.addEventListener('unhandledrejection', function(e) {
      console.log('Unhandled rejection caught:', e.reason);
      e.preventDefault();
    });
  </script>
</body>
</html>
  `.trim();
}

/**
 * Escapes HTML for safe use in srcdoc attribute
 * @param {string} html - HTML to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(html) {
  return html
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
