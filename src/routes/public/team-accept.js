// GET /team/accept/:token — accept a team invitation. Clicking the emailed link
// proves control of the member's email (same trust model as the billing magic
// link), so it both joins the team and signs the member in, then lands them on
// the dashboard. Mirrors handleBillingVerify's cookie handling.

import { redirect } from '../../utils/response.js';
import { setCookie } from '../../utils/crypto.js';
import { acceptInvite } from '../../db/teams.js';
import { createBillingSession, BILLING_COOKIE } from '../../db/billing.js';

export async function handleTeamAccept(ctx) {
  const { env, params } = ctx;
  const member = await acceptInvite(env.DB, params.token);
  if (!member) {
    return redirect('/billing?error=' + encodeURIComponent('That invite link is invalid or has expired.'), 303);
  }

  // Sign the member in (billing session for their email).
  const session = await createBillingSession(env.DB, member.member_email);
  let res = redirect('/dashboard', 303);
  res = setCookie(res, BILLING_COOKIE, session.token, {
    maxAge: session.maxAge,
    secure: env.ENVIRONMENT === 'production',
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
  });
  return res;
}
