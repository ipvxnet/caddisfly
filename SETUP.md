# Caddisfly Setup Guide - Phase 1

## Overview

Phase 1 implements the foundation for Caddisfly: authentication, database, and basic routing.

## Prerequisites

1. Node.js installed
2. Cloudflare account
3. Google OAuth credentials

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Cloudflare Authentication

```bash
npx wrangler login
```

### 3. Database Setup

The D1 database has already been created with ID: `8406777e-c7d1-4bf9-9a14-e554f8a5021a`

Run migration locally:
```bash
npm run db:migrate:local
```

Run migration on production:
```bash
npm run db:migrate:remote
```

### 4. R2 Storage Setup

R2 needs to be enabled in your Cloudflare Dashboard first:
1. Go to https://dash.cloudflare.com/
2. Navigate to R2 and enable it
3. Then run:
```bash
npm run r2:create
```

After creating the bucket, uncomment the R2 binding in `wrangler.toml`

### 5. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - Development: `http://localhost:8787/auth/google/callback`
     - Production: `https://caddisfly.ai/auth/google/callback`

5. Set the secrets:

Development (local):
```bash
# Create a .dev.vars file with:
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

Production (remote):
```bash
npm run secret:google-client-id
# Enter your Google Client ID when prompted

npm run secret:google-client-secret
# Enter your Google Client Secret when prompted
```

### 6. Test Locally

```bash
npm run dev
```

Visit http://localhost:8787 to see the landing page.

## Environment Variables

### Development (.dev.vars file)

Create a `.dev.vars` file in the project root:

```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Production (via Wrangler CLI)

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

## Database Management

### Useful Commands

Query database locally:
```bash
npx wrangler d1 execute caddisfly-db --local --command="SELECT * FROM users"
```

Query database remotely:
```bash
npx wrangler d1 execute caddisfly-db --remote --command="SELECT * FROM users"
```

## Routes

### Public Routes
- `GET /` - Landing page
- `GET /login` - Admin login page
- `GET /auth/google/callback` - Google OAuth callback

### Protected Routes (require authentication)
- `GET /admin` - Admin dashboard
- `GET /logout` - Logout

## Testing Checklist

- [ ] Landing page loads at http://localhost:8787
- [ ] Login page loads at http://localhost:8787/login
- [ ] Google OAuth flow completes successfully
- [ ] After login, redirects to /admin
- [ ] Admin dashboard shows user name and email
- [ ] Logout clears session and redirects to /login
- [ ] Accessing /admin without login redirects to /login

## Deployment

### Production Deployment

1. Run remote database migration:
```bash
npm run db:migrate:remote
```

2. Set production secrets (if not done already):
```bash
npx wrangler secret put GOOGLE_CLIENT_ID --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

3. Deploy:
```bash
npm run deploy:prod
```

### Auto-Deploy via GitHub Actions

GitHub Actions is configured to auto-deploy on push to main branch.
The workflow file is at `.github/workflows/deploy.yml`

## Troubleshooting

### "R2 needs to be enabled" error
- Enable R2 in your Cloudflare Dashboard first
- Go to https://dash.cloudflare.com/ → R2

### Google OAuth errors
- Verify redirect URIs match exactly in Google Cloud Console
- Check that secrets are set correctly
- Ensure client ID and secret are from the same OAuth credential

### Database errors
- Verify D1 database binding in wrangler.toml
- Check that migrations have been run
- Use `--local` flag for local development

## Next Steps

Phase 2 will add:
- Web scraping functionality
- Workers AI integration
- R2 content storage
- Preview page display
- Email sending via Cloudflare Email Workers

## Support

For issues, check:
1. Console logs in browser developer tools
2. Terminal output from `npm run dev`
3. Cloudflare Workers logs in dashboard
