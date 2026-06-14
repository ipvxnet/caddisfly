// Site version snapshots API (PROJ-gated like other project-scoped routes):
//   GET    /api/ai-builder/:project_id/snapshots                    list
//   POST   /api/ai-builder/:project_id/snapshots                    save {label}
//   POST   /api/ai-builder/:project_id/snapshots/:snapshot_id/restore
//   DELETE /api/ai-builder/:project_id/snapshots/:snapshot_id
//
// Restore ALWAYS takes a pre_restore safety snapshot first, so an accidental
// restore is itself undoable. Retention per tier (SNAPSHOT_LIMITS) is enforced
// at create time. Restoring changes the DRAFT state — the published site
// updates on the next Deploy.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getSnapshotsByProject, getSnapshotById, deleteSnapshotRow } from '../../../db/snapshots.js';
import { takeSnapshot, restoreSnapshot, restoreDesignFromSnapshot } from '../../../utils/site-snapshot.js';
import { getUserTier } from '../../../utils/rate-limiter.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId, updateWebsiteConfigById } from '../../../db/ai-config.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function resolveProject(env, project_id) {
  const aiProject = await getAIProjectByProjectId(env.DB, project_id);
  if (aiProject) return { projectKey: { aiProjectId: aiProject.id }, email: aiProject.customer_email };
  const regular = await getProjectByPreviewId(env.DB, project_id);
  if (regular) return { projectKey: { projectId: regular.id }, email: regular.customer_email };
  return { error: json({ success: false, error: 'Project not found' }, 404) };
}

export async function handleSnapshotList(ctx) {
  const { env, params } = ctx;
  const r = await resolveProject(env, params.project_id);
  if (r.error) return r.error;
  const snapshots = await getSnapshotsByProject(env.DB, r.projectKey);
  return json({ success: true, snapshots });
}

export async function handleSnapshotCreate(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;
    const body = await request.json().catch(() => ({}));
    const tier = await getUserTier(env.DB, r.email);
    const { row, pruned } = await takeSnapshot(env, r.projectKey, params.project_id, {
      label: (body.label || '').toString().trim().slice(0, 120),
      trigger: 'manual',
      tier,
    });
    return json({ success: true, snapshot: row, pruned }, 201);
  } catch (e) {
    console.error('snapshot create error:', e);
    return json({ success: false, error: 'Failed to save version' }, 500);
  }
}

export async function handleSnapshotRestore(ctx) {
  const { env, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;
    const snap = await getSnapshotById(env.DB, r.projectKey, parseInt(params.snapshot_id, 10));
    if (!snap) return json({ success: false, error: 'Version not found' }, 404);

    // Safety net: the current state is itself snapshotted before being replaced.
    const tier = await getUserTier(env.DB, r.email);
    await takeSnapshot(env, r.projectKey, params.project_id, { label: '', trigger: 'pre_restore', tier });

    const result = await restoreSnapshot(env, r.projectKey, snap);
    return json({ success: true, restored: result });
  } catch (e) {
    console.error('snapshot restore error:', e);
    return json({ success: false, error: e.message || 'Restore failed' }, 500);
  }
}

/**
 * POST /api/ai-builder/:project_id/revert-original
 * Reset the DESIGN/TEMPLATE (theme, fonts, colors, section layouts) to the
 * original AI-generated baseline, PRESERVING all content the user built (section
 * text/images, added sections, order, pages, blog, bookings). Takes a
 * pre_restore safety snapshot first, so the revert is itself undoable.
 */
export async function handleRevertToOriginal(ctx) {
  const { env, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;

    const all = await getSnapshotsByProject(env.DB, r.projectKey);
    const original = all.find((s) => s.trigger_type === 'original');
    if (!original) {
      return json({ success: false, error: 'No original version is available for this site.' }, 404);
    }

    const tier = await getUserTier(env.DB, r.email);
    await takeSnapshot(env, r.projectKey, params.project_id, { label: '', trigger: 'pre_restore', tier });

    // Design-only: restore the original template, keep the user's content.
    const result = await restoreDesignFromSnapshot(env, r.projectKey, original);
    return json({ success: true, restored: result });
  } catch (e) {
    console.error('revert-to-original error:', e);
    return json({ success: false, error: e.message || 'Revert failed' }, 500);
  }
}

/** PUT /api/ai-builder/:project_id/snapshots/auto — per-site auto-save toggle. */
export async function handleSnapshotAutoToggle(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;
    const body = await request.json().catch(() => ({}));
    const enabled = body.enabled !== false ? 1 : 0;
    const config = r.projectKey.aiProjectId != null
      ? await getWebsiteConfigByAIProjectId(env.DB, r.projectKey.aiProjectId)
      : await getWebsiteConfigByRegularProjectId(env.DB, r.projectKey.projectId);
    if (!config) return json({ success: false, error: 'Website configuration not found' }, 400);
    await updateWebsiteConfigById(env.DB, config.id, { auto_snapshot: enabled });
    return json({ success: true, auto_snapshot: enabled });
  } catch (e) {
    console.error('snapshot auto-toggle error:', e);
    return json({ success: false, error: 'Failed to update auto-save setting' }, 500);
  }
}

export async function handleSnapshotDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveProject(env, params.project_id);
  if (r.error) return r.error;
  const snap = await getSnapshotById(env.DB, r.projectKey, parseInt(params.snapshot_id, 10));
  if (!snap) return json({ success: false, error: 'Version not found' }, 404);
  try { await env.STORAGE.delete(snap.r2_path); } catch (e) { console.error('snapshot blob delete:', e.message); }
  await deleteSnapshotRow(env.DB, r.projectKey, snap.id);
  return json({ success: true });
}
