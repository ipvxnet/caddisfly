// Rate Limiter for AI Builder
// Protects against abuse and controls costs

/**
 * Rate limit tiers
 */
export const RATE_LIMITS = {
  free_trial: {
    projects_per_day: 2,
    requests_per_hour: 10,
    ai_generations_per_day: 5,
    enrichments_per_day: 2,
  },
  starter: {
    projects_per_day: 10,
    requests_per_hour: 50,
    ai_generations_per_day: 25,
    enrichments_per_day: 10,
  },
  pro: {
    projects_per_day: 50,
    requests_per_hour: 200,
    ai_generations_per_day: 100,
    enrichments_per_day: 50,
  },
  agency: {
    projects_per_day: 200,
    requests_per_hour: 500,
    ai_generations_per_day: 500,
    enrichments_per_day: 200,
  },
};

/**
 * Whether rate limits should be bypassed for this environment.
 * Limits protect production cost/abuse; in preview/development we disable them
 * so testing isn't throttled. Production (ENVIRONMENT='production') is unaffected.
 * @param {object} env - Environment bindings
 * @returns {boolean}
 */
export function limitsDisabled(env) {
  return !!env && env.ENVIRONMENT !== 'production';
}

/**
 * An "allowed" rate-limit result for when limits are bypassed.
 * @param {string} tier
 * @returns {object}
 */
export function unlimited(tier = 'free_trial') {
  const now = Math.floor(Date.now() / 1000);
  return { allowed: true, count: 0, remaining: 999999, limit: 999999, resetAt: now + 86400, tier };
}

/**
 * Check if user can create a new project
 * @param {object} db - D1 database
 * @param {string} email - User email
 * @param {string} tier - Pricing tier
 * @returns {object} { allowed: boolean, remaining: number, resetAt: number }
 */
export async function checkProjectCreationLimit(db, email, tier = 'free_trial') {
  const limits = RATE_LIMITS[tier];
  if (!limits) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  // Get start of today (UTC)
  const now = Math.floor(Date.now() / 1000);
  const startOfDay = Math.floor(now / 86400) * 86400;
  const resetAt = startOfDay + 86400;

  // Count projects created today
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM ai_projects WHERE customer_email = ? AND created_at >= ?')
    .bind(email, startOfDay)
    .first();

  const count = result?.count || 0;
  const remaining = Math.max(0, limits.projects_per_day - count);
  const allowed = count < limits.projects_per_day;

  return {
    allowed,
    count,
    remaining,
    limit: limits.projects_per_day,
    resetAt,
    tier,
  };
}

/**
 * Check if user can make API requests (general rate limit)
 * @param {object} db - D1 database
 * @param {string} email - User email
 * @param {string} tier - Pricing tier
 * @returns {object} { allowed: boolean, remaining: number, resetAt: number }
 */
export async function checkRequestRateLimit(db, email, tier = 'free_trial') {
  const limits = RATE_LIMITS[tier];
  if (!limits) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const oneHourAgo = now - 3600;
  const resetAt = now + 3600;

  // Count conversation responses in the last hour (as proxy for API requests)
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count
       FROM ai_conversations c
       JOIN ai_projects p ON c.ai_project_id = p.id
       WHERE p.customer_email = ? AND c.answered_at >= ?`
    )
    .bind(email, oneHourAgo)
    .first();

  const count = result?.count || 0;
  const remaining = Math.max(0, limits.requests_per_hour - count);
  const allowed = count < limits.requests_per_hour;

  return {
    allowed,
    count,
    remaining,
    limit: limits.requests_per_hour,
    resetAt,
    tier,
  };
}

/**
 * Check if user can generate AI content
 * @param {object} db - D1 database
 * @param {string} email - User email
 * @param {string} tier - Pricing tier
 * @returns {object} { allowed: boolean, remaining: number, resetAt: number }
 */
export async function checkAIGenerationLimit(db, email, tier = 'free_trial') {
  const limits = RATE_LIMITS[tier];
  if (!limits) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const startOfDay = Math.floor(now / 86400) * 86400;
  const resetAt = startOfDay + 86400;

  // Count projects that have generated content today
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count
       FROM ai_projects
       WHERE customer_email = ?
       AND created_at >= ?
       AND status IN ('preview_ready', 'customizing', 'deployed')`
    )
    .bind(email, startOfDay)
    .first();

  const count = result?.count || 0;
  const remaining = Math.max(0, limits.ai_generations_per_day - count);
  const allowed = count < limits.ai_generations_per_day;

  return {
    allowed,
    count,
    remaining,
    limit: limits.ai_generations_per_day,
    resetAt,
    tier,
  };
}

