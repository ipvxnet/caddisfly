/**
 * AI-powered HTML refactoring utilities using Workers AI
 */

const MAX_HTML_SIZE_BYTES = 12 * 1024; // 12KB - conservative limit for LLM context
const FALLBACK_CSS = `
<style>
  /* Caddisfly Modern Fallback Styles */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  header, nav, main, article, section, footer {
    display: block;
    margin-bottom: 20px;
  }

  h1, h2, h3, h4, h5, h6 {
    margin-bottom: 10px;
    font-weight: 600;
    line-height: 1.2;
  }

  h1 { font-size: 2.5em; }
  h2 { font-size: 2em; }
  h3 { font-size: 1.75em; }

  p {
    margin-bottom: 15px;
  }

  a {
    color: #007bff;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  img {
    max-width: 100%;
    height: auto;
  }

  ul, ol {
    margin-left: 20px;
    margin-bottom: 15px;
  }

  @media (max-width: 768px) {
    body {
      padding: 10px;
    }

    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
  }
</style>
`;

/**
 * Refactors HTML using Workers AI
 * @param {Object} env - Environment bindings
 * @param {string} originalHtml - Original HTML content
 * @param {string} pageUrl - URL of the page being refactored
 * @returns {Promise<string>} Refactored HTML
 */
export async function refactorHtml(env, originalHtml, pageUrl) {
  // For now, use CSS-only modernization instead of AI
  // AI restructuring is unreliable and often breaks layouts
  console.log('Using CSS-only modernization (AI disabled for reliability)');
  return applyCSSModernization(originalHtml, pageUrl);

  /* AI refactoring disabled - uncomment to re-enable
  try {
    const htmlSizeBytes = new TextEncoder().encode(originalHtml).length;

    if (htmlSizeBytes > MAX_HTML_SIZE_BYTES) {
      console.log(`HTML too large (${htmlSizeBytes} bytes), using CSS modernization`);
      return applyCSSModernization(originalHtml, pageUrl);
    }

    const prompt = buildRefactorPrompt(originalHtml, pageUrl);
    const refactoredHtml = await callWorkersAI(env, prompt);

    if (!refactoredHtml || refactoredHtml.trim().length === 0) {
      console.warn('AI returned empty result, using CSS modernization');
      return applyCSSModernization(originalHtml, pageUrl);
    }

    if (!refactoredHtml.includes('<!DOCTYPE') && !refactoredHtml.includes('<html')) {
      console.warn('AI returned invalid HTML, using CSS modernization');
      return applyCSSModernization(originalHtml, pageUrl);
    }

    return refactoredHtml;
  } catch (error) {
    console.error('AI refactoring failed:', error);
    console.log('Using CSS modernization');
    return applyCSSModernization(originalHtml, pageUrl);
  }
  */
}

/**
 * Builds the refactoring prompt for the AI
 * @param {string} html - HTML content
 * @param {string} url - Page URL
 * @returns {string} Formatted prompt
 */
export function buildRefactorPrompt(html, url) {
  // Extract just the body content to reduce size
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  return `Refactor this HTML into modern, clean code. Output ONLY valid HTML, no explanations.

Rules:
1. Use semantic HTML5 tags: <header>, <nav>, <main>, <section>, <article>, <footer>
2. Add responsive CSS using flexbox/grid in a <style> tag
3. Make it mobile-first with proper viewport meta tag
4. Keep ALL original text content unchanged
5. Start with <!DOCTYPE html>

Input:
${bodyContent.substring(0, 8000)}

Output (valid HTML only):`;
}

/**
 * Calls Workers AI to refactor HTML
 * @param {Object} env - Environment bindings
 * @param {string} prompt - Prompt for the AI
 * @returns {Promise<string>} AI-generated HTML
 */
