/**
 * Profile-driven site generation for the refactoring (`projects`) flow.
 *
 * Given a canonical company profile (scrape signal + Google Places facts), this
 * generates section content and assembles a preview using the SAME template
 * pipeline the AI builder uses. It mirrors the proven approach in
 * routes/api/ai-builder/generate.js, but:
 *   - writes sections/config with `project_id` (refactoring) not `ai_project_id`
 *   - sources content from the profile instead of a chat conversation
 *   - pre-fills contact/testimonials from hard facts (no hallucination)
 */

import { generateSectionContent } from './ai-content-generator.js';
import { getDefaultVariant } from './ai-content-extractor.js';
import { profileToContext, profileToFactSections } from './company-profile.js';
import { createSection } from '../db/ai-sections.js';
import { createWebsiteConfig } from '../db/ai-config.js';
import { assemblePage } from './ai-page-assembler.js';
import { uploadToR2 } from './r2-storage.js';

// Section line-up for a generated business site. Testimonials only appear when
// we have real Google reviews (added dynamically below).
const BASE_SECTIONS = ['hero', 'about', 'services', 'contact', 'footer'];

/**
 * Generate section objects from a company profile.
 * Each returned section: { type, order, content } where content includes _variant.
 * @param {object} env - Environment bindings (for AI)
 * @param {object} profile - Canonical profile from buildProfile()
 * @returns {Promise<Array>} sections
 */
export async function generateSectionsFromProfile(env, profile) {
  const context = profileToContext(profile);
  const factSections = profileToFactSections(profile);

  // Build the ordered section list; insert testimonials before contact when we
  // have real reviews to show.
  const types = [...BASE_SECTIONS];
  if (factSections.testimonials) {
    types.splice(types.indexOf('contact'), 0, 'testimonials');
  }

  const sections = [];
  let order = 0;

  for (const type of types) {
    let content;

    if (factSections[type]) {
      // Hard facts win — no AI call needed (contact, testimonials).
      content = factSections[type];
    } else {
      // Generate via the proven AI content path; fall back to profile defaults.
      try {
        content = await generateSectionContent(env, type, context);
        if (type === 'footer') {
          content.business_name = content.business_name || profile.name;
        }
      } catch (error) {
        console.error(`Profile generation: ${type} failed, using default:`, error.message);
        content = defaultContentForType(type, profile);
      }
    }

    const variant = getDefaultVariant(type);
    content._variant = variant;

    sections.push({ type, order: order++, content, variant });
  }

  return sections;
}

/**
 * Persist sections + config and assemble/upload the preview HTML.
 * Returns the R2 path of the stored preview.
 * @param {object} env - Environment bindings
 * @param {object} project - projects row (needs id, preview_id)
 * @param {Array} sections - From generateSectionsFromProfile
 * @param {object} projectData - { project_name, project_id } for the assembler
 * @returns {Promise<{previewPath: string, sectionsCreated: number}>}
 */
export async function buildAndStorePreview(env, project, sections, projectData) {
  // Config (refactoring side → project_id)
  const config = await createWebsiteConfig(env.DB, {
    project_id: project.id,
    primary_color: '#667eea',
    secondary_color: '#764ba2',
    font_heading: 'Inter',
    font_body: 'Inter',
    style_theme: 'modern',
  });

  // Persist each section
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

  // Assemble from the in-memory sections (same shape assemblePage expects)
  const previewHtml = assemblePage(
    sections.map((s) => ({
      section_type: s.type,
      section_order: s.order,
      html_template: s.variant,
      content_json: JSON.stringify(s.content),
      is_visible: 1,
    })),
    config,
    projectData
  );

  const previewPath = `projects/${project.id}/template-preview.html`;
  await uploadToR2(env.STORAGE, previewPath, previewHtml, 'text/html');

  return { previewPath, sectionsCreated: sections.length };
}

/**
 * Sensible default content per section type, drawn from the profile, used when
 * an AI generation call fails so the page is never blank.
 * @param {string} type
 * @param {object} profile
 * @returns {object}
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
