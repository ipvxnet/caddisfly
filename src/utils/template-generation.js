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
import { createWebsiteConfig } from '../db/ai-config.js';
import { assemblePage } from './ai-page-assembler.js';
import { uploadToR2 } from './r2-storage.js';
import { fetchPlacePhotoBytes } from './google-places.js';
import { searchStockPhotos } from './stock-photos.js';
import { inferIndustry, paletteFor, variantFor, imageKeywordsFor } from './industry-style.js';
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
  const industry = inferIndustry(profile.category, profile.name);

  // 1. Image pool: real Google Places photos (→ R2) first, then stock to fill.
  const photoPool = await buildPhotoPool(env, project, profile, industry);
  const pickPhoto = makePhotoPicker(photoPool);

  // 2. Section line-up: gallery only when we have enough imagery; testimonials
  //    only when we have real positive reviews.
  const factSections = profileToFactSections(profile);
  const types = ['hero', 'about', 'services'];
  if (photoPool.length >= 3) types.push('gallery');
  if (factSections.testimonials) types.push('testimonials');
  types.push('contact', 'footer');

  // 3. Generate each section's content.
  const context = profileToContext(profile);
  const sections = [];
  let order = 0;

  for (const type of types) {
    let content;
    if (factSections[type]) {
      content = factSections[type]; // hard facts (contact, testimonials)
    } else {
      try {
        content = await generateSectionContent(env, type, context);
        if (type === 'footer') content.business_name = content.business_name || profile.name;
      } catch (error) {
        console.error(`Profile generation: ${type} failed, using default:`, error.message);
        content = defaultContentForType(type, profile);
      }
    }

    const variant = variantFor(industry, type);
    attachImages(type, content, pickPhoto);
    content._variant = variant;
    sections.push({ type, order: order++, content, variant });
  }

  // 4. Config with the industry palette (replaces the old hardcoded purple).
  const palette = paletteFor(industry);
  const config = await createWebsiteConfig(env.DB, {
    project_id: project.id,
    primary_color: palette.primary,
    secondary_color: palette.secondary,
    font_heading: 'Inter',
    font_body: 'Inter',
    style_theme: 'modern',
  });

  // 5. Persist sections, assemble, upload.
  for (const s of sections) {
    await createSection(env.DB, {
      project_id: project.id,
      section_type: s.type,
      section_order: s.order,
      html_template: s.variant,
      content_json: JSON.stringify(s.content),
      is_visible: 1,
    });
  }

  const previewHtml = assemblePage(
    sections.map((s) => ({
      section_type: s.type,
      section_order: s.order,
      html_template: s.variant,
      content_json: JSON.stringify(s.content),
      is_visible: 1,
    })),
    config,
    { project_name: profile.name, project_id: project.preview_id }
  );

  const previewPath = `projects/${project.id}/template-preview.html`;
  await uploadToR2(env.STORAGE, previewPath, previewHtml, 'text/html');

  return { sectionsCreated: sections.length, previewPath, industry, photos: photoPool.length };
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

/**
 * Sensible default content per section type, drawn from the profile, used when
 * an AI generation call fails so the page is never blank.
 */
function defaultContentForType(type, profile) {
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
        items: [],
      };
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
