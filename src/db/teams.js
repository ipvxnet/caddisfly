// Team membership data layer (account-level teams; see migrations/014_teams.sql).
//
// A team is a billing account keyed by owner_email. The owner is implicit (never
// a row here) and is always admin. team_members holds invited/active members.
// Pure D1 access, mirrors src/db/billing.js conventions.

import { generateToken } from '../utils/crypto.js';

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

/** Remove a member from a team. */
export async function removeMember(db, ownerEmail, memberEmail) {
  await db
    .prepare('DELETE FROM team_members WHERE owner_email = ? AND member_email = ?')
    .bind(ownerEmail, memberEmail)
    .run();
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
