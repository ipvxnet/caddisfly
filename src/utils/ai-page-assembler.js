// AI Page Assembler
// Assembles complete HTML pages from sections

import { renderSection } from '../templates/ai-builder/registry.js';

/**
 * Assemble a complete HTML page from sections
 * @param {array} sections - Array of section objects from database
 * @param {object} config - Website configuration
 * @param {object} project - AI project object
 * @returns {string} Complete HTML document
 */
export function assemblePage(sections, config, project) {
  // Sort sections by order
  const sortedSections = sections.sort((a, b) => a.section_order - b.section_order);

  // Render each section
  const renderedSections = sortedSections
    .filter((section) => section.is_visible)
    .map((section) => {
      const contentData = section.content_json ? JSON.parse(section.content_json) : {};
      const variant = contentData._variant || 'default';

      return renderSection(section.section_type, contentData, config, variant);
    })
    .join('\n\n');

  // Build complete HTML document
  const html = buildHTMLDocument({
    title: project.project_name || 'My Website',
    body: renderedSections,
    config,
  });

  return html;
}

/**
 * Build complete HTML document structure
 * @param {object} options - Document options
 * @returns {string} Complete HTML document
 */
export function buildHTMLDocument({ title, body, config }) {
  const { primary_color = '#667eea', font_heading = 'Inter', font_body = 'Inter' } = config;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(title)} - Built with Caddisfly">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font_heading)}:wght@400;600;700&family=${encodeURIComponent(font_body)}:wght@400;500;600&display=swap" rel="stylesheet">

  <style>
    /* Global Reset & Base Styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: '${font_body}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #2d3748;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: '${font_heading}', sans-serif;
      line-height: 1.2;
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    /* CSS Variables */
    :root {
      --primary-color: ${primary_color};
      --primary-color-rgb: ${hexToRgb(primary_color)};
    }

    /* Smooth scroll offset for anchor links */
    section {
      scroll-margin-top: 20px;
    }

    /* Loading animation */
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    body {
      animation: fadeIn 0.5s ease-in;
    }
  </style>
</head>
<body>
${body}

<!-- Caddisfly Branding -->
<div style="text-align: center; padding: 1rem; background: #f7fafc; font-size: 0.875rem; color: #718096;">
  Built with <a href="https://caddisfly.ai" target="_blank" style="color: ${primary_color}; text-decoration: none; font-weight: 600;">Caddisfly</a>
</div>

<!-- Simple smooth scroll script -->
<script>
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
</script>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  if (!text) return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color code
 * @returns {string} RGB values (e.g., "102, 126, 234")
 */
export function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `${r}, ${g}, ${b}`;
}

/**
 * Deduplicate CSS from multiple sections
 * Note: Current implementation keeps CSS in each section for simplicity
 * Future optimization: extract and deduplicate CSS into <head>
 * @param {string} html - HTML with inline styles
 * @returns {string} HTML with deduplicated styles
 */
export function deduplicateCSS(html) {
  // For now, return as-is
  // Future: parse <style> tags, deduplicate rules, move to <head>
  return html;
}

/**
 * Generate preview HTML (similar to full page but with preview notice)
 * @param {array} sections - Array of section objects
 * @param {object} config - Website configuration
 * @param {object} project - AI project object
 * @returns {string} Preview HTML
 */
export function generatePreview(sections, config, project) {
  const pageHtml = assemblePage(sections, config, project);

  // Add preview banner with project ID
  const previewBanner = `
<div style="position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, ${config.primary_color} 0%, ${config.secondary_color} 100%); color: white; padding: 0.75rem 1rem; text-align: center; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.1); font-size: 0.875rem;">
  <strong>Preview Mode</strong> - This is a preview of your website. <a href="/ai-builder/customize/${project.project_id}" style="color: white; text-decoration: underline; margin-left: 1rem;">Customize</a>
</div>
<div style="height: 50px;"></div>
`;

  // Insert preview banner after <body> tag
  return pageHtml.replace('<body>', `<body>\n${previewBanner}`);
}

/**
 * Minify HTML (basic minification)
 * @param {string} html - HTML to minify
 * @returns {string} Minified HTML
 */
export function minifyHTML(html) {
  return (
    html
      // Remove comments (except IE conditional comments)
      .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
      // Remove whitespace between tags
      .replace(/>\s+</g, '><')
      // Remove leading/trailing whitespace
      .trim()
  );
}
