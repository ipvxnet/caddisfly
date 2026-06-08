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
import { createSection } from '../db/ai-sections.js';
import { createPage } from '../db/ai-pages.js';
import { planPages } from './pages-blueprint.js';
import { createWebsiteConfig } from '../db/ai-config.js';
import { assemblePage } from './ai-page-assembler.js';
import { uploadToR2 } from './r2-storage.js';
import { fetchPlacePhotoBytes } from './google-places.js';
import { searchStockPhotos } from './stock-photos.js';
import { inferIndustry, paletteFor, imageKeywordsFor } from './industry-style.js';
import { getRecipe, recipeVariant } from './industry-recipe.js';
import { attachImages, makePhotoPicker } from './section-images.js';

/**
 * Generate a full templated site from a profile, persist sections + config, and
 * upload the assembled preview. One call does everything.
 * @param {object} env - Environment bindings
 * @param {object} project - projects row (needs id, preview_id)
 * @param {object} profile - Canonical profile (see company-profile.buildProfile)
 * @returns {Promise<{sectionsCreated: number, previewPath: string, industry: string, photos: number}>}
 */
export async function generateAndStore(env, project, profile) {
  // Infer the industry from EVERYTHING we know — including the headings/body
  // scraped from the original site — so a scrape-only refactor (no verified
  // Places match) still lands on the right vertical (palette, fonts, imagery).
  const src = profile.source || {};
  const industry = inferIndustry(
    profile.category,
    profile.name,
    ...(Array.isArray(src.scrape_headings) ? src.scrape_headings : []),
    src.scrape_sample || ''
  );
  const recipe = getRecipe(industry);

  // 1. Image pool: real Google Places photos (→ R2) first, then stock to fill.
  const photoPool = await buildPhotoPool(env, project, profile, industry);
  const pickPhoto = makePhotoPicker(photoPool);

  // 2. Section line-up from the industry recipe, data-gated: drop gallery
  //    without enough imagery and testimonials without real reviews.
  const factSections = profileToFactSections(profile);
  const types = recipe.sections.filter(
    (t) => (t !== 'gallery' || photoPool.length >= 3) && (t !== 'testimonials' || !!factSections.testimonials)
  );

  // 3. Generate each section's content (in the project's chosen language).
  const context = profileToContext(profile, recipe, industry);
  context.language = (project && project.language) || 'en';
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
    } else if (factSections[type]) {
      content = factSections[type]; // hard facts (contact, testimonials)
    } else {
      try {
        content = await generateSectionContent(env, type, context);
        if (type === 'footer') content.business_name = content.business_name || profile.name;
      } catch (error) {
        console.error(`Profile generation: ${type} failed, using default:`, error.message);
        content = defaultContentForType(type, profile, recipe);
      }
    }

    // Features reuse the services {title,description,icon} shape.
    if (type === 'features' && !Array.isArray(content.features)) {
      content.features = content.services || content.items || [];
    }
    // These templates render a `description` subtitle; AI returns `subheading`.
    if ((type === 'services' || type === 'features') && !content.description && content.subheading) {
      content.description = content.subheading;
    }

    const variant = recipeVariant(recipe, type);
    attachImages(type, content, pickPhoto);
    content._variant = variant;
    sections.push({ type, order: order++, content, variant });
  }

  // 4. Config: industry palette + recipe fonts, but prefer the original site's
  //    brand color as primary when we recovered a valid one (stronger identity).
  const industryPalette = paletteFor(industry);
  const primaryColor = isHexColor(profile.brand_color) ? profile.brand_color : industryPalette.primary;
  const config = await createWebsiteConfig(env.DB, {
    project_id: project.id,
    primary_color: primaryColor,
    secondary_color: industryPalette.secondary,
    font_heading: recipe.fonts.heading,
    font_body: recipe.fonts.body,
    style_theme: 'modern',
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
async function buildPhotoPool(env, project, profile, industry) {
  const pool = [];

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

/** Turn a "A, B, C" service-hint string into [{title, description, icon}] items. */
function hintsToItems(hints) {
  if (!hints || typeof hints !== 'string') return [];
  return hints
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((title) => ({ title, description: '', icon: '✓' }));
}
