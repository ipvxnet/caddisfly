// Courses v2 data layer — see migrations/073_course_enrollments.sql.
// Bridge-aware like courses.js/site-members.js: projectKey is { aiProjectId }
// XOR { projectId }. An enrollment links a site_member (member_id, migration 070)
// to a course; the published player is gated behind an active row. Free courses
// enroll on a one-click sign-in; paid courses enroll via settleCoursePurchase.
const nowSec = () => Math.floor(Date.now() / 1000);

// WHERE fragment + bind value for a project key (XOR bridge).
function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}
// INSERT column + value for a project key (XOR bridge).
function keyCol(projectKey) {
  return projectKey.aiProjectId != null
    ? { col: 'ai_project_id', val: projectKey.aiProjectId }
    : { col: 'project_id', val: projectKey.projectId };
}

/**
 * Enroll a member in a course (idempotent on (site, course, member)). Re-enrolling
 * reactivates a refunded row. ON CONFLICT repeats the partial-index WHERE so it
 * targets the right index (gotcha — see site-members.js). Returns the row.
 */
export async function enrollMember(db, projectKey, { courseId, memberId, source = 'free' } = {}) {
  const k = keyCol(projectKey);
  const ts = nowSec();
  const src = source === 'paid' ? 'paid' : 'free';
  await db
    .prepare(
      `INSERT INTO course_enrollments (course_id, ${k.col}, member_id, status, source, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)
       ON CONFLICT(${k.col}, course_id, member_id) WHERE ${k.col} IS NOT NULL
       DO UPDATE SET status = 'active', updated_at = excluded.updated_at,
                     source = CASE WHEN course_enrollments.source = 'paid' THEN 'paid' ELSE excluded.source END`
    )
    .bind(courseId, k.val, memberId, src, ts, ts)
    .run();
  return getEnrollment(db, projectKey, courseId, memberId);
}

/** A single enrollment row by (course, member), or null. */
export async function getEnrollment(db, projectKey, courseId, memberId) {
  const k = keyWhere(projectKey);
  return db
    .prepare(`SELECT * FROM course_enrollments WHERE ${k.sql} AND course_id = ? AND member_id = ?`)
    .bind(k.val, courseId, memberId)
    .first();
}

/** True if the member has an ACTIVE enrollment in the course. */
export async function isEnrolled(db, projectKey, courseId, memberId) {
  if (!memberId) return false;
  const row = await getEnrollment(db, projectKey, courseId, memberId);
  return !!(row && row.status === 'active');
}

/** Active-enrollment count for a course (the manager column). */
export async function countEnrollments(db, courseId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM course_enrollments WHERE course_id = ? AND status = 'active'`)
    .bind(courseId)
    .first();
  return (row && row.n) || 0;
}

/** Active-enrollment counts for many courses at once → { [courseId]: n }. */
export async function countEnrollmentsByCourse(db, courseIds = []) {
  const ids = (courseIds || []).filter((n) => Number.isFinite(n));
  if (!ids.length) return {};
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT course_id, COUNT(*) AS n FROM course_enrollments WHERE status = 'active' AND course_id IN (${placeholders}) GROUP BY course_id`)
    .bind(...ids)
    .all();
  const out = {};
  for (const r of results || []) out[r.course_id] = r.n;
  return out;
}
