// POST /api/ai-builder/:project_id/respond
// Submit an answer to a conversation question

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import {
  createConversationEntry,
  getLatestUnansweredEntry,
  updateConversationAnswer,
} from '../../../db/ai-conversations.js';
import {
  validateAnswer,
  getNextStep,
  formatStepForResponse,
  isConversationComplete,
} from '../../../utils/ai-conversation.js';
import { extractAnswerData } from '../../../utils/ai-content-generator.js';
import { checkRequestRateLimit, getUserTier, formatRateLimitError, limitsDisabled, unlimited } from '../../../utils/rate-limiter.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';

/**
 * Handle conversation response
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderRespond(ctx) {
  const { request, env, params } = ctx;

  try {
    const { project_id } = params;

    // Parse request body
    const body = await request.json();
    const { answer } = body;

    // Get project
    const project = await getAIProjectByProjectId(env.DB, project_id);

    if (!project) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Project not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check rate limits
    const tier = await getUserTier(env.DB, project.customer_email);
    const limitCheck = limitsDisabled(env)
      ? unlimited(tier)
      : await checkRequestRateLimit(env.DB, project.customer_email, tier);

    if (!limitCheck.allowed) {
      return new Response(
        JSON.stringify(formatRateLimitError(limitCheck, 'requests')),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get latest unanswered question
    const currentQuestion = await getLatestUnansweredEntry(env.DB, project.id);

    if (!currentQuestion) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No unanswered question found',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate answer
    const validation = validateAnswer(currentQuestion.step_name, answer);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.error,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Acceptable Use screening on free-text answers.
    const answerText = typeof answer === 'string' ? answer : JSON.stringify(answer);
    const screen = screenContent(answerText);
    if (!screen.allowed) {
      return new Response(JSON.stringify(policyError(screen)), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store answer as JSON string if it's an array or object
    const answerToStore = typeof answer === 'object' ? JSON.stringify(answer) : answer;

    // Update conversation with answer
    await updateConversationAnswer(env.DB, currentQuestion.id, answerToStore);

    // Extract data using AI if applicable (non-blocking)
    let extractedData = null;
    try {
      extractedData = await extractAnswerData(env, currentQuestion.step_name, answerToStore);
    } catch (error) {
      console.error(`Failed to extract data for step ${currentQuestion.step_name}:`, error);
      // Continue without extracted data
    }

    // Special handling for business_info - update project name
    if (currentQuestion.step_name === 'business_info' && typeof answer === 'string') {
      await updateAIProject(env.DB, project.id, {
        project_name: answer,
      });
    }

    // Determine next step
    const nextStepName = getNextStep(currentQuestion.step_name);

    // Check if conversation is complete (no next step or next step is null)
    if (!nextStepName || isConversationComplete(currentQuestion.step_name)) {
      // Conversation is complete
      await updateAIProject(env.DB, project.id, {
        status: 'content_generation',
        conversation_step: 'review',
      });

      return new Response(
        JSON.stringify({
          success: true,
          conversation_complete: true,
          message: 'Conversation complete! Generating your website...',
          project_id: project.project_id,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if next step is an info-type step (doesn't need answer) - treat as complete
    const nextStepConfig = formatStepForResponse(nextStepName, project.language || 'en');
    if (nextStepConfig && nextStepConfig.type === 'info') {
      // Don't create conversation entry for info steps, just mark complete
      await updateAIProject(env.DB, project.id, {
        status: 'content_generation',
        conversation_step: nextStepName,
      });

      return new Response(
        JSON.stringify({
          success: true,
          conversation_complete: true,
          message: 'Conversation complete! Generating your website...',
          project_id: project.project_id,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create next conversation entry
    const nextQuestion = nextStepConfig;

    await createConversationEntry(env.DB, {
      ai_project_id: project.id,
      step_name: nextStepName,
      question: nextQuestion.question,
    });

    // Update project conversation step
    await updateAIProject(env.DB, project.id, {
      conversation_step: nextStepName,
    });

    // Return next question
    return new Response(
      JSON.stringify({
        success: true,
        conversation_complete: false,
        extracted_data: extractedData,
        next_question: nextQuestion,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error handling response:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process response',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
