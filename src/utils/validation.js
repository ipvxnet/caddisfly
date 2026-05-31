// Input validation utilities

/**
 * Validate email address
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email regex - matches most common email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate project input for creating a preview
 * @param {object} data - Project data to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateProjectInput(data) {
  const errors = [];

  if (!data.customerEmail || !isValidEmail(data.customerEmail)) {
    errors.push('Valid customer email is required');
  }

  if (!data.originalUrl || !isValidUrl(data.originalUrl)) {
    errors.push('Valid website URL is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize string input to prevent XSS
 * @param {string} input - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate preview ID format
 * @param {string} previewId - Preview ID to validate
 * @returns {boolean} True if valid preview ID
 */
export function isValidPreviewId(previewId) {
  if (!previewId || typeof previewId !== 'string') {
    return false;
  }

  // Preview IDs should be alphanumeric and a reasonable length
  const previewIdRegex = /^[a-zA-Z0-9_-]{8,64}$/;
  return previewIdRegex.test(previewId);
}

/**
 * Validate pricing tier
 * @param {string} tier - Pricing tier to validate
 * @returns {boolean} True if valid tier
 */
export function isValidPricingTier(tier) {
  const validTiers = ['plus', 'premium'];
  return validTiers.includes(tier);
}