export async function callWorkersAI(env, prompt) {
  if (!env.AI) {
    throw new Error('AI binding not available');
  }

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are an HTML code generator. You ONLY output valid HTML code, never explanations or comments.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.1, // Very low temperature for consistent, predictable output
    });

    if (!response || !response.response) {
      throw new Error('Invalid AI response');
    }

    // Extract HTML from response (AI might add explanations)
    let html = response.response.trim();

    // Try to extract HTML if AI added explanations
    const htmlMatch = html.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
    if (htmlMatch) {
      html = htmlMatch[0];
    } else {
      // Look for just html tags
      const htmlTagMatch = html.match(/<html[\s\S]*<\/html>/i);
      if (htmlTagMatch) {
        html = '<!DOCTYPE html>\n' + htmlTagMatch[0];
      }
    }

    console.log('AI response length:', html.length);
    console.log('AI response preview:', html.substring(0, 200));

    return html;
  } catch (error) {
    console.error('Workers AI error:', error);
    throw error;
  }
}

/**
 * Handles large HTML by chunking and processing separately
 * @param {Object} env - Environment bindings
 * @param {string} html - HTML content
 * @param {string} url - Page URL
 * @returns {Promise<string>} Refactored HTML
 */
async function refactorWithChunking(env, html, url) {
  try {
    // Extract different sections
    const chunks = chunkHtmlIfNeeded(html);

    if (chunks.length === 1) {
      // If chunking didn't help, use fallback
      return applyFallbackTemplate(html);
    }

    console.log(`Processing ${chunks.length} chunks`);

    // Process each chunk
    const refactoredChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkPrompt = `Refactor this HTML section to use modern best practices. Return ONLY the refactored HTML:\n\n${chunk}`;

      try {
        const refactored = await callWorkersAI(env, chunkPrompt);
        refactoredChunks.push(refactored);
      } catch (error) {
        console.error(`Failed to refactor chunk ${i}:`, error);
        refactoredChunks.push(chunk); // Use original if refactoring fails
      }
    }

    // Combine chunks into a complete HTML document
    return combineChunks(refactoredChunks, url);
  } catch (error) {
    console.error('Chunking refactor failed:', error);
    return applyFallbackTemplate(html);
  }
}

/**
 * Chunks HTML into smaller pieces if needed
 * @param {string} html - HTML content
 * @param {number} maxTokens - Maximum tokens per chunk (default: 3000)
 * @returns {string[]} Array of HTML chunks
 */
