// POST /api/preview/build/:preview_id
//
// Confirm-build for the refactor preview flow: the user reviewed what we found
// (POST /api/preview/search) and wants the site. We reuse the cached profile +
// photo pool — NO second paid Google call — generate, email the link, done.

import { getProjectByPreviewId, updateProject } from '../../../db/projects.js';
import { generateAndStore } from '../../../utils/template-generation.js';
import { sendPreviewEmail } from '../../../utils/email.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export async function handlePreviewBuildConfirm(ctx) {
  const { env, request, params } = ctx;
  try {
    const previewId = params.preview_id;
    const body = await request.json().catch(() => ({}));
    const token = (body && body.token) || '';

    const project = await getProjectByPreviewId(env.DB, previewId);
    if (!project) return json({ success: false, error: 'Preview not found' }, 404);
    // The build token (returned by /search) authorizes the build — the preview_id
    // alone shouldn't let a third party trigger someone's build.
    if (!project.verification_token || project.verification_token !== token) {
      return json({ success: false, error: 'This preview link is invalid or has expired.' }, 403);
    }
    // Idempotent: if already built, just return the link.
    if (project.status === 'preview_ready') {
      return json({ success: true, preview_url: `/ai-preview/${previewId}` });
    }

    let cp = {};
    try { cp = JSON.parse(project.company_profile_json || '{}'); } catch { cp = {}; }
    if (!cp.profile) {
      return json({ success: false, error: 'No cached search found — please run the preview again.' }, 400);
    }

    await generateAndStore(env, project, cp.profile, { photoPool: cp.photoPool || [] });

    await updateProject(env.DB, project.id, {
      status: 'preview_ready',
      template_generation_status: 'complete',
      enrichment_status: 'complete',
      verification_token: null, // one-time
    });

    try {
      const origin = new URL(request.url).origin;
      await sendPreviewEmail(env, project.customer_email, previewId, `${origin}/ai-preview/${previewId}`);
    } catch (e) {
      console.error('Preview email failed:', e.message);
    }

    return json({ success: true, preview_url: `/ai-preview/${previewId}` });
  } catch (error) {
    console.error('Preview build confirm error:', error);
    return json({ success: false, error: 'Build failed', details: error.message }, 500);
  }
}
