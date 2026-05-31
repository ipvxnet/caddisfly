# GitHub Actions Setup Guide

## Automatic Deployments

The repository is configured to automatically deploy:
- **Preview Environment** - When pushing to `dev` branch
- **Production Environment** - When pushing to `main` branch

---

## Initial Setup

### 1. Get Your Cloudflare API Token

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **My Profile** → **API Tokens**
3. Click **Create Token**
4. Use the **Edit Cloudflare Workers** template
5. Configure permissions:
   - **Account** → **Cloudflare Workers Scripts** → **Edit**
   - **Account** → **Account Settings** → **Read** (optional)
6. Click **Continue to summary** → **Create Token**
7. **Copy the token** (you won't see it again!)

### 2. Get Your Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select any website/Workers & Pages
3. Scroll down on the right sidebar
4. Copy your **Account ID**

### 3. Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

**Secret 1: CLOUDFLARE_API_TOKEN**
- Name: `CLOUDFLARE_API_TOKEN`
- Value: Paste your Cloudflare API token from step 1

**Secret 2: CLOUDFLARE_ACCOUNT_ID**
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Value: Paste your Cloudflare Account ID from step 2

---

## Workflow Files Created

### Preview Deployment (`.github/workflows/deploy-preview.yml`)
- **Triggers:** Push to `dev` branch or manual trigger
- **Deploys to:** `caddisfly-preview.fabianodevtools.workers.dev`
- **Use case:** Testing and development

### Production Deployment (`.github/workflows/deploy-production.yml`)
- **Triggers:** Push to `main` branch or manual trigger
- **Deploys to:** `caddisfly.ai`
- **Use case:** Live production site

---

## Usage

### Deploy to Preview (Automatic)
```bash
# Switch to dev branch
git checkout dev

# Make your changes
# ... edit files ...

# Commit and push
git add .
git commit -m "Add new feature"
git push origin dev

# GitHub Actions will automatically deploy to preview!
# View deployment at: https://github.com/YOUR_USERNAME/caddisfly/actions
```

### Deploy to Production (Automatic)
```bash
# Merge dev into main
git checkout main
git merge dev
git push origin main

# GitHub Actions will automatically deploy to production!
```

### Manual Deployment (Via GitHub UI)
1. Go to **Actions** tab in your GitHub repository
2. Select **Deploy to Preview** or **Deploy to Production**
3. Click **Run workflow**
4. Select branch and click **Run workflow**

---

## Branch Strategy

### Recommended Workflow

```
dev branch (development)
  ↓ commit & push
  ✅ Auto-deploys to preview
  ↓ test thoroughly
  ↓ merge to main
main branch (production)
  ↓ auto-deploys to production
  ✅ Live on caddisfly.ai
```

### Example Workflow
```bash
# Start from main
git checkout main
git pull origin main

# Create dev branch (if it doesn't exist)
git checkout -b dev

# Make changes
# ... edit files ...

# Commit and push to dev
git add .
git commit -m "Implement new feature"
git push origin dev

# Wait for preview deployment
# Test at: https://caddisfly-preview.fabianodevtools.workers.dev

# If tests pass, merge to main
git checkout main
git merge dev
git push origin main

# Production deployment happens automatically!
```

---

## Viewing Deployments

### GitHub Actions Dashboard
1. Go to your repository
2. Click **Actions** tab
3. See all workflows and their status
4. Click on a workflow run to see logs

### Cloudflare Dashboard
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Click on **caddisfly-preview** or **caddisfly**
4. View deployment history and logs

---

## Troubleshooting

### "Error: Authentication error"
**Solution:** Check that `CLOUDFLARE_API_TOKEN` is set correctly in GitHub Secrets.

### "Error: Account ID not found"
**Solution:** Check that `CLOUDFLARE_ACCOUNT_ID` is set correctly in GitHub Secrets.

### "Build failed"
**Solution:**
- Check the GitHub Actions logs for specific errors
- Ensure all dependencies are in `package.json`
- Verify code has no syntax errors

### "Deployment succeeded but site not updated"
**Solution:**
- Clear browser cache
- Wait 1-2 minutes for CDN propagation
- Check Cloudflare dashboard for actual deployment

---

## Database Migrations

**Important:** Database migrations are NOT automatic. You must run them manually.

### For Preview Environment
```bash
npx wrangler d1 execute caddisfly-db --remote --file=./migrations/YOUR_MIGRATION.sql
```

### For Production Environment
```bash
npx wrangler d1 execute caddisfly-db --remote --file=./migrations/YOUR_MIGRATION.sql --env production
```

**Recommendation:** Run migrations before merging to main/production.

---

## Reverting a Deployment

### Option 1: Rollback via Cloudflare
```bash
npx wrangler rollback --env preview
# or
npx wrangler rollback --env production
```

### Option 2: Deploy Previous Commit
```bash
# Find the working commit
git log

# Reset to that commit
git reset --hard COMMIT_HASH

# Force push (be careful!)
git push -f origin dev
# or
git push -f origin main
```

---

## Local Development (When Needed)

If you need to test locally before pushing:

```bash
# Run locally
npm run dev

# Test at http://localhost:8787

# When satisfied, push to dev
git push origin dev
```

**Note:** Local development is not recommended (uses memory). Prefer pushing to `dev` branch for preview deployments.

---

## Security Best Practices

### ✅ DO
- Keep API tokens secret
- Use separate tokens for different repos
- Rotate tokens periodically (every 90 days)
- Use minimal required permissions
- Enable 2FA on Cloudflare account

### ❌ DON'T
- Commit API tokens to repository
- Share tokens in chat/email
- Use account-wide tokens (use scoped tokens)
- Give tokens unnecessary permissions

---

## Monitoring Deployments

### Enable GitHub Notifications
1. Watch your repository (top right)
2. Go to Settings → Notifications
3. Enable "Actions" notifications
4. Get notified when deployments succeed/fail

### Slack/Discord Integration (Optional)
You can add Slack/Discord notifications to the workflow:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Current Status

- ✅ GitHub Actions workflows created
- ✅ Preview deployment configured (dev branch)
- ✅ Production deployment configured (main branch)
- ⏳ Awaiting GitHub secrets setup
- ⏳ Awaiting first push to dev branch

---

## Next Steps

1. **Add secrets to GitHub** (see step 3 above)
2. **Push to dev branch** to test preview deployment
3. **Verify deployment** at preview URL
4. **Merge to main** when ready for production

---

## Quick Reference

### Deploy Commands
```bash
# Manual local deploy (not recommended)
npm run deploy:preview
npm run deploy:prod

# Automatic via GitHub (recommended)
git push origin dev        # Deploys to preview
git push origin main       # Deploys to production
```

### Check Deployment Status
```bash
# View in GitHub
# Go to: https://github.com/YOUR_USERNAME/caddisfly/actions

# View in terminal
npx wrangler deployments list --env preview
npx wrangler deployments list --env production
```

### View Logs
```bash
# Live logs
npx wrangler tail --env preview
npx wrangler tail --env production

# Or view in Cloudflare Dashboard
```

---

**Setup Time:** ~5 minutes
**Benefits:** Automatic deployments, no local memory usage, CI/CD pipeline, deployment history
