# Plugin Platform + Catalogue Plugin — Design Doc

Status: **DRAFT for review** · Authored 2026-06-21 · Owner: Fernando

This locks the architecture before any code. It covers (1) a thin **plugin platform** and
(2) the **Catalogue** plugin built on it. CRM, Advanced Store, and a **Members / Gated-Access
(Auth)** plugin are future plugins that reuse the same platform and are out of scope here except
where they shape the design (see §11A).

---

## 1. Purpose

Monetize heavy / niche features as paid add-ons without bloating the core product or the base
plans. Each "plugin" is a self-contained feature module the user can subscribe to for **$5/mo**
(with combo/bundle discounts), on top of a base paid plan.

## 2. What a "plugin" is — and is NOT

- **IS:** a *first-party*, self-contained feature module (routes + section types + DB tables +
  manager UI), **entitlement-gated** and billed as a **Stripe subscription add-on**. All our code.
- **IS NOT:** third-party / customer-supplied code loaded into the Worker. That would require
  untrusted-code sandboxing on Workers — out of scope, rejected. "Plugin" here is a packaging +
  billing concept, not a code-loading mechanism.

## 3. Decisions (locked 2026-06-21)

| Decision | Choice |
|---|---|
| Sequencing | Build thin platform + **Catalogue plugin #1** end-to-end, then CRM / Advanced Store |
| Pricing | $5/mo per plugin; bundles save (combo discount) |
| Free tier | Plugins **require a base paid plan** (Starter+); no standalone-on-Free |
| Downgrade behavior | **Grace 7 days, then HIDE** the plugin's sections on the live site; data kept in DB, restorable on resubscribe |
| Catalogue backend | **Extend `products`** (not a parallel entity) — reuse Stripe Connect/orders/detail-pages |
| Catalogue media v1 | **FULL: PDF + multi-image gallery + videos (embed+upload) + external links/training** |
| Buy per item | **Optional** via a `for_sale` flag (info-only items: Training, PDFs, spec sheets) |
| Caps | Catalogue plugin **raises** the product/item cap (exact limit TBD) |
| Subscribe mechanics | Add a Stripe **subscription item via API** onto the existing subscription (one invoice, auto-proration) |
| Auto-extract catalogue from refactor | **Deferred** — manual authoring first |

## 4. Architecture overview

```
billing_accounts (existing)  ──1 Stripe subscription per account──┐
   pricing_tier, subscription_status, stripe_subscription_id      │
                                                                  │ subscription items
account_plugins (NEW)  ◀── Stripe webhook sync ──────────────────┘  (base plan + N add-ons)
   email, plugin_key, status, current_period_end

PLUGINS manifest (code constant) ── defines each plugin's key, Stripe price, section types,
                                    routes, tables, manager UI

hasPlugin(env, email, key) ── gate used in 3 places:
   (a) editor: which section types are offered      (b) manager routes / APIs
   (c) assemble/publish: whether plugin sections render
```

Single source of truth for "is X entitled": `account_plugins` (mirrors Stripe). Plugin
*definitions* live in code (`PLUGINS`), not the DB — version-controlled, no admin CRUD needed.

## 5. Data model (migrations — apply to BOTH preview + prod DBs)

### 5.1 `account_plugins` (new)
```sql
CREATE TABLE IF NOT EXISTS account_plugins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,                    -- billing account (matches billing_accounts.email)
  plugin_key TEXT NOT NULL,               -- 'catalogue' | 'crm' | 'advanced_store'
  status TEXT NOT NULL DEFAULT 'active',  -- active | canceling | canceled
  stripe_item_id TEXT,                    -- si_… (the subscription item) for sync/removal
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  current_period_end INTEGER,             -- entitlement valid through here (grace anchor)
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_plugins_uniq ON account_plugins(email, plugin_key);
```
- `status='canceling'` = canceled in Stripe but still within `current_period_end` (grace).
- Entitled = `status='active'` OR (`status='canceling'` AND `now < current_period_end`).

### 5.2 `products` extension (Catalogue plugin)
```sql
ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT '';        -- catalogue section grouping
ALTER TABLE products ADD COLUMN body TEXT NOT NULL DEFAULT '';            -- md-lite rich detail (blog-style)
ALTER TABLE products ADD COLUMN media_json TEXT NOT NULL DEFAULT '';      -- {gallery:[],videos:[],files:[{name,url}],links:[{label,url}]}
ALTER TABLE products ADD COLUMN for_sale INTEGER NOT NULL DEFAULT 1;      -- 0 = info-only (no Buy now)
```
Bridge pattern unchanged (`ai_project_id` XOR `project_id`). Existing shop ignores the new
columns; catalogue presentation reads them.

## 6. Plugin manifest (code)

