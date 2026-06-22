/**
 * Profile-driven site generation for the refactoring (`projects`) flow.
 *
 * Given a company profile (scrape signal + Google Places facts), generate a
 * site using the same template pipeline as the AI builder, with:
 *   - industry-aware colors + image-forward variants (company-profile category)
 *   - real imagery: Google Places photos (stored to R2) + Pexels stock fallback
 *   - hard-fact sections (contact, testimonials) pre-filled, no hallucination
 * Writes sections/config with `project_id` (refactoring side).
 */

import { generateSectionContent } from './ai-content-generator.js';
import { profileToContext, profileToFactSections } from './company-profile.js';
import { attachServiceImages } from './service-images.js';
import { selectTemplate } from './site-themes.js';
import { createSection } from '../db/ai-sections.js';
import { createPage, updatePage } from '../db/ai-pages.js';
import { generateSiteSeo, extractContentText } from './seo-generate.js';
import { planPages } from './pages-blueprint.js';
import { createWebsiteConfig } from '../db/ai-config.js';
import { assemblePage } from './ai-page-assembler.js';
import { uploadToR2 } from './r2-storage.js';
import { fetchPlacePhotoBytes } from './google-places.js';
import { searchStockPhotos } from './stock-photos.js';
import { inferIndustry, inferIndustryPreferring, paletteFor, imageKeywordsFor } from './industry-style.js';
import { getRecipe, recipeVariant } from './industry-recipe.js';
import { attachImages, makePhotoPicker } from './section-images.js';
import { buildFaithfulContent } from './faithful-import.js';

/**
 * Generate a full templated site from a profile, persist sections + config, and
 * upload the assembled preview. One call does everything.
 * @param {object} env - Environment bindings
 * @param {object} project - projects row (needs id, preview_id)
 * @param {object} profile - Canonical profile (see company-profile.buildProfile)
 * @returns {Promise<{sectionsCreated: number, previewPath: string, industry: string, photos: number}>}
 */
