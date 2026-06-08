// Namecheap API client — all calls go through the fixed-IP relay
// (scripts/nc-relay/) because Namecheap allowlists caller IPs and Workers
// have no stable egress IP. Credentials live in worker secrets and travel
// inside each request; the relay only contributes its allowlisted IP.
//
// Secrets: NC_RELAY_URL, NC_RELAY_SECRET, NAMECHEAP_API_USER,
// NAMECHEAP_API_KEY, NAMECHEAP_CLIENT_IP (the relay VPS IP — Namecheap wants
// it in every call). Optional var NAMECHEAP_SANDBOX="1" → sandbox host.

const SANDBOX_HOST = 'api.sandbox.namecheap.com';

// TLDs we quote/sell in v1 (top sellers; premium-name results are skipped).
export const SELL_TLDS = ['com', 'net', 'org', 'co', 'io', 'app', 'dev', 'shop', 'store', 'online', 'site', 'xyz', 'me', 'info', 'biz', 'us'];

export function isNamecheapConfigured(env) {
  return !!(env && env.NC_RELAY_URL && env.NC_RELAY_SECRET && env.NAMECHEAP_API_USER && env.NAMECHEAP_API_KEY && env.NAMECHEAP_CLIENT_IP);
}

// ---- minimal XML helpers (Workers have no DOMParser; Namecheap responses
// are flat, well-formed, attribute-heavy XML — regex extraction is enough) --

/** All occurrences of <tag …attrs…> (self-closing or not) → [{attrs, inner}]. */
export function xmlTags(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}((?:\\s+[\\w:-]+="[^"]*")*)\\s*(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g');
  let m;
  while ((m = re.exec(xml))) {
    const attrs = {};
    const attrRe = /([\w:-]+)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(m[1]))) attrs[a[1]] = decodeXml(a[2]);
    out.push({ attrs, inner: m[2] || '' });
  }
  return out;
}

function decodeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Relay/edge connection hiccups (522/502/503/504) are transient — retry the
// SAFE/idempotent commands. NEVER retry domains.create (non-idempotent).
const TRANSIENT = new Set([502, 503, 504, 522, 524]);

/**
 * Low-level call: POST params to the relay, verify ApiResponse Status="OK".
 * @param {object} opts - { retries } (default 2; pass 0 for non-idempotent calls)
 * @returns {Promise<string>} raw XML
 */
