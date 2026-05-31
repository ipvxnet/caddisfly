// Global error handler middleware

import { internalServerError } from '../utils/response.js';
import { getConfig } from '../utils/constants.js';

/**
 * Global error handler
 * Catches unhandled errors and returns appropriate responses
 * @param {Error} error - Error object
 * @param {object} request - Request object
 * @param {object} env - Environment bindings
 * @returns {Response} Error response
 */
export function handleError(error, request, env) {
  console.error('Unhandled error:', error);

  const config = getConfig(env);
  const acceptsJson = request.headers.get('Accept')?.includes('application/json');

  return internalServerError(
    'An unexpected error occurred',
    acceptsJson,
    config.isDev,
    error
  );
}

/**
 * Wrap an async handler with error handling
 * @param {function} handler - Async handler function
 * @returns {function} Wrapped handler
 */
export function withErrorHandling(handler) {
  return async (ctx) => {
    try {
      return await handler(ctx);
    } catch (error) {
      return handleError(error, ctx.request, ctx.env);
    }
  };
}
