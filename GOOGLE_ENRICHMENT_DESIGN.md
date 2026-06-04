# Design: Google Places Enrichment + Email-Gated Generation

**Status:** Proposed — 2026-05-31
**Branch:** dev (preview)
**Author:** Fernando + Claude

---

## 1. Motivation

The current product scrapes a target website and rebuilds it. In practice, target
sites are increasingly **bot-protected by their cloud providers** (Cloudflare,
Akamai, etc.), so scraping is unreliable as the *primary* content source.

**New approach:** stop depending on the scrape. Instead, build a fresh website from
**public business information**:

1. Best-effort scrape (kept, but no longer load-bearing) — grab whatever is easy.
2. **Google Places API** — identify the real business and pull structured facts.
3. AI + the existing 21-template library — generate a brand-new site.

Google Places calls **cost money per request**, so they are **gated behind email
verification**: no paid call happens until a human clicks a verification link.

---

## 2. Key decisions (locked)

| Decision | Choice |
|---|---|
| When paid enrichment fires | **On email-verify click** — zero paid calls before that |
| Google API scope | **Places only** (Place Search + Place Details). Custom Search deferred |
| Cost control | Verified-email gate + per-email daily cap on enrichment |
| Deploy | `git push origin dev` → preview, `git push origin main` → prod |

---

## 3. End-to-end flow

```
┌─────────────────────────────────────────────────────────────────┐
│ FREE / UNGATED (no paid API calls)                              │
└─────────────────────────────────────────────────────────────────┘
 User submits { email, website }  →  POST /api/preview/create
   1. Validate + sanitize email & URL
   2. Create project (status = 'awaiting_verification', email_verified = 0)
   3. Best-effort scrape → store light signal (title, meta, hostname, text)
   4. Generate verification_token, store on project
   5. Send verification email with link: GET /verify/:token
   6. Respond: "Check your email to generate your preview"

┌─────────────────────────────────────────────────────────────────┐
│ GATE: user clicks the verification link                         │
└─────────────────────────────────────────────────────────────────┘
 GET /verify/:token
   1. Look up project by token (reject if missing/expired/already used)
   2. Mark email_verified = 1, verified_at = now
   3. Enforce per-email daily enrichment cap (rate-limiter)
   4. ── PAID WORK STARTS HERE ──
      a. Google Places: Find Place (from business name/website) → place_id
      b. Google Places: Place Details → name, category, address, phone,
         hours, website, rating, top reviews
   5. Merge scrape signal + Places data → company profile
   6. AI content generation → 21-template assembly (reuse
      handleTemplateBasedGeneration pipeline)
   7. Upload preview to R2, status = 'preview_ready'
   8. Redirect user to /ai-preview/:preview_id (or customize page)
```

**Why gate at verify-click and not at submit:** it guarantees a real human + a
real inbox before we spend on Google. A bot spraying the form costs us nothing.

---

## 4. Data model changes

New migration: `migrations/006_email_verification_enrichment.sql`

```sql
ALTER TABLE projects ADD COLUMN email_verified     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN verification_token  TEXT;
ALTER TABLE projects ADD COLUMN verification_sent_at INTEGER;
ALTER TABLE projects ADD COLUMN verified_at         INTEGER;
ALTER TABLE projects ADD COLUMN enrichment_status   TEXT;   -- pending|running|complete|failed
ALTER TABLE projects ADD COLUMN place_id            TEXT;   -- Google Places id (cache/debug)
ALTER TABLE projects ADD COLUMN company_profile_json TEXT;  -- merged profile used for generation

CREATE INDEX IF NOT EXISTS idx_projects_verification_token ON projects(verification_token);
```

Notes:
- `verification_token`: 32-byte random (crypto), URL-safe, single-use.
- Token TTL: 24h (compare against `verification_sent_at`).
- `company_profile_json`: the canonical input to generation — lets us re-generate
  without re-calling Google.

---

## 5. New / changed code

