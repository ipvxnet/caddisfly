// Scheduled holiday themes — opt-in color skins that apply ~a week before a
// holiday and revert after, republishing the static site on each transition.
//   PUT /api/ai-builder/:project_id/holiday-themes  { enabled, holidays[] }
// plus processHolidayThemes(env), run from the DAILY cron (08:00 UTC,
// prod-only) and the admin test endpoint /api/admin/holiday-themes/run?dry=1.
//
// Only COLORS change (primary/secondary) — every template handles them, and
// the prior pair is stored in holiday_themes_json.applied for the revert.
// Republishing reuses handleAIBuilderDeploy with a synthetic ctx (the
// publish-count cap excludes already-published sites, so re-publishes pass).

import { getAIProjectByProjectId, getAIProjectById } from '../../../db/ai-projects.js';
import { getProjectByPreviewId, getProjectById } from '../../../db/projects.js';
import { getOrCreateConfig } from './store.js';
import { updateWebsiteConfigById, getHolidayEnabledConfigs } from '../../../db/ai-config.js';
import { parseHolidaySettings, activeHoliday, holidayWindowOver, HOLIDAY_SKINS, HOLIDAY_KEYS } from '../../../utils/holiday-themes.js';
import { handleAIBuilderDeploy } from './deploy.js';
import { audit } from '../../../utils/audit.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** PUT /holiday-themes — save the opt-in + selected holidays. */
export async function handleHolidayThemesSave(ctx) {
  const { env, request, params } = ctx;
  try {
    const ai = await getAIProjectByProjectId(env.DB, params.project_id);
    let projectKey = null;
    let email = '';
    if (ai) { projectKey = { aiProjectId: ai.id }; email = ai.customer_email; }
    else {
      const rp = await getProjectByPreviewId(env.DB, params.project_id);
      if (!rp) return json({ success: false, error: 'Project not found' }, 404);
      projectKey = { projectId: rp.id };
      email = rp.customer_email;
    }
    const body = await request.json().catch(() => ({}));
    const config = await getOrCreateConfig(env.DB, projectKey);
    const prev = parseHolidaySettings(config);
    const next = {
      enabled: !!body.enabled,
      holidays: (Array.isArray(body.holidays) ? body.holidays : []).filter((h) => HOLIDAY_KEYS.includes(h)),
      decor: body.decor !== false && body.decor !== 'false',
      applied: prev.applied, // the cron owns this field
    };
    await updateWebsiteConfigById(env.DB, config.id, { holiday_themes_json: JSON.stringify(next) });
    audit(ctx, 'site.holiday_themes', { teamOwner: email, resourceType: 'site', resourceId: params.project_id, metadata: { enabled: next.enabled, holidays: next.holidays } });
    return json({ success: true, settings: { enabled: next.enabled, holidays: next.holidays } });
  } catch (e) {
    console.error('holiday themes save error:', e);
    return json({ success: false, error: 'Could not save holiday themes.' }, 500);
  }
}

/** Resolve a config row to its publishable project view, or null. */
async function projectForConfig(env, config) {
  if (config.ai_project_id != null) {
    const p = await getAIProjectById(env.DB, config.ai_project_id);
    if (!p || p.status !== 'deployed' || !p.subdomain) return null;
    return { publicId: p.project_id, email: p.customer_email };
  }
  if (config.project_id != null) {
    const p = await getProjectById(env.DB, config.project_id);
    if (!p || p.status !== 'deployed' || !p.subdomain) return null;
    return { publicId: p.preview_id, email: p.customer_email };
  }
  return null;
}

/** Republish a site outside a request (cron) via a synthetic ctx. */
async function republish(env, cronCtx, publicId, email) {
  const res = await handleAIBuilderDeploy({
    env, params: { project_id: publicId }, ctx: cronCtx, billingEmail: email,
  });
  const body = await res.json().catch(() => ({}));
  if (!body.success) throw new Error(body.error || `deploy ${res.status}`);
}

/**
 * One daily tick. For every opted-in PUBLISHED site: apply a selected
 * holiday's colors when its window opens (saving the prior pair), revert when
 * it closes; republish on each transition. opts: { dryRun, now: 'YYYY-MM-DD' }.
 */
export async function processHolidayThemes(env, cronCtx, opts = {}) {
  const dryRun = !!opts.dryRun;
  const today = opts.now && /^\d{4}-\d{2}-\d{2}$/.test(opts.now) ? opts.now : new Date().toISOString().slice(0, 10);
  const summary = { checked: 0, applied: 0, reverted: 0, skipped: 0, errors: 0, dry: dryRun, today };

  const configs = await getHolidayEnabledConfigs(env.DB);
  for (const config of configs) {
    summary.checked++;
    try {
      const hs = parseHolidaySettings(config);
      if (!hs.enabled) { summary.skipped++; continue; }
      const proj = await projectForConfig(env, config);
      if (!proj) { summary.skipped++; continue; }

      const active = activeHoliday(today, hs.holidays);

      if (!hs.applied && active) {
        // Window opened → save prior colors, skin, republish.
        const skin = HOLIDAY_SKINS[active];
        if (dryRun) { summary.applied++; continue; }
        const applied = { holiday: active, prev_primary: config.primary_color || '#667eea', prev_secondary: config.secondary_color || '#764ba2' };
        await updateWebsiteConfigById(env.DB, config.id, {
          primary_color: skin.colors.primary,
          secondary_color: skin.colors.secondary,
          holiday_themes_json: JSON.stringify({ enabled: true, holidays: hs.holidays, decor: hs.decor, applied }),
        });
        await republish(env, cronCtx, proj.publicId, proj.email);
        console.log(`holiday theme APPLIED ${active} → ${proj.publicId}`);
        summary.applied++;
      } else if (hs.applied && holidayWindowOver(hs.applied.holiday, today)) {
        // Window closed → restore, republish.
        if (dryRun) { summary.reverted++; continue; }
        await updateWebsiteConfigById(env.DB, config.id, {
          primary_color: hs.applied.prev_primary,
          secondary_color: hs.applied.prev_secondary,
          holiday_themes_json: JSON.stringify({ enabled: true, holidays: hs.holidays, decor: hs.decor, applied: null }),
        });
        await republish(env, cronCtx, proj.publicId, proj.email);
        console.log(`holiday theme REVERTED ${hs.applied.holiday} → ${proj.publicId}`);
        summary.reverted++;
      } else {
        summary.skipped++;
      }
    } catch (e) {
      summary.errors++;
      console.error('holiday theme tick failed for config', config.id, e.message);
    }
  }
  return summary;
}
