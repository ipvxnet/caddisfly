// Project database operations

import { generateToken } from '../utils/crypto.js';

/**
 * Create a new project
 * @param {object} db - D1 database instance
 * @param {object} data - Project data
 * @returns {object} Created project
 */
export async function createProject(db, data) {
  const {
    customerEmail,
    originalUrl,
    status = 'preview_pending',
    pricingTier = null,
    portfolioIncluded = 0,
  } = data;

  // Generate unique preview ID
  const previewId = generateToken(16);

  const result = await db
    .prepare(
      `INSERT INTO projects (
         preview_id, customer_email, original_url, status,
         pricing_tier, portfolio_included
       )
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(previewId, customerEmail, originalUrl, status, pricingTier, portfolioIncluded)
    .first();

  return result;
}

/**
 * Get project by ID
 * @param {object} db - D1 database instance
 * @param {number} projectId - Project ID
 * @returns {object|null} Project object or null
 */
export async function getProjectById(db, projectId) {
  const project = await db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .bind(projectId)
    .first();

  return project;
}

/**
 * Get project by preview ID
 * @param {object} db - D1 database instance
 * @param {string} previewId - Preview ID
 * @returns {object|null} Project object or null
 */
export async function getProjectByPreviewId(db, previewId) {
  const project = await db
    .prepare('SELECT * FROM projects WHERE preview_id = ?')
    .bind(previewId)
    .first();

  return project;
}

/**
 * Update project status
 * @param {object} db - D1 database instance
 * @param {number} projectId - Project ID
 * @param {string} status - New status
 * @returns {object} Updated project
 */
export async function updateProjectStatus(db, projectId, status) {
  const result = await db
    .prepare(
      `UPDATE projects
       SET status = ?
       WHERE id = ?
       RETURNING *`
    )
    .bind(status, projectId)
    .first();

  return result;
}

/**
 * Update project
 * @param {object} db - D1 database instance
 * @param {number} projectId - Project ID
 * @param {object} updates - Fields to update
 * @returns {object} Updated project
 */
export async function updateProject(db, projectId, updates) {
  const allowedFields = [
    'status', 'pricing_tier', 'portfolio_included', 'dns_zone_id',
    'dns_status', 'github_repo_url', 'github_username', 'purchased_at', 'activated_at'
  ];

  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    return getProjectById(db, projectId);
  }

  values.push(projectId);

  const result = await db
    .prepare(
      `UPDATE projects
       SET ${fields.join(', ')}
       WHERE id = ?
       RETURNING *`
    )
    .bind(...values)
    .first();

  return result;
}

/**
 * Get all projects with pagination
 * @param {object} db - D1 database instance
 * @param {object} options - Query options
 * @returns {object} { projects: [], total: number }
 */
export async function getAllProjects(db, options = {}) {
  const {
    limit = 50,
    offset = 0,
    status = null,
    customerEmail = null,
    orderBy = 'created_at',
    orderDir = 'DESC',
  } = options;

  let query = 'SELECT * FROM projects WHERE 1=1';
  const bindings = [];

  if (status) {
    query += ' AND status = ?';
    bindings.push(status);
  }

  if (customerEmail) {
    query += ' AND customer_email = ?';
    bindings.push(customerEmail);
  }

  query += ` ORDER BY ${orderBy} ${orderDir}`;
  query += ' LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all();

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM projects WHERE 1=1';
  const countBindings = [];

  if (status) {
    countQuery += ' AND status = ?';
    countBindings.push(status);
  }

  if (customerEmail) {
    countQuery += ' AND customer_email = ?';
    countBindings.push(customerEmail);
  }

  const countResult = await db
    .prepare(countQuery)
    .bind(...countBindings)
    .first();

  return {
    projects: result.results || [],
    total: countResult?.total || 0,
  };
}

/**
 * Delete project
 * @param {object} db - D1 database instance
 * @param {number} projectId - Project ID
 * @returns {boolean} True if deleted
 */
export async function deleteProject(db, projectId) {
  const result = await db
    .prepare('DELETE FROM projects WHERE id = ?')
    .bind(projectId)
    .run();

  return result.success;
}
