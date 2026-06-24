// Recipient-facing website-transfer acceptance: the gated accept page, the
// execute-on-accept, and decline. The recipient must be signed in AS the
// recipient email and meet the site's requirements (their plan, not the
// sender's). Accepting flips ownership. See db/site-transfer.js + api/transfer.js.
// i18n: local TA dict (en/es/pt), resolved by ctx.lang.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getBillingAccount, countPublishedSites } from '../../db/billing.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { PUBLISH_LIMITS } from '../../utils/credits.js';
import { PLUGINS } from '../../plugins/manifest.js';
import { audit } from '../../utils/audit.js';
import { priceIdFor, createBundleCheckoutSession, isStripeConfigured, getSubscription, addSubscriptionItem } from '../../utils/stripe.js';
import { upsertAccountPlugin } from '../../db/account-plugins.js';
import { unmetRequirements, isMet } from '../api/transfer.js';
import { getTransferByToken, setTransferStatus, executeTransfer, countManagedPublishedSites } from '../../db/site-transfer.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const keyOf = (t) => (t.ai_project_id != null ? { aiProjectId: t.ai_project_id } : { projectId: t.project_id });

const TA = {
  en: {
    meta_title: 'Accept a website — Caddisfly', meta_desc: 'Accept a website transfer.',
    invalid_title: "This transfer link isn't valid",
    invalid_body: 'It may have been accepted, cancelled, or expired. Ask the sender to start a new transfer.',
    go_dashboard: 'Go to dashboard', site_fallback: 'this website',
    accept_title: 'Accept "{name}"',
    signin_body: '{from} wants to transfer this website to {to}. Sign in to that email to continue.',
    email_link_btn: 'Email me a sign-in link', onetime: 'A one-time link goes to {email}.',
    wrong_title: 'Wrong account', wrong_body: "This transfer is for {to}, but you're signed in as {you}.",
    signout: 'Sign out', reopen_tail: ', then open the link from your email again.',
    needed: 'needed', tier_domain: 'Starter+ (this site has a custom domain)', tier_base: 'Starter or higher',
    paid_plan: 'Paid plan — {tier}', plugin_suffix: '{label} plugin',
    room_limit: "You're at your published-site limit ({used}/{limit}). Free a slot or upgrade before accepting.",
    subscribe_btn: 'Subscribe & continue',
    finishing: 'Finishing your subscription… give it a few seconds and refresh this page.',
    one_checkout: "One checkout covers everything above. After you pay, you'll land back here to finish the transfer.",
    accept_btn: 'Accept transfer',
    accept_intro: "{from} is transferring this website to you. Once you accept it's yours — billed and gated by your plan{keep}.",
    keep_clause: ', and {from} keeps Builder access', no_special: 'No special requirements', decline: 'Decline',
  },
  es: {
    meta_title: 'Acepta un sitio web — Caddisfly', meta_desc: 'Acepta una transferencia de sitio web.',
    invalid_title: 'Este enlace de transferencia no es válido',
    invalid_body: 'Puede haber sido aceptado, cancelado o expirado. Pide al remitente que inicie una nueva transferencia.',
    go_dashboard: 'Ir al panel', site_fallback: 'este sitio web',
    accept_title: 'Acepta "{name}"',
    signin_body: '{from} quiere transferir este sitio web a {to}. Inicia sesión en ese correo para continuar.',
    email_link_btn: 'Envíame un enlace para iniciar sesión', onetime: 'Un enlace único se envía a {email}.',
    wrong_title: 'Cuenta incorrecta', wrong_body: 'Esta transferencia es para {to}, pero has iniciado sesión como {you}.',
    signout: 'Cerrar sesión', reopen_tail: ', luego abre el enlace de tu correo nuevamente.',
    needed: 'necesario', tier_domain: 'Starter+ (este sitio tiene un dominio personalizado)', tier_base: 'Starter o superior',
    paid_plan: 'Plan de pago — {tier}', plugin_suffix: 'plugin {label}',
    room_limit: 'Estás en tu límite de sitios publicados ({used}/{limit}). Libera un espacio o mejora tu plan antes de aceptar.',
    subscribe_btn: 'Suscríbete y continúa',
    finishing: 'Finalizando tu suscripción… espera unos segundos y recarga esta página.',
    one_checkout: 'Una única compra cubre todo lo anterior. Después de pagar, regresarás aquí para terminar la transferencia.',
    accept_btn: 'Aceptar transferencia',
    accept_intro: '{from} te está transfiriendo este sitio web. Una vez que lo aceptes, será tuyo — facturado y gestionado según tu plan{keep}.',
    keep_clause: ', y {from} mantiene el acceso del creador', no_special: 'No hay requisitos especiales', decline: 'Rechazar',
  },
  pt: {
    meta_title: 'Aceite um site — Caddisfly', meta_desc: 'Aceite uma transferência de site.',
    invalid_title: 'Este link de transferência não é válido',
    invalid_body: 'Ele pode ter sido aceito, cancelado ou expirado. Peça ao remetente para iniciar uma nova transferência.',
    go_dashboard: 'Ir para o painel', site_fallback: 'este site',
    accept_title: 'Aceite "{name}"',
    signin_body: '{from} quer transferir este site para {to}. Faça login nesse e-mail para continuar.',
    email_link_btn: 'Envie-me um link para fazer login', onetime: 'Um link único é enviado para {email}.',
    wrong_title: 'Conta incorreta', wrong_body: 'Esta transferência é para {to}, mas você está conectado como {you}.',
    signout: 'Sair', reopen_tail: ', depois abra o link do seu e-mail novamente.',
    needed: 'necessário', tier_domain: 'Starter+ (este site tem um domínio personalizado)', tier_base: 'Starter ou superior',
    paid_plan: 'Plano pago — {tier}', plugin_suffix: 'plugin {label}',
    room_limit: 'Você atingiu seu limite de sites publicados ({used}/{limit}). Libere uma vaga ou faça upgrade antes de aceitar.',
    subscribe_btn: 'Assine e continue',
    finishing: 'Finalizando sua assinatura… espere alguns segundos e recarregue esta página.',
    one_checkout: 'Um único checkout cobre tudo acima. Após o pagamento, você voltará aqui para concluir a transferência.',
    accept_btn: 'Aceitar transferência',
    accept_intro: '{from} está transferindo este site para você. Assim que você aceitar, ele será seu — cobrado e gerenciado de acordo com o seu plano{keep}.',
    keep_clause: ', e {from} mantém o acesso do criador', no_special: 'Nenhuma exigência especial', decline: 'Recusar',
  },
};
const ta = (lang) => TA[lang] || TA.en;

