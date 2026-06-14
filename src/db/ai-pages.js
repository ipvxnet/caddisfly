// AI Pages database operations (multi-page support)
//
// Pages belong to a project via the same bridge as sections: ai_project_id (AI
// builder) XOR project_id (refactoring). A `projectKey` arg is {aiProjectId} or
// {projectId}. Sections link to a page by the global ai_pages.id (no bridge).

/** Build a project-scope WHERE fragment from {aiProjectId} | {projectId}. */
function projectScope(projectKey) {
  if (projectKey && projectKey.aiProjectId != null) {
    return { clause: 'ai_project_id = ?', value: projectKey.aiProjectId, col: 'ai_project_id' };
  }
  return { clause: 'project_id = ?', value: projectKey.projectId, col: 'project_id' };
}

/** Slugify a label into a URL-safe slug. */
export function slugify(label) {
  return String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'page';
}

/**
 * Return a slug unique within the project (appends -2, -3, … on collision).
 */
export async function uniqueSlug(db, projectKey, base) {
  const root = slugify(base);
  const pages = await getPagesByProject(db, projectKey);
  const taken = new Set(pages.map((p) => p.slug));
  if (!taken.has(root)) return root;
  let i = 2;
  while (taken.has(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}

/** All pages for a project, ordered for the nav. */
export async function getPagesByProject(db, projectKey) {
  const scope = projectScope(projectKey);
  const r = await db
    .prepare(`SELECT * FROM ai_pages WHERE ${scope.clause} ORDER BY page_order ASC, id ASC`)
    .bind(scope.value)
    .all();
  return r.results || [];
}

export async function getPageById(db, id) {
  return db.prepare('SELECT * FROM ai_pages WHERE id = ?').bind(id).first();
}

export async function getPageBySlug(db, projectKey, slug) {
  const scope = projectScope(projectKey);
  return db
    .prepare(`SELECT * FROM ai_pages WHERE ${scope.clause} AND slug = ?`)
    .bind(scope.value, slug)
    .first();
}

/** The home page (is_home=1), falling back to the first by order. */
export async function getHomePage(db, projectKey) {
  const scope = projectScope(projectKey);
  const home = await db
    .prepare(`SELECT * FROM ai_pages WHERE ${scope.clause} AND is_home = 1 ORDER BY page_order ASC LIMIT 1`)
    .bind(scope.value)
    .first();
  if (home) return home;
  const pages = await getPagesByProject(db, projectKey);
  return pages[0] || null;
}

/**
 * Create a page.
 * @param {object} data - { ai_project_id?, project_id?, slug, title, nav_label, page_order, is_home, is_visible }
 */
export async function createPage(db, data) {
  const {
    ai_project_id = null,
    project_id = null,
    slug,
    title = null,
    nav_label = null,
    page_order = 0,
    is_home = 0,
    is_visible = 1,
  } = data;

  return db
    .prepare(
      `INSERT INTO ai_pages (ai_project_id, project_id, slug, title, nav_label, page_order, is_home, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(ai_project_id, project_id, slug, title, nav_label, page_order, is_home ? 1 : 0, is_visible ? 1 : 0)
    .first();
}

/** Update editable page fields. */
export async function updatePage(db, id, data) {
  const allowed = ['slug', 'title', 'nav_label', 'page_order', 'is_visible', 'seo_title', 'seo_description'];
  const updates = [];
  const values = [];
  Object.keys(data).forEach((k) => {
    if (allowed.includes(k)) {
      updates.push(`${k} = ?`);
      values.push(data[k]);
    }
  });
  if (updates.length === 0) throw new Error('No valid fields to update');
  updates.push('updated_at = unixepoch()');
  values.push(id);
  return db.prepare(`UPDATE ai_pages SET ${updates.join(', ')} WHERE id = ? RETURNING *`).bind(...values).first();
}

/** Set page_order = index for the given page ids. */
export async function reorderPages(db, pageIds) {
  await Promise.all(
    (pageIds || []).map((pageId, index) =>
      db.prepare('UPDATE ai_pages SET page_order = ?, updated_at = unixepoch() WHERE id = ?').bind(index, pageId).run()
    )
  );
  return true;
}

/**
 * Delete a page. Refuses the home page. Reassigns the page's sections to home so
 * nothing is orphaned.
 * @returns {{ok: boolean, reason?: string}}
 */
export async function deletePage(db, projectKey, id) {
  const page = await getPageById(db, id);
  if (!page) return { ok: false, reason: 'Page not found' };
  if (page.is_home) return { ok: false, reason: 'Cannot delete the home page' };
  const home = await getHomePage(db, projectKey);
  if (home) {
    await db
      .prepare('UPDATE ai_sections SET page_id = ?, updated_at = unixepoch() WHERE page_id = ?')
      .bind(home.id, id)
      .run();
  }
  await db.prepare('DELETE FROM ai_pages WHERE id = ?').bind(id).run();
  return { ok: true };
}

/**
 * Delete all pages for a refactor (regular) project — used when re-generating a
 * refactor site from a user-confirmed detailed profile (Phase 7).
 * @param {object} db - D1 database instance
 * @param {number} projectId - Refactor projects.id
 * @returns {boolean} Success
 */
export async function deletePagesByRegularProjectId(db, projectId) {
  await db.prepare('DELETE FROM ai_pages WHERE project_id = ?').bind(projectId).run();
  return true;
}

/**
 * Ensure a project has at least a home page; lazily upgrades legacy single-page
 * projects by creating 'home' and adopting their unassigned (page_id NULL) body
 * sections. Idempotent. Returns the project's pages.
 */
export async function ensurePagesForProject(db, projectKey) {
  const existing = await getPagesByProject(db, projectKey);
  if (existing.length > 0) return existing;

  const home = await createPage(db, {
    ai_project_id: projectKey.aiProjectId ?? null,
    project_id: projectKey.projectId ?? null,
    slug: 'home',
    title: 'Home',
    nav_label: 'Home',
    page_order: 0,
    is_home: 1,
    is_visible: 1,
  });

  // Adopt legacy/unassigned body sections (header/footer stay site-level / NULL).
  const scope = projectScope(projectKey);
  await db
    .prepare(
      `UPDATE ai_sections SET page_id = ?, updated_at = unixepoch()
       WHERE ${scope.clause} AND section_type NOT IN ('header','footer') AND page_id IS NULL`
    )
    .bind(home.id, scope.value)
    .run();

  return [home];
}
