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

  // Build page containers
  const pageContainers = pages.map((page, index) => `
    <div class="page-container ${index === 0 ? 'active' : ''}" data-page-index="${index}">
      <div class="comparison-grid">
        <div class="comparison-panel">
          <div class="panel-header original">
            <h3>Original</h3>
            <a href="${page.url}" target="_blank" class="view-live">View Live →</a>
          </div>
          <div class="iframe-container">
            <iframe
              sandbox="allow-scripts allow-same-origin"
              srcdoc="${escapeHtml(page.originalHtml)}"
              title="Original Page ${index}"
            ></iframe>
          </div>
        </div>

        <div class="comparison-panel">
          <div class="panel-header refactored">
            <h3>Refactored by Caddisfly</h3>
            <span class="badge">Modern</span>
          </div>
          <div class="iframe-container">
            <iframe
              sandbox="allow-scripts allow-same-origin"
              srcdoc="${escapeHtml(page.refactoredHtml)}"
              title="Refactored Page ${index}"
            ></iframe>
          </div>
        </div>
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

    /* Comparison Grid */
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      height: calc(100vh - 250px);
      min-height: 600px;
    }

    .comparison-panel {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      padding: 15px 20px;
      border-bottom: 2px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-header.original {
      border-bottom-color: #ff9800;
    }

    .panel-header.refactored {
      border-bottom-color: #4caf50;
    }

    .panel-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .view-live {
      color: #667eea;
      font-size: 13px;
      text-decoration: none;
      font-weight: 500;
    }

    .view-live:hover {
      text-decoration: underline;
    }

    .badge {
      background: #4caf50;
      color: white;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .iframe-container {
      flex: 1;
      position: relative;
      background: white;
    }

    .iframe-container iframe {
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

      .comparison-grid {
        grid-template-columns: 1fr;
        height: auto;
        gap: 15px;
      }

      .comparison-panel {
        min-height: 500px;
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