```js
// src/plugins/manifest.js
export const PLUGINS = {
  catalogue: {
    key: 'catalogue',
    label: 'Catalogue',
    priceVar: 'STRIPE_PRICE_PLUGIN_CATALOGUE',   // monthly add-on price id (env)
    sectionTypes: ['catalogue'],                  // gated section types
    summary: 'Rich product/service catalogues with categories, media, PDFs and optional buy.',
  },
  // crm, advanced_store … later
};
export const BUNDLES = {
  all_access: { plugins: ['catalogue','crm','advanced_store'], priceVar: 'STRIPE_PRICE_BUNDLE_ALL' },
};
```
Adding a plugin later = add a manifest entry + its module + a Stripe price. The platform code
iterates `PLUGINS` generically.

## 7. Entitlement lifecycle & Stripe billing

Reuses `src/utils/stripe.js` (`createCheckoutSession`, `stripeRequest`, form-encoded helper) and
the `billing_accounts` row (one subscription per account).

### 7.1 Subscribe (add-on)
- Requires an **active base plan** (`pricing_tier != 'free_trial'` AND `subscription_status` active).
- Add a **subscription item** (the plugin's price) to the account's existing
  `stripe_subscription_id` (POST `/subscription_items`), OR run a Checkout in `subscription`
  mode that appends the line item — prefer adding a subscription item so it's one invoice.
- Bundles: a single bundle price replaces the individual items (swap items in one API call).

### 7.2 Webhook sync (source of truth)
Extend the platform billing webhook (NOT the Connect/store webhook) to handle
`customer.subscription.updated` / `deleted`: read `items.data[]`, map each price id → plugin key
via `PLUGINS`, and **upsert `account_plugins`** (active / canceling / canceled +
`current_period_end`). This makes Stripe authoritative; the UI never sets entitlements directly.

### 7.3 Cancel → grace → hide
- User cancels a plugin → Stripe sets the item to cancel at period end → webhook sets
  `status='canceling'`, keeps `current_period_end`.
- While `now < current_period_end`: still entitled (grace).
- At period end → webhook (or a daily cron) sets `status='canceled'`; a **republish job**
  re-assembles affected live sites WITHOUT the plugin's sections (see §8.3). Data stays in DB.

## 8. Gating enforcement (server-side everywhere — IDOR lesson, gotcha #13)

`hasPlugin(env, email, key)` = base-paid-plan check AND entitled(`account_plugins`). Three layers:

### 8.1 Editor (which sections can be added)
The add-section picker in `ai-builder-customize.js` filters `getRegisteredSectionTypes()`
(registry.js) by entitlement: a non-entitled account doesn't see "Catalogue" as an option (shows
an upsell chip → `/plugins`).

### 8.2 Manager routes + APIs
Catalogue manager pages and `/api/.../catalogue/*` run a `pluginGate('catalogue')` middleware
(alongside `PROJ`). No entitlement → 402/redirect to `/plugins`. **Never client-only.**

### 8.3 Assemble / publish (the hard part — published sites are static R2 HTML)
Published sites are static HTML in R2, served by the lean sites worker (no per-request DB).
So we gate at **assemble time**, not request time:
- `assemblePage` / `deploy.js` skip rendering a plugin's section types when the owning account
  is not entitled. Preview/editor reflect entitlement live.
- On grace-end, a **daily cron** finds accounts whose plugin just lapsed and **republishes** their
  sites (deploy.js regenerates HTML sans plugin sections). Consistent with "published sites need a
  republish" (gotcha #15). This keeps the sites worker lean (no entitlement lookups on the hot path).
- Re-subscribe → republish restores the sections (data was kept).

## 9. Marketplace UI (`/plugins`)
- Lists plugins from `PLUGINS`: name, summary, $5/mo, bundle savings, Subscribe / Manage.
- Requires base plan; if on Free, CTA routes to upgrade first.
- Subscribe → adds the subscription item (§7.1) → success returns to `/plugins`.
- Manage → cancel (sets canceling) / re-enable. Shows grace end date.
- Surface owned plugins on `/billing` and `/dashboard`.

## 10. Catalogue plugin spec (plugin #1)

### 10.1 Authoring (manager) — "works like a blog"
Extend the store manager (or a "Catalogue" tab): per item → name, **category**, short description,
**rich body** (md-lite), **gallery** (multi-image), **video** (embed + upload, reuse testimonials
video pattern), **PDF** files, **links** (labeled), **price + `for_sale` toggle**. Reuse AI-describe.

### 10.2 PDF support (new)
`upload.js`: add `application/pdf` to `ALLOWED_MIME_TYPES` (~20 MB cap), store in R2 under the
project's assets, serve via `preview-asset`. Detail page shows an inline viewer (`<iframe>`/embed)
+ a download link. Gate PDF upload behind the catalogue entitlement.

