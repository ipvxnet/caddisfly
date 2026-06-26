// Members/Auth plugin — PUBLIC member endpoints, called cross-origin from a
// published site (CORS w/ credentials is applied to /api/members/* in index.js).
//
//   POST /api/members/:site/login    { email, name?, return_url?, website? } -> emails a magic link
//   GET  /members/:site/verify?token=…                                        -> sets session cookie, redirects back
//   GET  /api/members/:site/me                                                -> { logged_in, email }
//   POST /api/members/:site/logout                                            -> clears cookie
//
// The roster row is written on VERIFY (proven email ownership), not on the login
// request, so unverified emails never pollute the merchant's member list.
import { jsonResponse, htmlResponse } from '../../utils/response.js';
import { isValidEmail } from '../../utils/email.js';
import { sendMemberMagicLinkEmail } from '../../utils/email.js';
import { upsertMember } from '../../db/site-members.js';
import {
  resolveMemberSite, signMagicToken, verifyMagicToken, signSession,
  readSession, sessionCookie, clearCookie, safeReturnUrl,
} from '../../utils/member-session.js';

const appOrigin = (env) => (env.APP_URL && env.APP_URL.startsWith('http') ? env.APP_URL : 'https://caddisfly.ai');

/** POST /api/members/:site/login — email a magic sign-in link. */
export async function handleMemberLogin(ctx) {
  const { env, request, params } = ctx;
  const site = await resolveMemberSite(env, params.site);
  if (!site) return jsonResponse({ success: false, error: 'site_not_found' }, 404);

  const body = await request.json().catch(() => ({}));
  if (body.website) return jsonResponse({ success: true }); // honeypot: pretend success
  const email = String(body.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return jsonResponse({ success: false, error: 'invalid_email' }, 400);
  const name = String(body.name || '').slice(0, 120);

  const ret = safeReturnUrl(body.return_url, site.domains || []);
  const token = await signMagicToken(env, { site: params.site, email, name, ret });
  const verifyUrl = `${appOrigin(env)}/members/${encodeURIComponent(params.site)}/verify?token=${encodeURIComponent(token)}`;

  await sendMemberMagicLinkEmail(env, { to: email, siteName: site.siteName, linkUrl: verifyUrl, lang: site.lang });
  // Never reveal whether the email already had an account.
  return jsonResponse({ success: true });
}

/** GET /members/:site/verify?token=… — consume the magic link, set the session. */
export async function handleMemberVerify(ctx) {
  const { env, request, params } = ctx;
  const url = new URL(request.url);
  const payload = await verifyMagicToken(env, url.searchParams.get('token') || '');
  const site = await resolveMemberSite(env, params.site);

  if (!payload || !site || payload.s !== params.site) {
    return htmlResponse(memberNoticePage('This sign-in link is invalid or has expired.', ''), 400);
  }

  const member = await upsertMember(env.DB, site.projectKey, { email: payload.e, name: payload.n || '' });
  const token = await signSession(env, { site: params.site, email: payload.e, mid: member ? member.id : 0 });

  const ret = safeReturnUrl(payload.r, site.domains || []);
  const headers = { 'Set-Cookie': sessionCookie(token) };
  if (ret) return new Response(null, { status: 302, headers: { ...headers, Location: ret } });
  return htmlResponse(memberNoticePage("You're signed in ✓", 'You can return to the site and refresh the page.'), 200, headers);
}

/** GET /api/members/:site/me — session status for the on-page widget. */
export async function handleMemberMe(ctx) {
  const { env, request, params } = ctx;
  const session = await readSession(env, request, params.site);
  if (!session) return jsonResponse({ logged_in: false });
  return jsonResponse({ logged_in: true, email: session.e });
}

/** POST /api/members/:site/logout — clear the session cookie. */
export async function handleMemberLogout() {
  return jsonResponse({ success: true }, 200, { 'Set-Cookie': clearCookie() });
}

function memberNoticePage(heading, sub) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title>
  <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f5f6fa;color:#2d3748;text-align:center}.card{background:#fff;border-radius:14px;padding:2.5rem 2rem;max-width:420px;box-shadow:0 10px 30px rgba(0,0,0,.08)}h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#718096}</style>
  </head><body><div class="card"><h1>${esc(heading)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></body></html>`;
}
