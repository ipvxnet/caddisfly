// User database operations

/**
 * Create a new user from Google profile
 * @param {object} db - D1 database instance
 * @param {object} profile - Google profile data
 * @returns {object} Created user
 */
export async function createUser(db, profile) {
  const { email, sub: googleId, name, picture: avatarUrl } = profile;

  const result = await db
    .prepare(
      `INSERT INTO users (email, google_id, name, avatar_url, role, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(email, googleId, name, avatarUrl, 'admin', Math.floor(Date.now() / 1000))
    .first();

  return result;
}

/**
 * Get user by ID
 * @param {object} db - D1 database instance
 * @param {number} userId - User ID
 * @returns {object|null} User object or null
 */
export async function getUserById(db, userId) {
  const user = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first();

  return user;
}

/**
 * Get user by Google ID
 * @param {object} db - D1 database instance
 * @param {string} googleId - Google ID
 * @returns {object|null} User object or null
 */
export async function getUserByGoogleId(db, googleId) {
  const user = await db
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(googleId)
    .first();

  return user;
}

/**
 * Get user by email
 * @param {object} db - D1 database instance
 * @param {string} email - Email address
 * @returns {object|null} User object or null
 */
export async function getUserByEmail(db, email) {
  const user = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first();

  return user;
}

/**
 * Update user's last login timestamp
 * @param {object} db - D1 database instance
 * @param {number} userId - User ID
 * @returns {object} Updated user
 */
export async function updateUserLastLogin(db, userId) {
  const result = await db
    .prepare(
      `UPDATE users
       SET last_login_at = ?
       WHERE id = ?
       RETURNING *`
    )
    .bind(Math.floor(Date.now() / 1000), userId)
    .first();

  return result;
}

/**
 * Update user profile
 * @param {object} db - D1 database instance
 * @param {number} userId - User ID
 * @param {object} updates - Fields to update
 * @returns {object} Updated user
 */
export async function updateUser(db, userId, updates) {
  const allowedFields = ['name', 'avatar_url', 'email'];
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    return getUserById(db, userId);
  }

  values.push(userId);

  const result = await db
    .prepare(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = ?
       RETURNING *`
    )
    .bind(...values)
    .first();

  return result;
}
