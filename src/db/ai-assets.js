// AI Asset database operations

/**
 * Create a new asset record
 * @param {object} db - D1 database instance
 * @param {object} data - Asset data
 * @returns {object} Created asset
 */
export async function createAsset(db, data) {
  const { ai_project_id, asset_type, original_filename, r2_path, file_size, mime_type } = data;

  const result = await db
    .prepare(
      `INSERT INTO ai_assets (
         ai_project_id, asset_type, original_filename, r2_path,
         file_size, mime_type
       )
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(ai_project_id, asset_type, original_filename, r2_path, file_size, mime_type)
    .first();

  return result;
}

/**
 * Get asset by ID
 * @param {object} db - D1 database instance
 * @param {number} id - Asset ID
 * @returns {object|null} Asset or null
 */
export async function getAssetById(db, id) {
  const asset = await db.prepare('SELECT * FROM ai_assets WHERE id = ?').bind(id).first();

  return asset;
}

/**
 * Get all assets for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {array} Array of assets
 */
export async function getAssetsByProjectId(db, aiProjectId) {
  const assets = await db
    .prepare('SELECT * FROM ai_assets WHERE ai_project_id = ? ORDER BY uploaded_at DESC')
    .bind(aiProjectId)
    .all();

  return assets.results || [];
}

/**
 * Get assets by type for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @param {string} assetType - Asset type (e.g., 'logo', 'hero', 'gallery')
 * @returns {array} Array of assets
 */
export async function getAssetsByType(db, aiProjectId, assetType) {
  const assets = await db
    .prepare('SELECT * FROM ai_assets WHERE ai_project_id = ? AND asset_type = ? ORDER BY uploaded_at DESC')
    .bind(aiProjectId, assetType)
    .all();

  return assets.results || [];
}

/**
 * Delete asset
 * @param {object} db - D1 database instance
 * @param {number} id - Asset ID
 * @returns {object|null} Deleted asset (for cleanup) or null
 */
export async function deleteAsset(db, id) {
  // First get the asset to return for R2 cleanup
  const asset = await getAssetById(db, id);

  if (asset) {
    await db.prepare('DELETE FROM ai_assets WHERE id = ?').bind(id).run();
  }

  return asset;
}

/**
 * Delete all assets for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {array} Array of deleted assets (for R2 cleanup)
 */
export async function deleteAssetsByProjectId(db, aiProjectId) {
  // First get all assets to return for R2 cleanup
  const assets = await getAssetsByProjectId(db, aiProjectId);

  if (assets.length > 0) {
    await db.prepare('DELETE FROM ai_assets WHERE ai_project_id = ?').bind(aiProjectId).run();
  }

  return assets;
}

/**
 * Count assets for a project
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {number} Count of assets
 */
export async function countAssetsByProjectId(db, aiProjectId) {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM ai_assets WHERE ai_project_id = ?')
    .bind(aiProjectId)
    .first();

  return result?.count || 0;
}

/**
 * Get total file size for project assets
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @returns {number} Total file size in bytes
 */
export async function getTotalAssetSize(db, aiProjectId) {
  const result = await db
    .prepare('SELECT SUM(file_size) as total_size FROM ai_assets WHERE ai_project_id = ?')
    .bind(aiProjectId)
    .first();

  return result?.total_size || 0;
}

/**
 * Check if project has asset of specific type
 * @param {object} db - D1 database instance
 * @param {number} aiProjectId - AI project ID
 * @param {string} assetType - Asset type
 * @returns {boolean} Has asset of type
 */
export async function hasAssetOfType(db, aiProjectId, assetType) {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM ai_assets WHERE ai_project_id = ? AND asset_type = ?')
    .bind(aiProjectId, assetType)
    .first();

  return (result?.count || 0) > 0;
}
