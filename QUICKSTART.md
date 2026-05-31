# Caddisfly Quick Start

## Phase 1 is Ready!

All infrastructure is set up. Follow these steps to get running:

## 1. Set Up Google OAuth (Required for Testing)

### Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client ID"
5. Configure consent screen if needed
6. Application type: **Web application**
7. Add Authorized redirect URIs:
   - `http://localhost:8787/auth/google/callback`
   - `https://caddisfly.ai/auth/google/callback` (for production)
8. Copy the Client ID and Client Secret

### Configure Local Development

Create a `.dev.vars` file in the project root:

```bash
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

## 2. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:8787

## 3. Test the Flow

1. Click "Sign in here" link at the bottom
2. Click "Sign in with Google"
3. Complete Google OAuth
4. You should be redirected to the admin dashboard
5. Test logout

## Available Routes

- `/` - Landing page
- `/login` - Admin login
- `/admin` - Dashboard (protected)
- `/logout` - Logout (protected)

## Database Commands

View users:
```bash
npx wrangler d1 execute caddisfly-db --local --command="SELECT * FROM users"
```

View sessions:
```bash
npx wrangler d1 execute caddisfly-db --local --command="SELECT * FROM sessions"
```

## Production Deployment

### 1. Run Remote Migration

```bash
npm run db:migrate:remote
```

### 2. Set Production Secrets

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

### 3. Deploy

```bash
npm run deploy:prod
```

## Troubleshooting

**"Missing GOOGLE_CLIENT_ID" error**
- Make sure `.dev.vars` file exists with your credentials
- Restart the dev server after creating `.dev.vars`

**Google OAuth "redirect_uri_mismatch" error**
- Check that redirect URI in Google Console matches exactly
- For local: `http://localhost:8787/auth/google/callback`

**Database errors**
- Verify migration was run: `npm run db:migrate:local`

## What's Next

Phase 1 is complete! Next phases will add:
- Preview generation (Phase 2)
- Payment integration (Phase 3)
- Admin project management (Phase 3)
- DNS & deployment automation (Phase 4+)

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run deploy` | Deploy to production |
| `npm run db:migrate:local` | Run database migration locally |
| `npm run db:migrate:remote` | Run database migration in production |
| `npm run r2:list` | List R2 buckets |

## Architecture

```
Request Flow:
1. User hits route (e.g., /admin)
2. Router matches pattern
3. Middleware executes (auth check)
4. Handler executes
5. Response returned with CORS headers
```

```
Auth Flow:
1. User visits /login
2. Clicks "Sign in with Google"
3. Redirected to Google OAuth
4. Google redirects to /auth/google/callback
5. Code exchanged for access token
6. User profile fetched
7. User created/updated in DB
8. Session created
9. Session cookie set
10. Redirect to /admin
```

Enjoy building with Caddisfly!
