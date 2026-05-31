/**
 * Web scraping utilities for Caddisfly
 * Fetches and analyzes web pages for preview generation
 */

/**
 * Scrapes a website and returns the specified number of pages
 * @param {string} url - Base URL to scrape
 * @param {number} pageLimit - Maximum number of pages to scrape (default: 2)
 * @returns {Promise<Array<{url: string, html: string}>>} Array of scraped pages
 */
export async function scrapeWebsite(url, pageLimit = 2) {
  const scrapedPages = [];
  const baseUrl = normalizeUrl(url);

  try {
    // Always scrape the homepage first
    console.log(`Scraping homepage: ${baseUrl}`);
    const homepageHtml = await fetchHtml(baseUrl);
    scrapedPages.push({
      url: baseUrl,
      html: homepageHtml
    });

    // If we need more pages, discover and scrape additional pages
    if (pageLimit > 1) {
      const additionalPages = await discoverPages(baseUrl, homepageHtml);
      const pagesToScrape = additionalPages.slice(0, pageLimit - 1);

      for (const pageUrl of pagesToScrape) {
        try {
          console.log(`Scraping additional page: ${pageUrl}`);
          const pageHtml = await fetchHtml(pageUrl);
          scrapedPages.push({
            url: pageUrl,
            html: pageHtml
          });
        } catch (error) {
          console.error(`Failed to scrape ${pageUrl}:`, error.message);
          // Continue with other pages even if one fails
        }
      }
    }

    if (scrapedPages.length === 0) {
      throw new Error('No pages could be scraped');
    }

    return scrapedPages;
  } catch (error) {
    throw new Error(`Scraping failed: ${error.message}`);
  }
}

/**
 * Fetches HTML content from a URL with timeout and error handling
 * @param {string} url - URL to fetch
 * @param {number} timeoutSeconds - Timeout in seconds (default: 30)
 * @returns {Promise<string>} HTML content
 */
export async function fetchHtml(url, timeoutSeconds = 30) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('This website has security measures that prevent automated access. Try a different website or contact support.');
      } else if (response.status === 404) {
        throw new Error('Page not found (404). Please check the URL and try again.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (response.status >= 500) {
        throw new Error('The website is experiencing technical issues. Please try again later.');
      } else {
        throw new Error(`Unable to access website (Error ${response.status}). Please try a different URL.`);
      }
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error(`Expected HTML but got ${contentType}`);
    }

    const html = await response.text();

    if (!html || html.trim().length === 0) {
      throw new Error('Received empty HTML content');
    }

    return html;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Unable to reach website (timeout after 30 seconds)');
    } else if (error.message.includes('fetch failed')) {
      throw new Error('Website not found (DNS error)');
    } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
      throw new Error('SSL certificate error - website may be insecure');
    } else {
      throw error;
    }
  }
}

/**
 * Discovers internal pages from HTML content
 * Prioritizes common pages like /about, /services, /contact
 * @param {string} baseUrl - Base URL of the website
 * @param {string} html - HTML content to parse
 * @returns {Promise<string[]>} Array of discovered page URLs
 */
export async function discoverPages(baseUrl, html) {
  const discoveredUrls = new Set();
  const priorityPatterns = ['/about', '/services', '/contact', '/products', '/team'];

  try {
    // Extract base domain for validation
    const baseUrlObj = new URL(baseUrl);
    const baseDomain = baseUrlObj.hostname;

    // Simple regex to find href attributes
    // This is a basic implementation - in production you might want a proper HTML parser
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1];

      // Skip invalid links
      if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
          href.startsWith('tel:') || href.startsWith('javascript:')) {
        continue;
      }

      try {
        // Resolve relative URLs
        let fullUrl;
        if (href.startsWith('http://') || href.startsWith('https://')) {
          fullUrl = href;
        } else if (href.startsWith('//')) {
          fullUrl = baseUrlObj.protocol + href;
        } else if (href.startsWith('/')) {
          fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.hostname}${href}`;
        } else {
          // Relative path
          const basePath = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
          fullUrl = new URL(href, basePath).href;
        }

        const urlObj = new URL(fullUrl);

        // Only include URLs from the same domain
        if (urlObj.hostname === baseDomain) {
          // Remove trailing slashes and fragments for deduplication
          const cleanUrl = fullUrl.split('#')[0].replace(/\/$/, '');

          // Don't include the base URL itself
          if (cleanUrl !== baseUrl.replace(/\/$/, '')) {
            discoveredUrls.add(cleanUrl);
          }
        }
      } catch (error) {
        // Skip invalid URLs
        continue;
      }
    }

    // Convert to array and sort by priority
    const urlArray = Array.from(discoveredUrls);
    const sortedUrls = urlArray.sort((a, b) => {
      // Find priority index for each URL
      const aPriority = priorityPatterns.findIndex(pattern =>
        a.toLowerCase().includes(pattern)
      );
      const bPriority = priorityPatterns.findIndex(pattern =>
        b.toLowerCase().includes(pattern)
      );

      // If both have priority, sort by priority index
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      // If only one has priority, it comes first
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;

      // Otherwise, keep original order
      return 0;
    });

    return sortedUrls;
  } catch (error) {
    console.error('Error discovering pages:', error);
    return [];
  }
}

/**
 * Normalizes a URL to ensure it has a protocol and no trailing slash
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  let normalized = url.trim();

  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');

  return normalized;
}

/**
 * Validates if a URL is valid and accessible
 * @param {string} url - URL to validate
 * @param {boolean} allowLocalhost - Whether to allow localhost URLs (default: false)
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidUrl(url, allowLocalhost = false) {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);

    // Check protocol
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return false;
    }

    // Check for localhost in production
    if (!allowLocalhost) {
      const hostname = urlObj.hostname.toLowerCase();
      if (hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.endsWith('.local')) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}
