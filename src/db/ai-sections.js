// AI Section database operations

/**
 * Create a new section
 * @param {object} db - D1 database instance
 * @param {object} data - Section data
 * @returns {object} Created section
 */
export async function createSection(db, data) {
  const {
    ai_project_id,
    project_id,
    page_id = null,
    section_type,
    section_order = 0,
    html_template,
    content_json = null,
    is_visible = 1,
  } = data;

  const result = await db
    .prepare(
      `INSERT INTO ai_sections (
         ai_project_id, project_id, page_id, section_type, section_order, html_template,
         content_json, is_visible
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      ai_project_id ?? null,
      project_id ?? null,
      page_id ?? null,
      section_type,
      section_order,
      html_template,
      content_json,
      is_visible
    )
    .first();

  return result;
}

/**
 * Get section by ID
 * @param {object} db - D1 database instance
 * @param {number} id - Section ID
 * @returns {object|null} Section or null
 */
export async function getSectionById(db, id) {
  const section = await db.prepare('SELECT * FROM ai_sections WHERE id = ?').bind(id).first();

  return section;
}

/**
 * Get all sections for an AI builder project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @param {boolean} visibleOnly - Only return visible sections
 * @returns {array} Array of sections
 */
export async function getSectionsByAIProjectId(db, aiProjectId, visibleOnly = false) {
  let sql = 'SELECT * FROM ai_sections WHERE ai_project_id = ?';
  if (visibleOnly) {
    sql += ' AND is_visible = 1';
  }
  sql += ' ORDER BY section_order ASC';

  const sections = await db.prepare(sql).bind(aiProjectId).all();

  return sections.results || [];
}

/**
 * Get all sections for a regular refactoring project
 * @param {object} db - D1 database instance
 * @param {number} projectId - Regular project ID
 * @param {boolean} visibleOnly - Only return visible sections
 * @returns {array} Array of sections
 */
export async function getSectionsByRegularProjectId(db, projectId, visibleOnly = false) {
  let sql = 'SELECT * FROM ai_sections WHERE project_id = ?';
  if (visibleOnly) {
    sql += ' AND is_visible = 1';
  }
  sql += ' ORDER BY section_order ASC';

  const sections = await db.prepare(sql).bind(projectId).all();

  return sections.results || [];
}

/**
 * Backward compatible alias - tries AI project first
 * @deprecated Use getSectionsByAIProjectId or getSectionsByRegularProjectId instead
 */
export async function getSectionsByProjectId(db, aiProjectId, visibleOnly = false) {
  return getSectionsByAIProjectId(db, aiProjectId, visibleOnly);
}

/**
 * Update section
 * @param {object} db - D1 database instance
 * @param {number} id - Section ID
 * @param {object} data - Fields to update
 * @returns {object} Updated section
 */
export async function updateSection(db, id, data) {
  const allowedFields = ['section_type', 'section_order', 'html_template', 'content_json', 'is_visible', 'page_id'];

  const updates = [];
  const values = [];

  Object.keys(data).forEach((key) => {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(data[key]);
    }
  });

  if (updates.length === 0) {
    throw new Error('No valid fields to update');
  }

  // Always update updated_at
  updates.push('updated_at = unixepoch()');
  values.push(id);

  const sql = `UPDATE ai_sections SET ${updates.join(', ')} WHERE id = ? RETURNING *`;

  const result = await db.prepare(sql).bind(...values).first();

  return result;
}

/**
 * Delete section
 * @param {object} db - D1 database instance
 * @param {number} id - Section ID
 * @returns {boolean} Success
 */
export async function deleteSection(db, id) {
  await db.prepare('DELETE FROM ai_sections WHERE id = ?').bind(id).run();

  return true;
}

/**
 * Delete all sections for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {boolean} Success
 */
export async function deleteSectionsByProjectId(db, aiProjectId) {
  await db.prepare('DELETE FROM ai_sections WHERE ai_project_id = ?').bind(aiProjectId).run();

  return true;
}

/**
 * Reorder sections by id. Ownership is verified by the caller, so this scopes by
 * section id only (works for both ai_project_id and project_id flows — the old
 * `AND ai_project_id = ?` clause silently no-op'd for refactor projects).
 * @param {object} db - D1 database instance
 * @param {array} sectionIds - Array of section IDs in desired order (within one page)
 * @returns {boolean} Success
 */
export async function reorderSections(db, sectionIds) {
  const promises = (sectionIds || []).map((sectionId, index) =>
    db
      .prepare('UPDATE ai_sections SET section_order = ?, updated_at = unixepoch() WHERE id = ?')
      .bind(index, sectionId)
      .run()
  );

  await Promise.all(promises);

  return true;
}

// ---- Page-aware queries (multi-page) ----

/** Build a "project scope" WHERE fragment from {aiProjectId} | {projectId}. */
function projectScope(projectKey) {
  if (projectKey && projectKey.aiProjectId != null) {
    return { clause: 'ai_project_id = ?', value: projectKey.aiProjectId };
  }
  return { clause: 'project_id = ?', value: projectKey.projectId };
}

/**
 * Site-level sections (header/footer) — shared across every page, regardless of page_id.
 * @param {object} projectKey - {aiProjectId} or {projectId}
 */
export async function getSiteSections(db, projectKey, visibleOnly = false) {
  const scope = projectScope(projectKey);
  let sql = `SELECT * FROM ai_sections WHERE ${scope.clause} AND section_type IN ('header','footer')`;
  if (visibleOnly) sql += ' AND is_visible = 1';
  sql += ' ORDER BY section_order ASC';
  const r = await db.prepare(sql).bind(scope.value).all();
  return r.results || [];
}

/**
 * Body (non-header/footer) sections for a specific page.
 */
export async function getBodySectionsForPage(db, pageId, visibleOnly = false) {
  let sql = `SELECT * FROM ai_sections WHERE page_id = ? AND section_type NOT IN ('header','footer')`;
  if (visibleOnly) sql += ' AND is_visible = 1';
  sql += ' ORDER BY section_order ASC';
  const r = await db.prepare(sql).bind(pageId).all();
  return r.results || [];
}

/**
 * Body sections for the HOME page, tolerant of the upgrade window: also folds in
 * legacy/unassigned body sections (page_id IS NULL).
 */
export async function getHomeBodySections(db, projectKey, homePageId, visibleOnly = false) {
  const scope = projectScope(projectKey);
  let sql =
    `SELECT * FROM ai_sections WHERE ${scope.clause} AND section_type NOT IN ('header','footer') ` +
    `AND (page_id = ? OR page_id IS NULL)`;
  if (visibleOnly) sql += ' AND is_visible = 1';
  sql += ' ORDER BY section_order ASC';
  const r = await db.prepare(sql).bind(scope.value, homePageId).all();
  return r.results || [];
}

/**
 * Get sections by type for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @param {string} sectionType - Section type
 * @returns {array} Array of sections
 */
export async function getSectionsByType(db, aiProjectId, sectionType) {
  const sections = await db
    .prepare('SELECT * FROM ai_sections WHERE ai_project_id = ? AND section_type = ? ORDER BY section_order ASC')
    .bind(aiProjectId, sectionType)
    .all();

  return sections.results || [];
}

/**
 * Update section content (JSON only)
 * @param {object} db - D1 database instance
 * @param {number} id - Section ID
 * @param {object} contentJson - Content object to be stringified
 * @returns {object} Updated section
 */
export async function updateSectionContent(db, id, contentJson) {
  const result = await db
    .prepare(
      `UPDATE ai_sections
       SET content_json = ?, updated_at = unixepoch()
       WHERE id = ?
       RETURNING *`
    )
    .bind(JSON.stringify(contentJson), id)
    .first();

  return result;
}

/**
 * Toggle section visibility
 * @param {object} db - D1 database instance
 * @param {number} id - Section ID
 * @param {boolean} isVisible - Visibility state
 * @returns {object} Updated section
 */
export async function toggleSectionVisibility(db, id, isVisible) {
  const result = await db
    .prepare(
      `UPDATE ai_sections
       SET is_visible = ?, updated_at = unixepoch()
       WHERE id = ?
       RETURNING *`
    )
    .bind(isVisible ? 1 : 0, id)
    .first();

  return result;
}

/**
 * Count sections for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {number} Count of sections
 */
export async function countSectionsByProjectId(db, aiProjectId) {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM ai_sections WHERE ai_project_id = ?')
    .bind(aiProjectId)
    .first();

  return result?.count || 0;
}
