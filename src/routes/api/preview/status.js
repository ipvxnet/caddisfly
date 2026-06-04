// GET /api/preview/:preview_id/status
// Lightweight poll endpoint for the "building your site" page (refactor flow).
// Returns the project's enrichment_status so the page can redirect when ready.

import { getProjectByPreviewId } from '../../../db/projects.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handlePreviewStatus(ctx) {
  const { env, params } = ctx;
  const project = await getProjectByPreviewId(env.DB, params.preview_id);
  if (!project) return json({ status: 'not_found' }, 404);
  return json({ status: project.enrichment_status || 'pending', preview_id: project.preview_id });
}
