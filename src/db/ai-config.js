// AI Website Configuration database operations

/**
 * Create website configuration
 * @param {object} db - D1 database instance
 * @param {object} data - Configuration data
 * @returns {object} Created configuration
 */
export async function createWebsiteConfig(db, data) {
  const {
    ai_project_id,
    primary_color = '#667eea',
    secondary_color = '#764ba2',
    font_heading = 'Inter',
    font_body = 'Inter',
    style_theme = 'modern',
  } = data;

  const result = await db
    .prepare(
      `INSERT INTO ai_website_configs (
         ai_project_id, primary_color, secondary_color,
         font_heading, font_body, style_theme
       )
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(ai_project_id, primary_color, secondary_color, font_heading, font_body, style_theme)
    .first();

  return result;
}

/**
 * Get website configuration by project ID
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {object|null} Configuration or null
 */
export async function getWebsiteConfigByProjectId(db, aiProjectId) {
  const config = await db
    .prepare('SELECT * FROM ai_website_configs WHERE ai_project_id = ?')
    .bind(aiProjectId)
    .first();

  return config;
}

/**
 * Update website configuration
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @param {object} data - Fields to update
 * @returns {object} Updated configuration
 */
export async function updateWebsiteConfig(db, aiProjectId, data) {
  const allowedFields = ['primary_color', 'secondary_color', 'font_heading', 'font_body', 'style_theme'];

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
  values.push(aiProjectId);

  const sql = `UPDATE ai_website_configs SET ${updates.join(', ')} WHERE ai_project_id = ? RETURNING *`;

  const result = await db.prepare(sql).bind(...values).first();

  return result;
}

/**
 * Delete website configuration
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {boolean} Success
 */
export async function deleteWebsiteConfig(db, aiProjectId) {
  await db.prepare('DELETE FROM ai_website_configs WHERE ai_project_id = ?').bind(aiProjectId).run();

  return true;
}

/**
 * Get or create website configuration (ensures config exists)
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {object} Configuration
 */
export async function getOrCreateWebsiteConfig(db, aiProjectId) {
  let config = await getWebsiteConfigByProjectId(db, aiProjectId);

  if (!config) {
    config = await createWebsiteConfig(db, { ai_project_id: aiProjectId });
  }

  return config;
}

/**
 * Update colors only
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @param {string} primaryColor - Primary color hex
 * @param {string} secondaryColor - Secondary color hex
 * @returns {object} Updated configuration
 */
export async function updateColors(db, aiProjectId, primaryColor, secondaryColor) {
  return updateWebsiteConfig(db, aiProjectId, {
    primary_color: primaryColor,
    secondary_color: secondaryColor,
  });
}

/**
 * Update fonts only
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @param {string} fontHeading - Heading font name
 * @param {string} fontBody - Body font name
 * @returns {object} Updated configuration
 */
export async function updateFonts(db, aiProjectId, fontHeading, fontBody) {
  return updateWebsiteConfig(db, aiProjectId, {
    font_heading: fontHeading,
    font_body: fontBody,
  });
}

/**
 * Update theme only
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @param {string} styleTheme - Theme name (modern, classic, minimal, bold)
 * @returns {object} Updated configuration
 */
export async function updateTheme(db, aiProjectId, styleTheme) {
  return updateWebsiteConfig(db, aiProjectId, {
    style_theme: styleTheme,
  });
}
