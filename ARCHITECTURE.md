# Caddisfly Architecture - Phase 1

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Cloudflare Edge Network                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Cloudflare Workers (Caddisfly)                 │ │
│  │                                                         │ │
│  │  ┌──────────────┐      ┌──────────────┐               │ │
│  │  │    Router    │─────▶│  Middleware  │               │ │
│  │  │ (pattern     │      │  - Auth      │               │ │
│  │  │  matching)   │      │  - CORS      │               │ │
│  │  │              │      │  - Errors    │               │ │
│  │  └──────┬───────┘      └──────┬───────┘               │ │
│  │         │                     │                        │ │
│  │         │                     ▼                        │ │
│  │         │              ┌──────────────┐                │ │
│  │         └─────────────▶│   Handlers   │                │ │
│  │                        │ - Landing    │                │ │
│  │                        │ - Login      │                │ │
│  │                        │ - Dashboard  │                │ │
│  │                        │ - OAuth CB   │                │ │
│  │                        └──────┬───────┘                │ │
│  │                               │                        │ │
│  └───────────────────────────────┼────────────────────────┘ │
│                                  │                          │
└──────────────────────────────────┼──────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────┐
         │                         │                     │
         │                         │                     │
┌────────▼─────────┐    ┌──────────▼──────────┐  ┌──────▼──────┐
│   D1 Database    │    │    R2 Storage       │  │   Google    │
│   (SQLite)       │    │   (Object Store)    │  │   OAuth     │
│                  │    │                     │  │     API     │
│  - users         │    │  - caddisfly-       │  │             │
│  - sessions      │    │    storage/         │  │ - Auth      │
│  - projects      │    │                     │  │ - Profile   │
│  - scraped_pages │    │  (Ready for Phase2) │  │             │
│  - dns_records   │    │                     │  │             │
└──────────────────┘    └─────────────────────┘  └─────────────┘
```

## Request Flow

```
┌────────┐
│ Client │
└───┬────┘
    │
    │ 1. HTTP Request
    │
┌───▼────────────────────────────────────────────────────┐
│ Cloudflare Worker                                      │
│                                                        │
│  2. CORS Preflight Check                              │
│     │                                                  │
│     ▼                                                  │
│  3. Router.route()                                    │
│     │                                                  │
│     ├─ Pattern Match                                  │
│     └─ Extract Params                                 │
│        │                                               │
│        ▼                                               │
│  4. Middleware Chain                                  │
│     │                                                  │
│     ├─ authMiddleware (if protected route)            │
│     │   │                                             │
│     │   ├─ Parse Cookies                              │
│     │   ├─ Validate Session (D1)                      │
│     │   └─ Attach User to Context                     │
│     │                                                  │
│     └─ Continue if authorized                         │
│        │                                               │
│        ▼                                               │
│  5. Route Handler                                     │
│     │                                                  │
│     ├─ Business Logic                                 │
│     ├─ Database Operations (if needed)                │
│     └─ Generate Response                              │
│        │                                               │
│        ▼                                               │
│  6. Apply CORS Headers                                │
│     │                                                  │
│     ▼                                                  │
│  7. Return Response                                   │
│                                                        │
└────────────────────────────────┬───────────────────────┘
                                 │
                                 ▼
                            ┌────────┐
                            │ Client │
                            └────────┘
