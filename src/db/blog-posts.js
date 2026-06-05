// Blog post data layer (see migrations/021_blog_posts.sql). Bridge-aware like
// ai_pages: projectKey is { aiProjectId } XOR { projectId }.

const nowSec = () => Math.floor(Date.now() / 1000);

// WHERE fragment + bind value for a project key.
function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}

export function slugify(title) {
  const s = String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining marks after NFD)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'post';
}

/** Unique slug within the project (appends -2, -3, ... on collision). */
export async function uniquePostSlug(db, projectKey, title, excludeId = null) {
  const k = keyWhere(projectKey);
  const base = slugify(title);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const row = excludeId != null
      ? await db.prepare(`SELECT id FROM blog_posts WHERE ${k.sql} AND slug = ? AND id != ?`).bind(k.val, slug, excludeId).first()
      : await db.prepare(`SELECT id FROM blog_posts WHERE ${k.sql} AND slug = ?`).bind(k.val, slug).first();
    if (!row) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now() % 10000}`;
}

export async function createPost(db, projectKey, { slug, title, excerpt, content, cover_image, status }) {
  return db
    .prepare(
      `INSERT INTO blog_posts (ai_project_id, project_id, slug, title, excerpt, content, cover_image, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      projectKey.aiProjectId != null ? projectKey.aiProjectId : null,
      projectKey.projectId != null ? projectKey.projectId : null,
      slug,
      title,
      excerpt || '',
      content || '',
      cover_image || '',
      status === 'published' ? 'published' : 'draft',
      status === 'published' ? nowSec() : null
    )
    .first();
}

export async function getPostsByProject(db, projectKey, publishedOnly = false) {
  const k = keyWhere(projectKey);
  const where = publishedOnly ? `${k.sql} AND status = 'published'` : k.sql;
  const { results } = await db
    .prepare(`SELECT * FROM blog_posts WHERE ${where} ORDER BY COALESCE(published_at, created_at) DESC, id DESC`)
    .bind(k.val)
    .all();
  return results || [];
}

export async function getPostById(db, projectKey, id) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM blog_posts WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

export async function getPostBySlug(db, projectKey, slug) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM blog_posts WHERE ${k.sql} AND slug = ?`).bind(k.val, slug).first();
}

const POST_FIELDS = ['slug', 'title', 'excerpt', 'content', 'cover_image', 'status', 'published_at', 'seo_title', 'seo_description'];

export async function updatePost(db, projectKey, id, updates) {
  const k = keyWhere(projectKey);
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    if (POST_FIELDS.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (!fields.length) return getPostById(db, projectKey, id);
  fields.push('updated_at = ?');
  values.push(nowSec(), k.val, id);
  return db
    .prepare(`UPDATE blog_posts SET ${fields.join(', ')} WHERE ${k.sql} AND id = ? RETURNING *`)
    .bind(...values)
    .first();
}

export async function deletePost(db, projectKey, id) {
  const k = keyWhere(projectKey);
  const r = await db.prepare(`DELETE FROM blog_posts WHERE ${k.sql} AND id = ?`).bind(k.val, id).run();
  return !!(r && r.meta && r.meta.changes);
}

export async function countPublishedPosts(db, projectKey) {
  const k = keyWhere(projectKey);
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM blog_posts WHERE ${k.sql} AND status = 'published'`).bind(k.val).first();
  return (r && r.n) || 0;
}
