/**
 * Database operations for scraped_pages table
 */

/**
 * Creates a new scraped page record
 * @param {D1Database} db - D1 database binding
 * @param {Object} data - Page data
 * @param {string} data.project_id - Project UUID
 * @param {string} data.page_url - URL of the scraped page
 * @param {number} data.page_index - Page index (0-based)
 * @param {string} [data.original_r2_path] - R2 path for original HTML (optional)
 * @param {string} [data.refactored_r2_path] - R2 path for refactored HTML (optional)
 * @returns {Promise<Object>} Created page record with id
 */
export async function createScrapedPage(db, data) {
  const { project_id, page_url, page_index, original_r2_path, refactored_r2_path } = data;

  try {
    const result = await db.prepare(`
      INSERT INTO scraped_pages (
        project_id,
        page_url,
        page_index,
        original_r2_path,
        refactored_r2_path
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      project_id,
      page_url,
      page_index,
      original_r2_path || null,
      refactored_r2_path || null
    ).run();

    if (!result.success) {
      throw new Error('Failed to create scraped page record');
    }

    // Return the created record
    const created = await db.prepare(`
      SELECT * FROM scraped_pages
      WHERE id = ?
    `).bind(result.meta.last_row_id).first();

    return created;
  } catch (error) {
    console.error('Error creating scraped page:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Gets all scraped pages for a project
 * @param {D1Database} db - D1 database binding
 * @param {string} projectId - Project UUID
 * @returns {Promise<Array>} Array of scraped page records
 */
export async function getScrapedPagesByProjectId(db, projectId) {
  try {
    const result = await db.prepare(`
      SELECT *
      FROM scraped_pages
      WHERE project_id = ?
      ORDER BY page_index ASC
    `).bind(projectId).all();

    return result.results || [];
  } catch (error) {
    console.error('Error getting scraped pages:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Updates R2 paths for a scraped page
 * @param {D1Database} db - D1 database binding
 * @param {number} id - Scraped page ID
 * @param {string} originalPath - R2 path for original HTML
 * @param {string} refactoredPath - R2 path for refactored HTML
 * @returns {Promise<void>}
 */
export async function updateScrapedPagePaths(db, id, originalPath, refactoredPath) {
  try {
    const result = await db.prepare(`
      UPDATE scraped_pages
      SET original_r2_path = ?,
          refactored_r2_path = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(originalPath, refactoredPath, id).run();

    if (!result.success) {
      throw new Error('Failed to update scraped page paths');
    }
  } catch (error) {
    console.error('Error updating scraped page paths:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Gets a single scraped page by ID
 * @param {D1Database} db - D1 database binding
 * @param {number} id - Scraped page ID
 * @returns {Promise<Object|null>} Scraped page record or null if not found
 */
export async function getScrapedPageById(db, id) {
  try {
    const result = await db.prepare(`
      SELECT *
      FROM scraped_pages
      WHERE id = ?
    `).bind(id).first();

    return result || null;
  } catch (error) {
    console.error('Error getting scraped page by ID:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Deletes all scraped pages for a project
 * @param {D1Database} db - D1 database binding
 * @param {string} projectId - Project UUID
 * @returns {Promise<void>}
 */
export async function deleteScrapedPagesByProjectId(db, projectId) {
  try {
    const result = await db.prepare(`
      DELETE FROM scraped_pages
      WHERE project_id = ?
    `).bind(projectId).run();

    if (!result.success) {
      throw new Error('Failed to delete scraped pages');
    }

    console.log(`Deleted ${result.meta.changes} scraped pages for project ${projectId}`);
  } catch (error) {
    console.error('Error deleting scraped pages:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Counts scraped pages for a project
 * @param {D1Database} db - D1 database binding
 * @param {string} projectId - Project UUID
 * @returns {Promise<number>} Count of scraped pages
 */
export async function countScrapedPagesByProjectId(db, projectId) {
  try {
    const result = await db.prepare(`
      SELECT COUNT(*) as count
      FROM scraped_pages
      WHERE project_id = ?
    `).bind(projectId).first();

    return result?.count || 0;
  } catch (error) {
    console.error('Error counting scraped pages:', error);
    throw new Error(`Database error: ${error.message}`);
  }
}
