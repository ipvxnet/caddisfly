// Zyte API browser-rendering fallback (https://docs.zyte.com/zyte-api).
//
// When our cheap static fetch can't read a site (JS-rendered, bot-protected, or
// only a placeholder homepage), Zyte renders the page in a real browser and
// returns the HTML. PAID per request, so callers use it ONLY as a fallback and
// behind the same caps as other paid lookups. No-op unless ZYTE_API_KEY is set,
// so the feature is dark until the secret is provisioned.

const ZYTE_ENDPOINT = 'https://api.zyte.com/v1/extract';

/** Is Zyte configured for this environment? */
export function zyteEnabled(env) {
  return !!(env && env.ZYTE_API_KEY);
}

/** Should Zyte render FIRST (primary), not just as a fallback? Env-gated so we
 *  can test it on preview (ZYTE_PRIMARY="true") while prod stays fallback-only. */
export function zytePrimary(env) {
  return !!(env && (env.ZYTE_PRIMARY === 'true' || env.ZYTE_PRIMARY === true));
}

/**
 * Fetch a page's browser-rendered HTML via Zyte. Returns the HTML string, or
 * null on any failure/misconfiguration (caller falls back to static).
 * @param {object} env - needs ZYTE_API_KEY
 * @param {string} url
 * @returns {Promise<string|null>}
 */
export async function zyteBrowserHtml(env, url) {
  if (!zyteEnabled(env) || !url) return null;
  // Auth: API key as HTTP Basic username, empty password.
  const auth = btoa(`${env.ZYTE_API_KEY}:`);
  try {
    const res = await fetch(ZYTE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, browserHtml: true }),
    });
    if (!res.ok) {
      console.error(`Zyte ${res.status} for ${url}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    return data.browserHtml || null;
  } catch (e) {
    console.error(`Zyte fetch failed for ${url}: ${e.message}`);
    return null;
  }
}
