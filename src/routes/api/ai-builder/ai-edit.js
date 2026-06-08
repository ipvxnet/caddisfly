// AI Edit — chat-driven section editing (propose → confirm → apply)
//   POST /api/ai-builder/:project_id/sections/:section_id/ai-edit         (propose)
//   POST /api/ai-builder/:project_id/sections/:section_id/ai-edit/apply   (apply)

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { audit } from '../../../utils/audit.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getSectionById, updateSectionContent, updateSection } from '../../../db/ai-sections.js';
import { callWorkersAI, extractJSON } from '../../../utils/ai-content-generator.js';
import { buildEditPrompt, sanitizeProposal, mergePatch, ensureItemIcons } from '../../../utils/ai-edit.js';
import { generateToken } from '../../../utils/crypto.js';
import { uploadToR2 } from '../../../utils/r2-storage.js';
import { getUserTier, checkAIGenerationLimit, limitsDisabled, formatRateLimitError } from '../../../utils/rate-limiter.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS } from '../../../utils/credits.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';

const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Resolve the project (AI builder first, else refactoring bridge), load + verify
 * the section. Returns { section, email } or a Response (error) to return early.
 */
async function resolveSection(env, project_id, section_id) {
  const aiProject = await getAIProjectByProjectId(env.DB, project_id);
  let regularProject = null;
  if (!aiProject) {
    regularProject = await getProjectByPreviewId(env.DB, project_id);
    if (!regularProject) return { error: json({ success: false, error: 'Project not found' }, 404) };
  }

  const section = await getSectionById(env.DB, parseInt(section_id));
  if (!section) return { error: json({ success: false, error: 'Section not found' }, 404) };
  if (aiProject && section.ai_project_id !== aiProject.id) {
    return { error: json({ success: false, error: 'Section does not belong to this project' }, 403) };
  }
  if (regularProject && section.project_id !== regularProject.id) {
    return { error: json({ success: false, error: 'Section does not belong to this project' }, 403) };
  }

  return { section, email: (aiProject || regularProject).customer_email, language: (aiProject || regularProject).language || 'en' };
}

/**
 * Propose: ask the LLM for a patch + summary + optional image actions. Persists
 * nothing — the user confirms before apply.
 */
export async function handleAIEditPropose(ctx) {
  const { request, env, params } = ctx;
  try {
    const { project_id, section_id } = params;
    const resolved = await resolveSection(env, project_id, section_id);
    if (resolved.error) return resolved.error;
    const { section, language } = resolved;

    const body = await request.json();
    const message = (body.message || '').toString().trim();
    if (!message) return json({ success: false, error: 'Empty request' }, 400);

    const screen = screenContent(message);
    if (!screen.allowed) return json(policyError(screen), 422);

    const content = JSON.parse(section.content_json || '{}');
    const { system_message, prompt } = buildEditPrompt(section.section_type, content, message, body.history || [], language);

    let proposal;
    try {
      const raw = await callWorkersAI(env, prompt, { system_message, temperature: 0.4, max_tokens: 1500 });
      proposal = sanitizeProposal(extractJSON(raw), section.section_type);
    } catch (error) {
      console.error('AI edit propose failed:', error.message);
      return json({ success: false, error: 'AI could not process that request. Try rephrasing.' }, 502);
    }

    const hasChange = Object.keys(proposal.patch).length > 0 || proposal.actions.length > 0;
    return json({ success: true, ...proposal, has_change: hasChange });
  } catch (error) {
    console.error('Error in ai-edit propose:', error);
    return json({ success: false, error: 'Failed to propose edit', details: error.message }, 500);
  }
}

/**
 * Apply: run any generate_image actions (→ R2), merge the patch, persist. Also
 * supports an optional set_variant (e.g. switch hero to the video variant).
 */
export async function handleAIEditApply(ctx) {
  const { request, env, params } = ctx;
  try {
    const { project_id, section_id } = params;
    const resolved = await resolveSection(env, project_id, section_id);
    if (resolved.error) return resolved.error;
    const { section, email } = resolved;

    const body = await request.json();
    const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch) ? { ...body.patch } : {};
    const actions = Array.isArray(body.actions) ? body.actions : [];
    const imageActions = actions.filter((a) => a && a.type === 'generate_image' && a.prompt && a.target);

    // Credit cost: 1 for the text edit + 5 per generated image.
    const editCost = CREDIT_COSTS.text_edit + imageActions.length * CREDIT_COSTS.image;

    // Rate-limit the costly path (image generation), bypassed in preview/dev.
    if (imageActions.length && !limitsDisabled(env)) {
      const tier = await getUserTier(env.DB, email);
      const check = await checkAIGenerationLimit(env.DB, email, tier);
      if (!check.allowed) return json(formatRateLimitError(check, 'generations'), 429);
    }

    // AI credit pre-check (enforced in production; non-blocking in preview/dev).
    const afford = await canAfford(env, env.DB, email, editCost);
    if (!afford.ok) {
      return json(formatCreditError(afford.state, imageActions.length ? 'an AI image edit' : 'an AI edit'), 402);
    }

    // Generate images → store to R2 → write the served URL into the patch.
    for (const action of imageActions) {
      const url = await generateImageToR2(env, project_id, action.prompt);
      if (action.target === 'images') {
        const current = Array.isArray(patch.images) ? patch.images : [];
        patch.images = [...current, { url, alt: action.prompt.slice(0, 80) }];
      } else {
        patch[action.target] = url;
      }
    }

    if (Object.keys(patch).length === 0 && !body.set_variant) {
      return json({ success: false, error: 'Nothing to apply' }, 400);
    }

    const content = JSON.parse(section.content_json || '{}');
    const merged = ensureItemIcons(mergePatch(content, patch));
    await updateSectionContent(env.DB, section.id, merged);

    // Optional variant switch (e.g. hero → video so an uploaded/linked video renders).
    if (body.set_variant && typeof body.set_variant === 'string') {
      await updateSection(env.DB, section.id, { html_template: body.set_variant });
    }

    // Charge AI credits for the edit (after success).
    await chargeCredits(env, env.DB, email, editCost);
    audit(ctx, 'credit.ai_edit', { teamOwner: email, resourceType: 'section', resourceId: section_id, metadata: { credits: editCost, images: imageActions.length } });

    return json({ success: true, content: merged });
  } catch (error) {
    console.error('Error in ai-edit apply:', error);
    return json({ success: false, error: 'Failed to apply edit', details: error.message }, 500);
  }
}

/**
 * Generate an image with Workers AI, store it in R2, and return its served URL.
 * Flux-schnell returns { image: <base64 jpeg> }. (Also used by the blog cover
 * generator — routes/api/ai-builder/blog.js.)
 * @returns {Promise<string>} `/preview-asset/<id>/ai-<token>.jpg`
 */
export async function generateImageToR2(env, id, prompt) {
  if (!env.AI) throw new Error('AI binding not available');
  const result = await env.AI.run(IMAGE_MODEL, { prompt, steps: 6 });
  const b64 = result && result.image;
  if (!b64) throw new Error('Image model returned no image');
  // base64 → bytes
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const filename = `ai-${generateToken(10)}.jpg`;
  await uploadToR2(env.STORAGE, `assets/${id}/${filename}`, bytes, 'image/jpeg');
  return `/preview-asset/${id}/${filename}`;
}
