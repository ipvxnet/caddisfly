// AI Content Generation using Workers AI

import { POLICY_INSTRUCTION } from './content-policy.js';
import { detailedToContext } from './detailed-profile.js';

/**
 * Call Workers AI with a prompt
 * @param {object} env - Environment bindings
 * @param {string} prompt - Prompt for the AI
 * @param {object} options - Optional configuration
 * @returns {Promise<string>} AI response
 */
export async function callWorkersAI(env, prompt, options = {}) {
  if (!env.AI) {
    throw new Error('AI binding not available');
  }

  const { max_tokens = 2048, temperature = 0.3, system_message = 'You are a helpful AI assistant.' } = options;

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: system_message,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens,
      temperature,
    });

    if (!response || !response.response) {
      throw new Error('Invalid AI response');
    }

    return response.response.trim();
  } catch (error) {
    console.error('Workers AI error:', error);
    throw error;
  }
}

/**
 * Extract JSON from AI response (handles markdown code blocks)
 * @param {string} aiResponse - Raw AI response
 * @returns {object|array} Parsed JSON object or array
 */
export function extractJSON(aiResponse) {
  let jsonText = aiResponse.trim();

  // Remove markdown code blocks if present
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim();
  }

  // Determine the TOP-LEVEL structure by whichever delimiter appears first, then
  // extract a balanced span. This is critical: a naive "[...]" match would grab
  // the inner array of an object like {"heading":"x","services":[...]} and throw
  // away the wrapper, corrupting the content.
  const firstBrace = jsonText.indexOf('{');
  const firstBracket = jsonText.indexOf('[');

  let candidate = null;
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    candidate = extractBalanced(jsonText, '[', ']');
  } else if (firstBrace !== -1) {
    candidate = extractBalanced(jsonText, '{', '}');
  }
  if (candidate) {
    jsonText = candidate;
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    // Fallback: the AI may have returned bare objects without array brackets
    // (e.g. "{...},{...}"). Try wrapping in an array.
    if (/\}\s*,\s*\{/.test(jsonText)) {
      try {
        return JSON.parse('[' + jsonText + ']');
      } catch {
        // fall through to the thrown error below
      }
    }
    console.error('Failed to parse JSON:', jsonText);
    throw new Error('AI returned invalid JSON: ' + error.message);
  }
}

/**
 * Extract a balanced bracketed span starting at the first `open` delimiter,
 * correctly skipping brackets that appear inside strings. Returns null if no
 * balanced span is found.
 * @param {string} text
 * @param {string} open - '{' or '['
 * @param {string} close - '}' or ']'
 * @returns {string|null}
 */
function extractBalanced(text, open, close) {
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Generate content with retry logic
 * @param {object} env - Environment bindings
 * @param {string} prompt - AI prompt
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<object>} Parsed JSON content
 */
export async function generateContentWithRetry(env, prompt, maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const aiResponse = await callWorkersAI(env, prompt, {
        system_message: `You are a website content generator. You ONLY output valid JSON, never explanations. ${POLICY_INSTRUCTION}`,
        temperature: 0.3,
        max_tokens: 2048,
      });

      return extractJSON(aiResponse);
    } catch (error) {
      lastError = error;
      console.error(`Content generation attempt ${attempt + 1} failed:`, error.message);

      // Don't retry if it's a binding error
      if (error.message.includes('binding not available')) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw new Error(`Content generation failed after ${maxRetries + 1} attempts: ${lastError.message}`);
}

/**
 * Generate content for a specific section type
 * @param {object} env - Environment bindings
 * @param {string} sectionType - Type of section (hero, about, services, etc.)
 * @param {object} context - Conversation context
 * @returns {Promise<object>} Generated content
 */
// English names so the model reliably understands the target language.
const LANG_FULL = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

export async function generateSectionContent(env, sectionType, context) {
  // Import prompts dynamically to avoid circular dependencies
  const { getContentPrompt } = await import('./ai-prompts.js');

  let prompt = getContentPrompt(sectionType, context);
  const lang = context && context.language;
  if (lang && lang !== 'en' && LANG_FULL[lang]) {
    prompt += `\n\nIMPORTANT: Write ALL text — headings, body copy, button labels, everything — in natural, native ${LANG_FULL[lang]}. Do not use English.`;
  }
  return generateContentWithRetry(env, prompt);
}

