// CORS middleware

/**
 * CORS middleware - adds CORS headers to responses
 * @param {object} ctx - Request context
 * @returns {void}
 */
export async function corsMiddleware(ctx) {
  // CORS middleware doesn't block requests
  // Headers are applied in the main handler
  return;
}

/**
 * Apply CORS headers to a response
 * @param {Response} response - Response to modify
 * @param {object} options - CORS options
 * @returns {Response} Response with CORS headers
 */
export function applyCorsHeaders(response, options = {}) {
  const {
    origin = '*',
    methods = 'GET, POST, PUT, DELETE, OPTIONS',
    headers = 'Content-Type, Authorization',
    credentials = false,
    maxAge = 86400,
  } = options;

  const newResponse = new Response(response.body, response);

  newResponse.headers.set('Access-Control-Allow-Origin', origin);
  newResponse.headers.set('Access-Control-Allow-Methods', methods);
  newResponse.headers.set('Access-Control-Allow-Headers', headers);
  newResponse.headers.set('Access-Control-Max-Age', maxAge.toString());

  if (credentials) {
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  // A reflected (non-wildcard) origin means the response varies by Origin — set
  // Vary so caches don't serve one origin's ACAO to another.
  if (origin !== '*') newResponse.headers.append('Vary', 'Origin');

  return newResponse;
}

/**
 * Credentialed CORS preflight that reflects the request Origin (wildcard ACAO is
 * forbidden when credentials are allowed). Used for /api/members/* so the member
 * session cookie rides cross-site fetches from published customer sites.
 */
export function handleCredentialedPreflight(request) {
  const origin = request.headers.get('Origin') || '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}

/**
 * Handle CORS preflight requests
 * @returns {Response} Preflight response
 */
export function handleCorsPrelight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
