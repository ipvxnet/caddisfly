// Site version snapshots: serialize the project's editable D1 state (config +
// pages + sections) to ONE full JSON blob in R2, and restore by rewriting the
// rows from a blob. Full copies, not diffs — the state is small and R2 storage
// is nearly free, so restore stays trivial (see roadmap spec, 2026-06-01).
//
// Deliberately NOT included: blog posts (own draft/publish lifecycle), R2
// assets (referenced by URL and never deleted on edit, so old snapshots keep
// resolving), and the published R2 copies (restore changes the DRAFT; the user
// republishes to go live).

import { uploadToR2, getFromR2 } from './r2-storage.js';
import { SNAPSHOT_LIMITS } from './credits.js';
import { createSnapshotRow, snapshotsBeyondCap, deleteSnapshotRow } from '../db/snapshots.js';

const SNAPSHOT_VERSION = 1;
const MAX_PAGES = 200;
const MAX_SECTIONS = 1000;

function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}

const CONFIG_COLS = ['primary_color', 'secondary_color', 'font_heading', 'font_body', 'style_theme', 'social_image'];

/** Read the project's editable state into a plain serializable object. */
export async function serializeSiteState(db, projectKey) {
  const k = keyWhere(projectKey);
  const config = await db
    .prepare(`SELECT ${CONFIG_COLS.join(', ')} FROM ai_website_configs WHERE ${k.sql}`)
    .bind(k.val)
    .first();
  const pages =
    (await db
      .prepare(
        `SELECT id, slug, title, nav_label, page_order, is_home, is_visible, seo_title, seo_description
         FROM ai_pages WHERE ${k.sql} ORDER BY page_order, id`
      )
      .bind(k.val)
      .all()).results || [];
  const sections =
    (await db
      .prepare(
        `SELECT section_type, section_order, html_template, content_json, is_visible, page_id
         FROM ai_sections WHERE ${k.sql} ORDER BY section_order, id`
      )
      .bind(k.val)
      .all()).results || [];
  return { version: SNAPSHOT_VERSION, taken_at: Math.floor(Date.now() / 1000), config: config || null, pages, sections };
}

/**
 * Take a snapshot: serialize → R2 blob → metadata row → prune beyond the
 * tier's retention cap (oldest first; R2 blobs deleted best-effort).
 * @returns {Promise<{row: object, pruned: number}>}
 */
export async function takeSnapshot(env, projectKey, publicId, { label = '', trigger = 'manual', tier = 'free_trial' } = {}) {
  const state = await serializeSiteState(env.DB, projectKey);
  const body = JSON.stringify(state);
  const r2Path = `snapshots/${publicId}/${Date.now()}.json`;
  await uploadToR2(env.STORAGE, r2Path, body, 'application/json');
  const row = await createSnapshotRow(env.DB, projectKey, {
    label,
    trigger_type: trigger,
    r2_path: r2Path,
    size_bytes: body.length,
  });

  const keep = SNAPSHOT_LIMITS[tier] != null ? SNAPSHOT_LIMITS[tier] : SNAPSHOT_LIMITS.free_trial;
  const excess = await snapshotsBeyondCap(env.DB, projectKey, keep);
  for (const s of excess) {
    try { await env.STORAGE.delete(s.r2_path); } catch (e) { console.error('snapshot prune (blob):', e.message); }
    await deleteSnapshotRow(env.DB, projectKey, s.id);
  }
  return { row, pruned: excess.length };
}

/**
 * Restore a snapshot: rewrite the project's pages + sections + config from the
 * blob. Pages get NEW ids; section.page_id is remapped old→new. Two D1 batches
 * (each atomic): [delete sections+pages, insert pages] then [insert sections,
 * update config] — the page inserts must return ids before sections can bind.
 * Callers take a pre_restore safety snapshot FIRST (see the API handler).
 */
export async function restoreSnapshot(env, projectKey, snapshotRow) {
  const text = await getFromR2(env.STORAGE, snapshotRow.r2_path);
  if (!text) throw new Error('Snapshot data is missing from storage');
  let state;
  try { state = JSON.parse(text); } catch { throw new Error('Snapshot data is corrupted'); }
  if (!state || state.version !== SNAPSHOT_VERSION || !Array.isArray(state.pages) || !Array.isArray(state.sections)) {
    throw new Error('Snapshot has an unsupported format');
  }
  if (state.pages.length > MAX_PAGES || state.sections.length > MAX_SECTIONS) {
    throw new Error('Snapshot exceeds size limits');
  }

  const db = env.DB;
  const k = keyWhere(projectKey);
  const aiVal = projectKey.aiProjectId != null ? projectKey.aiProjectId : null;
  const pVal = projectKey.projectId != null ? projectKey.projectId : null;

  // Batch 1 (atomic): wipe sections + pages, re-insert pages RETURNING ids.
  const batch1 = [
    db.prepare(`DELETE FROM ai_sections WHERE ${k.sql}`).bind(k.val),
    db.prepare(`DELETE FROM ai_pages WHERE ${k.sql}`).bind(k.val),
    ...state.pages.map((p) =>
      db
        .prepare(
          `INSERT INTO ai_pages (ai_project_id, project_id, slug, title, nav_label, page_order, is_home, is_visible, seo_title, seo_description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
        )
        .bind(
          aiVal, pVal,
          p.slug || 'page', p.title || null, p.nav_label || null,
          p.page_order || 0, p.is_home ? 1 : 0, p.is_visible === 0 ? 0 : 1,
          p.seo_title || null, p.seo_description || null
        )
    ),
  ];
  const res1 = await db.batch(batch1);

  // old page id -> new page id (insert results start at index 2, same order).
  const idMap = new Map();
  state.pages.forEach((p, i) => {
    const inserted = res1[i + 2] && res1[i + 2].results && res1[i + 2].results[0];
    if (p.id != null && inserted) idMap.set(p.id, inserted.id);
  });

  // Batch 2 (atomic): sections (page_id remapped; unknown/missing → NULL =
  // site-level, e.g. header/footer) + config field update.
  const batch2 = state.sections.map((s) =>
    db
      .prepare(
        `INSERT INTO ai_sections (ai_project_id, project_id, section_type, section_order, html_template, content_json, is_visible, page_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        aiVal, pVal,
        s.section_type, s.section_order || 0, s.html_template || 'default',
        s.content_json || null, s.is_visible === 0 ? 0 : 1,
        s.page_id != null && idMap.has(s.page_id) ? idMap.get(s.page_id) : null
      )
  );
  if (state.config) {
    const sets = CONFIG_COLS.map((c) => `${c} = ?`).join(', ');
    batch2.push(
      db
        .prepare(`UPDATE ai_website_configs SET ${sets}, updated_at = unixepoch() WHERE ${k.sql}`)
        .bind(...CONFIG_COLS.map((c) => (state.config[c] != null ? state.config[c] : null)), k.val)
    );
  }
  if (batch2.length) await db.batch(batch2);

  return { pages: state.pages.length, sections: state.sections.length };
}
