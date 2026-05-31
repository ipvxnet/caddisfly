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

  console.log('[OAuth] Callback started');
  console.log('[OAuth] Environment:', env.ENVIRONMENT);
  console.log('[OAuth] Has DB binding:', !!env.DB);

  const config = getConfig(env);

  console.log('[OAuth] Config:', {
    hasClientId: !!config.googleClientId,
    hasClientSecret: !!config.googleClientSecret,
    redirectUri: config.googleRedirectUri,
    isDev: config.isDev
  });

  // Get authorization code from query params
  const code = query.code;
  const error = query.error;

  if (error) {
    console.error('[OAuth] Error from Google:', error);
    return badRequest('Authentication failed');
  }

  if (!code) {
    console.error('[OAuth] No code received');
    return badRequest('Missing authorization code');
  }

  console.log('[OAuth] Code received, proceeding with token exchange');

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

    console.log('[OAuth] Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[OAuth] Token exchange failed:', errorText);
      return internalServerError('Failed to exchange authorization code', false, true);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log('[OAuth] Got access token, fetching profile');

    // Fetch user profile from Google
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log('[OAuth] Profile response status:', profileResponse.status);

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('[OAuth] Profile fetch failed:', errorText);
      return internalServerError('Failed to fetch user profile', false, true);
    }

    const profile = await profileResponse.json();
    console.log('[OAuth] Profile received:', { email: profile.email, sub: profile.sub });

    // Check if user exists
    console.log('[OAuth] Looking up user by Google ID');
    let user = await getUserByGoogleId(env.DB, profile.sub);

    if (!user) {
      console.log('[OAuth] User not found, creating new user');
      user = await createUser(env.DB, profile);
      console.log('[OAuth] User created:', user.id);
    } else {
      console.log('[OAuth] User found, updating last login');
      user = await updateUserLastLogin(env.DB, user.id);
    }

    // Create session
    console.log('[OAuth] Creating session for user:', user.id);
    const session = await createSession(env.DB, user.id, config.sessionDurationHours);
    console.log('[OAuth] Session created:', session.id);

    // Set session cookie
    const response = redirect('/admin');
    const responseWithCookie = setCookie(response, 'session_token', session.session_token, {
      maxAge: config.sessionDurationHours * 60 * 60,
      secure: config.isProd,
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    });

    console.log('[OAuth] Redirecting to /admin with session cookie');
    return responseWithCookie;
  } catch (error) {
    console.error('[OAuth] Exception caught:', error.message);
    console.error('[OAuth] Stack trace:', error.stack);
    return internalServerError('Authentication failed: ' + error.message, false, true, error);
  }
}
