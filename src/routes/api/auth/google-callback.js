// Google OAuth callback handler

import { redirect, badRequest, internalServerError } from '../../../utils/response.js';
import { getConfig } from '../../../utils/constants.js';
import { getUserByGoogleId, createUser, updateUserLastLogin } from '../../../db/users.js';
import { createSession } from '../../../db/sessions.js';
import { setCookie } from '../../../utils/crypto.js';

/**
 * Handle Google OAuth callback
 * @param {object} ctx - Request context
 * @returns {Response} Redirect response
 */
export async function handleGoogleCallback(ctx) {
  const { query, env } = ctx;
  const config = getConfig(env);

  // Get authorization code from query params
  const code = query.code;
  const error = query.error;

  if (error) {
    console.error('Google OAuth error:', error);
    return badRequest('Authentication failed');
  }

  if (!code) {
    return badRequest('Missing authorization code');
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return internalServerError('Failed to exchange authorization code', false, config.isDev);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch user profile from Google
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      console.error('Profile fetch failed:', await profileResponse.text());
      return internalServerError('Failed to fetch user profile', false, config.isDev);
    }

    const profile = await profileResponse.json();

    // Check if user exists
    let user = await getUserByGoogleId(env.DB, profile.id);

    if (!user) {
      // Create new user
      user = await createUser(env.DB, profile);
    } else {
      // Update last login
      user = await updateUserLastLogin(env.DB, user.id);
    }

    // Create session
    const session = await createSession(env.DB, user.id, config.sessionDurationHours);

    // Set session cookie
    const response = redirect('/admin');
    const responseWithCookie = setCookie(response, 'session_token', session.session_token, {
      maxAge: config.sessionDurationHours * 60 * 60,
      secure: config.isProd,
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    });

    return responseWithCookie;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return internalServerError('Authentication failed', false, config.isDev, error);
  }
}
