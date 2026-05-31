/**
 * HTML processing utilities
 * Fixes URLs and resources to work when served from different domain
 */

/**
 * Fixes resource URLs in HTML to point back to original domain
 * @param {string} html - HTML content
 * @param {string} originalUrl - Original page URL
 * @returns {string} HTML with fixed URLs
 */
export function fixResourceUrls(html, originalUrl) {
  try {
    const url = new URL(originalUrl);
    const origin = url.origin;
    const baseUrl = `${url.protocol}//${url.hostname}`;

    let fixedHtml = html;

    // Fix relative image URLs
    fixedHtml = fixedHtml.replace(/src=["'](?!http|data:)([^"']+)["']/gi, (match, path) => {
      if (path.startsWith('//')) {
        return `src="${url.protocol}${path}"`;
      } else if (path.startsWith('/')) {
        return `src="${origin}${path}"`;
      } else {
        // Relative path
        const fullUrl = new URL(path, originalUrl).href;
        return `src="${fullUrl}"`;
      }
    });

    // Fix srcset attributes
    fixedHtml = fixedHtml.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
      const fixed = srcset.split(',').map(part => {
        const [url, descriptor] = part.trim().split(/\s+/);
        if (url.startsWith('http') || url.startsWith('data:')) {
          return part;
        }
        const fixedUrl = url.startsWith('/') ? origin + url : new URL(url, originalUrl).href;
        return descriptor ? `${fixedUrl} ${descriptor}` : fixedUrl;
      }).join(', ');
      return `srcset="${fixed}"`;
    });

    // Fix background images in style attributes
    fixedHtml = fixedHtml.replace(/style=["']([^"']*)background(-image)?:\s*url\(["']?(?!http|data:)([^"')]+)["']?\)([^"']*)["']/gi,
      (match, before, prop, path, after) => {
        const fixedPath = path.startsWith('/') ? origin + path : new URL(path, originalUrl).href;
        return `style="${before}background${prop || ''}: url('${fixedPath}')${after}"`;
      }
    );

    // Fix CSS background images in style tags
    fixedHtml = fixedHtml.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
      const fixedCss = css.replace(/url\(["']?(?!http|data:)([^"')]+)["']?\)/gi, (urlMatch, path) => {
        const fixedPath = path.startsWith('/') ? origin + path : new URL(path, originalUrl).href;
        return `url('${fixedPath}')`;
      });
      return match.replace(css, fixedCss);
    });

    // Fix link href for stylesheets
    fixedHtml = fixedHtml.replace(/<link([^>]*href=["'](?!http)([^"']+)["'][^>]*)>/gi, (match, attrs, path) => {
      const fixedPath = path.startsWith('/') ? origin + path : new URL(path, originalUrl).href;
      return `<link${attrs.replace(path, fixedPath)}>`;
    });

    // Fix script src
    fixedHtml = fixedHtml.replace(/<script([^>]*src=["'](?!http)([^"']+)["'][^>]*)>/gi, (match, attrs, path) => {
      const fixedPath = path.startsWith('/') ? origin + path : new URL(path, originalUrl).href;
      return `<script${attrs.replace(path, fixedPath)}>`;
    });

    // Add base tag if not present to help with relative URLs
    if (!fixedHtml.includes('<base')) {
      const baseTag = `<base href="${origin}/">`;
      if (fixedHtml.includes('</head>')) {
        fixedHtml = fixedHtml.replace('</head>', `${baseTag}\n</head>`);
      } else if (fixedHtml.includes('<head>')) {
        fixedHtml = fixedHtml.replace('<head>', `<head>\n${baseTag}`);
      }
    }

    return fixedHtml;
  } catch (error) {
    console.error('Error fixing resource URLs:', error);
    return html;
  }
}

/**
 * Adds a content security policy meta tag to allow loading resources from original domain
 * @param {string} html - HTML content
 * @param {string} originalUrl - Original page URL
 * @returns {string} HTML with CSP meta tag
 */
export function addCSPForResources(html, originalUrl) {
  try {
    const url = new URL(originalUrl);
    const origin = url.origin;

    // Allow images, scripts, styles from original domain
    const cspTag = `<meta http-equiv="Content-Security-Policy" content="img-src * data: blob:; script-src 'unsafe-inline' 'unsafe-eval' *; style-src 'unsafe-inline' *; font-src *;">`;

    if (html.includes('</head>')) {
      return html.replace('</head>', `${cspTag}\n</head>`);
    } else if (html.includes('<head>')) {
      return html.replace('<head>', `<head>\n${cspTag}`);
    }

    return html;
  } catch (error) {
    console.error('Error adding CSP:', error);
    return html;
  }
}
