// Grace-end republish cron — when a plugin's 7-day grace expires, republish the
// owner's live sites so the now-unentitled sections drop out of the static HTML
// (the deploy section filter does the dropping). Then mark the entitlement
// 'hidden' (terminal) so it isn't reprocessed. See PLUGIN_PLATFORM_DESIGN.md §8.3.

import { PLUGIN_GRACE_SECONDS } from '../db/account-plugins.js';
import { handleAIBuilderDeploy } from '../routes/api/ai-builder/deploy.js';

/** Republish a site outside a request (cron) via a synthetic ctx (mirrors holiday-themes). */
async function republish(env, cronCtx, publicId, email) {
  const res = await handleAIBuilderDeploy({ env, params: { project_id: publicId }, ctx: cronCtx, billingEmail: email });
  const body = await res.json().catch(() => ({}));
  if (!body.success) throw new Error(body.error || `deploy ${res.status}`);
}

/** Public ids of an account's currently-deployed sites (both project types). */
async function deployedSitesForEmail(env, email) {
  const ids = [];
  const a = await env.DB.prepare(
    `SELECT project_id AS id FROM ai_projects WHERE customer_email = ? AND status = 'deployed' AND subdomain IS NOT NULL`
  ).bind(email).all();
  for (const r of a.results || []) ids.push(r.id);
  const p = await env.DB.prepare(
    `SELECT preview_id AS id FROM projects WHERE customer_email = ? AND status = 'deployed' AND subdomain IS NOT NULL`
  ).bind(email).all();
  for (const r of p.results || []) ids.push(r.id);
  return ids;
}

/**
 * One daily tick: find entitlements past grace (canceling/canceled with
 * current_period_end + grace <= now), republish each owner's live sites once,
 * then mark those rows 'hidden'. opts: { dryRun, now }.
 */
export async function processPluginGraceHides(env, cronCtx, opts = {}) {
  const now = opts.now || Math.floor(Date.now() / 1000);
  const dryRun = !!opts.dryRun;
  const summary = { lapsed: 0, accounts: 0, republished: 0, errors: 0, dry: dryRun };

  const { results: rows } = await env.DB.prepare(
    `SELECT email, plugin_key FROM account_plugins
       WHERE status IN ('canceling','canceled')
         AND current_period_end IS NOT NULL
         AND current_period_end + ? <= ?`
  ).bind(PLUGIN_GRACE_SECONDS, now).all();
  summary.lapsed = (rows || []).length;
  if (summary.lapsed === 0) return summary;

  // Group lapsed plugins by account so each site republishes at most once.
  const byEmail = new Map();
  for (const r of rows) {
    if (!byEmail.has(r.email)) byEmail.set(r.email, []);
    byEmail.get(r.email).push(r.plugin_key);
  }
  summary.accounts = byEmail.size;

  for (const [email, keys] of byEmail) {
    try {
      if (dryRun) continue;
      const sites = await deployedSitesForEmail(env, email);
      for (const publicId of sites) {
        try {
          await republish(env, cronCtx, publicId, email);
          summary.republished++;
        } catch (e) {
          summary.errors++;
          console.error('grace republish failed', publicId, e.message);
        }
      }
      // Terminal state so we don't reprocess this account daily.
      for (const key of keys) {
        await env.DB.prepare(
          `UPDATE account_plugins SET status = 'hidden', updated_at = unixepoch() WHERE email = ? AND plugin_key = ?`
        ).bind(email, key).run();
      }
    } catch (e) {
      summary.errors++;
      console.error('grace hide failed for', email, e.message);
    }
  }
  return summary;
}
