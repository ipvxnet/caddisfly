// Response utility functions for Cloudflare Workers

/**
 * Create a JSON response
 * @param {object} data - Data to send as JSON
 * @param {number} status - HTTP status code
 * @param {object} headers - Additional headers
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Create an HTML response
 * @param {string} html - HTML content
 * @param {number} status - HTTP status code
 * @param {object} headers - Additional headers
 * @returns {Response}
 */
export function htmlResponse(html, status = 200, headers = {}) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...headers,
    },
  });
}

/**
 * Create a redirect response
 * @param {string} location - URL to redirect to
 * @param {number} status - HTTP status code (301, 302, 303, 307, 308)
 * @returns {Response}
 */
export function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
    },
  });
}

/**
 * Create a 404 Not Found response
 * @param {string} message - Error message
 * @param {boolean} asJson - Return as JSON instead of HTML
 * @returns {Response}
 */
export function notFound(message = 'Not Found', asJson = false) {
  if (asJson) {
    return jsonResponse({ error: message }, 404);
  }
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Not Found</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        h1 { color: #333; margin-bottom: 0.5rem; }
        p { color: #666; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404 - Not Found</h1>
        <p>${message}</p>
        <p><a href="/">Go to Home</a></p>
      </div>
    </body>
    </html>
  `;
  return htmlResponse(html, 404);
}

/**
 * Create a 401 Unauthorized response
 * @param {string} message - Error message
 * @param {boolean} asJson - Return as JSON instead of HTML
 * @returns {Response}
 */
export function unauthorized(message = 'Unauthorized', asJson = false) {
  if (asJson) {
    return jsonResponse({ error: message }, 401);
  }
  return redirect('/login');
}

/**
 * Create a 400 Bad Request response
 * @param {string} message - Error message
 * @param {boolean} asJson - Return as JSON instead of HTML
 * @returns {Response}
 */
export function badRequest(message = 'Bad Request', asJson = false) {
  if (asJson) {
    return jsonResponse({ error: message }, 400);
  }
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>400 - Bad Request</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        h1 { color: #333; margin-bottom: 0.5rem; }
        p { color: #666; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>400 - Bad Request</h1>
        <p>${message}</p>
        <p><a href="/">Go to Home</a></p>
      </div>
    </body>
    </html>
  `;
  return htmlResponse(html, 400);
}

/**
 * Create a 500 Internal Server Error response
 * @param {string} message - Error message
 * @param {boolean} asJson - Return as JSON instead of HTML
 * @param {boolean} isDev - Show detailed error in development
 * @param {Error} error - Original error object
 * @returns {Response}
 */
export function internalServerError(message = 'Internal Server Error', asJson = false, isDev = false, error = null) {
  const detailedMessage = isDev && error ? `${message}: ${error.message}\n${error.stack}` : message;

  if (asJson) {
    return jsonResponse({
      error: isDev ? detailedMessage : message,
      ...(isDev && error && { stack: error.stack })
    }, 500);
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>500 - Internal Server Error</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
          padding: 2rem;
        }
        .container {
          text-align: center;
          max-width: 800px;
        }
        h1 { color: #333; margin-bottom: 0.5rem; }
        p { color: #666; }
        pre {
          text-align: left;
          background: #fff;
          padding: 1rem;
          border-radius: 4px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>500 - Internal Server Error</h1>
        <p>${isDev ? 'Development Mode - Error Details:' : 'Something went wrong. Please try again later.'}</p>
        ${isDev && error ? `<pre>${detailedMessage}</pre>` : ''}
        <p><a href="/">Go to Home</a></p>
      </div>
    </body>
    </html>
  `;
  return htmlResponse(html, 500);
}