export function chunkHtmlIfNeeded(html, maxTokens = 3000) {
  // Rough estimate: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  const chunks = [];

  // Try to split by major HTML sections
  const sectionRegex = /<(header|nav|main|section|article|footer|div)[^>]*>[\s\S]*?<\/\1>/gi;
  const sections = html.match(sectionRegex) || [];

  if (sections.length === 0) {
    // If no sections found, split by character count
    for (let i = 0; i < html.length; i += maxChars) {
      chunks.push(html.substring(i, i + maxChars));
    }
  } else {
    let currentChunk = '';

    for (const section of sections) {
      if (currentChunk.length + section.length > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = section;
      } else {
        currentChunk += section;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
  }

  return chunks.length > 0 ? chunks : [html];
}

/**
 * Combines refactored chunks into a complete HTML document
 * @param {string[]} chunks - Array of refactored HTML chunks
 * @param {string} url - Original page URL
 * @returns {string} Complete HTML document
 */
function combineChunks(chunks, url) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refactored - ${url}</title>
  ${FALLBACK_CSS}
</head>
<body>
  ${chunks.join('\n')}
</body>
</html>`;
}

/**
 * Applies modern CSS to original HTML without changing structure
 * This preserves the original layout while modernizing the appearance
 * @param {string} originalHtml - Original HTML content
 * @param {string} pageUrl - URL of the page
 * @returns {string} HTML with modern CSS injected
 */
function applyCSSModernization(originalHtml, pageUrl) {
  // Remove existing style tags and inline styles for clean slate
  let html = originalHtml;

  // Extract title
  let title = 'Modernized Page';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1];
  }

  // Check if viewport meta tag exists
  const hasViewport = html.includes('viewport');

  // Modern CSS that enhances without breaking layout
  const modernCSS = `
<style>
/* Caddisfly CSS Modernization */
/* Reset and base styles */
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
  line-height: 1.6 !important;
  color: #333 !important;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Typography improvements */
h1, h2, h3, h4, h5, h6 {
  font-weight: 600 !important;
  line-height: 1.2 !important;
  margin-top: 1em !important;
  margin-bottom: 0.5em !important;
}

p {
  margin-bottom: 1em !important;
}

/* Link improvements */
a {
  color: #007bff !important;
  text-decoration: none !important;
  transition: all 0.2s ease !important;
}

a:hover {
  color: #0056b3 !important;
  text-decoration: underline !important;
}

/* Image responsiveness */
img {
  max-width: 100% !important;
  height: auto !important;
  display: block !important;
}

/* Button improvements */
button, .button, input[type="submit"], input[type="button"] {
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  border-radius: 4px !important;
}

button:hover, .button:hover, input[type="submit"]:hover, input[type="button"]:hover {
  opacity: 0.9 !important;
  transform: translateY(-1px) !important;
}

/* Form improvements */
input, textarea, select {
  font-family: inherit !important;
  font-size: inherit !important;
  border-radius: 4px !important;
}

/* Table improvements */
table {
  border-collapse: collapse !important;
  width: 100% !important;
}

th, td {
  padding: 12px !important;
  text-align: left !important;
}

/* List improvements */
ul, ol {
  padding-left: 1.5em !important;
}

li {
  margin-bottom: 0.5em !important;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  body {
    font-size: 16px !important;
  }

  img {
    width: 100% !important;
  }

  table {
    font-size: 14px !important;
  }
}

/* Accessibility */
:focus {
  outline: 2px solid #007bff !important;
  outline-offset: 2px !important;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth !important;
}
</style>
`;

  // Inject viewport meta tag if missing
  const viewportTag = hasViewport ? '' : '<meta name="viewport" content="width=device-width, initial-scale=1.0">';

  // Inject modern CSS into head
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${viewportTag}\n${modernCSS}\n</head>`);
  } else if (html.includes('<body')) {
    html = html.replace('<body', `${viewportTag}\n${modernCSS}\n<body`);
  } else {
    // Wrap entire HTML
    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${viewportTag}
  <title>${title}</title>
  ${modernCSS}
</head>
<body>
  ${html}
</body>
</html>`;
  }

  return html;
}

/**
 * Applies a basic modern CSS template to the original HTML
 * This is used as a fallback when AI processing fails
 * @param {string} originalHtml - Original HTML content
 * @returns {string} HTML with fallback styling
 */
function applyFallbackTemplate(originalHtml) {
  // Extract body content if possible
  let bodyContent = originalHtml;
  const bodyMatch = originalHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  }

  // Extract title if possible
  let title = 'Refactored Page';
  const titleMatch = originalHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1];
  }

  // Basic semantic restructuring
  // Wrap first heading in header if it exists
  let restructured = bodyContent;

  // Find first h1 and wrap in header
  restructured = restructured.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, '<header>$1</header>');

  // Wrap remaining content in main if not already wrapped
  if (!restructured.includes('<main')) {
    const headerMatch = restructured.match(/(<header>[\s\S]*?<\/header>)/i);
    if (headerMatch) {
      const afterHeader = restructured.substring(restructured.indexOf('</header>') + 9);
      restructured = headerMatch[0] + '\n<main>\n' + afterHeader + '\n</main>';
    } else {
      restructured = '<main>\n' + restructured + '\n</main>';
    }
  }

  // Better CSS for fallback
  const enhancedCSS = `
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background: #fff;
  }

  header {
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #f0f0f0;
  }

  main {
    margin-bottom: 40px;
  }

  h1, h2, h3, h4, h5, h6 {
    margin: 20px 0 10px 0;
    font-weight: 600;
    line-height: 1.2;
    color: #222;
  }

  h1 { font-size: 2.5em; }
  h2 { font-size: 2em; }
  h3 { font-size: 1.75em; }

  p {
    margin-bottom: 15px;
  }

  a {
    color: #007bff;
    text-decoration: none;
    transition: color 0.2s;
  }

  a:hover {
    color: #0056b3;
    text-decoration: underline;
  }

  img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }

  ul, ol {
    margin: 15px 0 15px 20px;
  }

  li {
    margin-bottom: 8px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }

  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }

  th {
    background: #f8f9fa;
    font-weight: 600;
  }

  blockquote {
    border-left: 4px solid #007bff;
    padding-left: 20px;
    margin: 20px 0;
    color: #666;
    font-style: italic;
  }

  @media (max-width: 768px) {
    body {
      padding: 15px;
    }

    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
  }
</style>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${enhancedCSS}
</head>
<body>
  ${restructured}
</body>
</html>`;
}
