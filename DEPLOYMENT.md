# Deployment Guide

## Automatic Deployments via GitHub Actions (RECOMMENDED)

The repository now uses GitHub Actions for automatic deployments:

- **Push to `dev` branch** → Auto-deploys to preview
- **Push to `main` branch** → Auto-deploys to production

### Quick Deploy Workflow
```bash
# Make your changes
git add .
git commit -m "Your changes"

# Deploy to preview
git push origin dev

# GitHub Actions automatically deploys to:
# https://caddisfly-preview.fabianodevtools.workers.dev
```

**Setup Required:** See [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md) for first-time setup.

---

## Manual Deploy (Alternative)

If you need to deploy manually:

```bash
# Deploy to preview
npm run deploy:preview

# Deploy to production
npm run deploy:prod
```

Preview URL: **https://caddisfly-preview.fabianodevtools.workers.dev**

### Why Use GitHub Actions Instead of Local?
- ✅ Automatic deployments on git push
- ✅ No local memory usage
- ✅ Deployment history and logs
- ✅ CI/CD pipeline
- ✅ Team collaboration
- ✅ No need to have wrangler configured locally

---

## Deployment Workflow

### 1. Make Changes Locally
Edit files in your local repository.

### 2. Deploy to Preview
```bash
npm run deploy:preview
```

This deploys to: `caddisfly-preview.fabianodevtools.workers.dev`

### 3. Test in Preview Environment
- Test functionality at the preview URL
- Check browser console for errors
- Verify database operations
- Test on mobile devices

### 4. Deploy to Production (When Ready)
```bash
npm run deploy:prod
```

This deploys to: `caddisfly.ai`

---

## Database Migrations

### Preview Environment
```bash
# Apply migration to remote preview database
npx wrangler d1 execute caddisfly-db --remote --file=./migrations/YOUR_MIGRATION.sql
```

### Production Environment
```bash
# Apply migration to production database
npx wrangler d1 execute caddisfly-db --remote --file=./migrations/YOUR_MIGRATION.sql --env production
```

**Note:** The same database is shared between preview and production in current setup.

---

## Environment-Specific Configuration

### Preview Environment
- **Name:** `caddisfly-preview`
- **URL:** `https://caddisfly-preview.fabianodevtools.workers.dev`
- **Database:** `caddisfly-db` (remote)
- **R2 Bucket:** `caddisfly-storage`
- **Environment:** `preview`

### Production Environment
- **Name:** `caddisfly`
- **URL:** `https://caddisfly.ai`
- **Database:** `caddisfly-db` (remote)
- **R2 Bucket:** `caddisfly-storage`
- **Environment:** `production`

---

## Verifying Deployments

### Check Deployment Status
```bash
# List deployments
npx wrangler deployments list --env preview
npx wrangler deployments list --env production
```

### View Logs
```bash
# Preview logs
npx wrangler tail --env preview

# Production logs
npx wrangler tail --env production
```

### Test Endpoints
```bash
# Preview
curl https://caddisfly-preview.fabianodevtools.workers.dev

# Production
curl https://caddisfly.ai
```

---

## Database Management

### Query Remote Database
```bash
# Preview/Production (same database)
npx wrangler d1 execute caddisfly-db --remote --command="SELECT * FROM projects LIMIT 5"
```

### Backup Database
```bash
# Export database
npx wrangler d1 export caddisfly-db --remote --output=backup.sql
```

### List Tables
```bash
npx wrangler d1 execute caddisfly-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

---

## R2 Storage Management

### List Files
```bash
# Preview/Production (same bucket)
npx wrangler r2 object list caddisfly-storage
```

### Delete Files
```bash
# Delete specific file
npx wrangler r2 object delete caddisfly-storage projects/1/original/page-0.html

# Delete with prefix (careful!)
npx wrangler r2 object delete caddisfly-storage --prefix=projects/TEST_PROJECT_ID/
```

---

## Rollback Procedure

If something goes wrong in production:

### 1. List Recent Deployments
```bash
npx wrangler deployments list --env production
```

### 2. Rollback to Previous Version
```bash
npx wrangler rollback --env production
```

### 3. Verify Rollback
```bash
curl https://caddisfly.ai
```

---

## Secrets Management

### Set Secrets (One-Time Setup)

**Preview:**
```bash
npx wrangler secret put GOOGLE_CLIENT_ID --env preview
npx wrangler secret put GOOGLE_CLIENT_SECRET --env preview
```

**Production:**
```bash
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

### List Secrets
```bash
npx wrangler secret list --env preview
npx wrangler secret list --env production
```

---

## Performance Monitoring

### View Analytics
Visit Cloudflare Dashboard:
- Workers > caddisfly-preview > Metrics
- Workers > caddisfly > Metrics

### Tail Logs in Real-Time
```bash
# Preview
npx wrangler tail --env preview

# Production
npx wrangler tail --env production
```

### Check CPU/Memory Usage
View in Cloudflare Dashboard under Worker metrics.

---

## Troubleshooting Deployments

### "Build failed"
- Check syntax errors in code
- Verify all imports are valid
- Check wrangler.toml configuration

### "Binding not found"
- Verify bindings in wrangler.toml
- Check binding names match code
- Ensure resources exist (D1, R2, etc.)

### "Deployment timeout"
- Check Worker size (max 1MB after compression)
- Reduce dependencies if needed
- Check network connection

### "Database error after deployment"
- Verify migration was applied
- Check database schema matches code
- Test queries manually with wrangler d1

---

## Best Practices

### 1. Always Deploy to Preview First
```bash
npm run deploy:preview
# Test thoroughly
npm run deploy:prod
```

### 2. Test Database Migrations
```bash
# Test on preview first
npx wrangler d1 execute caddisfly-db --remote --file=./migrations/new_migration.sql

# Verify changes
npx wrangler d1 execute caddisfly-db --remote --command="PRAGMA table_info(table_name)"

# Then deploy code
npm run deploy:preview
```

### 3. Monitor After Deployment
```bash
# Watch logs for errors
npx wrangler tail --env preview
```

### 4. Keep Local and Remote in Sync
```bash
# Pull latest code
git pull

# Deploy
npm run deploy:preview
```

---

## Quick Reference

### Deploy Changes
```bash
npm run deploy:preview  # Preview environment
npm run deploy:prod     # Production (careful!)
```

### Database Operations
```bash
npx wrangler d1 execute caddisfly-db --remote --file=./migrations/XXX.sql  # Run migration
npx wrangler d1 execute caddisfly-db --remote --command="SELECT ..."       # Query
```

### View Logs
```bash
npx wrangler tail --env preview     # Preview logs
npx wrangler tail --env production  # Production logs
```

### R2 Operations
```bash
npx wrangler r2 object list caddisfly-storage              # List files
npx wrangler r2 object get caddisfly-storage path/to/file  # Download file
```

---

## Emergency Contacts

If something breaks in production:
1. **Rollback immediately:** `npx wrangler rollback --env production`
2. **Check logs:** `npx wrangler tail --env production`
3. **Notify team:** Contact project maintainers
4. **Investigate:** Review recent changes and deployments

---

## Current Status

**Preview Environment:** ✅ Deployed and Ready
- URL: https://caddisfly-preview.fabianodevtools.workers.dev
- Phase 2 Implementation Complete
- Database Migrated
- All Features Working

**Production Environment:** ⏳ Ready to Deploy
- Awaiting email service configuration
- Database migration ready
- All code tested in preview

---

**Last Updated:** Phase 2 Implementation (2026-05-30)
