// Members/Auth plugin — PUBLIC member endpoints, called cross-origin from a
// published site (CORS w/ credentials is applied to /api/members/* in index.js).
//
//   POST /api/members/:site/login    { email, name?, return_url?, website? } -> emails a magic link
//   GET  /members/:site/verify?token=…                                        -> sets session cookie, redirects back
//   GET  /api/members/:site/me                                                -> { logged_in, email }
//   POST /api/members/:site/logout                                            -> clears cookie
//   GET  /api/members/:site/content?page=<slug>                               -> real body of a members-only page (members only)
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
import { getMemberByEmail } from '../../db/site-members.js';
import { hasPlugin, entitledSectionFilter } from '../../plugins/entitlements.js';
import { getPageBySlug, getHomePage, getPagesByProject } from '../../db/ai-pages.js';
import { getHomeBodySections, getBodySectionsForPage } from '../../db/ai-sections.js';
import { getProductsByProject } from '../../db/products.js';
import { annotateProductsWithVariants } from '../../db/variants.js';
import { getServices } from '../../db/bookings.js';
import { getCoursesByProject } from '../../db/courses.js';
import { assemblePage } from '../../utils/ai-page-assembler.js';

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

/** GET /api/members/:site/content?page=<slug> — the REAL body of a members-only
 *  page, served ONLY to a valid signed-in member (the public page ships just a
 *  gate; this is injected client-side). Returns { html:'' } for non-gated pages
 *  or when the owner isn't entitled — never leaks gated content to non-members. */
export async function handleMemberContent(ctx) {
  const { env, request, params } = ctx;
  const url = new URL(request.url);
  const session = await readSession(env, request, params.site);
  if (!session) return jsonResponse({ error: 'not_a_member' }, 401);
  const site = await resolveMemberSite(env, params.site);
  if (!site) return jsonResponse({ error: 'site_not_found' }, 404);

  // Blocked members get nothing; gating is real only when the owner is entitled.
  const member = await getMemberByEmail(env.DB, site.projectKey, session.e);
  if (!member || member.status === 'blocked') return jsonResponse({ error: 'forbidden' }, 403);
  if (!(await hasPlugin(env, site.ownerEmail, 'members'))) return jsonResponse({ html: '' });

  const slug = (url.searchParams.get('page') || '').trim();
  const page = slug ? await getPageBySlug(env.DB, site.projectKey, slug) : await getHomePage(env.DB, site.projectKey);
  if (!page) return jsonResponse({ html: '' });

  const filterSections = await entitledSectionFilter(env, site.ownerEmail);
  const body = filterSections(page.is_home
    ? await getHomeBodySections(env.DB, site.projectKey, page.id, true)
    : await getBodySectionsForPage(env.DB, page.id, true));
  if (!body.length) return jsonResponse({ html: '' });

  // Same live data deploy injects, so gated content renders identically.
  const products = await getProductsByProject(env.DB, site.projectKey, true);
  await annotateProductsWithVariants(env.DB, site.projectKey, products);
  const courses = (await hasPlugin(env, site.ownerEmail, 'courses'))
    ? await getCoursesByProject(env.DB, site.projectKey, { publishedOnly: true }) : [];
  const bookingServices = await getServices(env.DB, site.projectKey, { activeOnly: true });
  const hasAdvStore = await hasPlugin(env, site.ownerEmail, 'advanced_store');
  let pages = [];
  try { pages = await getPagesByProject(env.DB, site.projectKey); } catch { /* nav anchors best-effort */ }

  // Render the given sections (NOT gated) and return the <main> inner.
  const renderBody = (secs) => {
    const full = assemblePage(secs, site.config || {}, { project_name: site.siteName }, {
      pages, currentSlug: page.slug, preordered: true, previewBase: '',
      trackId: params.site, appOrigin: env.APP_URL || '', lang: site.lang,
      products, courses, bookingServices, hasAdvStore,
    });
    const m = full.match(/<main>([\s\S]*?)<\/main>/i);
    return m ? m[1].trim() : '';
  };

  // Whole-page gate (2a): return the full body. Else per-section gate (2b):
  // return each members-only section keyed by id.
  if (page.members_only) return jsonResponse({ html: renderBody(body) });
  const isMO = (s) => { try { const v = JSON.parse(s.content_json || '{}')._members_only; return v === true || v === 1 || v === '1'; } catch { return false; } };
  const gated = body.filter(isMO);
  if (!gated.length) return jsonResponse({ sections: [] });
  return jsonResponse({ sections: gated.map((s) => ({ id: s.id, html: renderBody([s]) })) });
}

function memberNoticePage(heading, sub) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title>
  <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f5f6fa;color:#2d3748;text-align:center}.card{background:#fff;border-radius:14px;padding:2.5rem 2rem;max-width:420px;box-shadow:0 10px 30px rgba(0,0,0,.08)}h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#718096}</style>
  </head><body><div class="card"><h1>${esc(heading)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></body></html>`;
}