```

## Authentication Flow

```
┌──────┐                                               ┌────────┐
│ User │                                               │ Google │
└──┬───┘                                               └────┬───┘
   │                                                         │
   │ 1. Visit /login                                        │
   ├──────────────────────────▶┌─────────────┐             │
   │                            │   Worker    │             │
   │ 2. Return Login HTML       │             │             │
   │    with Google Auth URL    │             │             │
   │◀───────────────────────────┤             │             │
   │                            └─────────────┘             │
   │                                                         │
   │ 3. Click "Sign in with Google"                         │
   │────────────────────────────────────────────────────────▶│
   │                                                         │
   │ 4. Google Authentication                                │
   │◀───────────────────────────────────────────────────────▶│
   │                                                         │
   │ 5. Redirect with auth code                             │
   ├──────────────────────────▶┌─────────────┐             │
   │  /auth/google/callback    │   Worker    │             │
   │  ?code=xxx                │             │             │
   │                            │ 6. Exchange │             │
   │                            │    code for │             │
   │                            │    token    │             │
   │                            ├─────────────────────────▶│
   │                            │             │             │
   │                            │ 7. Get      │             │
   │                            │    access   │             │
   │                            │◀────────────┤    token    │
   │                            │             │             │
   │                            │ 8. Fetch    │             │
   │                            │    profile  │             │
   │                            ├─────────────────────────▶│
   │                            │             │             │
   │                            │ 9. User     │             │
   │                            │◀────────────┤    profile  │
   │                            │             │             │
   │                            │ 10. Create/ │             │
   │                            │     Update  │             │
   │                            │     User    │             │
   │                            ├──────┐      │             │
   │                            │      │      │             │
   │                            │      ▼      │             │
   │                            │  ┌────────┐ │             │
   │                            │  │   D1   │ │             │
   │                            │  └────────┘ │             │
   │                            │             │             │
   │                            │ 11. Create  │             │
   │                            │     Session │             │
   │                            ├──────┐      │             │
   │                            │      │      │             │
   │                            │      ▼      │             │
   │                            │  ┌────────┐ │             │
   │                            │  │   D1   │ │             │
   │                            │  └────────┘ │             │
   │                            │             │             │
   │ 12. Set Session Cookie     │             │             │
   │     Redirect to /admin     │             │             │
   │◀───────────────────────────┤             │             │
   │                            └─────────────┘             │
   │                                                         │
   │ 13. Authenticated!                                      │
   │                                                         │
   ▼                                                         ▼
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────┐
│                        D1 Database                           │
│                                                              │
│  ┌────────────────┐       ┌────────────────┐                │
│  │     users      │       │   sessions     │                │
│  ├────────────────┤       ├────────────────┤                │
│  │ id (PK)        │◀──┐   │ id (PK)        │                │
│  │ email (unique) │   │   │ user_id (FK)   │────────────┐   │
│  │ google_id      │   └───│ session_token  │            │   │
│  │ name           │       │ expires_at     │            │   │
│  │ avatar_url     │       │ created_at     │            │   │
│  │ role           │       └────────────────┘            │   │
│  │ created_at     │                                     │   │
│  │ last_login_at  │                                     │   │
│  └────────────────┘                                     │   │
│                                                          │   │
│  ┌────────────────────────────────────────┐             │   │
│  │           projects                     │             │   │
│  ├────────────────────────────────────────┤             │   │
│  │ id (PK)                                │             │   │
│  │ preview_id (unique)                    │             │   │
│  │ customer_email                         │             │   │
│  │ original_url                           │             │   │
│  │ status                                 │             │   │
│  │ pricing_tier                           │             │   │
│  │ portfolio_included                     │             │   │
│  │ dns_zone_id                            │             │   │
│  │ dns_status                             │             │   │
│  │ github_repo_url                        │             │   │
│  │ github_username                        │             │   │
│  │ created_at                             │             │   │
│  │ purchased_at                           │             │   │
│  │ activated_at                           │             │   │
│  └────────────┬───────────────────────────┘             │   │
│               │                                         │   │
│       ┌───────┴──────────┐                              │   │
│       │                  │                              │   │
│       ▼                  ▼                              │   │
│  ┌──────────┐      ┌──────────┐                        │   │
│  │ scraped_ │      │   dns_   │                        │   │
│  │  pages   │      │ records  │                        │   │
│  └──────────┘      └──────────┘                        │   │
│                                                          │   │
└──────────────────────────────────────────────────────────┘   │
                                                               │
                    Session Validation Flow                    │
                                                               │
                    ┌──────────────┐                           │
                    │  Request     │                           │
                    │  with Cookie │                           │
                    └──────┬───────┘                           │
                           │                                   │
                           ▼                                   │
                    ┌──────────────┐                           │
                    │ Parse Cookie │                           │
                    │ Get Token    │                           │
                    └──────┬───────┘                           │
                           │                                   │
                           ▼                                   │
                    ┌──────────────┐                           │
                    │ Query D1:    │◀──────────────────────────┘
                    │ JOIN sessions│
                    │   & users    │
                    │ WHERE token  │
                    │   & not exp. │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Return User  │
                    │   + Session  │
                    │     Data     │
                    └──────────────┘
