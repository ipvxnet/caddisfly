// Bridge pattern helper. Per-site tables carry BOTH ai_project_id and project_id
// with exactly ONE set (XOR): AI-builder projects use ai_project_id, refactor
// projects use project_id. keyCol() resolves which column + value to scope by.
// Shared so db modules don't each redefine it. See CONVENTIONS.md.
//
// crm_quotes additionally supports a `lead_id` owner (the admin Leads CRM), so
// keyCol also accepts { leadId } — only meaningful for tables that have that
// column. Owners are mutually exclusive: leadId XOR aiProjectId XOR projectId.

/**
 * @param {{aiProjectId?: number, projectId?: number, leadId?: number}} owner
 * @returns {{col: 'ai_project_id'|'project_id'|'lead_id', val: number}} column to scope by + its value
 */
export function keyCol(owner) {
  if (owner.leadId != null) return { col: 'lead_id', val: owner.leadId };
  return owner.aiProjectId != null
    ? { col: 'ai_project_id', val: owner.aiProjectId }
    : { col: 'project_id', val: owner.projectId };
}
