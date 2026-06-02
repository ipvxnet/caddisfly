// POST /api/track — first-party, cookieless analytics beacon for published sites.
// No cookies and no stored IP. A daily, per-site pseudonymous visitor_hash
// (sha256 of site|day|ip|user-agent) is used only to count daily uniques; it
// cannot follow a visitor across days or sites and is never reversible to an IP.

import { recordEvent } from '../../db/analytics.js';

const PUBLIC_ID_RE = /^[a-f0-9-]{8,64}$/i;

function utcDay(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function deviceFromUA(ua) {
  const s = (ua || '').toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet';
  if (/mobi|iphone|android.*mobile|phone/.test(s)) return 'mobile';
  return 'desktop';
}

function hostOf(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleTrack(ctx) {
  const { request, env } = ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = (body.s || '').toString();
    if (!PUBLIC_ID_RE.test(publicId)) {
      return new Response(null, { status: 204 }); // ignore junk silently
    }

    const ts = Math.floor(Date.now() / 1000);
    const day = utcDay(ts);
    const path = (body.p || '/').toString().slice(0, 200);
    const referrerHost = hostOf((body.r || '').toString());
    const country = request.headers.get('CF-IPCountry') || (request.cf && request.cf.country) || '';
    const ua = request.headers.get('User-Agent') || '';
    const device = deviceFromUA(ua);

    // Pseudonymous daily-unique key — IP+UA are hashed with the site and day and
    // never stored in the clear.
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const visitorHash = (await sha256Hex(`${publicId}|${day}|${ip}|${ua}`)).slice(0, 32);

    await recordEvent(env.DB, {
      public_id: publicId,
      day,
      path,
      referrer_host: referrerHost,
      country: country === 'XX' ? '' : country,
      device,
      visitor_hash: visitorHash,
      created_at: ts,
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('track error:', e.message);
    return new Response(null, { status: 204 }); // never break the visitor's page
  }
}