### 10.3 Catalogue section (new registry section type)
`catalogue` section: config = `{ category, layout }`. Renders that category's items as **tiles**
(image + name + short desc + "View" / "Buy now" when `for_sale`). Drop **multiple** catalogue
sections on one page, each pointing at a different category → multiple catalogues per page. Must be
registered in the dark-surface lists (gotcha #11) and localize all defaults (gotcha #23).

### 10.4 Item detail page
Reuse the `/shop/:product_slug` pattern (or a parallel `/catalog/:slug`): full rich page — gallery,
embedded video, PDF viewer/download, links, training, body — plus **Buy now** (Stripe Connect, the
*customer's* store) when `for_sale`. Info-only items show no buy button.

### 10.5 Buy flow
Reuses existing commerce-v1 (Stripe Connect + `orders` + cart). No new payment wiring — catalogue
sellable items ARE products.

## 11. Phasing & milestones

**Phase A — platform (build once)**
- A1: migration `account_plugins`; `PLUGINS` manifest; `hasPlugin` + `pluginGate`.
- A2: Stripe add-on subscribe (subscription items) + webhook sync; require base plan.
- A3: `/plugins` marketplace + billing/dashboard surfacing.
- A4: grace-then-hide: assemble-time gating + grace-end republish cron.

**Phase B — Catalogue plugin**
- B1: `products` extension migration; catalogue manager (manual authoring).
- B2: catalogue section type + tiles + multi-section-per-page.
- B3: item detail page + Buy now (for_sale).
- B4: PDF upload + viewer/download. (Gallery/video/links per confirmed v1 scope.)

**Deferred:** auto-extract catalogue from refactor; CRM; Advanced Store; Members/Auth (§11A).

## 11A. Future plugins (reuse this platform — not built here)

- **CRM** ($5/mo) — aggregate the leads you already collect (contact-form submissions, booking
  requests, store orders) into contacts/pipeline. Low new-data, high value.
- **Advanced Store** ($5/mo) — gates commerce-v1 *upgrades*: variants, inventory, discounts/coupons,
  product categories, abandoned-cart. Base store stays free-ish.
- **Members / Gated Access (Auth)** ($5/mo) — let the *site's visitors* register/log in to unlock
  protected sections, pages, or catalogue items (pairs with Catalogue: gate training/PDFs/pricing).
  **Auth model TBD — own design pass when built.** Two hard problems it (uniquely) introduces:
  1. **Static-hosting conflict.** Published sites are static R2 HTML on the lean sites worker;
     member-gated content CANNOT be baked into public HTML (visible in source). Protected content
     must be served **dynamically** (sites worker checks a member session → fetches from D1/R2 per
     request) or fetched client-side via an authenticated API after login. This is a real departure
     from the current static model ([[hosting-architecture]]) and is the gating decision for this plugin.
  2. **Security/liability.** Storing the customer's customers' credentials + PII: hashing on Workers
     (PBKDF2/scrypt via Web Crypto — no native bcrypt), OTP, session security, login rate-limiting,
     enumeration defense, reset flows, GDPR. **Lower-risk v1 option to weigh:** passwordless
     (email magic-link / OTP only) — no stored passwords, reuses Caddisfly's owner-auth pattern,
     still fully gates content; add password+2FA later if wanted.
  Sequence LAST (after the platform + Catalogue are proven), and give it a dedicated design doc.

## 12. Security considerations
- All gating server-side (editor picker, manager routes, APIs, assemble). Never trust the client.
- Webhook is the only writer of `account_plugins`; verify Stripe signature.
- A lapsed plugin must not leave buyable/visible sections on the live site past grace.
- Respect existing draft/grant auth model (gotcha #13) — plugin routes run under `[billingAuth, projectAccess]` plus `pluginGate`.

## 13. Testing plan (preview-first)
- Entitlement state machine: subscribe → active; cancel → canceling (still works in grace);
  period-end → canceled (sections gone after republish); resubscribe → restored.
- Gating: non-entitled account can't see/add catalogue section, can't hit manager APIs (402).
- Stripe: add-on item appears on the one subscription; bundle swaps items; proration sane.
- Catalogue: multi-category multi-section page; for_sale vs info-only; PDF view/download; buy via Connect end-to-end on preview.
- Migrations applied to BOTH DBs; bridge pattern intact.

## 14. Open questions

**Resolved (2026-06-21):**
1. **Grace length → 7 days** post period-end, then sections hide. Show the resubscribe-by date in that window.
2. **Catalogue media v1 → FULL: PDF + multi-image gallery + videos (embed+upload) + external links/training.** (Build all in Phase B.)
4. **Subscribe mechanics → add a Stripe subscription ITEM via API** onto the existing subscription (one invoice, auto-proration; base plan guarantees a payment method on file).
6. **Caps → the plugin RAISES the cap** (catalogue items get more headroom than the base tier's product cap; exact new limit TBD).

**Still open:**
3. **Bundle pricing** — exact combo price(s) and which plugins bundle (pure pricing decision).
5. **Catalogue vs Shop coexistence** — same item in both a Shop grid and a Catalogue section? (Proposed: yes, same `products` row.)
7. **`/catalog/:slug` vs reusing `/shop/:slug`** for detail pages.

---
See memory: `plugin-platform.md`, `commerce-v1.md`, `pricing.md`, `codebase-gotchas.md`
(bridge #4, IDOR #13, dark-lists #11, section i18n #23, republish #15).
