// Courses v2 — PUBLIC enrollment endpoints, called cross-origin from a published
// site (credentialed CORS is applied to /api/courses/* in index.js, same as
// /api/members/*). The published player ships only an enroll gate; these endpoints
// resolve enrollment, enroll the member, and serve the real player on demand.
//
//   GET  /api/courses/:site/access?slug=  -> { logged_in, enrolled, is_paid, price_cents, currency }
//   POST /api/courses/:site/enroll        { slug, path? }  -> free: { enrolled:true } · paid: { checkout_url }
//   GET  /api/courses/:site/player?slug=  -> { html } the real player (enrolled members only)
//
// Identity = the shared member session cookie (cf_member); sign-in itself happens
// via the Members endpoints (/api/members/:site/login). Course gating is part of
// the COURSES plugin and does NOT require the Members plugin.
import { jsonResponse } from '../../utils/response.js';
import { resolveMemberSite, readSession } from '../../utils/member-session.js';
import { getMemberByEmail, upsertMember } from '../../db/site-members.js';
import { getCourseBySlug, getCourseFull } from '../../db/courses.js';
import { isEnrolled, enrollMember } from '../../db/course-enrollments.js';
import { hasPlugin } from '../../plugins/entitlements.js';
import { coursePlayerSection } from '../../utils/course-render.js';
import { renderSection } from '../../templates/ai-builder/registry.js';
import { getOrCreateConfig } from './ai-builder/store.js';
import { createStoreCheckoutSession, stripeUnitAmount } from '../../utils/stripe.js';

/** Resolve the published course (published only) + the calling member, if any. */
async function resolve(ctx) {
  const { env, request, params } = ctx;
  const site = await resolveMemberSite(env, params.site);
  if (!site) return { error: jsonResponse({ error: 'site_not_found' }, 404) };
  const entitled = await hasPlugin(env, site.ownerEmail, 'courses');
  const session = await readSession(env, request, params.site);
  let member = null;
  if (session) {
    member = await getMemberByEmail(env.DB, site.projectKey, session.e);
    if (member && member.status === 'blocked') member = null;
  }
  return { site, entitled, session, member };
}

/** GET /api/courses/:site/access?slug= — enrollment state for the gate script. */
export async function handleCourseAccessState(ctx) {
  const { env } = ctx;
  const r = await resolve(ctx);
  if (r.error) return r.error;
  const slug = (new URL(ctx.request.url).searchParams.get('slug') || '').trim();
  const course = slug ? await getCourseBySlug(env.DB, r.site.projectKey, slug) : null;
  if (!r.entitled || !course || course.status !== 'published') {
    return jsonResponse({ logged_in: !!r.member, enrolled: false, is_paid: false, price_cents: 0, currency: 'usd' });
  }
  const enrolled = r.member ? await isEnrolled(env.DB, r.site.projectKey, course.id, r.member.id) : false;
  const config = await getOrCreateConfig(env.DB, r.site.projectKey);
  return jsonResponse({
    logged_in: !!r.member,
    enrolled,
    is_paid: (course.price_cents || 0) > 0,
    price_cents: course.price_cents || 0,
    currency: (config && config.store_currency) || 'usd',
  });
}

/** POST /api/courses/:site/enroll — free: enroll the member; paid: start checkout. */
export async function handleCourseEnroll(ctx) {
  const { env, request, params } = ctx;
  const r = await resolve(ctx);
  if (r.error) return r.error;
  if (!r.entitled) return jsonResponse({ error: 'forbidden' }, 403);
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || '').trim();
  const course = slug ? await getCourseBySlug(env.DB, r.site.projectKey, slug) : null;
  if (!course || course.status !== 'published') return jsonResponse({ error: 'not_available' }, 409);

  // FREE → require a signed-in member, enroll immediately.
  if (!(course.price_cents > 0)) {
    if (!r.member) return jsonResponse({ error: 'not_a_member' }, 401);
    await enrollMember(env.DB, r.site.projectKey, { courseId: course.id, memberId: r.member.id, source: 'free' });
    return jsonResponse({ enrolled: true });
  }

  // PAID → Stripe Connect checkout (email collected at checkout; settle enrolls).
  const config = await getOrCreateConfig(env.DB, r.site.projectKey);
  if (!config.stripe_account_id) return jsonResponse({ error: 'no_payments' }, 503);
  const appOrigin = env.APP_URL || '';
  const origin = (request.headers.get('Origin') || appOrigin || '').replace(/\/$/, '');
  if (!/^https?:\/\/[\w.-]+(:\d+)?$/.test(origin)) return jsonResponse({ error: 'bad_origin' }, 400);
  let path = String(body.path || `/courses/${slug}`).split('?')[0].slice(0, 200);
  if (!path.startsWith('/')) path = `/courses/${slug}`;

  const cur = config.store_currency || 'usd';
  const productData = { name: course.title };
  if (course.image) {
    const abs = course.image.startsWith('/') ? `${appOrigin}${course.image}` : course.image;
    if (/^https:\/\//.test(abs)) productData.images = [abs];
  }
  try {
    const session = await createStoreCheckoutSession(env, {
      account: config.stripe_account_id,
      lineItems: [{ price_data: { currency: cur, unit_amount: stripeUnitAmount(course.price_cents, cur), product_data: productData }, quantity: 1 }],
      successUrl: `${appOrigin}/course-access/claim?s=${encodeURIComponent(params.site)}&sid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${path}?cancelled=1`,
      // member_email (if signed in) ties the enrollment to the session identity.
      metadata: { type: 'course_purchase', site: params.site, course_id: String(course.id), slug: course.slug, member_email: (r.session && r.session.e) || '' },
    });
    return jsonResponse({ checkout_url: session.url });
  } catch (e) {
    console.error('course enroll checkout error:', e);
    return jsonResponse({ error: 'checkout_fail' }, 500);
  }
}

/** GET /api/courses/:site/player?slug= — the REAL player, enrolled members only. */
export async function handleCoursePlayer(ctx) {
  const { env } = ctx;
  const r = await resolve(ctx);
  if (r.error) return r.error;
  if (!r.session) return jsonResponse({ error: 'not_a_member' }, 401);
  if (!r.entitled) return jsonResponse({ html: '' });
  if (!r.member) return jsonResponse({ error: 'forbidden' }, 403);
  const slug = (new URL(ctx.request.url).searchParams.get('slug') || '').trim();
  const course = slug ? await getCourseBySlug(env.DB, r.site.projectKey, slug) : null;
  if (!course || course.status !== 'published') return jsonResponse({ html: '' });
  if (!(await isEnrolled(env.DB, r.site.projectKey, course.id, r.member.id))) {
    return jsonResponse({ error: 'not_enrolled' }, 403);
  }
  const full = await getCourseFull(env.DB, r.site.projectKey, course.id);
  if (!full) return jsonResponse({ html: '' });
  const config = await getOrCreateConfig(env.DB, r.site.projectKey);
  const currency = (config && config.store_currency) || 'usd';
  // Enrolled → unlocked render (every lesson open, no buy button).
  const section = coursePlayerSection(full, '', currency, r.site.lang, true);
  const html = renderSection('course_player', JSON.parse(section.content_json), { ...(config || {}), lang: r.site.lang, embed: true, appOrigin: env.APP_URL || '' }, 'default');
  return jsonResponse({ html });
}
