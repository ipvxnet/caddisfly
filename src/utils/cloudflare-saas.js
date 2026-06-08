// Cloudflare for SaaS — Custom Hostnames API. Lets customers attach their own
// domain to a published site. Raw REST (mirrors utils/stripe.js). Graceful when
// unconfigured: isSaaSConfigured(env) is false until CF_API_TOKEN + CF_ZONE_ID
// are set, so the UI can show "not available yet".
//
// Config (secrets/vars on the app worker):
//   CF_API_TOKEN     - token scoped to Zone:SSL and Certificates: Edit on the
//                      caddisfly.app zone (Custom Hostnames)
//   CF_ZONE_ID       - the caddisfly.app zone id
//   SAAS_CNAME_TARGET - the hostname customers CNAME their domain to
//                      (e.g. "sites.caddisfly.app" — the SaaS fallback target)

const CF_API = 'https://api.cloudflare.com/client/v4';

export function isSaaSConfigured(env) {
  return !!(env && env.CF_API_TOKEN && env.CF_ZONE_ID);
}

export function cnameTarget(env) {
  return (env && env.SAAS_CNAME_TARGET) || 'sites.caddisfly.app';
}

/** The sites Worker that serves custom hostnames (per env: prod vs preview). */
export function saasWorkerScript(env) {
  return (env && env.SAAS_WORKER_SCRIPT) || 'caddisfly-sites';
}

/**
 * Ensure a Worker route `<hostname>/*` → the sites worker. REQUIRED for SaaS
 * custom hostnames: Cloudflare matches Worker routes against the incoming
 * (custom) hostname, which never matches *.caddisfly.app — so without this the
 * worker never runs and CF times out on the fallback origin (522). Idempotent:
 * a duplicate route is treated as success.
 */
export async function createWorkerRoute(env, hostname) {
  try {
    await cfRequest(env, 'POST', '/workers/routes', { pattern: `${hostname}/*`, script: saasWorkerScript(env) });
    return true;
  } catch (e) {
    if (/duplicate|already exists|10020/i.test(e.message)) return true; // already routed
    throw e;
  }
}

/** Normalize user input to a bare hostname (lowercase, no scheme/path/port). */
export function normalizeHostname(input) {
  let h = String(input || '').trim().toLowerCase();
  h = h.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:.*$/, '');
  return h;
}

export function isValidHostname(h) {
  // FQDN with a TLD; rejects bare labels and our own apex.
  if (!h || h.length > 253) return false;
  if (h.endsWith('.caddisfly.app') || h === 'caddisfly.app') return false;
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h);
}

async function cfRequest(env, method, path, body) {
  if (!isSaaSConfigured(env)) throw new Error('Cloudflare for SaaS is not configured');
  const res = await fetch(`${CF_API}/zones/${env.CF_ZONE_ID}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const msg = (json.errors && json.errors[0] && json.errors[0].message) || `Cloudflare ${res.status}`;
    throw new Error(msg);
  }
  return json.result;
}

// Normalize a CF custom-hostname result. With HTTP DCV (our default) the
// customer only needs the CNAME — Cloudflare validates + issues the cert over
// HTTP automatically once the hostname points to us, so we surface NO DNS
// validation record. (TXT method, if ever used, still exposes its record.)
function extractRecords(result) {
  const ssl = result.ssl || {};
  const method = ssl.method || 'http';
  const useTxt = method === 'txt';
  const vr = (ssl.validation_records && ssl.validation_records[0]) || {};
  const ov = result.ownership_verification || {};
  return {
    cf_hostname_id: result.id,
    status: result.status || 'pending',
    ssl_status: ssl.status || 'pending_validation',
    // Only TXT DCV needs a customer-added record; HTTP DCV needs none.
    dcv_type: useTxt ? (vr.txt_name ? 'TXT' : ov.type ? ov.type.toUpperCase() : null) : null,
    dcv_name: useTxt ? (vr.txt_name || ov.name || null) : null,
    dcv_value: useTxt ? (vr.txt_value || ov.value || null) : null,
  };
}

/**
 * Create a custom hostname with HTTP DCV. The customer adds ONE record — a
 * CNAME to our SaaS target — and Cloudflare issues + auto-renews the cert over
 * HTTP with no further DNS records. Works across all DNS providers (GoDaddy,
 * Namecheap, Route 53, Cloudflare, …) for subdomains.
 */
export async function createCustomHostname(env, hostname) {
  const result = await cfRequest(env, 'POST', '/custom_hostnames', {
    hostname,
    ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
  });
  // The worker route is what actually makes the sites worker serve this
  // hostname — without it the active cert still 522s. Best-effort here; the
  // reconnect path re-ensures it.
  try {
    await createWorkerRoute(env, hostname);
  } catch (e) {
    console.error('worker route create failed (will retry on reconnect):', e.message);
  }
  return { ...extractRecords(result), cname_target: cnameTarget(env) };
}

/** Delete the Worker route `<hostname>/*` (cleanup on disconnect/offboard).
 *  Best-effort: finds the route by pattern, deletes it. No-op if none. */
export async function deleteWorkerRoute(env, hostname) {
  try {
    const routes = await cfRequest(env, 'GET', '/workers/routes');
    const match = (routes || []).find((r) => r.pattern === `${hostname}/*`);
    if (match) await cfRequest(env, 'DELETE', `/workers/routes/${match.id}`);
    return true;
  } catch (e) {
    console.error('worker route delete failed (ignored):', e.message);
    return false;
  }
}

/** Fetch current state of a custom hostname. */
export async function getCustomHostname(env, id) {
  const result = await cfRequest(env, 'GET', `/custom_hostnames/${id}`);
  return { ...extractRecords(result), cname_target: cnameTarget(env) };
}

/** Delete a custom hostname (ignore 404s). */
export async function deleteCustomHostname(env, id) {
  try {
    await cfRequest(env, 'DELETE', `/custom_hostnames/${id}`);
  } catch (e) {
    if (!/not found|1436|1437/i.test(e.message)) throw e;
  }
}

/** Active = hostname active AND SSL active. */
export function isActive(state) {
  return state && state.status === 'active' && state.ssl_status === 'active';
}
