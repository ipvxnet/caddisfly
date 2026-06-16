// POST /api/ai-builder/:project_id/detailed
// Receives the full detailed-form payload in one shot, screens + stores it as a
// JSON blob on the project, and hands off to generation.

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { getProjectByPreviewId, updateProject } from '../../../db/projects.js';
import { coerceDetailedProfile } from '../../../utils/detailed-profile.js';
import { applyDetailedOverride } from '../../../utils/company-profile.js';
import { generateAndStore } from '../../../utils/template-generation.js';
import { deleteSectionsByRegularProjectId } from '../../../db/ai-sections.js';
import { deletePagesByRegularProjectId } from '../../../db/ai-pages.js';
import { deleteWebsiteConfigByRegularProjectId } from '../../../db/ai-config.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export async function handleAIBuilderDetailedSubmit(ctx) {
  const { request, env, params } = ctx;

  try {
    const { project_id } = params;
    const aiProject = await getAIProjectByProjectId(env.DB, project_id);
    const refactorProject = aiProject ? null : await getProjectByPreviewId(env.DB, project_id);
    if (!aiProject && !refactorProject) return json({ success: false, error: 'Project not found' }, 404);

    const body = await request.json();
    const profile = coerceDetailedProfile(body);

    if (!profile.business_name) {
      return json({ success: false, error: 'Business name is required' }, 400);
    }

    // Acceptable-use screening on all user free-text fields.
    const freeText = [profile.business_name, profile.history, profile.founder, profile.services, profile.demographics]
      .filter(Boolean)
      .join('\n');
    const screen = screenContent(freeText);
    if (!screen.allowed) return json(policyError(screen), 422);

    // AI-builder flow: store the blob and hand off to generation.
    if (aiProject) {
      await updateAIProject(env.DB, aiProject.id, {
        detailed_profile_json: JSON.stringify(profile),
        project_name: profile.business_name,
        flow_path: 'detailed',
        status: 'content_generation',
        conversation_step: 'review',
      });

      return json({ success: true, redirect: `/ai-builder/generating/${aiProject.project_id}` });
    }

    // Refactor flow (Phase 7): override the stored profile with the confirmed
    // details, rebuild the site cleanly, and return to the preview.
    let cp = {};
    try {
      cp = JSON.parse(refactorProject.company_profile_json || '{}');
    } catch {
      cp = {};
    }
    // The search/build flow nests the real profile (with source/photos/
    // scrape_images) under `.profile` and caches the photo pool; the older
    // verify flow stores the profile at the top level. Handle both.
    const nested = cp && cp.profile && typeof cp.profile === 'object';
    const baseProfile = nested ? cp.profile : cp;
    const overridden = applyDetailedOverride(baseProfile, profile);

    // Reuse the cached photo pool to avoid re-billing — UNLESS the user added
    // their own photos, in which case rebuild so those lead.
    const userAddedPics = Array.isArray(profile.picture_urls) && profile.picture_urls.length > 0;
    const genOpts = (!userAddedPics && nested && Array.isArray(cp.photoPool) && cp.photoPool.length)
      ? { photoPool: cp.photoPool }
      : {};

    // Teardown old generation, then rebuild. A mid-rebuild failure leaves the
    // confirmed profile stored so the user can retry by re-saving.
    await deleteSectionsByRegularProjectId(env.DB, refactorProject.id);
    await deletePagesByRegularProjectId(env.DB, refactorProject.id);
    await deleteWebsiteConfigByRegularProjectId(env.DB, refactorProject.id);
    await generateAndStore(env, refactorProject, overridden, genOpts);

    // Persist: keep the wrapper shape if it was nested (so the title + future
    // re-edits still resolve), and store `_detailed` so the form round-trips.
    const stored = nested ? { ...cp, profile: overridden, _detailed: profile } : { ...overridden, _detailed: profile };
    await updateProject(env.DB, refactorProject.id, {
      company_profile_json: JSON.stringify(stored),
      status: 'preview_ready',
    });

    return json({ success: true, redirect: `/ai-preview/${refactorProject.preview_id}` });
  } catch (error) {
    console.error('Error saving detailed profile:', error);
    return json({ success: false, error: 'Failed to save details', details: error.message }, 500);
  }
}