export async function generateAndStore(env, project, profile, opts = {}) {
  // Infer the industry from EVERYTHING we know — including the headings/body
  // scraped from the original site — so a scrape-only refactor (no verified
  // Places match) still lands on the right vertical (palette, fonts, imagery).
  const src = profile.source || {};
  // Prefer authoritative signals (Places category, business name, the owner's own
  // description + services) over the scraped page body — a stray keyword in the
  // scrape (e.g. a "we speak …, Italian" languages list) must not outscore the
  // real vertical. Scrape text is a fallback only when the rest says nothing.
  const industry = inferIndustryPreferring(
    [profile.category, profile.name, profile.description, profile.user_services],
    [...(Array.isArray(src.scrape_headings) ? src.scrape_headings : []), src.scrape_sample || '']
  );
  const recipe = getRecipe(industry);
  // Phase C: curated template for the vertical (composes variants + fonts +
  // colors + tokens). Recipe still drives the section line-up + content.
  const template = selectTemplate(industry);

  // 1. Image pool: real Google Places photos (→ R2) first, then stock to fill.
  //    A caller (the search-preview step) may pass a pool it already built so we
  //    don't re-fetch/re-bill the same photos at confirm-build time.
  const photoPool = Array.isArray(opts.photoPool) && opts.photoPool.length
    ? opts.photoPool
    : await buildPhotoPool(env, project, profile, industry);
  const pickPhoto = makePhotoPicker(photoPool);

  // Faithful Import: when the owner chose "match my current site", build section
  // content from the site's REAL blocks (extracted at scrape time) instead of
  // AI-regenerating it. Covers hero/services/gallery/about; contact/testimonials
  // still come from hard facts, AI fills any remaining recipe sections.
  const faithful = opts.import_mode === 'faithful'
    ? buildFaithfulContent((profile.source || {}).scrape_blocks, { profile, photoPool, lang: project.language || 'en' }).content
    : null;

  // 2. Section line-up from the industry recipe, data-gated: drop gallery
  //    without enough imagery and testimonials without real reviews.
  const factSections = profileToFactSections(profile, (project && project.language) || 'en');
  const types = recipe.sections.filter(
    (t) => (t !== 'gallery' || photoPool.length >= 3) && (t !== 'testimonials' || !!factSections.testimonials)
  );
  // The owner wrote an about/founder story but the recipe has no About section
  // (e.g. fitness) → guarantee one so their words actually appear.
  if (!types.includes('about') && ownerAboutStory(profile)) {
    types.splice(Math.min(2, types.length), 0, 'about');
  }

  // 3. Generate each section's content (in the project's chosen language).
  const context = profileToContext(profile, recipe, industry);
  context.language = (project && project.language) || 'en';

  // Stock customer faces for testimonials so the new photo/portrait layouts
  // render with real faces out of the box (starter content — the owner swaps in
  // real customer photos via the editor). [] if Pexels is unavailable → the
  // templates fall back to monogram tiles.
  let portraitPool = [];
  if (types.includes('testimonials')) {
    try {
      const r = await searchStockPhotos(env, 'smiling customer portrait person', 6);
      portraitPool = (r || []).map((x) => x && x.url).filter(Boolean);
    } catch (e) { /* monogram fallback */ }
  }

  const sections = [];
  let order = 0;

  for (const type of types) {
    let content;
    if (type === 'header') {
      // Brand identity recovered from the original site.
      content = {
        logo: profile.logo || '',
        business_name: profile.name,
        phone: profile.phone || '',
        cta_link: '#contact',
      };
    } else if (faithful && faithful[type]) {
      content = { ...faithful[type] }; // the site's REAL copy + photos (faithful import)
    } else if (factSections[type]) {
      content = factSections[type]; // hard facts (contact, testimonials)
      // Give testimonials a customer photo (stock; owner replaces with real ones).
      if (type === 'testimonials' && Array.isArray(content.testimonials) && portraitPool.length) {
        content = {
          ...content,
          testimonials: content.testimonials.map((t, i) => ({ ...t, avatar: t.avatar || portraitPool[i % portraitPool.length] })),
        };
      }
    } else {
      try {
        content = await generateSectionContent(env, type, context);
        if (type === 'footer') content.business_name = content.business_name || profile.name;
      } catch (error) {
        console.error(`Profile generation: ${type} failed, using default:`, error.message);
        content = defaultContentForType(type, profile, recipe);
      }
    }

    // Owner provided an explicit services list → use ALL of it (overrides the
    // AI's summarized ~6) so nothing they typed gets dropped. Apply it to the
    // SERVICES section only; FEATURES is meant for benefits / "why choose us", so
    // stuffing the same product list there just reads as repetition. Fall back to
    // FEATURES only when the line-up has no dedicated services section.
    if (type === 'services' || (type === 'features' && !types.includes('services'))) {
      const explicitSvcs = explicitServiceItems(profile);
      if (explicitSvcs.length) { content.services = explicitSvcs; content.items = explicitSvcs; }
    }
    // Features reuse the services {title,description,icon} shape.
    if (type === 'features' && !Array.isArray(content.features)) {
      content.features = content.services || content.items || [];
    }
    // Owner typed an "about us"/founder story → render their ACTUAL words as the
    // About body (both about variants use `story`), keeping the AI heading/
    // subheading/image. Soft AI context dropped this; the owner's text is verbatim.
    if (type === 'about') {
      const story = ownerAboutStory(profile);
      if (story) content.story = story;
    }
    // These templates render a `description` subtitle; AI returns `subheading`.
    if ((type === 'services' || type === 'features') && !content.description && content.subheading) {
      content.description = content.subheading;
    }
    // Picture tile per service (best-effort; falls back to icons).
    if (type === 'services') {
      await attachServiceImages(env, project.preview_id, content, context);
    }
    // Overlay confirmed social links onto the footer (contact gets them via its
    // fact section). No-op unless a detailed override supplied real links.
    if (type === 'footer' && Array.isArray(profile.social) && profile.social.length) {
      content.social = profile.social;
    }

    const variant = template.variants[type] || recipeVariant(recipe, type);
    attachImages(type, content, pickPhoto);
    content._variant = variant;
    sections.push({ type, order: order++, content, variant });
  }

  // 4. Config: the template's design. Dark templates use their own palette; light
  //    templates prefer the original site's brand color (stronger identity).
  const industryPalette = paletteFor(industry);
  let primaryColor, secondaryColor;
  if (template.colors) {
    primaryColor = template.colors.primary;
    secondaryColor = template.colors.secondary;
  } else {
    primaryColor = isHexColor(profile.brand_color) ? profile.brand_color : industryPalette.primary;
    secondaryColor = industryPalette.secondary;
  }
  // Owner-specified brand colors win over the template/industry defaults — a
  // refactor should keep the branding the owner invested in. (Only set when the
  // user provided them, or a real theme-color was detected; AI-builder generation
  // never sets brand_color, so it's unaffected.)
  if (isHexColor(profile.brand_color)) primaryColor = profile.brand_color;
  if (isHexColor(profile.accent_color)) secondaryColor = profile.accent_color;
  const config = await createWebsiteConfig(env.DB, {
    project_id: project.id,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    font_heading: template.fonts.heading,
    font_body: template.fonts.body,
    style_theme: template.key,
  });

  // 5. Multi-page split (deterministic blueprint; thin sites collapse to Home).
  const { pages: pagePlan, assign } = planPages(sections.map((s) => s.type), context.language || 'en');
  const pageIdBySlug = {};
  for (const p of pagePlan) {
    const row = await createPage(env.DB, {
      project_id: project.id,
      slug: p.slug,
      title: p.title,
      nav_label: p.nav_label,
      page_order: p.order,
      is_home: p.is_home,
      is_visible: 1,
    });
    pageIdBySlug[p.slug] = row.id;
  }
  const pageSlugForSection = (type) =>
    type === 'header' || type === 'footer' ? null : assign(type);

  // 6. Persist sections with per-page ordering (header/footer site-level).
  const orderByPage = {};
  let siteOrder = 0;
  for (const s of sections) {
    const slug = pageSlugForSection(s.type);
    const pageId = slug ? (pageIdBySlug[slug] ?? pageIdBySlug.home ?? null) : null;
    let secOrder;
    if (pageId == null) {
      secOrder = siteOrder++;
    } else {
      secOrder = orderByPage[pageId] || 0;
      orderByPage[pageId] = secOrder + 1;
    }
    await createSection(env.DB, {
      project_id: project.id,
      page_id: pageId,
      section_type: s.type,
      section_order: secOrder,
      html_template: s.variant,
      content_json: JSON.stringify(s.content),
      is_visible: 1,
    });
  }

  // 6b. Auto-SEO: per-page title + meta description in the site language —
  // part of the build, best-effort (NULL fields keep the render fallbacks,
  // which for refactors at least carry the Places profile description).
  try {
    const textBySlug = {};
    for (const s of sections) {
      const slug = pageSlugForSection(s.type);
      if (slug) textBySlug[slug] = `${textBySlug[slug] || ''} ${extractContentText(s.content)}`.trim().slice(0, 600);
    }
    const seoPages = pagePlan.map((p) => ({
      pageId: pageIdBySlug[p.slug], slug: p.slug, title: p.title, contentText: textBySlug[p.slug] || '',
    }));
    const seoMap = await generateSiteSeo(env, {
      businessName: profile.name, industry, language: context.language || 'en',
      description: profile.description || '',
    }, seoPages);
    if (seoMap) {
      for (const [pageId, seo] of seoMap) await updatePage(env.DB, pageId, seo);
      console.log(`auto-seo (refactor): ${seoMap.size}/${seoPages.length} pages filled`);
    } else {
      console.error('auto-seo (refactor): skipped (generation returned null) — SEO fields left empty');
    }
  } catch (e) {
    console.error('auto-seo (refactor) pass failed:', e.message);
  }

  // 7. Stored R2 preview = the HOME page (shared header + home body + footer).
  const homeSubset = sections.filter(
    (s) => s.type === 'header' || s.type === 'footer' || assign(s.type) === 'home'
  );
  const previewHtml = assemblePage(
    homeSubset.map((s) => ({
      section_type: s.type,
      section_order: s.order,
      html_template: s.variant,
      content_json: JSON.stringify(s.content),
      is_visible: 1,
    })),
    config,
    { project_name: profile.name, project_id: project.preview_id },
    {
      preordered: true,
      pages: pagePlan.map((p) => ({ slug: p.slug, nav_label: p.nav_label, is_visible: 1 })),
      currentSlug: 'home',
      previewBase: `/ai-preview/${project.preview_id}`,
    }
  );

  const previewPath = `projects/${project.id}/template-preview.html`;
  await uploadToR2(env.STORAGE, previewPath, previewHtml, 'text/html');

  return { sectionsCreated: sections.length, pages: pagePlan.length, previewPath, industry, photos: photoPool.length };
}

