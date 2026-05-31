# Caddisfly Deployment Guide

## Overview

Your code has been pushed to GitHub with two branches:
- **`dev`** → Deploys to preview environment automatically
- **`main`** → Deploys to production environment automatically

## Current Status

✅ Code pushed to GitHub (ipvxnet/caddisfly)
✅ GitHub Actions workflows configured
✅ D1 database created locally
✅ R2 bucket created
⏳ Waiting for deployment setup

## Step-by-Step Deployment

### 1. Set Up GitHub Secret

1. Go to: https://github.com/ipvxnet/caddisfly/settings/secrets/actions
2. Click "New repository secret"
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: Your Cloudflare API token
   - Get it from: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use template: "Edit Cloudflare Workers"
   - Or create custom token with these permissions:
     - Account - Workers Scripts - Edit
     - Account - Workers KV Storage - Edit
     - Account - D1 - Edit
     - Account - R2 - Edit

### 2. Set Up Google OAuth Credentials

#### Create OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Navigate to: APIs & Services → Credentials
4. Click "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure consent screen if needed
6. Application type: **Web application**
7. Add these Authorized redirect URIs:
   - **Preview**: `https://caddisfly-preview.fernandooliveira2.workers.dev/auth/google/callback`
   - **Production**: `https://caddisfly.workers.dev/auth/google/callback`
   - (Or use custom domain once set up)

8. Copy your Client ID and Client Secret

### 3. Run Database Migration (Remote)

```bash
npm run db:migrate:remote
```

This creates the tables in the production D1 database.

### 4. Set Preview Environment Secrets

```bash
npm run secret:preview:google-client-id
# Paste your Google Client ID when prompted

npm run secret:preview:google-client-secret
# Paste your Google Client Secret when prompted
```

### 5. Set Production Environment Secrets

```bash
npm run secret:prod:google-client-id
# Paste your Google Client ID when prompted

npm run secret:prod:google-client-secret
# Paste your Google Client Secret when prompted
```

### 6. Trigger Deployment

The deployments should trigger automatically, but you can also trigger manually:

#### Deploy Preview (from dev branch)
```bash
git checkout dev
git push origin dev
```

Or deploy manually:
```bash
npm run deploy:preview
```

#### Deploy Production (from main branch)
```bash
git checkout main
git push origin main
```

Or deploy manually:
```bash
npm run deploy:prod
```

### 7. Verify Deployments

After GitHub Actions complete (check: https://github.com/ipvxnet/caddisfly/actions):

**Preview Environment:**
- URL: https://caddisfly-preview.fernandooliveira2.workers.dev
- Test: Visit the URL, click login, complete OAuth

**Production Environment:**
- URL: https://caddisfly.workers.dev (or custom domain)
- Test: Visit the URL, click login, complete OAuth

## Deployment URLs

| Environment | Branch | URL | Worker Name |
|-------------|--------|-----|-------------|
| Preview | dev | https://caddisfly-preview.fernandooliveira2.workers.dev | caddisfly-preview |
| Production | main | https://caddisfly.workers.dev | caddisfly |

**Note**: Replace `fernandooliveira2` with your Cloudflare account subdomain if different.

## Workflow

```
Local Development → dev branch → GitHub → Preview Deployment
                                              ↓
                                         Test on preview
                                              ↓
                                         Merge to main
                                              ↓
                                    Production Deployment
```

## Quick Commands

```bash
# Check deployment status
gh run list  # If you have GitHub CLI installed

# Watch deployment logs
# Visit: https://github.com/ipvxnet/caddisfly/actions

# Check Cloudflare Workers
# Visit: https://dash.cloudflare.com/

# View database
npx wrangler d1 execute caddisfly-db --remote --command="SELECT * FROM users"

# List deployments
npx wrangler deployments list
```

## Testing Preview

1. **Visit preview URL**: https://caddisfly-preview.fernandooliveira2.workers.dev
2. **Test landing page**: Should show gradient design
3. **Click "Sign in here"**: Should redirect to login page
4. **Click "Sign in with Google"**: Should redirect to Google OAuth
5. **Complete authentication**: Should redirect to /admin dashboard
6. **Verify dashboard**: Shows your name, email, avatar
7. **Test logout**: Should clear session and redirect to /login

## Testing Production

Same tests as preview, but on production URL.

## Monitoring

### GitHub Actions
- **URL**: https://github.com/ipvxnet/caddisfly/actions
- **Check**: Deployment status, logs, errors

### Cloudflare Dashboard
- **Workers**: https://dash.cloudflare.com/ → Workers & Pages
- **D1**: Check database in Workers & Pages → D1
- **R2**: Check storage in R2

### Logs
```bash
# Tail logs for preview
npx wrangler tail --env preview

# Tail logs for production
npx wrangler tail --env production
```

## Custom Domain Setup (Optional)

To use `caddisfly.ai` instead of `.workers.dev`:

1. **Add domain in Cloudflare**:
   - Workers & Pages → caddisfly → Settings → Domains & Routes
   - Add custom domain: `caddisfly.ai`
   - Add preview domain: `preview.caddisfly.ai` (optional)

2. **Update Google OAuth redirect URIs**:
   - Add: `https://caddisfly.ai/auth/google/callback`
   - Add: `https://preview.caddisfly.ai/auth/google/callback`

3. **Update wrangler.toml** (if using custom domains):
   ```toml
   [env.preview]
   vars = { APP_URL = "https://preview.caddisfly.ai", ... }

   [env.production]
   vars = { APP_URL = "https://caddisfly.ai", ... }
   ```

## Troubleshooting

### Deployment fails with "Missing CLOUDFLARE_API_TOKEN"
- **Solution**: Set up GitHub secret (Step 1)

### OAuth redirect_uri_mismatch
- **Solution**: Add the exact Workers URL to Google OAuth redirect URIs

### Database not found
- **Solution**: Run `npm run db:migrate:remote`

### Secrets not found
- **Solution**: Run the secret commands (Steps 4-5)

### Preview URL doesn't load
- **Solution**: Check GitHub Actions for deployment errors

## Rollback

If you need to rollback production:

```bash
git checkout main
git revert HEAD
git push origin main
```

Or deploy a specific version:
```bash
git checkout main
git reset --hard <commit-hash>
git push origin main --force
```

## Next Steps After Successful Deployment

1. ✅ Verify preview deployment works
2. ✅ Test full authentication flow
3. ✅ Verify database operations
4. ✅ Test on mobile devices
5. ✅ Merge dev → main for production deployment
6. ✅ Verify production deployment
7. ✅ Set up custom domain (optional)
8. ✅ Set up branch protection rules on GitHub
9. 🚀 Start Phase 2 development

---

**Current Branch**: dev
**Next**: Set up GitHub secret and Google OAuth, then check GitHub Actions
**Preview URL**: https://caddisfly-preview.fernandooliveira2.workers.dev (after deployment)
