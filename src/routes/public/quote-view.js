// Public hosted quote page (/q/:token) + its PDF (/q/:token/pdf). The token is
// the unguessable auth — no session needed. Branding comes from the issuer
// snapshot frozen on the quote at send time. PDF via Cloudflare Browser Rendering.

import puppeteer from '@cloudflare/puppeteer';
import { getQuoteByToken, markQuoteViewed } from '../../db/crm-quotes.js';
import { renderQuoteHtml } from '../../utils/quote-doc.js';
import { htmlResponse } from '../../utils/response.js';

function issuerOf(quote) {
  let iss = {};
  try { iss = JSON.parse(quote.issuer_json || '{}'); } catch { /* defaults below */ }
  return {
    name: iss.name || 'Quote',
    logo: iss.logo || '',
    contact: Array.isArray(iss.contact) ? iss.contact : [],
    accent: iss.accent || '#5a3da8',
    intro: iss.intro || '',
    thankYou: iss.thankYou || '',
    terms: iss.terms || '',
  };
}

/** GET /q/:token — the branded hosted quote page. */
export async function handleQuoteView(ctx) {
  const { env, params, url } = ctx;
  const quote = await getQuoteByToken(env.DB, params.token);
  if (!quote) return new Response('Quote not found', { status: 404 });
  await markQuoteViewed(env.DB, params.token);
  const pdfUrl = `${url.origin}/q/${encodeURIComponent(params.token)}/pdf`;
  return htmlResponse(renderQuoteHtml({ quote, items: quote.items, issuer: issuerOf(quote), pdfUrl }));
}

/** GET /q/:token/pdf — the same document rendered to PDF via Browser Rendering. */
export async function handleQuotePdf(ctx) {
  const { env, params } = ctx;
  const quote = await getQuoteByToken(env.DB, params.token);
  if (!quote) return new Response('Quote not found', { status: 404 });
  if (!env.BROWSER) return new Response('PDF rendering unavailable', { status: 503 });
  const html = renderQuoteHtml({ quote, items: quote.items, issuer: issuerOf(quote), pdfUrl: '' });
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="quote-${quote.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    await browser.close();
  }
}