/**
 * Build the image pool for a site: real Google Places photos stored to R2,
 * topped up with Pexels stock when we have too few. Returns served URLs.
 * @returns {Promise<Array<{url: string, alt: string}>>}
 */
export async function buildPhotoPool(env, project, profile, industry) {
  const pool = [];

  // User-confirmed photos (from the detailed form, Phase 7) lead the pool so
  // the owner's real images are used before Places/stock.
  if (Array.isArray(profile.user_pictures)) {
    for (const url of profile.user_pictures) pool.push({ url, alt: profile.name });
  }

  // Real photos scraped from the original site (its own imagery) → R2. Crucial
  // for a business with no Google listing whose site we COULD read (or read at a
  // content path like /home). Skip fetch failures and tiny/icon responses.
  const scraped = Array.isArray(profile.scrape_images) ? profile.scrape_images.slice(0, 6) : [];
  for (let i = 0; i < scraped.length && pool.length < 6; i++) {
    try {
      // Downscale + WebP at ingest via Cloudflare image transformations. Scraped
      // originals are often 2000px+ hero JPEGs — far bigger than we ever display.
      // `cf.image` is a graceful no-op if Transformations aren't enabled on the
      // account (returns the original), so this never regresses; it just kicks in
      // automatically once Transformations is on for caddisfly.app.
      const r = await fetch(scraped[i], {
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: profile.website || '' },
        cf: { image: { width: 1280, fit: 'scale-down', quality: 82, format: 'webp' } },
      });
      if (!r.ok) continue;
      const ct = r.headers.get('content-type') || '';
      if (!/^image\//i.test(ct)) continue;
      const bytes = await r.arrayBuffer();
      if (bytes.byteLength < 8000) continue; // likely an icon/spacer
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
      const filename = `s${i}.${ext}`;
      await uploadToR2(env.STORAGE, `assets/${project.preview_id}/${filename}`, bytes, ct);
      pool.push({ url: `/preview-asset/${project.preview_id}/${filename}`, alt: profile.name });
    } catch (error) {
      console.error(`Scrape image ${i} failed:`, error.message);
    }
  }

  // Real business photos from Google Places → R2 → our served URL.
  const names = Array.isArray(profile.photos) ? profile.photos.slice(0, 6) : [];
  for (let i = 0; i < names.length; i++) {
    try {
      const { bytes, contentType } = await fetchPlacePhotoBytes(env, names[i]);
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      const filename = `${i}.${ext}`;
      await uploadToR2(env.STORAGE, `assets/${project.preview_id}/${filename}`, bytes, contentType);
      pool.push({ url: `/preview-asset/${project.preview_id}/${filename}`, alt: profile.name });
    } catch (error) {
      console.error(`Places photo ${i} failed:`, error.message);
    }
  }

  // Fill with stock if we don't have enough real photos.
  if (pool.length < 4) {
    const stock = await searchStockPhotos(env, imageKeywordsFor(industry, profile.name), 6);
    for (const s of stock) {
      pool.push(s);
      if (pool.length >= 6) break;
    }
  }

  console.log(`Photo pool for ${profile.name}: ${pool.length} (industry=${industry})`);
  return pool;
}

