// Website transfer — initiate / cancel (owner side). Ownership is the single
// source of plan-gating, so accepting (see public/transfer-accept.js) flips
// customer_email and the site obeys the NEW owner's plan. See db/site-transfer.js.

import { resolveStoreProject } from './ai-builder/store.js';
import { getBillingAccount } from '../../db/billing.js';
import { hasBasePlan, hasPlugin } from '../../plugins/entitlements.js';
import { PLUGINS } from '../../plugins/manifest.js';
import { DOMAIN_LIMITS } from '../../utils/credits.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { generateToken } from '../../utils/crypto.js';
import { isValidEmail, sendTransferInviteEmail } from '../../utils/email.js';
import { audit } from '../../utils/audit.js';
import {
  computeSiteRequirements, createTransfer, getPendingTransferForSite, cancelTransfer,
} from '../../db/site-transfer.js';

export const TRANSFER_TTL = 7 * 24 * 60 * 60;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// i18n: local dict (en/es/pt), resolved by ctx.lang. Errors surface in UI alerts.
const TX = {
  en: {
    req_domain: 'A paid plan that supports a custom domain (Starter or higher)',
    req_base: 'A paid plan (Starter or higher)', req_plugin: '{label} plugin',
    err_owner_only: 'Only the site owner can transfer it.', err_not_found: 'Project not found',
    err_need_plan: 'Transferring a site requires a Pro or Agency plan.',
    err_bad_email: 'Enter a valid recipient email.', err_own: 'You already own this site.',
    err_pending: 'A transfer is already pending for this site — cancel it first.',
    err_cancel_owner: 'Only the site owner can cancel.',
  },
  es: {
    req_domain: 'Un plan de pago que admite un dominio personalizado (Starter o superior)',
    req_base: 'Un plan de pago (Starter o superior)', req_plugin: 'Plugin {label}',
    err_owner_only: 'Solo el propietario del sitio puede transferirlo.', err_not_found: 'Proyecto no encontrado',
    err_need_plan: 'Transferir un sitio requiere un plan Pro o Agency.',
    err_bad_email: 'Ingresa un correo electrónico válido para el destinatario.', err_own: 'Ya posees este sitio.',
    err_pending: 'Ya hay una transferencia pendiente para este sitio — cancela primero.',
    err_cancel_owner: 'Solo el propietario del sitio puede cancelar.',
  },
  pt: {
    req_domain: 'Um plano pago que suporta um domínio personalizado (Starter ou superior)',
    req_base: 'Um plano pago (Starter ou superior)', req_plugin: 'Plugin {label}',
    err_owner_only: 'Apenas o proprietário do site pode transferi-lo.', err_not_found: 'Projeto não encontrado',
    err_need_plan: 'Transferir um site exige um plano Pro ou Agency.',
    err_bad_email: 'Digite um e-mail válido para o destinatário.', err_own: 'Você já possui esse site.',
    err_pending: 'Já existe uma transferência pendente para esse site — cancele primeiro.',
    err_cancel_owner: 'Apenas o proprietário do site pode cancelar.',
  },
};
const tx = (lang) => TX[lang] || TX.en;

/** Human-readable requirement labels (email + accept page), localized by lang. */
export function reqLabels(reqs, lang = 'en') {
  const T = tx(lang);
  const out = [];
  if (reqs.domain) out.push(T.req_domain);
  else if (reqs.base) out.push(T.req_base);
  for (const pk of reqs.plugins || []) out.push(T.req_plugin.replace('{label}', (PLUGINS[pk] || {}).label || pk));
  return out;
}

/** Which requirements does `email`'s account NOT meet? { base, domain, plugins:[] } */
export async function unmetRequirements(env, email, reqs) {
  const acct = await getBillingAccount(env.DB, email);
  const tier = acct && acct.pricing_tier;
  const missing = { base: false, domain: false, plugins: [] };
  if (reqs.base && !hasBasePlan(acct)) missing.base = true;
  if (reqs.domain && (!hasBasePlan(acct) || (DOMAIN_LIMITS[tier] || 0) < 1)) missing.domain = true;
  for (const pk of reqs.plugins || []) {
    if (!(await hasPlugin(env, email, pk))) missing.plugins.push(pk);
  }
  return missing;
}
export function isMet(missing) { return !missing.base && !missing.domain && missing.plugins.length === 0; }

/** POST /api/ai-builder/:project_id/transfer  { to_email, keep_builder } */
export async function handleTransferInitiate(ctx) {
  const { env, request, params } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = tx(lang);
  if (ctx.projectRole !== 'owner') return json({ success: false, error: T.err_owner_only }, 403);
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: T.err_not_found }, 404);
  const tier = await getUserTier(env.DB, ctx.billingEmail);
  if (!['pro', 'agency'].includes(tier)) return json({ success: false, error: T.err_need_plan }, 402);

  const body = await request.json().catch(() => ({}));
  const toEmail = String(body.to_email || '').trim().toLowerCase();
  if (!isValidEmail(toEmail)) return json({ success: false, error: T.err_bad_email }, 400);
  if (toEmail === String(ctx.billingEmail).toLowerCase()) return json({ success: false, error: T.err_own }, 400);
  if (await getPendingTransferForSite(env.DB, r.projectKey)) {
    return json({ success: false, error: T.err_pending }, 409);
  }

  const requirements = await computeSiteRequirements(env.DB, r.projectKey);
  const token = generateToken(24);
  const expiresAt = Math.floor(Date.now() / 1000) + TRANSFER_TTL;
  await createTransfer(env.DB, r.projectKey, { fromEmail: ctx.billingEmail, toEmail, keepBuilder: !!body.keep_builder, requirements, token, expiresAt });

  const origin = (ctx.url && ctx.url.origin) || env.APP_URL || 'https://caddisfly.ai';
  const acceptUrl = `${origin}/transfer/accept/${token}`;
  let sent = false;
  try {
    sent = await sendTransferInviteEmail(env, { to: toEmail, fromEmail: ctx.billingEmail, siteName: r.businessName, acceptUrl, requirements: reqLabels(requirements, lang), lang });
  } catch (e) { /* fall through — return the link so the owner can share it */ }
  audit(ctx, 'site.transfer.initiate', { resourceType: 'project', resourceId: params.project_id, resourceName: r.businessName, metadata: { to: toEmail, keep_builder: !!body.keep_builder } });
  return json({ success: true, sent, requirements: reqLabels(requirements, lang), accept_url: acceptUrl });
}

/** POST /api/ai-builder/:project_id/transfer/cancel */
export async function handleTransferCancel(ctx) {
  const { env, params } = ctx;
  const T = tx((ctx && ctx.lang) || 'en');
  if (ctx.projectRole !== 'owner') return json({ success: false, error: T.err_cancel_owner }, 403);
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return json({ success: false, error: T.err_not_found }, 404);
  const ok = await cancelTransfer(env.DB, r.projectKey, ctx.billingEmail);
  return json({ success: ok });
}
