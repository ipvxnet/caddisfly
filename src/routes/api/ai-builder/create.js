// POST /api/ai-builder/create
// Creates a new AI project and starts the conversation

import { createAIProject, updateAIProject } from '../../../db/ai-projects.js';
import { createConversationEntry, updateConversationAnswer } from '../../../db/ai-conversations.js';
import { createWebsiteConfig } from '../../../db/ai-config.js';
import { getFirstStep, formatStepForResponse } from '../../../utils/ai-conversation.js';
import { extractAnswerData } from '../../../utils/ai-content-generator.js';
import { checkProjectCreationLimit, getUserTier, formatRateLimitError, limitsDisabled, unlimited } from '../../../utils/rate-limiter.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';

/**
 * Handle AI builder project creation
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderCreate(ctx) {
  const { request, env } = ctx;

  try {
    // Parse request body
    const body = await request.json();
    // A signed-in user's SESSION identity wins — they never re-enter (or
    // spoof) an email; anonymous visitors still supply one in the form.
    const email = ctx.billingEmail || body.email;
    const { initial_prompt } = body;
    const acceptedTerms = body.accepted_terms === true || body.accepted_terms === 'true';
    // Site language: explicit selector → UI language → English.
    const LANGS = ['en', 'es', 'pt'];
    const language = LANGS.includes(body.language) ? body.language : (LANGS.includes(ctx.lang) ? ctx.lang : 'en');

    // Require Terms/Privacy acceptance before building.
    if (!acceptedTerms) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'You must agree to the Terms of Service and Privacy Policy to start building.',
          terms_url: '/terms',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate inputs
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Valid email is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check rate limits
    const tier = await getUserTier(env.DB, email);
    const limitCheck = limitsDisabled(env)
      ? unlimited(tier)
      : await checkProjectCreationLimit(env.DB, email, tier);

    if (!limitCheck.allowed) {
      return new Response(
        JSON.stringify(formatRateLimitError(limitCheck, 'projects')),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!initial_prompt || initial_prompt.trim().length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Initial prompt is required (minimum 10 characters)',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Acceptable Use screening — block prohibited prompts up front.
    const screen = screenContent(initial_prompt);
    if (!screen.allowed) {
      return new Response(JSON.stringify(policyError(screen)), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create AI project. Chat opens at Q1 (business_status); the free-text
    // describe-prompt is collected on the landing page (stored below).
    const project = await createAIProject(env.DB, {
      customer_email: email,
      status: 'conversation',
      conversation_step: 'business_status',
      pricing_tier: 'free_trial',
      language,
    });

    // Record Terms/Privacy acceptance.
    try {
      await updateAIProject(env.DB, project.id, { terms_accepted_at: Math.floor(Date.now() / 1000) });
    } catch (e) {
      console.error('Failed to record terms acceptance:', e.message);
    }

    // The landing page already collected the free-text "describe your business"
    // prompt. Store it as the (answered) initial_prompt entry so we don't
    // re-ask it in chat — it still feeds AI extraction and buildContext.
    const promptStep = getFirstStep(); // 'initial_prompt'
    const promptQuestion = formatStepForResponse(promptStep, language);
    const promptEntry = await createConversationEntry(env.DB, {
      ai_project_id: project.id,
      step_name: promptStep,
      question: promptQuestion.question,
    });
    await updateConversationAnswer(env.DB, promptEntry.id, initial_prompt);

    // First interactive chat question: Q1 — new vs existing business.
    const firstStep = 'business_status';
    const firstQuestion = formatStepForResponse(firstStep, language);
    await createConversationEntry(env.DB, {
      ai_project_id: project.id,
      step_name: firstStep,
      question: firstQuestion.question,
    });

    // Create default website config
    await createWebsiteConfig(env.DB, {
      ai_project_id: project.id,
    });

    // Try to extract data from initial prompt using AI (non-blocking)
    let extractedData = null;
    try {
      extractedData = await extractAnswerData(env, 'initial_prompt', initial_prompt);
    } catch (error) {
      console.error('Failed to extract initial prompt data:', error);
      // Continue without extracted data
    }

    // Return response. The chat UI is driven by project.conversation_step on
    // load, so this next_question is informational (the first chat step, Q1).
    return new Response(
      JSON.stringify({
        success: true,
        project_id: project.project_id,
        message: 'AI project created successfully',
        extracted_data: extractedData,
        next_question: firstQuestion,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating AI project:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to create AI project',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
