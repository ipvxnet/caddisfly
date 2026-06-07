// Stateless HMAC-signed tokens (no DB row, no revocation — use for short-lived
// links and read-only sessions). Format: <payloadB64url>.<exp>.<sigHex>, keyed
// off STRIPE_SECRET_KEY (always set where these features are live; same
// pragmatic choice as the Connect OAuth state in utils/stripe.js).

function b64urlEncode(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)));
}

function hex(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

/**
 * Sign a JSON-serializable payload into a token valid for ttlSec.
 * `scope` namespaces the signature so tokens can't cross features.
 */
export async function signToken(secret, scope, payload, ttlSec) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await hmacHex(secret, `${scope}:${body}.${exp}`);
  return `${body}.${exp}.${sig}`;
}

/** Verify a token; returns the payload, or null (bad sig / expired / malformed). */
export async function verifyToken(secret, scope, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [body, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now() / 1000)) return null;
  const expected = await hmacHex(secret, `${scope}:${body}.${exp}`);
  if (!safeEqual(expected, sig)) return null;
  try {
    return JSON.parse(b64urlDecode(body));
  } catch {
    return null;
  }
}
