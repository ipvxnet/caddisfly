// Caddisfly Constants and Configuration

// Pricing tiers
export const PRICING_TIERS = {
  PLUS: 'plus',
  PREMIUM: 'premium',
};

export const PRICING_CONFIG = {
  [PRICING_TIERS.PLUS]: {
    name: 'Plus',
    price: 499, // $4.99 in cents
    pageLimit: 10,
    portfolio: false,
  },
  [PRICING_TIERS.PREMIUM]: {
    name: 'Premium',
    price: 999, // $9.99 in cents
    pageLimit: 20,
    portfolio: true,
  },
};

// Project status
export const PROJECT_STATUS = {
  PREVIEW_PENDING: 'preview_pending',
  PREVIEW_READY: 'preview_ready',
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_COMPLETE: 'payment_complete',
  PROCESSING: 'processing',
  DNS_PENDING: 'dns_pending',
  ACTIVE: 'active',
  FAILED: 'failed',
};

// DNS status
export const DNS_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
};

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
};

// Session configuration
export const SESSION_DURATION_HOURS = 168; // 7 days

// Preview limits
export const PREVIEW_PAGE_LIMIT = 2;

/**
 * Get environment-aware configuration
 * @param {object} env - Environment bindings from Cloudflare Workers
 * @returns {object} Configuration object
 */
export function getConfig(env) {
  const isDev = env.ENVIRONMENT === 'development';

  return {
    appUrl: env.APP_URL || (isDev ? 'http://localhost:8787' : 'https://caddisfly.ai'),
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI || (isDev
      ? 'http://localhost:8787/auth/google/callback'
      : 'https://caddisfly.ai/auth/google/callback'),
    sessionDurationHours: parseInt(env.SESSION_DURATION_HOURS || SESSION_DURATION_HOURS),
    environment: env.ENVIRONMENT || 'development',
    isDev,
    isProd: !isDev,
  };
}
