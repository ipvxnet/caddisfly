// Paid courses (Courses plugin, Phase 5) — buy without a visitor account:
//   POST /api/store/course-checkout      → Stripe Connect checkout for one course
//   GET  /course-access/claim?s=&sid=    → verify paid session, record purchase,
//                                          redirect to the token player
//   GET  /course-access/:token           → the unlocked course player (the token
//                                          IS the credential; emailed to the buyer)
// Reuses the store's Stripe Connect plumbing (createStoreCheckoutSession +
// settleCoursePurchase + the /api/store/webhook backstop). Public + cross-origin
// (the published static site calls the checkout endpoint), like /api/store/checkout.
// Buyer-facing strings are localized to the SITE's language (CP_T, en/es/pt).
import { resolveStoreProject, getOrCreateConfig, settleCoursePurchase } from '../api/ai-builder/store.js';
import { getCourseBySlug, getCourseFull, getCoursePurchaseByToken } from '../../db/courses.js';
import { coursePlayerSection } from '../../utils/course-render.js';
import { renderSection } from '../../templates/ai-builder/registry.js';
import { createStoreCheckoutSession, getStoreCheckoutSession, stripeUnitAmount } from '../../utils/stripe.js';

const PUBLIC_ID_RE = /^[a-f0-9]{32}$/i;
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const CP_T = {
  en: {
    unknown_site: 'Unknown site', no_payments: 'This site isn’t accepting payments yet.',
    not_available: 'Course not available for purchase.', checkout_fail: 'Could not start checkout — please try again.',
    missing_params: 'Missing parameters', verify_fail: 'Could not verify your purchase. Check your email for the access link.',
    processing: 'Payment is still processing — you’ll receive an access link by email shortly.',
    grant_fail: 'Could not grant access — check your email for the link.',
    invalid_link: 'This access link is invalid or has expired.', course_not_found: 'Course not found.',
  },
  es: {
    unknown_site: 'Sitio desconocido', no_payments: 'Este sitio aún no acepta pagos.',
    not_available: 'El curso no está disponible para la compra.', checkout_fail: 'No se pudo iniciar el pago — inténtalo de nuevo.',
    missing_params: 'Faltan parámetros', verify_fail: 'No se pudo verificar tu compra. Revisa tu correo para ver el enlace de acceso.',
    processing: 'El pago aún se está procesando — recibirás un enlace de acceso por correo en breve.',
    grant_fail: 'No se pudo otorgar el acceso — revisa tu correo para ver el enlace.',
    invalid_link: 'Este enlace de acceso no es válido o ha expirado.', course_not_found: 'Curso no encontrado.',
  },
  pt: {
    unknown_site: 'Site desconhecido', no_payments: 'Este site ainda não aceita pagamentos.',
    not_available: 'O curso não está disponível para compra.', checkout_fail: 'Não foi possível iniciar o pagamento — tente novamente.',
    missing_params: 'Parâmetros ausentes', verify_fail: 'Não foi possível verificar sua compra. Verifique seu e-mail para ver o link de acesso.',
    processing: 'O pagamento ainda está sendo processado — você receberá um link de acesso por e-mail em breve.',
    grant_fail: 'Não foi possível conceder o acesso — verifique seu e-mail para ver o link.',
    invalid_link: 'Este link de acesso é inválido ou expirou.', course_not_found: 'Curso não encontrado.',
  },
};
const cpt = (lang) => CP_T[lang] || CP_T.en;

/** Site language for a bridge projectKey (the access route only has the projectKey). */
async function langForProjectKey(env, projectKey) {
  const row = projectKey.aiProjectId != null
    ? await env.DB.prepare('SELECT language FROM ai_projects WHERE id = ?').bind(projectKey.aiProjectId).first()
    : await env.DB.prepare('SELECT language FROM projects WHERE id = ?').bind(projectKey.projectId).first();
  return (row && row.language) || 'en';
}

/** POST /api/store/course-checkout — start a paid-course purchase. */
export async function handleCourseCheckout(ctx) {
  const { env, request } = ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = (body.s || '').toString();
    const r = PUBLIC_ID_RE.test(publicId) ? await resolveStoreProject(env, publicId) : null;
    if (!r) return json({ success: false, error: cpt('en').unknown_site }, 404);
    const T = cpt(r.language);
    const config = await getOrCreateConfig(env.DB, r.projectKey);
    if (!config.stripe_account_id) return json({ success: false, error: T.no_payments }, 503);

    const slug = (body.slug || '').toString();
    const course = await getCourseBySlug(env.DB, r.projectKey, slug);
    if (!course || course.status !== 'published' || !(course.price_cents > 0)) {
      return json({ success: false, error: T.not_available }, 409);
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
      lineItems: [{ price_data: { currency: config.store_currency || 'usd', unit_amount: stripeUnitAmount(course.price_cents, config.store_currency || 'usd'), product_data: productData }, quantity: 1 }],
      successUrl: `${appOrigin}/course-access/claim?s=${publicId}&sid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${path}?cancelled=1`,
      metadata: { type: 'course_purchase', site: publicId, course_id: String(course.id), slug: course.slug },
    });
    return json({ success: true, url: session.url });
  } catch (e) {
    console.error('course checkout error:', e);
    return json({ success: false, error: cpt('en').checkout_fail }, 500);
  }
}

/** GET /course-access/claim?s=&sid= — verify the paid session, record the purchase, redirect to the player. */
export async function handleCourseClaim(ctx) {
  const { env, request } = ctx;
  const url = new URL(request.url);
  const publicId = url.searchParams.get('s') || '';
  const sid = url.searchParams.get('sid') || '';
  const r = PUBLIC_ID_RE.test(publicId) && sid ? await resolveStoreProject(env, publicId) : null;
  const T = cpt(r && r.language);
  if (!PUBLIC_ID_RE.test(publicId) || !sid) return new Response(T.missing_params, { status: 400 });
  if (!r) return new Response(T.unknown_site, { status: 404 });
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  if (!config.stripe_account_id) return new Response(T.unknown_site, { status: 400 });
  let session;
  try { session = await getStoreCheckoutSession(env, config.stripe_account_id, sid); }
  catch { return new Response(T.verify_fail, { status: 400 }); }
  if (!session || session.payment_status !== 'paid') {
    return new Response(T.processing, { status: 202 });
  }
  const settled = await settleCoursePurchase(env, publicId, session);
  if (!settled || !settled.purchase) return new Response(T.grant_fail, { status: 500 });
  return Response.redirect(`${env.APP_URL || ''}/course-access/${settled.purchase.access_token}`, 303);
}

/** GET /course-access/:token — the unlocked player (token = credential). */
export async function handleCourseAccess(ctx) {
  const { env, params } = ctx;
  const purchase = await getCoursePurchaseByToken(env.DB, params.token);
  if (!purchase) return new Response(cpt('en').invalid_link, { status: 404 });
  const projectKey = purchase.ai_project_id != null ? { aiProjectId: purchase.ai_project_id } : { projectId: purchase.project_id };
  const lang = await langForProjectKey(env, projectKey);
  const full = await getCourseFull(env.DB, projectKey, purchase.course_id);
  if (!full) return new Response(cpt(lang).course_not_found, { status: 404 });
  const config = await getOrCreateConfig(env.DB, projectKey);
  const currency = (config && config.store_currency) || 'usd';
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
