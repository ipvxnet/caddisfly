// Paid courses (Courses plugin, Phase 5) — buy without a visitor account:
//   POST /api/store/course-checkout      → Stripe Connect checkout for one course
//   GET  /course-access/claim?s=&sid=    → verify paid session, record purchase,
//                                          redirect to the token player
//   GET  /course-access/:token           → the unlocked course player (the token
//                                          IS the credential; emailed to the buyer)
// Reuses the store's Stripe Connect plumbing (createStoreCheckoutSession +
// settleCoursePurchase + the /api/store/webhook backstop). Public + cross-origin
// (the published static site calls the checkout endpoint), like /api/store/checkout.
import { resolveStoreProject, getOrCreateConfig, settleCoursePurchase } from '../api/ai-builder/store.js';
import { getCourseBySlug, getCourseFull, getCoursePurchaseByToken } from '../../db/courses.js';
import { coursePlayerSection } from '../../utils/course-render.js';
import { renderSection } from '../../templates/ai-builder/registry.js';
import { createStoreCheckoutSession, getStoreCheckoutSession } from '../../utils/stripe.js';

const PUBLIC_ID_RE = /^[a-f0-9]{32}$/i;
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** POST /api/store/course-checkout — start a paid-course purchase. */
export async function handleCourseCheckout(ctx) {
  const { env, request } = ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = (body.s || '').toString();
    if (!PUBLIC_ID_RE.test(publicId)) return json({ success: false, error: 'Unknown site' }, 404);
    const r = await resolveStoreProject(env, publicId);
    if (!r) return json({ success: false, error: 'Unknown site' }, 404);
    const config = await getOrCreateConfig(env.DB, r.projectKey);
    if (!config.stripe_account_id) return json({ success: false, error: 'This site isn’t accepting payments yet.' }, 503);

    const slug = (body.slug || '').toString();
    const course = await getCourseBySlug(env.DB, r.projectKey, slug);
    if (!course || course.status !== 'published' || !(course.price_cents > 0)) {
      return json({ success: false, error: 'Course not available for purchase.' }, 409);
    }

    const appOrigin = env.APP_URL || '';
    const origin = (request.headers.get('Origin') || appOrigin || '').replace(/\/$/, '');
    if (!/^https?:\/\/[\w.-]+(:\d+)?$/.test(origin)) return json({ success: false, error: 'Bad origin' }, 400);
    let path = (body.path || `/courses/${slug}`).toString().split('?')[0].slice(0, 200);
    if (!path.startsWith('/')) path = `/courses/${slug}`;

    const productData = { name: course.title };
    if (course.image) {
      const abs = course.image.startsWith('/') ? `${appOrigin}${course.image}` : course.image;
      if (/^https:\/\//.test(abs)) productData.images = [abs];
    }

    const session = await createStoreCheckoutSession(env, {
      account: config.stripe_account_id,
      lineItems: [{ price_data: { currency: config.store_currency || 'usd', unit_amount: course.price_cents, product_data: productData }, quantity: 1 }],
      successUrl: `${appOrigin}/course-access/claim?s=${publicId}&sid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${path}?cancelled=1`,
      metadata: { type: 'course_purchase', site: publicId, course_id: String(course.id), slug: course.slug },
    });
    return json({ success: true, url: session.url });
  } catch (e) {
    console.error('course checkout error:', e);
    return json({ success: false, error: 'Could not start checkout — please try again.' }, 500);
  }
}

/** GET /course-access/claim?s=&sid= — verify the paid session, record the purchase, redirect to the player. */
export async function handleCourseClaim(ctx) {
  const { env, request } = ctx;
  const url = new URL(request.url);
  const publicId = url.searchParams.get('s') || '';
  const sid = url.searchParams.get('sid') || '';
  if (!PUBLIC_ID_RE.test(publicId) || !sid) return new Response('Missing parameters', { status: 400 });
  const r = await resolveStoreProject(env, publicId);
  if (!r) return new Response('Unknown site', { status: 404 });
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  if (!config.stripe_account_id) return new Response('Not available', { status: 400 });
  let session;
  try { session = await getStoreCheckoutSession(env, config.stripe_account_id, sid); }
  catch { return new Response('Could not verify your purchase. Check your email for the access link.', { status: 400 }); }
  if (!session || session.payment_status !== 'paid') {
    return new Response('Payment is still processing — you’ll receive an access link by email shortly.', { status: 202 });
  }
  const settled = await settleCoursePurchase(env, publicId, session);
  if (!settled || !settled.purchase) return new Response('Could not grant access — check your email for the link.', { status: 500 });
  return Response.redirect(`${env.APP_URL || ''}/course-access/${settled.purchase.access_token}`, 303);
}

/** GET /course-access/:token — the unlocked player (token = credential). */
export async function handleCourseAccess(ctx) {
  const { env, params } = ctx;
  const purchase = await getCoursePurchaseByToken(env.DB, params.token);
  if (!purchase) return new Response('This access link is invalid or has expired.', { status: 404 });
  const projectKey = purchase.ai_project_id != null ? { aiProjectId: purchase.ai_project_id } : { projectId: purchase.project_id };
  const full = await getCourseFull(env.DB, projectKey, purchase.course_id);
  if (!full) return new Response('Course not found.', { status: 404 });
  const config = await getOrCreateConfig(env.DB, projectKey);
  const currency = (config && config.store_currency) || 'usd';
  const lang = (config && config.lang) || 'en';
  // Unlocked render (token access): every lesson open, no buy button.
  const section = coursePlayerSection(full, '', currency, lang, true);
  const body = renderSection('course_player', JSON.parse(section.content_json), { ...(config || {}), lang, embed: true, appOrigin: env.APP_URL || '' }, 'default');
  const html = `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${esc(full.title)}</title>
</head>
<body>${body}</body>
</html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, private' } });
}
