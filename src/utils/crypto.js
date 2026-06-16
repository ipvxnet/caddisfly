// Cryptographic utilities for Cloudflare Workers

/**
 * Generate a cryptographically random token
 * @param {number} bytes - Number of bytes for the token (default: 32)
 * @returns {string} Hex-encoded random token
 */
export function generateToken(bytes = 32) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 hash a string, returned as lowercase hex. Used to store capability
 * tokens (e.g. build grants) at rest without keeping the raw token.
 * @param {string} input
 * @returns {Promise<string>} hex digest
 */
export async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Set a cookie on the response
 * @param {Response} response - Response object to modify
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {object} options - Cookie options
 * @returns {Response} Modified response with Set-Cookie header
 */
export function setCookie(response, name, value, options = {}) {
  const {
    maxAge,
    expires,
    path = '/',
    domain,
    secure = true,
    httpOnly = true,
    sameSite = 'Lax',
  } = options;

  let cookie = `${name}=${value}`;

  if (maxAge !== undefined) {
    cookie += `; Max-Age=${maxAge}`;
  }

  if (expires) {
    cookie += `; Expires=${expires.toUTCString()}`;
  }

  cookie += `; Path=${path}`;

  if (domain) {
    cookie += `; Domain=${domain}`;
  }

  if (secure) {
    cookie += '; Secure';
  }

  if (httpOnly) {
    cookie += '; HttpOnly';
  }

  if (sameSite) {
    cookie += `; SameSite=${sameSite}`;
  }

  // Clone response and add Set-Cookie header
  const newResponse = new Response(response.body, response);
  newResponse.headers.append('Set-Cookie', cookie);

  return newResponse;
}

/**
 * Parse cookies from request header
 * @param {Request} request - Request object
 * @returns {object} Object with cookie key-value pairs
 */
export function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [key, ...values] = cookie.trim().split('=');
      return [key, values.join('=')];
    })
  );
}

/**
 * Clear a cookie by setting it to expire immediately
 * @param {Response} response - Response object to modify
 * @param {string} name - Cookie name to clear
 * @param {object} options - Cookie options (path, domain)
 * @returns {Response} Modified response with Set-Cookie header
 */
export function clearCookie(response, name, options = {}) {
  return setCookie(response, name, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}
