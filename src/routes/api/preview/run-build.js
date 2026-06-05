// POST /api/preview/run-build/:token
//
// Runs the paid enrichment + site generation for a verified refactor project,
// INSIDE this request. The "building" page (GET /verify/:token) calls this and
// keeps the connection open for the whole build — a live client is what keeps
// the worker alive. (The build used to run via ctx.waitUntil after the verify
// response, but the runtime cancels waitUntil work ~30s after the invocation
// ends, so longer builds died mid-flight and wedged the project at 'running'.)
//
// Claiming is atomic (db/projects.js claimEnrichmentBuild): exactly one caller
// transitions pending → running (or re-claims a STALE running left by a dead
// build), so reloads and extra tabs can't double-run the paid Google calls.

import { getProjectByVerificationToken, getProjectById, claimEnrichmentBuild } from '../../../db/projects.js';
import { getUserTier, checkEnrichmentLimit, formatRateLimitError, limitsDisabled, unlimited } from '../../../utils/rate-limiter.js';
import { canAfford, formatCreditError, CREDIT_COSTS } from '../../../utils/credits.js';
import { runBuild } from '../../public/verify.js';
import { jsonResponse } from '../../../utils/response.js';

// A 'running' claim older than this is considered dead and may be re-claimed.
// Real builds finish well inside it (~1-2 min worst case).
export const BUILD_STALE_SECONDS = 180;

export async function handleRunBuild(ctx) {
  const { env, params, request } = ctx;
  const token = params.token;
  if (!token) return jsonResponse({ success: false, status: 'not_found' }, 404);

  const project = await getProjectByVerificationToken(env.DB, token);
  if (!project) return jsonResponse({ success: false, status: 'not_found' }, 404);

  // The verify click marks the email; this endpoint never substitutes for it.
  if (!project.email_verified) {
    return jsonResponse({ success: false, status: 'unverified' }, 403);
  }

  // Terminal states are idempotent — report them so the page can react.
  const s = project.enrichment_status;
  if (s === 'complete' || s === 'no_match' || s === 'failed') {
    return jsonResponse({ success: true, status: s, preview_id: project.preview_id });
  }

  // Cost controls on the SPENDING path (mirrors the old verify-time checks).
  const tier = await getUserTier(env.DB, project.customer_email);
  const limit = limitsDisabled(env)
    ? unlimited(tier)
    : await checkEnrichmentLimit(env.DB, project.customer_email, tier);
  if (!limit.allowed) {
    return jsonResponse({ success: false, status: 'failed', error: formatRateLimitError(limit, 'enrichments').error }, 429);
  }
  const afford = await canAfford(env, env.DB, project.customer_email, CREDIT_COSTS.enrich);
  if (!afford.ok) {
    return jsonResponse({ success: false, status: 'failed', error: formatCreditError(afford.state, 'business enrichment').error }, 402);
  }

  const now = Math.floor(Date.now() / 1000);
  const claimed = await claimEnrichmentBuild(env.DB, project.id, now, now - BUILD_STALE_SECONDS);
  if (!claimed) {
    // Someone else owns a live build — the caller's status poller will see it land.
    return jsonResponse({ success: true, status: 'running', preview_id: project.preview_id });
  }

  // Run the build in THIS request. waitUntil is tail-end insurance only: if the
  // client disconnects near the end, the runtime still gives the task a short
  // grace window to write its terminal status.
  const origin = new URL(request.url).origin;
  const buildTask = runBuild(env, project, origin);
  if (ctx.ctx && typeof ctx.ctx.waitUntil === 'function') ctx.ctx.waitUntil(buildTask);
  await buildTask;

  const fresh = await getProjectById(env.DB, project.id);
  const status = (fresh && fresh.enrichment_status) || 'failed';
  return jsonResponse({ success: status === 'complete', status, preview_id: project.preview_id });
}
