# Caddisfly Branching Strategy

## Branch Structure

```
main (production)
 │
 └── dev (preview/staging)
      │
      └── feature branches (optional)
```

## Branches

### `main` - Production Branch
- **Deployment**: Automatic to production (https://caddisfly.ai)
- **Protection**: Should be protected, requires PR approval
- **Purpose**: Production-ready code only
- **Cloudflare Environment**: `production`
- **Worker Name**: `caddisfly`

### `dev` - Preview/Staging Branch
- **Deployment**: Automatic to preview (https://caddisfly-preview.fernandooliveira2.workers.dev)
- **Purpose**: Testing and validation before production
- **Cloudflare Environment**: `preview`
- **Worker Name**: `caddisfly-preview`

## Workflow

### Standard Development Flow

```
1. Make changes in dev branch
   ↓
2. Push to dev → Triggers preview deployment
   ↓
3. Test on preview URL
   ↓
4. If OK → Create PR: dev → main
   ↓
5. Review and merge PR
   ↓
6. Merge to main → Triggers production deployment
```

### Example Commands

**Working on dev branch:**
```bash
# Switch to dev branch
git checkout dev

# Make your changes
# ...

# Commit changes
git add .
git commit -m "Add new feature"

# Push to dev (triggers preview deployment)
git push origin dev
```

**Deploying to production:**
```bash
# Create PR from dev to main on GitHub
# Or merge locally:

git checkout main
git merge dev
git push origin main  # Triggers production deployment
```

## GitHub Actions Workflow

### Preview Deployment (dev branch)
```yaml
Trigger: Push to dev branch
Environment: preview
Deployment: caddisfly-preview worker
URL: https://caddisfly-preview.fernandooliveira2.workers.dev
```

### Production Deployment (main branch)
```yaml
Trigger: Push to main branch
Environment: production
Deployment: caddisfly worker
URL: https://caddisfly.ai (after custom domain setup)
```

## Environment Configuration

### Preview Environment
- **Worker**: caddisfly-preview
- **Database**: Same D1 database (isolated by environment logic if needed)
- **R2 Bucket**: Same bucket (can use prefixes if needed)
- **Secrets**: Set separately with `--env preview`
- **Google OAuth Redirect**: https://caddisfly-preview.fernandooliveira2.workers.dev/auth/google/callback

### Production Environment
- **Worker**: caddisfly
- **Database**: Same D1 database
- **R2 Bucket**: Same bucket
- **Secrets**: Set separately with `--env production`
- **Google OAuth Redirect**: https://caddisfly.ai/auth/google/callback

## Setting Up Secrets

### For Preview Environment
```bash
npx wrangler secret put GOOGLE_CLIENT_ID --env preview
npx wrangler secret put GOOGLE_CLIENT_SECRET --env preview
```

### For Production Environment
```bash
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

## Database Migrations

### Preview
```bash
npm run db:migrate:remote
```

### Production
Same database, migration already applied.

**Note**: Both environments share the same D1 database. Consider adding environment prefixes to table names in future if complete isolation is needed.

## Branch Protection Rules (Recommended)

### Main Branch
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass (preview deployment)
- ✅ Require branches to be up to date before merging
- ✅ Include administrators in restrictions

### Dev Branch
- Optional: Require PR for feature branches
- Allow direct pushes from maintainers

## Testing Checklist

### Before Merging dev → main

- [ ] Preview deployment successful
- [ ] All routes working on preview
- [ ] Authentication flow works
- [ ] Database operations successful
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Session persistence working
- [ ] Logout functioning correctly

## Deployment URLs

| Branch | Environment | URL |
|--------|-------------|-----|
| dev | preview | https://caddisfly-preview.fernandooliveira2.workers.dev |
| main | production | https://caddisfly.ai (or .workers.dev until custom domain) |

## Quick Reference

```bash
# Check current branch
git branch

# Switch to dev
git checkout dev

# Switch to main
git checkout main

# Create feature branch from dev
git checkout -b feature/my-feature dev

# Merge feature to dev
git checkout dev
git merge feature/my-feature

# Create PR dev → main
# (Use GitHub UI or gh CLI)
gh pr create --base main --head dev --title "Deploy to production"
```

## Rollback Strategy

If production has issues:

### Option 1: Revert commit
```bash
git checkout main
git revert HEAD
git push origin main
```

### Option 2: Redeploy previous version
```bash
git checkout main
git reset --hard <previous-commit-hash>
git push origin main --force  # Use with caution!
```

### Option 3: Manual deployment from local
```bash
npm run deploy:prod
```

## GitHub Setup Required

1. **Set up branch protection** for `main`
2. **Add secret**: `CLOUDFLARE_API_TOKEN`
   - Go to: Repository → Settings → Secrets and variables → Actions
   - New repository secret: `CLOUDFLARE_API_TOKEN`
   - Value: Your Cloudflare API token

## Custom Domain Setup (Future)

Once you set up custom domains in Cloudflare:

1. **Preview**: preview.caddisfly.ai
2. **Production**: caddisfly.ai

Update `wrangler.toml` URLs accordingly.

---

**Status**: Ready for deployment
**Last Updated**: 2026-05-30
