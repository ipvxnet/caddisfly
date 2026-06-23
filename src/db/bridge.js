// Bridge pattern helper. Per-site tables carry BOTH ai_project_id and project_id
// with exactly ONE set (XOR): AI-builder projects use ai_project_id, refactor
// projects use project_id. keyCol() resolves which column + value to scope by.
// Shared so db modules don't each redefine it. See CONVENTIONS.md.

/**
 * @param {{aiProjectId?: number, projectId?: number}} projectKey
 * @returns {{col: 'ai_project_id'|'project_id', val: number}} column to scope by + its value
 */
export function keyCol(projectKey) {
  return projectKey.aiProjectId != null
    ? { col: 'ai_project_id', val: projectKey.aiProjectId }
    : { col: 'project_id', val: projectKey.projectId };
}
