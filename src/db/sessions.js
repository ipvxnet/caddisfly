// Session database operations

import { generateToken } from '../utils/crypto.js';

/**
 * Create a new session for a user
 * @param {object} db - D1 database instance
 * @param {number} userId - User ID
 * @param {number} durationHours - Session duration in hours
 * @returns {object} Created session with token
 */
export async function createSession(db, userId, durationHours = 168) {
  const sessionToken = generateToken(32);
  const expiresAt = Math.floor(Date.now() / 1000) + (durationHours * 60 * 60);

  const result = await db
    .prepare(
      `INSERT INTO sessions (user_id, session_token, expires_at)
       VALUES (?, ?, ?)
       RETURNING *`
    )
    .bind(userId, sessionToken, expiresAt)
    .first();

  return result;
}

/**
 * Get session by token and validate expiration
 * @param {object} db - D1 database instance
 * @param {string} token - Session token
 * @returns {object|null} Session with user data or null if invalid/expired
 */
export async function getSessionByToken(db, token) {
  const now = Math.floor(Date.now() / 1000);

  const session = await db
    .prepare(
      `SELECT
         s.*,
         u.id as user_id,
         u.email,
         u.name,
         u.avatar_url,
         u.role
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = ?
         AND s.expires_at > ?`
    )
    .bind(token, now)
    .first();

  return session;
}

/**
 * Delete a session (logout)
 * @param {object} db - D1 database instance
 * @param {string} token - Session token
 * @returns {boolean} True if deleted
 */
export async function deleteSession(db, token) {
  const result = await db
    .prepare('DELETE FROM sessions WHERE session_token = ?')
    .bind(token)
    .run();

  return result.success;
}

/**
 * Delete all sessions for a user
 * @param {object} db - D1 database instance
 * @param {number} userId - User ID
 * @returns {boolean} True if deleted
 */
export async function deleteUserSessions(db, userId) {
  const result = await db
    .prepare('DELETE FROM sessions WHERE user_id = ?')
    .bind(userId)
    .run();

  return result.success;
}

/**
 * Clean up expired sessions
 * @param {object} db - D1 database instance
 * @returns {number} Number of sessions deleted
 */
export async function cleanupExpiredSessions(db) {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare('DELETE FROM sessions WHERE expires_at <= ?')
    .bind(now)
    .run();

  return result.meta.changes || 0;
}

/**
 * Get all sessions for a user
 * @param {object} db - D1 database instance
 * @param {number} userId - User ID
 * @returns {array} Array of sessions
 */
export async function getUserSessions(db, userId) {
  const result = await db
    .prepare(
      `SELECT * FROM sessions
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all();

  return result.results || [];
}
