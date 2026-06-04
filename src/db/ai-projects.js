// AI Project database operations

import { generateToken } from '../utils/crypto.js';

/**
 * Create a new AI project
 * @param {object} db - D1 database instance
 * @param {object} data - Project data
 * @returns {object} Created AI project
 */
export async function createAIProject(db, data) {
  const {
    project_id,
    customer_email,
    project_name = null,
    status = 'conversation',
    conversation_step = 'initial_prompt',
    pricing_tier = 'free_trial',
    language = 'en',
  } = data;

  // Use provided project_id or generate one
  const projectId = project_id || generateToken(16);

  const result = await db
    .prepare(
      `INSERT INTO ai_projects (
         project_id, customer_email, project_name, status,
         conversation_step, pricing_tier, language
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(projectId, customer_email, project_name, status, conversation_step, pricing_tier, language)
    .first();

  return result;
}

/**
 * Get AI project by ID (internal database ID)
 * @param {object} db - D1 database instance
 * @param {number} id - Internal project ID
 * @returns {object|null} Project object or null
 */
export async function getAIProjectById(db, id) {
  const project = await db
    .prepare('SELECT * FROM ai_projects WHERE id = ?')
    .bind(id)
    .first();

  return project;
}

/**
 * Get AI project by project_id (public identifier)
 * @param {object} db - D1 database instance
 * @param {string} projectId - Public project ID
 * @returns {object|null} Project object or null
 */
export async function getAIProjectByProjectId(db, projectId) {
  const project = await db
    .prepare('SELECT * FROM ai_projects WHERE project_id = ?')
    .bind(projectId)
    .first();

  return project;
}

/**
 * Get AI projects by customer email
 * @param {object} db - D1 database instance
 * @param {string} email - Customer email
 * @returns {array} Array of projects
 */
export async function getAIProjectsByEmail(db, email) {
  const projects = await db
    .prepare('SELECT * FROM ai_projects WHERE customer_email = ? ORDER BY created_at DESC')
    .bind(email)
    .all();

  return projects.results || [];
}

/**
 * Update AI project
 * @param {object} db - D1 database instance
 * @param {number} id - Internal project ID
 * @param {object} data - Fields to update
 * @returns {object} Updated project
 */
export async function updateAIProject(db, id, data) {
  const allowedFields = [
    'project_name',
    'status',
    'conversation_step',
    'pricing_tier',
    'language',
    'deployed_at',
    'deployed_url',
    'terms_accepted_at',
    'subdomain',
  ];

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

  const sql = `UPDATE ai_projects SET ${updates.join(', ')} WHERE id = ? RETURNING *`;

  const result = await db.prepare(sql).bind(...values).first();

  return result;
}

/**
 * Delete AI project (cascades to related tables)
 * @param {object} db - D1 database instance
 * @param {number} id - Internal project ID
 * @returns {boolean} Success
 */
export async function deleteAIProject(db, id) {
  await db.prepare('DELETE FROM ai_projects WHERE id = ?').bind(id).run();

  return true;
}

/**
 * Get AI projects by status
 * @param {object} db - D1 database instance
 * @param {string} status - Project status
 * @returns {array} Array of projects
 */
export async function getAIProjectsByStatus(db, status) {
  const projects = await db
    .prepare('SELECT * FROM ai_projects WHERE status = ? ORDER BY created_at DESC')
    .bind(status)
    .all();

  return projects.results || [];
}

/**
 * Count AI projects by email and time range
 * @param {object} db - D1 database instance
 * @param {string} email - Customer email
 * @param {number} sinceTimestamp - Unix timestamp to count from
 * @returns {number} Count of projects
 */
export async function countAIProjectsByEmailSince(db, email, sinceTimestamp) {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM ai_projects WHERE customer_email = ? AND created_at >= ?')
    .bind(email, sinceTimestamp)
    .first();

  return result?.count || 0;
}

/**
 * Get all AI projects (for admin)
 * @param {object} db - D1 database instance
 * @param {number} limit - Limit results
 * @param {number} offset - Offset for pagination
 * @returns {array} Array of projects
 */
export async function getAllAIProjects(db, limit = 50, offset = 0) {
  const projects = await db
    .prepare('SELECT * FROM ai_projects ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all();

  return projects.results || [];
}
