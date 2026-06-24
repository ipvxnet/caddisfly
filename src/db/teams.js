// Team membership data layer (account-level teams; see migrations/014_teams.sql).
//
// A team is a billing account keyed by owner_email. The owner is implicit (never
// a row here) and is always admin. team_members holds invited/active members.
// Pure D1 access, mirrors src/db/billing.js conventions.

import { generateToken } from '../utils/crypto.js';
import { keyCol } from './bridge.js';

const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60; // invite links valid 7 days
const nowSec = () => Math.floor(Date.now() / 1000);

/** All members of an owner's team (invited + active), newest first. */
export async function getTeamMembers(db, ownerEmail) {
  const { results } = await db
    .prepare('SELECT * FROM team_members WHERE owner_email = ? ORDER BY created_at ASC')
    .bind(ownerEmail)
    .all();
  return results || [];
}

/** Seats used by an account: 1 (owner) + every member row (invited or active). */
export async function countTeamSeats(db, ownerEmail) {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM team_members WHERE owner_email = ?')
    .bind(ownerEmail)
    .first();
  return 1 + ((row && row.n) || 0);
}

/** A single member row (or null). */
export async function getMember(db, ownerEmail, memberEmail) {
  return db
    .prepare('SELECT * FROM team_members WHERE owner_email = ? AND member_email = ?')
    .bind(ownerEmail, memberEmail)
    .first();
}

/**
 * Create (or re-issue) an invite. Returns the row including the invite token.
 * Idempotent on (owner_email, member_email): re-inviting refreshes the token.
 */
export async function createInvite(db, { ownerEmail, memberEmail, role = 'member', invitedBy }) {
  const token = generateToken(32);
  const expiresAt = nowSec() + INVITE_TTL_SECONDS;
  await db
    .prepare(
      `INSERT INTO team_members (owner_email, member_email, role, status, invite_token, invite_expires_at, invited_by)
       VALUES (?, ?, ?, 'invited', ?, ?, ?)
       ON CONFLICT(owner_email, member_email) DO UPDATE SET
         role = excluded.role,
         invite_token = excluded.invite_token,
         invite_expires_at = excluded.invite_expires_at,
         invited_by = excluded.invited_by`
    )
    .bind(ownerEmail, memberEmail, role, token, expiresAt, invitedBy || ownerEmail)
    .run();
  return getMember(db, ownerEmail, memberEmail);
}

/** Look up an invite by its token (any status). */
export async function getInviteByToken(db, token) {
  return db.prepare('SELECT * FROM team_members WHERE invite_token = ?').bind(token).first();
}

/**
 * Accept an invite token: marks the row active, stamps joined_at, clears the
 * token. Returns the member row, or null if the token is invalid/expired.
 */
export async function acceptInvite(db, token) {
  const row = await getInviteByToken(db, token);
  if (!row) return null;
  if (row.invite_expires_at && row.invite_expires_at < nowSec()) return null;
  await db
    .prepare(
      `UPDATE team_members SET status = 'active', joined_at = ?, invite_token = NULL, invite_expires_at = NULL
       WHERE id = ?`
    )
    .bind(nowSec(), row.id)
    .run();
  return getMember(db, row.owner_email, row.member_email);
}

/** Change a member's role (admin | member). */
export async function setMemberRole(db, ownerEmail, memberEmail, role) {
  await db
    .prepare('UPDATE team_members SET role = ? WHERE owner_email = ? AND member_email = ?')
    .bind(role, ownerEmail, memberEmail)
    .run();
  return getMember(db, ownerEmail, memberEmail);
}

/** Remove a member from a team (and clear any per-site scope rows). */
export async function removeMember(db, ownerEmail, memberEmail) {
  await db.batch([
    db.prepare('DELETE FROM team_members WHERE owner_email = ? AND member_email = ?').bind(ownerEmail, memberEmail),
    db.prepare('DELETE FROM team_member_sites WHERE owner_email = ? AND member_email = ?').bind(ownerEmail, memberEmail),
  ]);
}

/** Active teams a member belongs to → array of rows (owner_email + role). */
export async function getTeamsForMember(db, memberEmail) {
  const { results } = await db
    .prepare("SELECT * FROM team_members WHERE member_email = ? AND status = 'active' ORDER BY joined_at DESC")
    .bind(memberEmail)
    .all();
  return results || [];
}