function shell(inner, origin, T, lang = 'en') {
  return htmlResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: T.meta_desc, origin, path: '/transfer/accept' })}<meta name="robots" content="noindex">
  <style>${baseCss()}
    main{min-height:60vh}.twrap{max-width:560px;margin:0 auto;padding:3rem 1.5rem}
    .tcard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.8rem}
    .tcard h1{font-size:1.4rem;color:var(--ink);margin:0 0 .6rem}.sub{color:var(--body);line-height:1.6}
    .req{list-style:none;padding:0;margin:1.2rem 0}
    .req li{padding:.6rem 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:.6rem;font-size:.92rem}
    .ok{color:#15803d;font-weight:800}.miss{color:#b91c1c;font-weight:700;text-decoration:none}
    .btn-full{width:100%;justify-content:center;margin-top:.6rem}.muted{color:var(--muted);font-size:.84rem}
  </style></head><body>${siteHeader('/', {})}<main><div class="twrap"><div class="tcard">${inner}</div></div></main>${siteFooter({ lang })}</body></html>`);
}

async function siteInfo(env, projectKey) {
  if (projectKey.aiProjectId != null) {
    const p = await env.DB.prepare(`SELECT project_name AS name, status FROM ai_projects WHERE id = ?`).bind(projectKey.aiProjectId).first();
    return p ? { name: p.name || 'Website', published: p.status === 'deployed' } : null;
  }
  const p = await env.DB.prepare(`SELECT website_url AS name, status FROM projects WHERE id = ?`).bind(projectKey.projectId).first();
  return p ? { name: p.name || 'Website', published: p.status === 'deployed' } : null;
}

/** GET /transfer/accept/:token */
export async function handleTransferAcceptPage(ctx) {
  const { env, params, url } = ctx;
  const origin = url.origin;
  const lang = (ctx && ctx.lang) || 'en';
  const T = ta(lang);
  const t = await getTransferByToken(env.DB, params.token);
  const now = Math.floor(Date.now() / 1000);
  if (!t || t.status !== 'pending' || t.expires_at <= now) {
    return shell(`<h1>${T.invalid_title}</h1><p class="sub">${T.invalid_body}</p>
      <p style="margin-top:1.2rem"><a class="btn btn-ghost" href="/dashboard">${T.go_dashboard}</a></p>`, origin, T, lang);
  }
  const site = await siteInfo(env, keyOf(t));
  const siteName = esc(site ? site.name : T.site_fallback);
  const reqs = (() => { try { return JSON.parse(t.requirements_json || '{}'); } catch { return {}; } })();
  const next = `/transfer/accept/${params.token}`;

  if (!ctx.billingEmail) {
    return shell(`<h1>${T.accept_title.replace('{name}', siteName)}</h1>
      <p class="sub">${T.signin_body.replace('{from}', `<strong>${esc(t.from_email)}</strong>`).replace('{to}', `<strong>${esc(t.to_email)}</strong>`)}</p>
      <form method="POST" action="/api/billing/login" style="margin-top:1.2rem">
        <input type="hidden" name="email" value="${esc(t.to_email)}"><input type="hidden" name="next" value="${esc(next)}">
        <button class="btn btn-primary btn-full" type="submit">${T.email_link_btn}</button>
      </form><p class="muted" style="margin-top:.8rem">${T.onetime.replace('{email}', esc(t.to_email))}</p>`, origin, T, lang);
  }
  if (String(ctx.billingEmail).toLowerCase() !== String(t.to_email).toLowerCase()) {
    return shell(`<h1>${T.wrong_title}</h1>
      <p class="sub">${T.wrong_body.replace('{to}', `<strong>${esc(t.to_email)}</strong>`).replace('{you}', `<strong>${esc(ctx.billingEmail)}</strong>`)}</p>
      <p style="margin-top:1.2rem"><a class="btn btn-ghost" href="/billing/logout">${T.signout}</a>${T.reopen_tail}</p>`, origin, T, lang);
  }

  const missing = await unmetRequirements(env, ctx.billingEmail, reqs);
  const met = isMet(missing);
  const subscribed = url.searchParams.get('subscribed') === '1';
  const reqRow = (label, ok) => `<li><span>${esc(label)}</span><span class="${ok ? 'ok' : 'miss'}">${ok ? '✓' : '• ' + T.needed}</span></li>`;
  let rows = '';
  if (reqs.base || reqs.domain) {
    const tierLabel = reqs.domain ? T.tier_domain : T.tier_base;
    rows += reqRow(T.paid_plan.replace('{tier}', tierLabel), !missing.base && !missing.domain);
  }
  for (const pk of reqs.plugins || []) rows += reqRow(T.plugin_suffix.replace('{label}', (PLUGINS[pk] || {}).label || pk), !missing.plugins.includes(pk));

  let roomNote = '';
  if (site && site.published) {
    const tier = await getUserTier(env.DB, ctx.billingEmail);
    const limit = PUBLISH_LIMITS[tier];
    if (limit !== Infinity) {
      const used = (await countPublishedSites(env.DB, ctx.billingEmail)) + (await countManagedPublishedSites(env.DB, ctx.billingEmail));
      if (used >= limit) roomNote = `<p class="miss" style="margin:.4rem 0">${T.room_limit.replace('{used}', used).replace('{limit}', limit)}</p>`;
    }
  }

  let action;
  if (!met) {
    // ONE checkout for everything the recipient is missing (plan + plugins).
    action = `<form method="POST" action="/transfer/accept/${esc(params.token)}/subscribe">
        <button class="btn btn-primary btn-full" type="submit">${T.subscribe_btn}</button></form>
      <p class="muted" style="margin-top:.6rem">${subscribed ? T.finishing : T.one_checkout}</p>`;
  } else if (roomNote) {
    action = `<button class="btn btn-primary btn-full" disabled style="opacity:.5;cursor:not-allowed">${T.accept_btn}</button>`;
  } else {
    action = `<form method="POST" action="/transfer/accept/${esc(params.token)}"><button class="btn btn-primary btn-full" type="submit">${T.accept_btn}</button></form>`;
  }
  const keepClause = t.keep_builder_access ? T.keep_clause.replace('{from}', esc(t.from_email)) : '';
  return shell(`<h1>${T.accept_title.replace('{name}', siteName)}</h1>
    <p class="sub">${T.accept_intro.replace('{from}', `<strong>${esc(t.from_email)}</strong>`).replace('{keep}', keepClause)}</p>
    <ul class="req">${rows || `<li><span>${T.no_special}</span><span class="ok">✓</span></li>`}</ul>
    ${roomNote}${action}
    <form method="POST" action="/transfer/decline/${esc(params.token)}" style="margin-top:.4rem"><button class="btn btn-ghost btn-full" type="submit">${T.decline}</button></form>`, origin, T, lang);
}

/** POST /transfer/accept/:token — execute the ownership move. */
export async function handleTransferAcceptExecute(ctx) {
  const { env, params } = ctx;
  const t = await getTransferByToken(env.DB, params.token);
  const now = Math.floor(Date.now() / 1000);
  if (!t || t.status !== 'pending' || t.expires_at <= now) return redirect('/dashboard?transfer=invalid', 303);
  if (!ctx.billingEmail || String(ctx.billingEmail).toLowerCase() !== String(t.to_email).toLowerCase()) return redirect(`/transfer/accept/${params.token}`, 303);
  const projectKey = keyOf(t);
  const reqs = (() => { try { return JSON.parse(t.requirements_json || '{}'); } catch { return {}; } })();
  const missing = await unmetRequirements(env, ctx.billingEmail, reqs);
  if (!isMet(missing)) return redirect(`/transfer/accept/${params.token}?err=requirements`, 303);
  const site = await siteInfo(env, projectKey);
  if (site && site.published) {
    const tier = await getUserTier(env.DB, ctx.billingEmail);
    const limit = PUBLISH_LIMITS[tier];
    if (limit !== Infinity) {
      const used = (await countPublishedSites(env.DB, ctx.billingEmail)) + (await countManagedPublishedSites(env.DB, ctx.billingEmail));
      if (used >= limit) return redirect(`/transfer/accept/${params.token}?err=limit`, 303);
    }
  }
  const acct = await getBillingAccount(env.DB, ctx.billingEmail);
  await executeTransfer(env.DB, projectKey, {
    fromEmail: t.from_email, toEmail: t.to_email, keepBuilder: !!t.keep_builder_access,
    recipientStripeCustomerId: acct && acct.stripe_customer_id,
  });
  await setTransferStatus(env.DB, t.id, 'accepted');
  audit(ctx, 'site.transfer.accept', { resourceType: 'project', resourceName: site ? site.name : '', metadata: { from: t.from_email, keep_builder: !!t.keep_builder_access } });
  return redirect('/dashboard?transfer=accepted', 303);
}

/** POST /transfer/accept/:token/subscribe — one checkout for ALL the requirements
 *  the recipient is missing (base plan + plugins), then back to the accept page. */
export async function handleTransferSubscribe(ctx) {
  const { env, params, url } = ctx;
  const t = await getTransferByToken(env.DB, params.token);
  const now = Math.floor(Date.now() / 1000);
  if (!t || t.status !== 'pending' || t.expires_at <= now) return redirect('/dashboard', 303);
  if (!ctx.billingEmail || String(ctx.billingEmail).toLowerCase() !== String(t.to_email).toLowerCase()) return redirect(`/transfer/accept/${params.token}`, 303);
  if (!isStripeConfigured(env)) return redirect(`/transfer/accept/${params.token}?err=billing`, 303);

  const reqs = (() => { try { return JSON.parse(t.requirements_json || '{}'); } catch { return {}; } })();
  const missing = await unmetRequirements(env, ctx.billingEmail, reqs);
  const pluginPrices = missing.plugins.map((pk) => env[(PLUGINS[pk] || {}).priceVar]).filter(Boolean);
  const acct = await getBillingAccount(env.DB, ctx.billingEmail);
  const backUrl = `${url.origin}/transfer/accept/${params.token}`;

  // No base plan → ONE combined checkout (Starter + every missing plugin).
  if (missing.base) {
    const planPrice = priceIdFor(env, 'starter', 'mo');
    if (!planPrice) return redirect(`${backUrl}?err=billing`, 303);
    const session = await createBundleCheckoutSession(env, {
      email: ctx.billingEmail, priceIds: [planPrice, ...pluginPrices],
      successUrl: `${backUrl}?subscribed=1`, cancelUrl: backUrl,
      customerId: acct && acct.stripe_customer_id,
    });
    return redirect(session.url, 303);
  }
  // Has a base plan but missing plugins → add them to the existing subscription.
  if (acct && acct.stripe_subscription_id && pluginPrices.length) {
    try {
      const sub = await getSubscription(env, acct.stripe_subscription_id);
      for (const pk of missing.plugins) {
        const price = env[(PLUGINS[pk] || {}).priceVar]; if (!price) continue;
        const existing = ((sub.items && sub.items.data) || []).find((it) => it.price && it.price.id === price);
        const item = existing || await addSubscriptionItem(env, acct.stripe_subscription_id, price);
        await upsertAccountPlugin(env.DB, { email: ctx.billingEmail, pluginKey: pk, status: 'active', stripeItemId: item.id, currentPeriodEnd: acct.current_period_end });
      }
    } catch (e) { return redirect(`${backUrl}?err=plugins`, 303); }
    return redirect(`${backUrl}?subscribed=1`, 303);
  }
  return redirect(backUrl, 303);
}

/** POST /transfer/decline/:token */
export async function handleTransferDecline(ctx) {
  const { env, params } = ctx;
  const t = await getTransferByToken(env.DB, params.token);
  if (t && t.status === 'pending') await setTransferStatus(env.DB, t.id, 'declined');
  return redirect('/dashboard?transfer=declined', 303);
}
