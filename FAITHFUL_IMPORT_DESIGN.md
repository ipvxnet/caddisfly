# Faithful Import — design spec

**Goal:** turn the refactor flow from "AI regenerates a generic-but-clean site" into "import my real site, section-for-section, with my actual text and photos." The single biggest onboarding-friction remover: *paste your URL → your site, in Caddisfly.*

## Problem
The current refactor flow: scrape → **AI regenerates** content → sections. It produces a clean site but often **loses the business's identity** — ARM Diesel lost its Psalm 89:13 verse, its "We speak English, French, Portuguese, Italian and Spanish" line, its "MADE IN BRASIL, USA, CANADA AND ITALY" tagline, and used stock photos instead of the real product shots. Onboarding feels like a rebuild, not an import.

## Proven live (2026-06-22, against armdieselsolutions.com)
- **Static scrape = useless** for builder sites. GoDaddy Websites+Marketing (and Wix/Duda/Squarespace) render client-side: raw HTML = nav + logo only (~1.4k chars, 2 imgs). **Must browser-render.** Caddisfly already has this (Zyte fallback in `refactor-scrape.js`).
- **Browser render (Chrome) of the home page** → **17 real photos** (hi-res, on `img1.wsimg.com`) + the real copy. Extracted cleanly into ordered blocks:

| Extracted block | → Caddisfly section |
|---|---|
| "We speak English, French, Portuguese, Italian and Spanish" | hero sub / banner |
| "OUR PRODUCTS ARE MADE IN BRASIL, USA, CANADA AND ITALY" + product lines | hero + **services** (Diesel injection parts, Nozzles & pumps, Repair tools EUI/EUP/HEUI, Test benches) |
| section with 15 images, no text | **gallery** |
| "Your arm is powerful… Psalm 89:13" | **about / quote** (verbatim — the bit that got lost) |
| "Send a message" + phone/address | **contact** |

→ Near-1:1 mapping to hero/services/gallery/about/contact, *recovering the identity the AI rebuild dropped.*

## Pipeline
1. **Crawl** — browser-render (Zyte) each page: home + nav-discovered pages (cap ~8 by nav order). Scroll to trigger lazy-load. Per page, collect **ordered blocks**: each section's text + image URLs (+ heading where semantic, else the first large/strong text).
2. **Normalize** — strip repeated nav/footer chrome; group blocks by visual section; pull images to R2 (`buildPhotoPool` already does this — they're the merchant's own photos, reuse is expected).
3. **Classify** — map each block → a Caddisfly section type. Heuristics first (image-only strip→gallery; phone/address→contact; top tagline→hero; bulleted offerings→services; product grid pages→catalogue), **AI fallback** for fuzzy blocks (tiny classify prompt: block text + image-count → `{type, confidence}`; can run on the LAN Ollama or Workers AI). Low-confidence → a generic text+image section, never a wrong type.
4. **Build sections with REAL content** using the existing `content_json` schemas: hero `{heading, subheading, background_image}`, services `{services[]}`, gallery `{images[]}`, about `{story = verbatim identity copy}`, contact `{phone,email,address}`, and **catalogue** (plugin) for product pages → one catalogue section per category, real product names + images.
5. **Verbatim-preserve** high-signal copy (taglines, quotes, slogans, the language line) by extending the existing hard-fact overlay (`ownerAboutStory`, contact/social) to more sections. **AI fills GAPS only** (missing subheadings, alt text, SEO) — it never overwrites real copy.
6. **AI polish (optional, OFF in faithful mode)** — grammar tidy + missing meta, behind a toggle.

## Where it plugs in
- A new **mode flag** on the refactor/preview build path (`routes/api/preview/build` + `template-generation.js`). Existing path = "Reimagine it"; new path = **"Match my current site as closely as possible."** Surface as a choice on the landing Refactor card.
- Reuses: `refactor-scrape.js` (browser render), `buildPhotoPool` (R2 images), the section registry + schemas, the hard-fact overlay pattern, `entitledSectionFilter` (catalogue gating), `inferIndustryPreferring`.

## Caveats / risk
- Builder widget layouts don't map 1:1 → the AI classify step + confidence threshold handle fuzziness.
- Multi-page = per-page Zyte render (cost) → cap pages; fall back to AI-rebuild when extraction is too thin (existing placeholder-aware logic).
- Wix/anti-bot sites are heavier → Zyte handles most; degrade gracefully to the current flow.

## Onboarding win
"Paste your current site → we rebuild it in Caddisfly with your real text and photos, section for section." True migration, not regeneration.
