# Fix 500 Error After Google Login

## Problem
Getting "500 - Internal Server Error" after clicking "Sign in with Google" and completing authentication.

## Root Cause
Google OAuth redirect URI is not configured for the production URL.

## Solution

### Update Google OAuth Redirect URI

1. **Go to Google Cloud Console**:
   - URL: https://console.cloud.google.com/

2. **Navigate to Credentials**:
   - Click on "APIs & Services" (left sidebar)
   - Click on "Credentials"

3. **Edit OAuth 2.0 Client**:
   - Find your OAuth 2.0 Client ID
   - Click the edit icon (pencil)

4. **Add Production Redirect URI**:
   - Scroll to "Authorized redirect URIs"
   - Click "ADD URI"
   - Add: `https://caddisfly.fabianodevtools.workers.dev/auth/google/callback`
   - Click "Save"

5. **Verify Both URIs Are Added**:
   - ✅ Preview: `https://caddisfly-preview.fabianodevtools.workers.dev/auth/google/callback`
   - ✅ Production: `https://caddisfly.fabianodevtools.workers.dev/auth/google/callback`

## Test Again

After adding the redirect URI:

1. Visit: https://caddisfly.fabianodevtools.workers.dev
2. Click "Sign in here"
3. Click "Sign in with Google"
4. Complete authentication
5. You should now be redirected to /admin successfully

## Why This Happened

Google OAuth requires you to explicitly whitelist each redirect URI. When Google redirects back to your application after authentication, it checks if the redirect URI is in the whitelist. If not, the callback fails with a generic error, which our application catches and shows as a 500 error.

## Alternative: Check Current Configuration

If you want to see what redirect URIs are currently configured:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Check the "Authorized redirect URIs" section

## Expected URIs

You should have these URIs configured:

```
https://caddisfly-preview.fabianodevtools.workers.dev/auth/google/callback
https://caddisfly.fabianodevtools.workers.dev/auth/google/callback
```

## After Fix

Once the redirect URI is added:
- ✅ Login will work on production
- ✅ You'll be redirected to admin dashboard
- ✅ Session will persist
- ✅ All routes will work

---

**Quick Fix**: Just add the production callback URL to Google OAuth settings!