/**
 * Extract structured data from user answer
 * @param {object} env - Environment bindings
 * @param {string} stepName - Conversation step name
 * @param {string} answer - User's answer
 * @returns {Promise<object|null>} Extracted data or null
 */
export async function extractAnswerData(env, stepName, answer) {
  // Import prompts dynamically
  const { extractInitialPromptData, extractAudienceData } = await import('./ai-prompts.js');

  let prompt;

  switch (stepName) {
    case 'initial_prompt':
      prompt = extractInitialPromptData(answer);
      break;
    case 'audience':
      prompt = extractAudienceData(answer);
      break;
    default:
      // Not all steps need AI extraction
      return null;
  }

  try {
    return await generateContentWithRetry(env, prompt, 1); // Only 1 retry for extraction
  } catch (error) {
    console.error(`Failed to extract data for step ${stepName}:`, error);
    // Return null instead of throwing - extraction is optional
    return null;
  }
}

/**
 * Generate color scheme based on style and industry
 * @param {object} env - Environment bindings
 * @param {string} style - Visual style
 * @param {string} industry - Business industry
 * @returns {Promise<object>} Color scheme
 */
export async function generateColorScheme(env, style, industry) {
  const { generateColorScheme: getColorPrompt } = await import('./ai-prompts.js');

  const prompt = getColorPrompt(style, industry);

  try {
    return await generateContentWithRetry(env, prompt, 1);
  } catch (error) {
    console.error('Failed to generate color scheme, using defaults:', error);

    // Return default color scheme based on style
    const defaultColors = {
      modern: { primary_color: '#667eea', secondary_color: '#764ba2', accent_color: '#f093fb' },
      classic: { primary_color: '#1a1a2e', secondary_color: '#16213e', accent_color: '#0f3460' },
      minimal: { primary_color: '#2d3748', secondary_color: '#4a5568', accent_color: '#718096' },
      bold: { primary_color: '#e53e3e', secondary_color: '#ed8936', accent_color: '#ecc94b' },
    };

    return defaultColors[style] || defaultColors.modern;
  }
}

/**
 * Build context object from conversation answers
 * @param {object} project - AI project object
 * @param {array} conversations - Array of conversation entries
 * @returns {object} Context for content generation
 */
export function buildContext(project, conversations) {
  const context = {
    business_name: project.project_name || 'Your Business',
    business_type: 'business',
    industry: 'general',
    audience: 'customers',
    tone: 'professional',
    style: 'modern',
    content_source: 'ai_generate',
    selected_sections: [],
    language: project.language || 'en', // AI writes the site copy in this language
  };

  // Extract answers from conversations
  conversations.forEach((conv) => {
    if (!conv.answer) return;

    switch (conv.step_name) {
      case 'initial_prompt':
        // Try to parse extracted data if stored
        try {
          const extracted = JSON.parse(conv.answer);
          if (extracted.business_type) context.business_type = extracted.business_type;
          if (extracted.industry) context.industry = extracted.industry;
          if (extracted.tone) context.tone = extracted.tone;
        } catch {
          // Answer is plain text, not JSON
        }
        break;

      case 'business_info':
        context.business_name = conv.answer;
        break;

      case 'features':
        try {
          context.selected_sections = JSON.parse(conv.answer);
        } catch {
          context.selected_sections = [conv.answer];
        }
        break;

      case 'audience':
        context.audience = conv.answer;
        break;

      case 'style':
        context.style = conv.answer;
        break;

      case 'content_source':
        context.content_source = conv.answer;
        break;
    }
  });

  // Detailed flow: the rich business info lives in a JSON blob, not in chat
  // rows. Merge it so prompts ground copy in real history/founder/services and
  // contact/social facts are available to overlay onto sections.
  if (project.detailed_profile_json) {
    const det = detailedToContext(project.detailed_profile_json);
    if (det.description) context.description = det.description;
    if (det.audience) context.audience = det.audience;
    if (det.location) context.location = det.location;
    if (det.source_material) context.source_material = det.source_material;
    if (det.facts) context.facts = det.facts;
  }

  return context;
}
