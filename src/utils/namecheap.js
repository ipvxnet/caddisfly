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

/**
 * Low-level call: POST params to the relay, verify ApiResponse Status="OK".
 * @returns {Promise<string>} raw XML
 */
export async function ncRequest(env, command, params = {}) {
  if (!isNamecheapConfigured(env)) throw new Error('Namecheap is not configured');
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

  const res = await fetch(env.NC_RELAY_URL, {
    method: 'POST',
    headers: { 'X-Relay-Secret': env.NC_RELAY_SECRET, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
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

/**
 * Wholesale 1-year register + renew prices for our SELL_TLDS.
 * → { com: {register_cents, renew_cents}, … } (cents; YourPrice = what WE pay)
 */
export async function getWholesalePricing(env) {
  const out = {};
  for (const category of ['REGISTER', 'RENEW']) {
    const xml = await ncRequest(env, 'namecheap.users.getPricing', {
      ProductType: 'DOMAIN',
      ProductCategory: category,
    });
    // <Product Name="com"><Price Duration="1" DurationType="YEAR" YourPrice="9.58" …/></Product>
    for (const p of xmlTags(xml, 'Product')) {
      const tld = (p.attrs.Name || '').toLowerCase();
      if (!SELL_TLDS.includes(tld)) continue;
      const price1y = xmlTags(p.inner, 'Price').find(
        (pr) => pr.attrs.Duration === '1' && (pr.attrs.DurationType || '').toUpperCase() === 'YEAR'
      );
      if (!price1y) continue;
      const cents = Math.round(parseFloat(price1y.attrs.YourPrice || price1y.attrs.Price || '0') * 100);
      if (!cents) continue;
      out[tld] = out[tld] || {};
      out[tld][category === 'REGISTER' ? 'register_cents' : 'renew_cents'] = cents;
    }
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
  const xml = await ncRequest(env, 'namecheap.domains.create', params);
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
 * Replace ALL DNS records for a domain (Namecheap BasicDNS). hosts:
 * [{ name: '@'|'www'|…, type: 'CNAME'|'A'|'URL301'|…, address, ttl? }]
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
  });
  const xml = await ncRequest(env, 'namecheap.domains.dns.setHosts', params);
  const r = xmlTags(xml, 'DomainDNSSetHostsResult')[0];
  if (!r || r.attrs.IsSuccess !== 'true') throw new Error('Setting DNS records failed');
  return true;
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
