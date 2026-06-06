// Commerce v1 — Stripe Connect plumbing (registered with PROJ middleware
// except the OAuth callback, which is public and gated by the signed state):
//   GET    /api/ai-builder/:project_id/store/stripe             connection status
//   POST   /api/ai-builder/:project_id/store/stripe/connect     -> { url } (OAuth authorize)
//   POST   /api/ai-builder/:project_id/store/stripe/disconnect  revoke + clear
//   GET    /store/stripe/callback?code&state                    Stripe redirects here
//
// The merchant's acct_… id lives on ai_website_configs.stripe_account_id
// (bridge-aware get-or-create below). Checkout/webhook arrive in later steps.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import {
  getWebsiteConfigByAIProjectId,
  getWebsiteConfigByRegularProjectId,
  createWebsiteConfig,
  updateWebsiteConfigById,
} from '../../../db/ai-config.js';
import {
  isConnectConfigured,
  connectAuthorizeUrl,
  exchangeConnectCode,
  deauthorizeConnect,
  signConnectState,
  verifyConnectState,
} from '../../../utils/stripe.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resolve :project_id (ai-first, like blog.js) to { projectKey, email }. */
export async function resolveStoreProject(env, project_id) {
  const aiProject = await getAIProjectByProjectId(env.DB, project_id);
  if (aiProject) {
    return { projectKey: { aiProjectId: aiProject.id }, email: aiProject.customer_email };
  }
  const regular = await getProjectByPreviewId(env.DB, project_id);
  if (regular) {
    return { projectKey: { projectId: regular.id }, email: regular.customer_email };
  }
  return null;
}

/** Bridge-aware config get-or-create (refactor projects may not have one yet). */
export async function getOrCreateConfig(db, projectKey) {
  if (projectKey.aiProjectId) {
    return (
      (await getWebsiteConfigByAIProjectId(db, projectKey.aiProjectId)) ||
      (await createWebsiteConfig(db, { ai_project_id: projectKey.aiProjectId }))
    );
  }
  return (
    (await getWebsiteConfigByRegularProjectId(db, projectKey.projectId)) ||
    (await createWebsiteConfig(db, { project_id: projectKey.projectId }))
  );
}

/** GET /api/ai-builder/:project_id/store/stripe — connection status. */
export async function handleStoreStripeStatus(ctx) {
  const { env, params } = ctx;
  const resolved = await resolveStoreProject(env, params.project_id);
  if (!resolved) return json({ success: false, error: 'Project not found' }, 404);

  const config = await getOrCreateConfig(env.DB, resolved.projectKey);
  const accountId = config.stripe_account_id || '';
  return json({
    success: true,
    configured: isConnectConfigured(env),
    connected: !!accountId,
    // Mask the middle of the acct id — enough to recognize, not to reuse.
    account: accountId ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : '',
    currency: config.store_currency || 'usd',
  });
}

/** POST /api/ai-builder/:project_id/store/stripe/connect — mint OAuth URL. */
export async function handleStoreStripeConnect(ctx) {
  const { env, params, url } = ctx;
  if (!isConnectConfigured(env)) {
    return json({ success: false, error: 'Stripe Connect is not configured on this environment.' }, 503);
  }
  const resolved = await resolveStoreProject(env, params.project_id);
  if (!resolved) return json({ success: false, error: 'Project not found' }, 404);

  const state = await signConnectState(env, params.project_id);
  const authorizeUrl = connectAuthorizeUrl(env, {
    state,
    redirectUri: `${url.origin}/store/stripe/callback`,
    email: resolved.email || undefined,
  });
  return json({ success: true, url: authorizeUrl });
}

/** POST /api/ai-builder/:project_id/store/stripe/disconnect — revoke + clear. */
export async function handleStoreStripeDisconnect(ctx) {
  const { env, params } = ctx;
  const resolved = await resolveStoreProject(env, params.project_id);
  if (!resolved) return json({ success: false, error: 'Project not found' }, 404);

  const config = await getOrCreateConfig(env.DB, resolved.projectKey);
  if (config.stripe_account_id) {
    // Best-effort revoke: clearing our column is what actually stops checkout,
    // and the merchant can always revoke from their own Stripe dashboard.
    try {
      await deauthorizeConnect(env, config.stripe_account_id);
    } catch (e) {
      console.error('Stripe deauthorize failed (continuing):', e.message);
    }
    await updateWebsiteConfigById(env.DB, config.id, { stripe_account_id: '' });
  }
  return json({ success: true, connected: false });
}

/**
 * GET /store/stripe/callback — public; Stripe redirects the merchant's browser
 * here after the OAuth screen. The signed state (minted by the project-gated
 * connect endpoint, 30-min expiry) is what authorizes the write.
 */
export async function handleStripeConnectCallback(ctx) {
  const { env, url } = ctx;
  const back = (projectId, q) =>
    Response.redirect(`${url.origin}/ai-builder/store/${projectId}?${q}`, 302);

  const state = url.searchParams.get('state') || '';
  const projectId = await verifyConnectState(env, state);
  if (!projectId) return new Response('Invalid or expired state', { status: 403 });

  // Merchant cancelled / Stripe error → bounce back with a notice.
  const oauthError = url.searchParams.get('error');
  if (oauthError) return back(projectId, `stripe_error=${encodeURIComponent(oauthError)}`);

  const code = url.searchParams.get('code');
  if (!code) return back(projectId, 'stripe_error=missing_code');

  const resolved = await resolveStoreProject(env, projectId);
  if (!resolved) return new Response('Project not found', { status: 404 });

  try {
    const accountId = await exchangeConnectCode(env, code);
    const config = await getOrCreateConfig(env.DB, resolved.projectKey);
    await updateWebsiteConfigById(env.DB, config.id, { stripe_account_id: accountId });
    return back(projectId, 'connected=1');
  } catch (e) {
    console.error('Stripe Connect exchange failed:', e.message);
    return back(projectId, `stripe_error=${encodeURIComponent(e.message.slice(0, 120))}`);
  }
}
