// AI Conversation State Machine

import { t } from '../i18n/index.js';

/**
 * Conversation steps definition
 * Each step defines a question, type, and next step
 */
export const CONVERSATION_STEPS = {
  // Q1 — branches the whole flow. New businesses go straight to the regular
  // prompts; existing businesses are asked Q2 (data_mode) next.
  business_status: {
    question: 'Do you already have a website for your business?',
    type: 'single_choice',
    options: [
      { value: 'new_business', label: 'New business — no website yet', description: "I'm starting fresh and may need a logo too" },
      { value: 'existing_business', label: 'Existing business — I have a website', description: 'I already have an online presence' },
    ],
    next: (a) => (a.business_status === 'new_business' ? 'business_info' : 'data_mode'),
  },
  // Q2 — only reached for existing businesses. "detailed" hands off to the
  // single-page detailed form; "ai_generated" continues the regular prompts.
  data_mode: {
    question: 'How would you like to build your site?',
    type: 'single_choice',
    options: [
      { value: 'detailed', label: 'Use my real business details', description: 'Logo, history, founders, services, photos, social links — for the best result' },
      { value: 'ai_generated', label: 'Let AI generate it for now', description: "AI writes the text and picks images; I'll add details later" },
    ],
    next: (a) => (a.data_mode === 'detailed' ? 'detailed_form' : 'business_info'),
  },
  initial_prompt: {
    question: 'What kind of website do you need? Describe your business or project.',
    type: 'text',
    placeholder: 'e.g., A bakery website with online ordering, a portfolio for my photography...',
    next: 'business_info',
  },
  business_info: {
    question: "What's your business or project name?",
    type: 'text',
    placeholder: 'e.g., Sweet Delights Bakery',
    next: 'features',
  },
  features: {
    question: 'Which sections would you like on your website?',
    type: 'multiple_choice',
    options: [
      { value: 'hero', label: 'Hero / Landing Section', description: 'Eye-catching introduction with call-to-action' },
      { value: 'about', label: 'About Us', description: 'Tell your story and mission' },
      { value: 'services', label: 'Services / Products', description: 'Showcase what you offer' },
      { value: 'features', label: 'Features', description: 'Highlight key features and benefits' },
      { value: 'pricing', label: 'Pricing Plans', description: 'Display pricing options and plans' },
      { value: 'stats', label: 'Stats / Numbers', description: 'Showcase impressive metrics' },
      { value: 'gallery', label: 'Photo Gallery', description: 'Visual showcase of your work' },
      { value: 'testimonials', label: 'Customer Reviews', description: 'Social proof and testimonials' },
      { value: 'cta', label: 'Call-to-Action', description: 'Conversion-focused banner' },
      { value: 'products', label: 'Online Store', description: 'Sell products with Stripe checkout' },
      { value: 'booking', label: 'Bookings', description: 'Let visitors book appointments' },
      { value: 'blog', label: 'Blog', description: 'AI-assisted blog — we draft your first post' },
      { value: 'contact', label: 'Contact Form', description: 'Let visitors get in touch' },
      { value: 'footer', label: 'Footer', description: 'Contact info and social links' },
    ],
    next: 'audience',
  },
  audience: {
    question: 'Who is your target audience?',
    type: 'text',
    placeholder: 'e.g., Local customers looking for fresh baked goods, wedding planners...',
    next: 'style',
  },
  style: {
    question: 'Choose a visual style for your website',
    type: 'single_choice',
    options: [
      { value: 'modern', label: 'Modern', description: 'Clean lines, gradients, contemporary feel' },
      { value: 'classic', label: 'Classic', description: 'Timeless, elegant, professional' },
      { value: 'minimal', label: 'Minimal', description: 'Simple, focused, lots of white space' },
      { value: 'bold', label: 'Bold', description: 'Vibrant colors, strong typography, energetic' },
    ],
    next: 'content_source',
  },
  content_source: {
    question: 'How would you like to provide content?',
    type: 'single_choice',
    options: [
      { value: 'ai_generate', label: 'AI Generate', description: "Let AI create content based on your answers (you can edit later)" },
      { value: 'upload', label: "I'll Upload", description: 'Upload your own text and images' },
      { value: 'hybrid', label: 'Mix of Both', description: 'AI generates some content, you upload specific items' },
    ],
    next: 'review',
  },
  review: {
    question: 'Great! Let me generate your website preview...',
    type: 'info',
    next: null, // End of conversation
  },
  // Hand-off step: not a chat question. respond.js detects type 'form' and
  // redirects to the single-page detailed form instead of generating.
  detailed_form: {
    question: 'Tell us about your business',
    type: 'form',
    next: null,
  },
};

/**
 * Ordered step lists per flow path, used for the progress indicator. The
 * `initial_prompt` describe step is collected on the landing page (not in chat),
 * so it is intentionally excluded here.
 */
export const PATHS = {
  regular: ['business_status', 'data_mode', 'business_info', 'features', 'audience', 'style', 'content_source', 'review'],
  detailed: ['business_status', 'data_mode', 'detailed_form'],
};

/**
 * Get the first conversation step
 * @returns {string} First step name
 */
export function getFirstStep() {
  return 'initial_prompt';
}

/**
 * Get step configuration
 * @param {string} stepName - Step name
 * @returns {object|null} Step configuration or null
 */
