// Admin logout route

import { redirect } from '../../utils/response.js';
import { deleteSession } from '../../db/sessions.js';
import { clearCookie } from '../../utils/crypto.js';

/**
 * Handle logout
 * @param {object} ctx - Request context
 * @returns {Response} Redirect response
 */
export async function handleLogout(ctx) {
  const { session, env } = ctx;

  // Delete session from database if it exists
  if (session?.token) {
    await deleteSession(env.DB, session.token);
  }

  // Clear session cookie and redirect to login
  const response = redirect('/login');
  const responseWithClearedCookie = clearCookie(response, 'session_token', {
    path: '/',
  });

  return responseWithClearedCookie;
}