/**
 * Is `email` allowed to manage `ownerEmail`'s team? True for the owner itself or
 * an ACTIVE member with the admin role.
 */
export async function canManageTeam(db, ownerEmail, email) {
  if (email === ownerEmail) return true;
  const m = await getMember(db, ownerEmail, email);
  return !!(m && m.status === 'active' && m.role === 'admin');
}

// ---- Per-site access scope (migration 061) --------------------------------
// A member with ZERO scope rows can access ALL of the owner's sites (default,
// backward compatible). With ≥1 rows, access is limited to exactly those sites.

/**
 * Replace a member's per-site scope. `projectKeys` = array of {aiProjectId} or
 * {projectId} bridge keys. An EMPTY array clears the scope → full-account
 * access. Atomic (db.batch).
 */
export async function setMemberSiteScope(db, ownerEmail, memberEmail, projectKeys = []) {
  const stmts = [
    db.prepare('DELETE FROM team_member_sites WHERE owner_email = ? AND member_email = ?').bind(ownerEmail, memberEmail),
  ];
  for (const pk of projectKeys) {
    const k = keyCol(pk);
    const ai = k.col === 'ai_project_id' ? k.val : null;
    const rg = k.col === 'project_id' ? k.val : null;
    stmts.push(
      db.prepare('INSERT OR IGNORE INTO team_member_sites (owner_email, member_email, ai_project_id, project_id) VALUES (?, ?, ?, ?)')
        .bind(ownerEmail, memberEmail, ai, rg)
    );
  }
  await db.batch(stmts);
}

/** A member's scoped sites as bridge keys. Empty array means NO scope (= all sites). */
export async function getMemberSiteScope(db, ownerEmail, memberEmail) {
  const { results } = await db
    .prepare('SELECT ai_project_id, project_id FROM team_member_sites WHERE owner_email = ? AND member_email = ?')
    .bind(ownerEmail, memberEmail)
    .all();
  return (results || []).map((r) => (r.ai_project_id != null ? { aiProjectId: r.ai_project_id } : { projectId: r.project_id }));
}

/**
 * Does `memberEmail` reach this specific site? True when the member is unscoped
 * (no rows → full access) OR the site is explicitly in their scope.
 */
export async function memberHasSiteAccess(db, ownerEmail, memberEmail, projectKey) {
  const cnt = await db
    .prepare('SELECT COUNT(*) AS n FROM team_member_sites WHERE owner_email = ? AND member_email = ?')
    .bind(ownerEmail, memberEmail)
    .first();
  if (!cnt || !cnt.n) return true; // unscoped → full access
  const k = keyCol(projectKey);
  const row = await db
    .prepare(`SELECT 1 FROM team_member_sites WHERE owner_email = ? AND member_email = ? AND ${k.col} = ?`)
    .bind(ownerEmail, memberEmail, k.val)
    .first();
  return !!row;
}

/** One member's scoped PUBLIC ids as a Set, or null when unscoped (= all sites).
 *  Drives filtering of the member's "shared by owner" site list. */
export async function getMemberScopePublicIds(db, ownerEmail, memberEmail) {
  const { results } = await db
    .prepare(
      `SELECT COALESCE(a.project_id, p.preview_id) AS public_id
         FROM team_member_sites t
         LEFT JOIN ai_projects a ON a.id = t.ai_project_id
         LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.owner_email = ? AND t.member_email = ?`
    )
    .bind(ownerEmail, memberEmail)
    .all();
  if (!results || !results.length) return null; // unscoped
  return new Set(results.map((r) => r.public_id).filter(Boolean));
}

/** Map of member_email → Set of scoped PUBLIC ids, for one owner. Members with no
 *  entry here are unscoped (full access). Drives the member-row scope display +
 *  pre-checked state of the scope editor. */
export async function getScopePublicIdMap(db, ownerEmail) {
  const { results } = await db
    .prepare(
      `SELECT t.member_email AS member_email, COALESCE(a.project_id, p.preview_id) AS public_id
         FROM team_member_sites t
         LEFT JOIN ai_projects a ON a.id = t.ai_project_id
         LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.owner_email = ?`
    )
    .bind(ownerEmail)
    .all();
  const map = {};
  for (const r of results || []) {
    if (!r.public_id) continue;
    (map[r.member_email] = map[r.member_email] || new Set()).add(r.public_id);
  }
  return map;
}
