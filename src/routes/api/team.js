// Team management API (account-level). The caller (ctx.billingEmail) manages
// their OWN team (they are the implicit owner/admin). JSON in/out.
//   POST /api/team/invite  { email, role? }
//   POST /api/team/role    { email, role }
//   POST /api/team/remove  { email }

import {
  countTeamSeats,
  getMember,
  createInvite,
  setMemberRole,
  removeMember,
  canManageTeam,
} from '../../db/teams.js';
import { getCreditState, teamLimit } from '../../utils/credits.js';
import { isValidEmail, sanitizeEmail, sendTeamInviteEmail } from '../../utils/email.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Resolve the team being managed (body.owner, defaulting to the caller's own
// account) and confirm the caller may manage it (owner or active admin member).
async function resolveTeam(ctx, body) {
  const caller = ctx.billingEmail;
  if (!caller) return { error: json({ success: false, error: 'Please sign in.' }, 401) };
  const owner = sanitizeEmail(body.owner || caller) || caller;
  if (!(await canManageTeam(ctx.env.DB, owner, caller))) {
    return { error: json({ success: false, error: "You're not allowed to manage this team." }, 403) };
  }
  return { caller, owner };
}

/** POST /api/team/invite */
export async function handleTeamInvite(ctx) {
  const { env, request, url } = ctx;
  const body = await request.json().catch(() => ({}));
  const { owner, error } = await resolveTeam(ctx, body);
  if (error) return error;

  const member = sanitizeEmail(body.email || '');
  const role = ['admin', 'publisher', 'member'].includes(body.role) ? body.role : 'member';

  if (!isValidEmail(member)) return json({ success: false, error: 'Enter a valid email address.' }, 400);
  if (member === owner) return json({ success: false, error: "That's the team owner's account." }, 400);

  const { tier } = await getCreditState(env.DB, owner);
  const limit = teamLimit(tier);
  if (limit <= 1) {
    return json({ success: false, error: 'Team members are available on paid plans. Upgrade to invite your team.', billing_url: '/billing' }, 402);
  }

  // Re-inviting an existing member doesn't consume a new seat; a brand-new
  // member must fit within the tier's seat cap (total incl. owner).
  const existing = await getMember(env.DB, owner, member);
  if (!existing) {
    const seatsUsed = await countTeamSeats(env.DB, owner);
    if (seatsUsed >= limit) {
      return json({ success: false, error: `This plan allows ${limit} seats (including the owner). Upgrade to add more.`, billing_url: '/billing' }, 402);
    }
  }

  const row = await createInvite(env.DB, { ownerEmail: owner, memberEmail: member, role, invitedBy: ctx.billingEmail });
  const inviteUrl = `${url.origin}/team/accept/${row.invite_token}`;
  await sendTeamInviteEmail(env, member, inviteUrl, owner);

  return json({ success: true, member: { email: member, role, status: row.status } });
}

/** POST /api/team/role */
export async function handleTeamRole(ctx) {
  const { env, request } = ctx;
  const body = await request.json().catch(() => ({}));
  const { owner, error } = await resolveTeam(ctx, body);
  if (error) return error;

  const member = sanitizeEmail(body.email || '');
  const role = ['admin', 'publisher', 'member'].includes(body.role) ? body.role : 'member';

  const existing = await getMember(env.DB, owner, member);
  if (!existing) return json({ success: false, error: 'That person is not on this team.' }, 404);

  await setMemberRole(env.DB, owner, member, role);
  return json({ success: true, member: { email: member, role } });
}

/** POST /api/team/remove */
export async function handleTeamRemove(ctx) {
  const { env, request } = ctx;
  const body = await request.json().catch(() => ({}));
  const { owner, error } = await resolveTeam(ctx, body);
  if (error) return error;

  const member = sanitizeEmail(body.email || '');

  const existing = await getMember(env.DB, owner, member);
  if (!existing) return json({ success: false, error: 'That person is not on this team.' }, 404);

  await removeMember(env.DB, owner, member);
  return json({ success: true });
}