/** True for a valid #RGB or #RRGGBB hex color string. */
function isHexColor(s) {
  return typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
}

/**
 * Sensible default content per section type, drawn from the profile (and the
 * recipe's service hints), used when an AI generation call fails so the page is
 * never blank — and never shows "Service 1" placeholders.
 */
function defaultContentForType(type, profile, recipe = {}) {
  const serviceItems = hintsToItems(recipe.serviceHints);
  switch (type) {
    case 'hero':
      return {
        heading: profile.name,
        subheading: profile.description || profile.category || 'Quality you can trust',
        cta_text: 'Get in touch',
        cta_link: '#contact',
      };
    case 'about':
      return {
        heading: `About ${profile.name}`,
        story: profile.description || `${profile.name} is a trusted ${profile.category || 'local business'}.`,
        values: [],
      };
    case 'services':
      return {
        heading: 'What We Offer',
        description: profile.category ? `Professional ${profile.category} services.` : '',
        services: serviceItems,
        items: serviceItems,
      };
    case 'features':
      return { heading: 'Why Choose Us', description: '', features: serviceItems };
    case 'gallery':
      return { heading: 'Gallery', subheading: '', images: [] };
    case 'footer':
      return {
        company_name: profile.name,
        description: profile.category || '',
        social_links: [],
        links: [],
      };
    default:
      return { heading: profile.name };
  }
}

/** Turn a service list (newline- or comma-separated) into [{title,...}] items. */
function listToItems(text, cap = 15) {
  if (!text || typeof text !== 'string') return [];
  const seen = new Set();
  return text
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, '').trim()) // strip bullets/numbering
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .slice(0, cap)
    .map((title) => ({ title: smartTitleCase(title), description: '', icon: '✓' }));
}

/**
 * Title-case a short label for display (service names typed as a comma list come
 * in with inconsistent casing — "Diesel tools, parts, test benches"). Capitalizes
 * each word but preserves all-caps acronyms/codes (EUI, HEUI, USA, C175).
 */
function smartTitleCase(s) {
  return String(s).trim().split(/\s+/).map((w) => {
    if (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w; // keep EUI/USA/HEUI
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

/** Recipe service hints → items (fallback when the user gave no explicit list). */
function hintsToItems(hints) {
  return listToItems(hints, 8);
}

/** The owner's explicit services list (from the onboarding form), if any. */
function explicitServiceItems(profile) {
  return listToItems(profile && profile.user_services, 15);
}

/** The owner's About story (history + founder narrative), if they typed any. */
function ownerAboutStory(profile) {
  return [profile && profile.history, profile && profile.founder]
    .filter((s) => s && String(s).trim())
    .join('\n\n')
    .trim();
}
