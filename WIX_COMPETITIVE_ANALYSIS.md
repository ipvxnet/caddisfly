# Wix Competitive Analysis → Caddisfly Roadmap

*Deep research, 2026-06-05. 23 sources fetched, 88 claims extracted, 25 adversarially verified (3-vote panels): 24 confirmed, 1 refuted. Confidence flagged per claim; Wix primary docs preferred over blogs.*

---

## 1. Wix's three building surfaces (2026)

### 1.1 Classic Wix Editor
The mainstream drag-and-drop editor: absolute-positioned freeform layout, strip/section system, large element library, 900+ templates, separate mobile editor, App Market, and Velo (full JS dev platform with backend code, data APIs, custom interactions).

### 1.2 Wix Studio (pro/agency editor) — verified against Wix primary docs, HIGH confidence
- **Responsive engine**: 3 default breakpoints (Desktop 1001px+, Tablet 751–1000px, Mobile 320–750px) + up to **3 custom breakpoints**, definable per page and per global section. Strictly **top-down cascade**: larger-breakpoint changes trickle down; smaller-breakpoint changes never propagate up. [support.wix.com/studio-editor-designing-across-breakpoints]
- **Advanced CSS Grid**: user-set rows/columns sized with `fr`, min/max, % — tailored per breakpoint, cascading desktop-down. [support.wix.com/studio-editor-working-with-an-advanced-css-grid]
- **Design libraries**: reusable color palettes, typography styles, designed sections/elements usable on **any Studio site in a workspace**, shareable with teammates. [support.wix.com/studio-editor-creating-and-managing-design-libraries]

### 1.3 Wix AI: ADI → AI Website Builder → **Harmony** — HIGH confidence
- **ADI is dead**: support ended Nov 10, 2024; replaced by the **Wix AI Website Builder** (AI text gen, custom AI section creation, AI image creation). [support.wix.com/adi-sites-no-longer-supported]
- **Wix Harmony launched Jan 21, 2026**: hybrid editor merging natural-language AI with drag-and-drop. Its agent **"Aria"** generates pages, sections, components, copy, and images, and (per Wix marketing — 2-1 vote, treat as real-but-overstated) chains multiple operations in one batch request.
- **Quality reality check** (reviewers, The Wix Wiz et al.): generic output, ~70% layout accuracy, even simple sites need 10–15 prompts + manual cleanup, and the AI "fights you for control."

## 2. Wix e-commerce (full coverage) — mostly HIGH confidence
- **Catalog**: up to **50,000 products**, 6 options + **1,000 variants per product** (note: the "unlimited products / 1,000 variants total" phrasing was REFUTED 1-2 — use the per-product caps), digital goods. **Wix itself warns performance degrades well below the 50K cap.** [support.wix.com/wix-stores-limits]
- **Payments**: 80+ gateways, native Wix Payments (only **15 countries**), BNPL, wallets, recurring. **0% platform fee**; processing ~2.9% + $0.30 US. [wix.com/ecommerce/features]
- **Fulfillment ecosystem**: native dropshipping (Modalyst — Wix-owned, Spocket, 365Dropship), print-on-demand (Printful, March 2025; Printify), 3PL (ShipBob), Amazon MCF, abandoned-cart recovery automation.
- **Verticals**: Stores, **Bookings** (services/appointments), Restaurants, Events/tickets, Pricing Plans (subscriptions), digital products, POS.
- **Plan gating** (MEDIUM confidence on exact feature splits, 2-1): e-commerce starts at **Core $29/mo** (annual) — the **$17 Light plan cannot sell at all** (2 GB storage, no payments). Business $39 adds Avalara automated tax + subscriptions + advanced shipping; Business Elite $159 adds custom reports + loyalty (Smile.io).

## 3. Platform capabilities
- **Performance**: Wix ships a **Site Speed Dashboard** (real-visitor CWV data + Lighthouse simulation + remediation tips; needs 10+ sessions/7 days) — the existence of a remediation dashboard tacitly admits the platform's known CWV struggles. [support.wix.com/site-performance-about-core-web-vitals]
- **Pricing creep / hidden costs** (HIGH confidence): ~$17/yr domain renewal after the free first year (annual plans only), **$6/mo/user** Google Workspace email, 2.9%+$0.30 processing. Reviewers consistently list pricing as a top con.
- Other table-stakes Wix has: CMS/dynamic collections, blog, forms backend, member areas/login, multilingual, full analytics suite, App Market, Velo code access. (No site export — lock-in is a persistent complaint.)

## 4. Gap map: Wix vs Caddisfly

