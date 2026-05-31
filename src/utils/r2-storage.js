/**
 * R2 storage utilities for Caddisfly
 * Handles file uploads and retrieval from Cloudflare R2
 */

/**
 * Uploads content to R2 bucket
 * @param {R2Bucket} storage - R2 bucket binding
 * @param {string} path - Path within the bucket
 * @param {string|ReadableStream|ArrayBuffer} content - Content to upload
 * @param {string} contentType - MIME type of the content
 * @returns {Promise<void>}
 */
export async function uploadToR2(storage, path, content, contentType = 'text/html') {
  try {
    await storage.put(path, content, {
      httpMetadata: {
        contentType: contentType,
      },
    });
    console.log(`Uploaded to R2: ${path}`);
  } catch (error) {
    console.error(`Failed to upload to R2 at ${path}:`, error);
    throw new Error(`R2 upload failed: ${error.message}`);
  }
}

/**
 * Retrieves content from R2 bucket
 * @param {R2Bucket} storage - R2 bucket binding
 * @param {string} path - Path within the bucket
 * @returns {Promise<string|null>} Content as string, or null if not found
 */
export async function getFromR2(storage, path) {
  try {
    const object = await storage.get(path);

    if (!object) {
      console.log(`Object not found in R2: ${path}`);
      return null;
    }

    const content = await object.text();
    return content;
  } catch (error) {
    console.error(`Failed to retrieve from R2 at ${path}:`, error);
    throw new Error(`R2 retrieval failed: ${error.message}`);
  }
}

/**
 * Generates R2 storage path for project files
 * @param {string} projectId - Project UUID
 * @param {number} pageIndex - Page index (0-based)
 * @param {'original'|'refactored'} type - File type
 * @returns {string} R2 path
 */
export function generateR2Path(projectId, pageIndex, type) {
  if (type !== 'original' && type !== 'refactored') {
    throw new Error(`Invalid type: ${type}. Must be 'original' or 'refactored'`);
  }

  return `projects/${projectId}/${type}/page-${pageIndex}.html`;
}

/**
 * Deletes an object from R2 bucket
 * @param {R2Bucket} storage - R2 bucket binding
 * @param {string} path - Path within the bucket
 * @returns {Promise<void>}
 */
export async function deleteFromR2(storage, path) {
  try {
    await storage.delete(path);
    console.log(`Deleted from R2: ${path}`);
  } catch (error) {
    console.error(`Failed to delete from R2 at ${path}:`, error);
    throw new Error(`R2 deletion failed: ${error.message}`);
  }
}

/**
 * Deletes all files for a project
 * @param {R2Bucket} storage - R2 bucket binding
 * @param {string} projectId - Project UUID
 * @returns {Promise<void>}
 */
export async function deleteProjectFiles(storage, projectId) {
  const prefix = `projects/${projectId}/`;

  try {
    // List all objects with the project prefix
    const listed = await storage.list({ prefix });

    // Delete each object
    const deletePromises = listed.objects.map(obj => storage.delete(obj.key));
    await Promise.all(deletePromises);

    console.log(`Deleted ${listed.objects.length} files for project ${projectId}`);
  } catch (error) {
    console.error(`Failed to delete project files for ${projectId}:`, error);
    throw new Error(`Project file deletion failed: ${error.message}`);
  }
}

/**
 * Checks if an object exists in R2
 * @param {R2Bucket} storage - R2 bucket binding
 * @param {string} path - Path within the bucket
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
export async function existsInR2(storage, path) {
  try {
    const object = await storage.head(path);
    return object !== null;
  } catch (error) {
    console.error(`Failed to check existence in R2 at ${path}:`, error);
    return false;
  }
}

/**
 * Gets metadata for an object in R2
 * @param {R2Bucket} storage - R2 bucket binding
 * @param {string} path - Path within the bucket
 * @returns {Promise<Object|null>} Metadata object or null if not found
 */
export async function getR2Metadata(storage, path) {
  try {
    const object = await storage.head(path);

    if (!object) {
      return null;
    }

    return {
      size: object.size,
      etag: object.etag,
      httpEtag: object.httpEtag,
      uploaded: object.uploaded,
      httpMetadata: object.httpMetadata,
      customMetadata: object.customMetadata,
    };
  } catch (error) {
    console.error(`Failed to get R2 metadata at ${path}:`, error);
    return null;
  }
}