/**
 * Check if user can run a paid Google Places enrichment today.
 * Primary cost control for the gated refactoring flow. Counts enrichments
 * already attempted today (verified projects whose enrichment ran), keyed on
 * the refactoring `projects` table by email.
 * @param {object} db - D1 database
 * @param {string} email - User email
 * @param {string} tier - Pricing tier
 * @returns {object} { allowed, count, remaining, limit, resetAt, tier }
 */
export async function checkEnrichmentLimit(db, email, tier = 'free_trial') {
  const limits = RATE_LIMITS[tier];
  if (!limits) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const startOfDay = Math.floor(now / 86400) * 86400;
  const resetAt = startOfDay + 86400;

  // Count paid enrichment attempts today: verified projects where enrichment
  // has progressed past 'pending' (running/complete/no_match/failed).
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count
       FROM projects
       WHERE customer_email = ?
       AND verified_at >= ?
       AND enrichment_status IS NOT NULL
       AND enrichment_status != 'pending'`
    )
    .bind(email, startOfDay)
    .first();

  const count = result?.count || 0;
  const remaining = Math.max(0, limits.enrichments_per_day - count);
  const allowed = count < limits.enrichments_per_day;

  return {
    allowed,
    count,
    remaining,
    limit: limits.enrichments_per_day,
    resetAt,
    tier,
  };
}

/**
 * Get user's pricing tier from project or email
 * @param {object} db - D1 database
 * @param {string} email - User email
 * @returns {string} Pricing tier
 */
export async function getUserTier(db, email) {
  // Check if user has any paid projects
  const result = await db
    .prepare(
      `SELECT pricing_tier
       FROM ai_projects
       WHERE customer_email = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(email)
    .first();

  return result?.pricing_tier || 'free_trial';
}

/**
 * Format rate limit error response
 * @param {object} limitInfo - Rate limit info
 * @param {string} limitType - Type of limit (projects, requests, generations)
 * @returns {object} Error response object
 */
export function formatRateLimitError(limitInfo, limitType = 'requests') {
  const resetDate = new Date(limitInfo.resetAt * 1000);
  const resetTime = resetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const messages = {
    projects: `Daily project limit reached (${limitInfo.limit} projects per day on ${limitInfo.tier} tier). Resets at ${resetTime}.`,
    requests: `Hourly request limit reached (${limitInfo.limit} requests per hour on ${limitInfo.tier} tier). Try again in a few minutes.`,
    generations: `Daily AI generation limit reached (${limitInfo.limit} generations per day on ${limitInfo.tier} tier). Resets at ${resetTime}.`,
    enrichments: `Daily limit reached (${limitInfo.limit} site builds per day on ${limitInfo.tier} tier). Resets at ${resetTime}.`,
  };

  return {
    success: false,
    error: messages[limitType] || 'Rate limit exceeded',
    rate_limit: {
      exceeded: true,
      limit: limitInfo.limit,
      remaining: 0,
      resetAt: limitInfo.resetAt,
      tier: limitInfo.tier,
    },
    upgrade_message: limitInfo.tier === 'free_trial' ? 'Upgrade to a paid plan for higher limits.' : null,
  };
}

/**
 * Add rate limit headers to response
 * @param {Response} response - Original response
 * @param {object} limitInfo - Rate limit info
 * @returns {Response} Response with rate limit headers
 */
export function addRateLimitHeaders(response, limitInfo) {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', limitInfo.limit.toString());
  headers.set('X-RateLimit-Remaining', limitInfo.remaining.toString());
  headers.set('X-RateLimit-Reset', limitInfo.resetAt.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
