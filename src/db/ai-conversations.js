// AI Conversation database operations

/**
 * Create a new conversation entry (question asked)
 * @param {object} db - D1 database instance
 * @param {object} data - Conversation data
 * @returns {object} Created conversation entry
 */
export async function createConversationEntry(db, data) {
  const { ai_project_id, step_name, question } = data;

  const result = await db
    .prepare(
      `INSERT INTO ai_conversations (
         ai_project_id, step_name, question
       )
       VALUES (?, ?, ?)
       RETURNING *`
    )
    .bind(ai_project_id, step_name, question)
    .first();

  return result;
}

/**
 * Update conversation entry with answer
 * @param {object} db - D1 database instance
 * @param {number} id - Conversation entry ID
 * @param {string} answer - User's answer
 * @returns {object} Updated conversation entry
 */
export async function updateConversationAnswer(db, id, answer) {
  const result = await db
    .prepare(
      `UPDATE ai_conversations
       SET answer = ?, answered_at = unixepoch()
       WHERE id = ?
       RETURNING *`
    )
    .bind(answer, id)
    .first();

  return result;
}

/**
 * Get conversation entry by ID
 * @param {object} db - D1 database instance
 * @param {number} id - Conversation entry ID
 * @returns {object|null} Conversation entry or null
 */
export async function getConversationEntryById(db, id) {
  const entry = await db
    .prepare('SELECT * FROM ai_conversations WHERE id = ?')
    .bind(id)
    .first();

  return entry;
}

/**
 * Get all conversation entries for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {array} Array of conversation entries
 */
export async function getConversationsByProjectId(db, aiProjectId) {
  const conversations = await db
    .prepare('SELECT * FROM ai_conversations WHERE ai_project_id = ? ORDER BY asked_at ASC')
    .bind(aiProjectId)
    .all();

  return conversations.results || [];
}

/**
 * Get conversation entry by project and step
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @param {string} stepName - Step name
 * @returns {object|null} Conversation entry or null
 */
export async function getConversationByStep(db, aiProjectId, stepName) {
  const entry = await db
    .prepare('SELECT * FROM ai_conversations WHERE ai_project_id = ? AND step_name = ?')
    .bind(aiProjectId, stepName)
    .first();

  return entry;
}

/**
 * Get latest unanswered conversation entry for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {object|null} Conversation entry or null
 */
export async function getLatestUnansweredEntry(db, aiProjectId) {
  const entry = await db
    .prepare(
      `SELECT * FROM ai_conversations
       WHERE ai_project_id = ? AND answer IS NULL
       ORDER BY asked_at DESC
       LIMIT 1`
    )
    .bind(aiProjectId)
    .first();

  return entry;
}

/**
 * Get all answered conversation entries for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {array} Array of answered conversation entries
 */
export async function getAnsweredConversations(db, aiProjectId) {
  const conversations = await db
    .prepare(
      `SELECT * FROM ai_conversations
       WHERE ai_project_id = ? AND answer IS NOT NULL
       ORDER BY asked_at ASC`
    )
    .bind(aiProjectId)
    .all();

  return conversations.results || [];
}

/**
 * Delete all conversation entries for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {boolean} Success
 */
export async function deleteConversationsByProjectId(db, aiProjectId) {
  await db.prepare('DELETE FROM ai_conversations WHERE ai_project_id = ?').bind(aiProjectId).run();

  return true;
}

/**
 * Check if all required questions have been answered
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {boolean} All questions answered
 */
export async function areAllQuestionsAnswered(db, aiProjectId) {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN answer IS NOT NULL THEN 1 ELSE 0 END) as answered
       FROM ai_conversations
       WHERE ai_project_id = ?`
    )
    .bind(aiProjectId)
    .first();

  return result.total > 0 && result.total === result.answered;
}