export async function ncRequest(env, command, params = {}, opts = {}) {
  if (!isNamecheapConfigured(env)) throw new Error('Namecheap is not configured');
  const retries = opts.retries != null ? opts.retries : 2;
  const body = new URLSearchParams({
    ApiUser: env.NAMECHEAP_API_USER,
    ApiKey: env.NAMECHEAP_API_KEY,
    UserName: env.NAMECHEAP_API_USER,
    ClientIp: env.NAMECHEAP_CLIENT_IP,
    Command: command,
  });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) body.set(k, String(v));
  }
  if (env.NAMECHEAP_SANDBOX === '1') body.set('__host', SANDBOX_HOST);

  // Bound every attempt so a hung relay/Namecheap call can't make the request
  // hang forever (the cause of "never loads"). Reads are fast when healthy;
  // create/renew pass a longer timeout (the relay's own upstream cap is ~90s).
  const timeoutMs = opts.timeoutMs || 15000;
  let res, lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(500 * attempt);
    try {
      res = await fetch(env.NC_RELAY_URL, {
        method: 'POST',
        headers: { 'X-Relay-Secret': env.NC_RELAY_SECRET, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      lastErr = e; res = null;
      // Timeouts/network errors are transient → retry the safe commands.
      if (attempt < retries) continue;
      throw new Error(`Namecheap relay unreachable: ${e.message}`);
    }
    if (TRANSIENT.has(res.status) && attempt < retries) { lastErr = new Error(`relay ${res.status}`); continue; }
    break;
  }
  const xml = await res.text();
  if (!res.ok) throw new Error(`Namecheap relay ${res.status}`);

  const apiResp = xmlTags(xml, 'ApiResponse')[0];
  if (!apiResp || apiResp.attrs.Status !== 'OK') {
    const err = xmlTags(xml, 'Error')[0];
    const msg = err ? `${err.inner.trim()} (#${err.attrs.Number || '?'})` : 'Namecheap request failed';
    throw new Error(msg);
  }
  return xml;
}

/** Availability for up to 50 domains. → [{domain, available, premium}] */
export async function checkDomains(env, domains) {
  const xml = await ncRequest(env, 'namecheap.domains.check', { DomainList: domains.join(',') });
  return xmlTags(xml, 'DomainCheckResult').map((t) => ({
    domain: (t.attrs.Domain || '').toLowerCase(),
    available: t.attrs.Available === 'true',
    premium: t.attrs.IsPremiumName === 'true',
  }));
}

/** 1-year YourPrice (cents) for a category block within a per-TLD response. */
function categoryPrice1y(xml, categoryName) {
  const cat = xmlTags(xml, 'ProductCategory').find((c) => (c.attrs.Name || '').toLowerCase() === categoryName);
  if (!cat) return null;
  const prod = xmlTags(cat.inner, 'Product')[0];
  if (!prod) return null;
  const p1 = xmlTags(prod.inner, 'Price').find(
    (pr) => pr.attrs.Duration === '1' && (pr.attrs.DurationType || '').toUpperCase() === 'YEAR'
  );
  if (!p1) return null;
  return Math.round(parseFloat(p1.attrs.YourPrice || p1.attrs.Price || '0') * 100) || null;
}

/**
 * Wholesale 1-year register + renew prices for our SELL_TLDS.
 * → { com: {register_cents, renew_cents}, … } (cents; YourPrice = what WE pay)
 *
 * Scoped PER-TLD (ProductName) and fetched concurrently — the unscoped
 * users.getPricing returns Namecheap's whole catalog and times out at the
 * relay. One per-TLD response carries both register + renew categories.
 */
export async function getWholesalePricing(env) {
  const rows = await Promise.all(
    SELL_TLDS.map(async (tld) => {
      try {
        const xml = await ncRequest(env, 'namecheap.users.getPricing', { ProductType: 'DOMAIN', ProductName: tld });
        return { tld, register_cents: categoryPrice1y(xml, 'register'), renew_cents: categoryPrice1y(xml, 'renew') };
      } catch (e) {
        console.error(`pricing for .${tld} failed:`, e.message);
        return { tld, register_cents: null, renew_cents: null };
      }
    })
  );
  const out = {};
  for (const r of rows) {
    if (r.register_cents && r.renew_cents) out[r.tld] = { register_cents: r.register_cents, renew_cents: r.renew_cents };
  }
  return out;
}

/** Map our flat contact object to Namecheap's four role-prefixed contacts. */
function contactParams(contact) {
  const roles = ['Registrant', 'Tech', 'Admin', 'AuxBilling'];
  const fields = {
    FirstName: contact.first_name,
    LastName: contact.last_name,
    Address1: contact.address1,
    City: contact.city,
    StateProvince: contact.state || contact.city,
    PostalCode: contact.postal_code,
    Country: contact.country,
    Phone: contact.phone, // Namecheap format: +NNN.NNNNNNNNNN
    EmailAddress: contact.email,
  };
  const params = {};
  for (const role of roles) {
    for (const [k, v] of Object.entries(fields)) params[`${role}${k}`] = v;
  }
  return params;
}

/**
 * Register a domain (1+ years) with free WhoisGuard enabled.
 * → { domain, registered, charged_amount, domain_id, transaction_id }
 */
export async function registerDomain(env, { domain, years = 1, contact, nameservers = null }) {
  const params = {
    DomainName: domain,
    Years: years,
    AddFreeWhoisguard: 'yes',
    WGEnabled: 'yes',
    ...contactParams(contact),
  };
  if (nameservers) params.Nameservers = nameservers.join(',');
  // NEVER retry registration — it's non-idempotent (the caller verifies with
  // getDomainInfo on error instead).
  const xml = await ncRequest(env, 'namecheap.domains.create', params, { retries: 0, timeoutMs: 95000 });
  const r = xmlTags(xml, 'DomainCreateResult')[0];
  if (!r || r.attrs.Registered !== 'true') throw new Error('Registration was not confirmed by Namecheap');
  return {
    domain: r.attrs.Domain,
    registered: true,
    charged_amount: r.attrs.ChargedAmount,
    domain_id: r.attrs.DomainID,
    transaction_id: r.attrs.TransactionID,
  };
}

/**
 * Read ALL DNS host records for a domain (Namecheap BasicDNS).
 * → [{ name, type, address, mxpref, ttl }]
 */
export async function getDnsHosts(env, domain) {
  const [sld, ...rest] = domain.split('.');
  const xml = await ncRequest(env, 'namecheap.domains.dns.getHosts', { SLD: sld, TLD: rest.join('.') });
  return xmlTags(xml, 'host').map((h) => ({
    name: h.attrs.Name || '',
    type: h.attrs.Type || '',
    address: h.attrs.Address || '',
    mxpref: h.attrs.MXPref || '10',
    ttl: h.attrs.TTL || '1800',
  }));
}

/**
 * Replace ALL DNS records for a domain (Namecheap BasicDNS). hosts:
 * [{ name: '@'|'www'|…, type: 'CNAME'|'A'|'MX'|'TXT'|'URL301'|…, address, mxpref?, ttl? }]
 * setHosts is all-or-nothing, so callers must pass the COMPLETE desired set.
 */
export async function setDnsHosts(env, domain, hosts) {
  const [sld, ...rest] = domain.split('.');
  const params = { SLD: sld, TLD: rest.join('.') };
  hosts.forEach((h, i) => {
    const n = i + 1;
    params[`HostName${n}`] = h.name;
    params[`RecordType${n}`] = h.type;
    params[`Address${n}`] = h.address;
    params[`TTL${n}`] = h.ttl || 1800;
    if (h.type === 'MX') params[`MXPref${n}`] = h.mxpref || 10;
  });
  // Any MX record requires EmailType=MX (else Namecheap ignores MX rows).
  if (hosts.some((h) => h.type === 'MX')) params.EmailType = 'MX';
  // setHosts replaces the full set → idempotent → safe to retry on transient 522.
  const xml = await ncRequest(env, 'namecheap.domains.dns.setHosts', params);
  const r = xmlTags(xml, 'DomainDNSSetHostsResult')[0];
  if (!r || r.attrs.IsSuccess !== 'true') throw new Error('Setting DNS records failed');
  return true;
}

/**
 * Renew a domain for N years. Non-idempotent (charges the operator's NC
 * balance) — caller must guard against double-runs. → { domain_id, charged }
 */
export async function renewDomain(env, domain, years = 1) {
  const xml = await ncRequest(env, 'namecheap.domains.renew', { DomainName: domain, Years: years }, { retries: 0, timeoutMs: 95000 });
  const r = xmlTags(xml, 'DomainRenewResult')[0];
  if (!r || r.attrs.Renew !== 'true') throw new Error('Renewal was not confirmed by Namecheap');
  return { domain_id: r.attrs.DomainID || null, charged: r.attrs.ChargedAmount || null };
}

/** Basic domain info (expiry, status). */
export async function getDomainInfo(env, domain) {
  const xml = await ncRequest(env, 'namecheap.domains.getInfo', { DomainName: domain });
  const r = xmlTags(xml, 'DomainGetInfoResult')[0] || { attrs: {} };
  const expired = xmlTags(xml, 'DomainDetails')[0];
  return {
    status: r.attrs.Status || '',
    expires: expired ? (xmlTags(expired.inner, 'ExpiredDate')[0] || { inner: '' }).inner : '',
  };
}
