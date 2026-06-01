/**
 * POST /api/preview/manual/:token
 *
 * Fallback when Google Places can't identify the business. The verify page
 * renders a small form; this builds a company profile from the entered details
 * and generates the site with the same template pipeline. No paid Google call.
 */

import { getProjectByVerificationToken, updateProject } from '../../../db/projects.js';
import { generateSectionsFromProfile, buildAndStorePreview } from '../../../utils/template-generation.js';
import { redirect, badRequest, htmlResponse } from '../../../utils/response.js';

export async function handleManualProfile(ctx) {
  const { env, params, request } = ctx;
  const token = params.token;

  if (!token) {
    return badRequest('Invalid link.');
  }

  const project = await getProjectByVerificationToken(env.DB, token);
  if (!project) {
    return badRequest('This link is invalid or has expired.');
  }

  // Idempotent: if it's already built, just go to the preview.
  if (project.enrichment_status === 'complete') {
    return redirect(`/ai-preview/${project.preview_id}`, 303);
  }

  // Only reachable after email verification (the manual page is shown post-verify).
  if (!project.email_verified) {
    return badRequest('Please verify your email first.');
  }

  // Parse the submitted form.
  let form;
  try {
    form = await request.formData();
  } catch {
    return badRequest('Could not read form submission.');
  }

  const name = (form.get('name') || '').toString().trim();
  if (!name) {
    return badRequest('Business name is required.');
  }

  const profile = {
    name,
    category: (form.get('category') || '').toString().trim(),
    description: (form.get('description') || '').toString().trim(),
    address: (form.get('address') || '').toString().trim(),
    phone: (form.get('phone') || '').toString().trim(),
    website: project.website_url || '',
    hours: [],
    rating: null,
    rating_count: 0,
    reviews: [],
    source: { places_found: false, place_id: null, manual: true, scrape_headings: [], scrape_sample: '' },
  };

  await updateProject(env.DB, project.id, { enrichment_status: 'running', status: 'enriching' });

  try {
    const sections = await generateSectionsFromProfile(env, profile);
    await buildAndStorePreview(env, project, sections, {
      project_name: profile.name,
      project_id: project.preview_id,
    });
  } catch (error) {
    console.error('Manual-profile generation error:', error);
    await updateProject(env.DB, project.id, { enrichment_status: 'failed' });
    return htmlResponse(
      '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;">' +
        '<h1>We hit a snag</h1><p>Sorry, we had trouble building your site. Please try again in a moment.</p>' +
        '<p><a href="/">Back to homepage</a></p></body></html>',
      500
    );
  }

  await updateProject(env.DB, project.id, {
    status: 'preview_ready',
    enrichment_status: 'complete',
    template_generation_status: 'complete',
    company_profile_json: JSON.stringify(profile),
  });

  return redirect(`/ai-preview/${project.preview_id}`, 303);
}
