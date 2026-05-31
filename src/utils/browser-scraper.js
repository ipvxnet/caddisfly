/**
 * Browser-based scraping using Cloudflare Browser Rendering
 * For websites that block regular HTTP requests
 */

import puppeteer from '@cloudflare/puppeteer';

/**
 * Scrapes a website using headless browser
 * @param {Object} env - Environment bindings
 * @param {string} url - URL to scrape
 * @param {number} pageLimit - Maximum number of pages to scrape
 * @returns {Promise<Array<{url: string, html: string}>>} Array of scraped pages
 */
export async function scrapeWithBrowser(env, url, pageLimit = 2) {
  if (!env.BROWSER) {
    throw new Error('Browser binding not available');
  }

  const scrapedPages = [];

  try {
    console.log(`Launching browser for ${url}`);

    // Launch browser
    const browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Scrape homepage
    console.log(`Navigating to homepage: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for React/JavaScript to render content
    // Many modern sites use React/Vue/Angular that need time to hydrate
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get HTML content after rendering
    const homepageHtml = await page.content();

    scrapedPages.push({
      url: url,
      html: homepageHtml,
    });

    // If we need more pages, discover and scrape them
    if (pageLimit > 1) {
      // Find links on the page
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors
          .map(a => a.href)
          .filter(href => href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:'));
      });

      // Filter to same domain
      const baseUrl = new URL(url);
      const sameOriginLinks = links.filter(link => {
        try {
          const linkUrl = new URL(link);
          return linkUrl.hostname === baseUrl.hostname && link !== url;
        } catch {
          return false;
        }
      });

      // Prioritize common pages
      const priorityPatterns = ['/about', '/contact', '/services', '/products'];
      const sortedLinks = sameOriginLinks.sort((a, b) => {
        const aPriority = priorityPatterns.findIndex(pattern => a.toLowerCase().includes(pattern));
        const bPriority = priorityPatterns.findIndex(pattern => b.toLowerCase().includes(pattern));

        if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        return 0;
      });

      // Scrape additional pages
      const pagesToScrape = sortedLinks.slice(0, pageLimit - 1);

      for (const pageUrl of pagesToScrape) {
        try {
          console.log(`Navigating to: ${pageUrl}`);
          await page.goto(pageUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });

          // Wait for React/JavaScript to render content
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Scroll to trigger lazy loading
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
          });
          await new Promise(resolve => setTimeout(resolve, 500));

          await page.evaluate(() => {
            window.scrollTo(0, 0);
          });
          await new Promise(resolve => setTimeout(resolve, 500));

          const pageHtml = await page.content();

          scrapedPages.push({
            url: pageUrl,
            html: pageHtml,
          });
        } catch (error) {
          console.error(`Failed to scrape ${pageUrl}:`, error.message);
          // Continue with other pages
        }
      }
    }

    await browser.close();
    console.log(`Browser scraping complete. Scraped ${scrapedPages.length} pages.`);

    return scrapedPages;
  } catch (error) {
    console.error('Browser scraping error:', error);
    throw new Error(`Browser scraping failed: ${error.message}`);
  }
}

/**
 * Check if a URL should use browser rendering
 * Some sites are known to block regular requests
 * @param {string} url - URL to check
 * @returns {boolean} True if should use browser
 */
export function shouldUseBrowser(url) {
  const knownBlockers = [
    'totalwine.com',
    'mavis.com',
    'amazon.com',
    'walmart.com',
    'target.com',
    'bestbuy.com',
    'homedepot.com',
    // Add more as we discover them
  ];

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return knownBlockers.some(blocker => hostname.includes(blocker));
  } catch {
    return false;
  }
}
