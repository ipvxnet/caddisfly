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
  try {
    // Check if HTML needs chunking
    const htmlSizeBytes = new TextEncoder().encode(originalHtml).length;

    if (htmlSizeBytes > MAX_HTML_SIZE_BYTES) {
      console.log(`HTML too large (${htmlSizeBytes} bytes), chunking...`);
      return await refactorWithChunking(env, originalHtml, pageUrl);
    }

    // Build the prompt
    const prompt = buildRefactorPrompt(originalHtml, pageUrl);

    // Call Workers AI
    const refactoredHtml = await callWorkersAI(env, prompt);

    // Validate the output
    if (!refactoredHtml || refactoredHtml.trim().length === 0) {
      console.warn('AI returned empty result, using fallback');
      return applyFallbackTemplate(originalHtml);
    }

    // Ensure it's valid HTML
    if (!refactoredHtml.includes('<!DOCTYPE') && !refactoredHtml.includes('<html')) {
      console.warn('AI returned invalid HTML, using fallback');
      return applyFallbackTemplate(originalHtml);
    }

    return refactoredHtml;
  } catch (error) {
    console.error('AI refactoring failed:', error);
    console.log('Using fallback template');
    return applyFallbackTemplate(originalHtml);
  }
}

/**
 * Builds the refactoring prompt for the AI
 * @param {string} html - HTML content
 * @param {string} url - Page URL
 * @returns {string} Formatted prompt
 */
export function buildRefactorPrompt(html, url) {
  return `You are an expert web developer. Refactor this HTML to use modern best practices:

REQUIREMENTS:
- Use HTML5 semantic elements (header, nav, main, article, section, footer)
- Mobile-first responsive design with flexbox/grid
- Remove inline styles, use clean CSS in <style> tag
- Ensure accessibility (ARIA labels, alt text)
- Preserve all content exactly as-is
- Return ONLY the complete HTML, no explanations

ORIGINAL URL: ${url}

ORIGINAL HTML:
${html}

REFACTORED HTML:`;
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
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.3, // Lower temperature for more consistent output
    });

    if (!response || !response.response) {
      throw new Error('Invalid AI response');
    }

    return response.response.trim();
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${FALLBACK_CSS}
</head>
<body>
  <main>
    ${bodyContent}
  </main>
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 0.9em;">
    <p>Refactored by Caddisfly</p>
  </footer>
</body>
</html>`;
}
