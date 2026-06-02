// POST /api/ai-builder/create
// Creates a new AI project and starts the conversation

import { createAIProject } from '../../../db/ai-projects.js';
import { createConversationEntry } from '../../../db/ai-conversations.js';
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
    const { email, initial_prompt } = body;

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

    // Create AI project
    const project = await createAIProject(env.DB, {
      customer_email: email,
      status: 'conversation',
      conversation_step: 'initial_prompt',
      pricing_tier: 'free_trial',
    });

    // Create initial conversation entry
    const firstStep = getFirstStep();
    const firstQuestion = formatStepForResponse(firstStep);

    await createConversationEntry(env.DB, {
      ai_project_id: project.id,
      step_name: firstStep,
      question: firstQuestion.question,
    });

    // Store the initial prompt as the answer to the first question
    // We'll update this in the respond endpoint

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

    // Determine next question
    const nextStep = 'business_info';
    const nextQuestion = formatStepForResponse(nextStep);

    // Return response with next question
    return new Response(
      JSON.stringify({
        success: true,
        project_id: project.project_id,
        message: 'AI project created successfully',
        extracted_data: extractedData,
        next_question: nextQuestion,
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