| Capability | Wix | Caddisfly | Verdict |
|---|---|---|---|
| AI site generation | Harmony/Aria (new, generic output, control-fighting) | Conversational builder + refactor flow, template-constrained | **PARITY+ — our core strength** |
| AI per-section editing | Aria | AI chat per section + Flux images + uploads | **HAS** |
| Section-based editing | Yes (+ freeform) | Yes (section-only) | HAS |
| Freeform drag-and-drop | Yes (both editors) | No | MISSING — *deliberately off-strategy* |
| Per-breakpoint design / CSS Grid | Studio | No | MISSING — off-strategy (agency play) |
| Design libraries / reusable assets | Studio workspaces | 6 themes, not user-authored | PARTIAL — teams/roles is a foundation |
| Templates | 900+ | 21 section templates × variants | PARTIAL — quantity gap, quality lever |
| **E-commerce (any)** | Deep (50K products, 80+ gateways, verticals) | **None** | **MISSING — largest table-stakes gap** |
| Bookings/services vertical | Native | None | MISSING — high-fit for our local-SMB segment |
| CMS / dynamic collections | Yes | No | MISSING — table stakes |
| Blog | Yes | No | MISSING — table stakes |
| Forms backend | Yes | Template only, no submissions | MISSING — cheapest table-stakes fix |
| Member areas (site visitors) | Yes | No | MISSING |
| Version history | Yes | No (specced in roadmap) | MISSING |
| App market / code (Velo) | Yes | No | MISSING — off-strategy near-term |
| SEO tooling | Good (+complaints) | Auto sitemap/robots/JSON-LD/LocalBusiness + editable | **HAS — competitive** |
| Multilingual | Yes | EN/ES/PT complete | HAS |
| Analytics | Full suite | First-party cookieless | HAS (lighter, privacy angle) |
| Speed/CWV dashboard | Yes | No | PARTIAL — we likely *are* faster; can't prove it yet |
| Custom domains | Yes (renewal creep) | One-CNAME auto-SSL | HAS — smoother |
| Storage for price | $17 → 2 GB | $9 → 25 GB | **WIN** |
| Payments reach | Wix Payments: 15 countries | Stripe-native | **WIN (latent)** |
| Site export | No (lock-in complaint) | No | Both locked — *opportunity to differ* |

## 5. Where Wix is weak — attack opportunities
1. **Pricing creep**: $29 just to start selling; domain renewal + email + add-ons stack up. → Message: *transparent all-in pricing; sell on a cheaper tier than Wix's $29 floor.*
2. **AI quality**: Harmony output is generic, ~70% layout accuracy, fights the user. → Our template-constrained generation is *more reliable by design*. Lean in; benchmark publicly.
3. **Performance at scale**: Wix warns its own 50K-product cap degrades sites; CWV complaints persist. → Cloudflare-edge + lean templates should structurally win. **Needs a published head-to-head CWV benchmark to be marketable.**
4. **Wix Payments = 15 countries** → Stripe-native reach is broader from day one.
5. **Lock-in complaints** (no export) → an HTML-export feature would be a cheap, loud differentiator Wix structurally can't match.

## 6. Prioritized roadmap recommendation

### Tier 1 — table stakes, high leverage, low-medium effort
1. **Forms backend** (S–M, days): D1 `form_submissions` + Resend notification + dashboard inbox + spam guard. Cheapest gap to close; every SMB site needs it; fits existing patterns (tickets system is the template).
2. **Blog / CMS-lite** (M, ~1–2 wks): posts as a special page type reusing the section/AI pipeline; AI-drafted posts are a natural credit sink and an SEO flywheel (we already have sitemap/JSON-LD). Avoid rebuilding Wix's full dynamic-collections CMS — posts + simple lists covers most switcher use cases.
3. **Version snapshots** (M, already specced in roadmap): closes a stated gap; cheap on R2.

### Tier 2 — the commerce decision (the big one)
4. **Bookings/services first, then Stores** (M-L each). Rationale: the refactor + Google Places flow targets local SMBs — appointment businesses (salons, clinics, trades) likely convert better than storefronts, and a bookings MVP (service list + calendar + Stripe Checkout deposit/payment) is far smaller than cart/shipping/tax. Then a lean Stores v1 (≤100 products, Stripe Checkout, digital + simple physical, no shipping matrices) **priced below Wix's $29 floor** — that's the pricing wedge.
5. **Open question to resolve with data**: instrument/ask which verticals current users are in before sequencing 4.

### Tier 3 — differentiators (cheap, loud)
6. **Published CWV benchmark vs Wix** (S, marketing + a bit of tooling): convert the structural speed edge into evidence. Possibly a public "speed test your Wix site" tool as lead-gen.
7. **HTML export** (S–M): published sites are already static HTML in R2 — zip and hand it over. Direct hit on Wix's #1 lock-in complaint; "your site is yours."
8. **Transparent-pricing comparison page** (S, marketing only): all-in vs Wix's à-la-carte creep.

### Deliberately deferred (off-strategy for AI-native simplicity)
- Studio-grade breakpoint engine / CSS Grid freeform editing (agency play, huge lift)
- App market / Velo-style code platform
- Freeform drag-and-drop (Harmony's hybrid shows even Wix struggles to make AI + freeform coexist)
- POS, dropshipping/POD ecosystems, 50K-product scale

## 7. Caveats & open questions
- Harmony launched Jan 21, 2026 and is still rolling out — AI-quality claims have a short shelf life; re-check quarterly.
- Pricing is US/annual-equivalent, early-2026; varies by region/cadence.
- The Aria "batch-chaining" claim is Wix marketing (2-1 vote); the e-commerce plan feature split leans on a review blog corroborated by Wix pages (2-1).
- REFUTED (don't cite): "unlimited products, 1,000 variants total, customizations/ribbons/size-charts/wishlists" bundle — verified caps are 50K products / 6 options / 1,000 variants *per product*.
- Open: measure our actual CWV vs Wix; hands-on Harmony teardown; bookings-vs-stores sequencing data; minimum-viable CMS scope on D1/R2.

### Key sources
Wix primary docs (Studio breakpoints, CSS Grid, design libraries, ADI sunset, AI tools, ecommerce features, Stores limits, Payments fees, CWV dashboard, Harmony/Aria), wix.com/harmony, TechRadar/SEJ/HostingAdvice press, Tooltester (pricing/Shopify-vs-Wix), ecommerceparadise, The Wix Wiz hands-on.