```

## File Structure

```
caddisfly/
│
├── src/
│   ├── index.js              ← Main entry point
│   ├── router.js             ← Route matching & dispatch
│   │
│   ├── utils/                ← Shared utilities
│   │   ├── constants.js
│   │   ├── crypto.js
│   │   ├── response.js
│   │   └── validation.js
│   │
│   ├── middleware/           ← Request middleware
│   │   ├── auth.js
│   │   ├── cors.js
│   │   └── error-handler.js
│   │
│   ├── db/                   ← Database operations
│   │   ├── users.js
│   │   ├── sessions.js
│   │   ├── projects.js
│   │   ├── queries.js
│   │   └── transactions.js
│   │
│   └── routes/               ← Route handlers
│       ├── public/
│       │   └── landing.js
│       ├── admin/
│       │   ├── login.js
│       │   ├── logout.js
│       │   └── dashboard.js
│       └── api/
│           └── auth/
│               └── google-callback.js
│
├── migrations/
│   └── 0001_initial_schema.sql
│
├── schema.sql
├── wrangler.toml
├── package.json
└── [documentation files]
```

## Security Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Security Layers                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. Transport Layer                                    │
│     ├─ HTTPS Only (Cloudflare enforced)              │
│     └─ TLS 1.2+ Required                              │
│                                                        │
│  2. Authentication Layer                               │
│     ├─ Google OAuth 2.0                               │
│     ├─ No password storage                            │
│     └─ Token-based sessions                           │
│                                                        │
│  3. Session Layer                                      │
│     ├─ 32-byte random tokens                          │
│     ├─ 7-day expiration                               │
│     ├─ Database-backed validation                     │
│     └─ Automatic cleanup of expired sessions          │
│                                                        │
│  4. Cookie Security                                    │
│     ├─ HttpOnly (prevents XSS access)                 │
│     ├─ Secure (HTTPS only in production)              │
│     ├─ SameSite=Lax (CSRF protection)                 │
│     └─ Path=/ (application-wide)                      │
│                                                        │
│  5. Input Validation                                   │
│     ├─ Email validation (regex)                       │
│     ├─ URL validation (URL constructor)               │
│     ├─ Input sanitization (HTML escape)               │
│     └─ Type checking                                  │
│                                                        │
│  6. Database Security                                  │
│     ├─ Prepared statements (SQL injection prevention) │
│     ├─ Parameterized queries                          │
│     └─ No dynamic SQL construction                    │
│                                                        │
│  7. CORS Policy                                        │
│     ├─ Explicit allowed origins                       │
│     ├─ Preflight handling                             │
│     └─ Header whitelisting                            │
│                                                        │
│  8. Error Handling                                     │
│     ├─ Generic errors in production                   │
│     ├─ Detailed errors in development                 │
│     └─ No sensitive data in error messages            │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
Development Environment:
┌────────────────────────────────────┐
│  Local Machine                     │
│  ┌──────────────────────────────┐ │
│  │  wrangler dev                │ │
│  │  localhost:8787              │ │
│  │                              │ │
│  │  ┌────────────────────────┐  │ │
│  │  │  Local D1 Database     │  │ │
│  │  │  (.wrangler/state/)    │  │ │
│  │  └────────────────────────┘  │ │
│  │                              │ │
│  │  Google OAuth               │ │
│  │  redirect: localhost:8787   │ │
│  └──────────────────────────────┘ │
└────────────────────────────────────┘

Production Environment:
┌──────────────────────────────────────────┐
│  Cloudflare Edge Network                 │
│  ┌────────────────────────────────────┐  │
│  │  Workers Script                    │  │
│  │  caddisfly.ai                      │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐ │  │
│  │  │  Remote D1 Database          │ │  │
│  │  │  (Distributed)               │ │  │
│  │  └──────────────────────────────┘ │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐ │  │
│  │  │  R2 Storage                  │ │  │
│  │  │  (Global)                    │ │  │
│  │  └──────────────────────────────┘ │  │
│  │                                    │  │
│  │  Google OAuth                     │  │
│  │  redirect: caddisfly.ai          │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Future Architecture (Phases 2-7)

```
Phase 2+:
┌──────────────────────────────────────────────────────────┐
│                    Extended System                        │
│                                                           │
│  ┌─────────────┐    ┌──────────────┐   ┌──────────────┐ │
│  │   Worker    │───▶│  Workers AI  │   │  Scraper     │ │
│  │  (Main)     │    │  (Refactor)  │   │  (Puppeteer) │ │
│  └──────┬──────┘    └──────────────┘   └──────────────┘ │
│         │                                                │
│         ├──────────────┬──────────────┬─────────────┐   │
│         ▼              ▼              ▼             ▼   │
│    ┌────────┐   ┌──────────┐   ┌─────────┐  ┌─────────┐ │
│    │   D1   │   │    R2    │   │ Stripe  │  │ GitHub  │ │
│    │        │   │ (Content)│   │   API   │  │   API   │ │
│    └────────┘   └──────────┘   └─────────┘  └─────────┘ │
│                                                           │
│                 ┌────────────────────┐                    │
│                 │ Email Workers      │                    │
│                 │ (Notifications)    │                    │
│                 └────────────────────┘                    │
│                                                           │
│  Phase 7: Per-Customer Workers                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  customer1.com → Worker1 → R2 bucket1             │  │
│  │  customer2.com → Worker2 → R2 bucket2             │  │
│  │  customer3.com → Worker3 → R2 bucket3             │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

**Document Version**: 1.0
**Last Updated**: 2026-05-30
**Phase**: 1 (Foundation Complete)
