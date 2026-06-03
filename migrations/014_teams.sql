-- 014_teams.sql — account-level team membership.
--
-- A "team" is a billing account, identified by its owner_email (the customer
-- who created the account). The owner is IMPLICIT (no row here) and is always
-- the team admin. team_members holds everyone else the owner invites.
--
-- Seats used by an account = 1 (owner) + COUNT(team_members for that owner).
-- Both 'invited' and 'active' rows consume a seat. Limits per tier live in
-- src/utils/credits.js (TEAM_LIMITS): free_trial 1, starter 5, pro 15, agency 50.
--
-- Additive migration. Applied to PREVIEW caddisfly-db; re-apply to
-- caddisfly-db-prod at cutover.

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,                 -- the billing account = the "team"
  member_email TEXT NOT NULL,                -- invited member (lowercased)
  role TEXT NOT NULL DEFAULT 'member',       -- admin | member  (owner is implicit admin)
  status TEXT NOT NULL DEFAULT 'invited',    -- invited | active
  invite_token TEXT,                         -- single-use token for the accept link
  invite_expires_at INTEGER,
  invited_by TEXT,                           -- email that sent the invite
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  joined_at INTEGER,
  UNIQUE(owner_email, member_email)
);

CREATE INDEX IF NOT EXISTS idx_team_members_owner  ON team_members(owner_email);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_email);
CREATE INDEX IF NOT EXISTS idx_team_members_token  ON team_members(invite_token);