export function getStepConfig(stepName) {
  return CONVERSATION_STEPS[stepName] || null;
}

/**
 * Get next step name. A step's `next` may be a string or a function of the
 * answers-so-far (for branching, e.g. business_status / data_mode).
 * @param {string} currentStep - Current step name
 * @param {object} [answers] - Map of step_name -> answer (from buildConversationSummary)
 * @returns {string|null} Next step name or null if conversation complete
 */
export function getNextStep(currentStep, answers = {}) {
  const stepConfig = getStepConfig(currentStep);
  const next = stepConfig?.next;
  if (typeof next === 'function') return next(answers) || null;
  return next || null;
}

/**
 * Check if step is valid
 * @param {string} stepName - Step name
 * @returns {boolean} Is valid step
 */
export function isValidStep(stepName) {
  return stepName in CONVERSATION_STEPS;
}

/**
 * Check if conversation is complete
 * @param {string} stepName - Current step name
 * @returns {boolean} Is conversation complete
 */
export function isConversationComplete(stepName) {
  const stepConfig = getStepConfig(stepName);
  return stepConfig?.next === null;
}

/**
 * Validate answer based on step type
 * @param {string} stepName - Step name
 * @param {any} answer - User's answer
 * @returns {object} Validation result { valid: boolean, error?: string }
 */
export function validateAnswer(stepName, answer) {
  const stepConfig = getStepConfig(stepName);

  if (!stepConfig) {
    return { valid: false, error: 'Invalid step' };
  }

  // Info and form-handoff types don't require a chat answer.
  if (stepConfig.type === 'info' || stepConfig.type === 'form') {
    return { valid: true };
  }

  // Check if answer exists
  if (answer === null || answer === undefined || answer === '') {
    return { valid: false, error: 'Answer is required' };
  }

  // Validate based on type
  switch (stepConfig.type) {
    case 'text':
      if (typeof answer !== 'string') {
        return { valid: false, error: 'Answer must be a string' };
      }
      if (answer.trim().length < 2) {
        return { valid: false, error: 'Answer is too short (minimum 2 characters)' };
      }
      if (answer.length > 1000) {
        return { valid: false, error: 'Answer is too long (maximum 1000 characters)' };
      }
      return { valid: true };

    case 'single_choice':
      if (typeof answer !== 'string') {
        return { valid: false, error: 'Answer must be a string' };
      }
      const validOptions = stepConfig.options.map((opt) => opt.value);
      if (!validOptions.includes(answer)) {
        return { valid: false, error: 'Invalid option selected' };
      }
      return { valid: true };

    case 'multiple_choice':
      if (!Array.isArray(answer)) {
        return { valid: false, error: 'Answer must be an array' };
      }
      if (answer.length === 0) {
        return { valid: false, error: 'At least one option must be selected' };
      }
      const validMultiOptions = stepConfig.options.map((opt) => opt.value);
      const invalidOption = answer.find((opt) => !validMultiOptions.includes(opt));
      if (invalidOption) {
        return { valid: false, error: `Invalid option: ${invalidOption}` };
      }
      return { valid: true };

    default:
      return { valid: false, error: 'Unknown question type' };
  }
}

/**
 * Get conversation progress
 * @param {string} currentStep - Current step name
 * @returns {object} Progress information { current: number, total: number, percentage: number }
 */
export function getConversationProgress(currentStep, pathKey = 'regular') {
  const list = PATHS[pathKey] || PATHS.regular;
  let currentIndex = list.indexOf(currentStep);
  // A step that isn't on the chosen path (e.g. a transient data_mode before
  // flow_path is decided) falls back to the regular superset for a sane number.
  if (currentIndex === -1) currentIndex = PATHS.regular.indexOf(currentStep);
  const total = list.length;

  return {
    current: currentIndex >= 0 ? currentIndex + 1 : 0,
    total,
    percentage: currentIndex >= 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0,
  };
}

/**
 * Get all conversation steps (for progress display)
 * @returns {array} Array of step names
 */
export function getAllSteps() {
  return Object.keys(CONVERSATION_STEPS);
}

/**
 * Format step for API response
 * @param {string} stepName - Step name
 * @returns {object} Formatted step data
 */
export function formatStepForResponse(stepName, lang = 'en', pathKey = 'regular') {
  const stepConfig = getStepConfig(stepName);

  if (!stepConfig) {
    return null;
  }

  const response = {
    step: stepName,
    // Localized display text (option VALUES stay constant; only labels translate).
    question: t(lang, `convo.q.${stepName}`),
    type: stepConfig.type,
  };

  if (stepConfig.options) {
    response.options = stepConfig.options.map((opt) => ({
      value: opt.value,
      label: t(lang, `convo.opt.${opt.value}_l`),
      description: t(lang, `convo.opt.${opt.value}_d`),
    }));
  }

  if (stepConfig.placeholder) {
    response.placeholder = t(lang, `convo.ph.${stepName}`);
  }

  response.progress = getConversationProgress(stepName, pathKey);

  return response;
}

/**
 * Build conversation summary from all answers
 * @param {array} conversations - Array of conversation entries with answers
 * @returns {object} Summary of all answers
 */
export function buildConversationSummary(conversations) {
  const summary = {};

  conversations.forEach((conv) => {
    if (conv.answer) {
      summary[conv.step_name] = conv.answer;
    }
  });

  return summary;
}