| File | Change |
|---|---|
| `migrations/006_email_verification_enrichment.sql` | New columns + index (above) |
| `src/utils/google-places.js` | **New.** `findPlace()`, `getPlaceDetails()`, `enrichBusiness()` — thin client over Places API, returns normalized profile |
| `src/utils/company-profile.js` | **New.** `buildProfile(scrapeSignal, placesData)` → merged object the AI prompt consumes |
| `src/db/projects.js` | Add: `findByVerificationToken()`, `setVerified()`, `setEnrichment()` helpers |
| `src/routes/api/preview/create.js` | Split: do light scrape, create project, send verification email; **remove** the synchronous paid generation from this path |
| `src/routes/public/verify.js` | **New.** `GET /verify/:token` handler — verify, gate-check, enrich, generate, redirect |
| `src/utils/email.js` | Add `sendVerificationEmail(env, email, token, verifyUrl)` |
| `src/utils/rate-limiter.js` | Add a per-email **enrichment** cap (paid-call budget per day) |
| `src/index.js` | Register `router.get('/verify/:token', handleVerify)` |
| `wrangler.toml` | Document `GOOGLE_PLACES_API_KEY` secret (not committed) |

The existing `handleTemplateBasedGeneration` in `create.js` is **reused** — it's
extracted/imported so the verify handler can call it with `scrapedPages`-shaped
input derived from the company profile.

---

## 6. Google Places client (`google-places.js`)

Two REST calls (Places API):

1. **Find Place from Text** — input = business name (or website/domain) → `place_id`.
   `https://maps.googleapis.com/maps/api/place/findplacefromtext/json`
2. **Place Details** — `place_id` + `fields=` (request only needed fields to control
   billing SKU) → details.
   `https://maps.googleapis.com/maps/api/place/details/json`

Normalized return shape:

```js
{
  found: true,
  place_id: "...",
  name: "Acme Plumbing",
  category: "Plumber",
  address: "123 Main St, ...",
  phone: "+1 ...",
  website: "https://...",
  hours: ["Mon 9–5", ...],
  rating: 4.6,
  reviews: [{ author, rating, text }, ...]   // top N, trimmed
}
```

`enrichBusiness(env, { businessName, website })` orchestrates both calls and
returns the normalized object (or `{ found: false }` so the caller can fall back
to scrape-only generation).

**Field masking matters for cost** — request only the fields we use. Document the
chosen field set inline so billing is predictable.

---

## 7. Cost controls

1. **Email-verify gate** — primary control; no paid call without a click.
2. **Per-email daily cap** — reuse `rate-limiter.js` pattern (query projects by
   email + date). Reject/queue beyond cap.
3. **Field masking** — minimize Place Details billing SKU.
4. **Single-use, expiring tokens** — re-clicking a link does not re-bill (if
   `enrichment_status = complete`, just redirect to the existing preview).
5. **Idempotency** — store `place_id` + `company_profile_json`; re-generation
   never re-calls Google.

---

## 8. Failure modes

| Case | Handling |
|---|---|
| Places finds nothing | `found: false` → generate from scrape signal + AI only (degraded, still works) |
| Token expired/used | Friendly page: "link expired, request a new preview" |
| Google API error/quota | Mark `enrichment_status = failed`, fall back to scrape-only, alert via `sendErrorNotification` |
| Email never verified | Project stays `awaiting_verification`; no cost; optional cleanup job later |

---

## 9. Secrets / config

```bash
# Preview
npx wrangler secret put GOOGLE_PLACES_API_KEY --env preview
# Production
npx wrangler secret put GOOGLE_PLACES_API_KEY --env production
```

Restrict the key in Google Cloud Console to the **Places API** only, and (if
possible) by referrer/IP. Add to `.dev.vars.example` for local dev.

---

## 10. Build order (proposed)

1. Migration 006 + `projects.js` helpers (foundation).
2. `email.js` `sendVerificationEmail` + update `create.js` to send-and-stop.
3. `verify.js` route (verify + gate, **no** Google yet — stub enrichment).
4. `google-places.js` client + `company-profile.js` merge.
5. Wire enrichment into `verify.js`, call existing template generation.
6. Rate-limiter enrichment cap.
7. Test on preview (`git push origin dev`), then promote to `main`.

Each step is independently shippable to preview.

---

## 11. Open questions

- **Business-name source for Find Place:** derive from scraped `<title>`/`og:site_name`,
  or ask the user for the business name on the form? (Cleaner input = better Places match.)
- **Same DB for preview & prod:** wrangler.toml currently points both envs at the
  same `database_id` / R2 bucket. Separate before this goes to real users?
- **Reviews usage:** include customer reviews as testimonial content, or facts only?
