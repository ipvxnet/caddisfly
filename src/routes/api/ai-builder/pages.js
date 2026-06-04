// Page CRUD for multi-page sites
//   GET    /api/ai-builder/:project_id/pages            list
//   POST   /api/ai-builder/:project_id/pages            create
//   PUT    /api/ai-builder/:project_id/pages/reorder    reorder
//   PUT    /api/ai-builder/:project_id/pages/:page_id   rename / visibility
//   DELETE /api/ai-builder/:project_id/pages/:page_id   delete (reassign to home)

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import {
  ensurePagesForProject,
  getPagesByProject,
  getPageById,
  createPage,
  updatePage,
  reorderPages,
  deletePage,
  uniqueSlug,
} from '../../../db/ai-pages.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resolve the public project id to a {aiProjectId}|{projectId} key (ai-first). */
async function resolveProjectKey(env, project_id) {
  const aiProject = await getAIProjectByProjectId(env.DB, project_id);
  if (aiProject) return { projectKey: { aiProjectId: aiProject.id } };
  const regular = await getProjectByPreviewId(env.DB, project_id);
  if (regular) return { projectKey: { projectId: regular.id } };
  return { error: json({ success: false, error: 'Project not found' }, 404) };
}

/** True if a page belongs to the resolved project. */
function pageBelongs(page, projectKey) {
  if (!page) return false;
  return projectKey.aiProjectId != null
    ? page.ai_project_id === projectKey.aiProjectId
    : page.project_id === projectKey.projectId;
}

export async function handleListPages(ctx) {
  const { env, params } = ctx;
  try {
    const { projectKey, error } = await resolveProjectKey(env, params.project_id);
    if (error) return error;
    await ensurePagesForProject(env.DB, projectKey);
    const pages = await getPagesByProject(env.DB, projectKey);
    return json({ success: true, pages });
  } catch (e) {
    console.error('list pages error:', e);
    return json({ success: false, error: 'Failed to list pages', details: e.message }, 500);
  }
}

export async function handleCreatePage(ctx) {
  const { env, request, params } = ctx;
  try {
    const { projectKey, error } = await resolveProjectKey(env, params.project_id);
    if (error) return error;
    await ensurePagesForProject(env.DB, projectKey);

    const body = await request.json();
    const label = (body.nav_label || body.title || 'Page').toString().trim() || 'Page';
    const slug = await uniqueSlug(env.DB, projectKey, label);
    const existing = await getPagesByProject(env.DB, projectKey);

    const page = await createPage(env.DB, {
      ai_project_id: projectKey.aiProjectId ?? null,
      project_id: projectKey.projectId ?? null,
      slug,
      title: label,
      nav_label: label,
      page_order: existing.length,
      is_home: 0,
      is_visible: 1,
    });
    return json({ success: true, page });
  } catch (e) {
    console.error('create page error:', e);
    return json({ success: false, error: 'Failed to create page', details: e.message }, 500);
  }
}

export async function handleReorderPages(ctx) {
  const { env, request, params } = ctx;
  try {
    const { projectKey, error } = await resolveProjectKey(env, params.project_id);
    if (error) return error;
    const body = await request.json();
    const ids = Array.isArray(body.page_ids) ? body.page_ids : [];
    // Only reorder pages that belong to this project.
    const pages = await getPagesByProject(env.DB, projectKey);
    const owned = new Set(pages.map((p) => p.id));
    await reorderPages(env.DB, ids.filter((id) => owned.has(id)));
    return json({ success: true });
  } catch (e) {
    console.error('reorder pages error:', e);
    return json({ success: false, error: 'Failed to reorder pages', details: e.message }, 500);
  }
}

export async function handleUpdatePage(ctx) {
  const { env, request, params } = ctx;
  try {
    const { projectKey, error } = await resolveProjectKey(env, params.project_id);
    if (error) return error;
    const page = await getPageById(env.DB, parseInt(params.page_id));
    if (!pageBelongs(page, projectKey)) return json({ success: false, error: 'Page not found' }, 404);

    const body = await request.json();
    const updates = {};
    if (body.nav_label !== undefined) updates.nav_label = String(body.nav_label).slice(0, 60);
    if (body.title !== undefined) updates.title = String(body.title).slice(0, 80);
    if (body.is_visible !== undefined) updates.is_visible = body.is_visible ? 1 : 0;
    if (Object.keys(updates).length === 0) return json({ success: false, error: 'Nothing to update' }, 400);

    const updated = await updatePage(env.DB, page.id, updates);
    return json({ success: true, page: updated });
  } catch (e) {
    console.error('update page error:', e);
    return json({ success: false, error: 'Failed to update page', details: e.message }, 500);
  }
}

export async function handleDeletePage(ctx) {
  const { env, params } = ctx;
  try {
    const { projectKey, error } = await resolveProjectKey(env, params.project_id);
    if (error) return error;
    const page = await getPageById(env.DB, parseInt(params.page_id));
    if (!pageBelongs(page, projectKey)) return json({ success: false, error: 'Page not found' }, 404);

    const result = await deletePage(env.DB, projectKey, page.id);
    if (!result.ok) return json({ success: false, error: result.reason }, 400);
    return json({ success: true });
  } catch (e) {
    console.error('delete page error:', e);
    return json({ success: false, error: 'Failed to delete page', details: e.message }, 500);
  }
}
