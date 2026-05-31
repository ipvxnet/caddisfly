// Router for Cloudflare Workers
// Supports route registration, path parameters, and middleware

export class Router {
  constructor() {
    this.routes = [];
  }

  /**
   * Register a route with handler and optional middleware
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} pattern - URL pattern (supports :param syntax)
   * @param {function} handler - Route handler function
   * @param {function[]} middleware - Array of middleware functions
   */
  register(method, pattern, handler, middleware = []) {
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      regex: this.patternToRegex(pattern),
      paramNames: this.extractParamNames(pattern),
      handler,
      middleware: Array.isArray(middleware) ? middleware : [middleware],
    });
  }

  /**
   * Convert URL pattern to regex for matching
   * @param {string} pattern - URL pattern
   * @returns {RegExp} Regular expression for matching
   */
  patternToRegex(pattern) {
    // Escape special regex characters except for :param
    let regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:(\w+)/g, '([^/]+)');

    // Ensure exact match
    regexPattern = `^${regexPattern}$`;

    return new RegExp(regexPattern);
  }

  /**
   * Extract parameter names from pattern
   * @param {string} pattern - URL pattern
   * @returns {string[]} Array of parameter names
   */
  extractParamNames(pattern) {
    const matches = pattern.matchAll(/:(\w+)/g);
    return Array.from(matches, match => match[1]);
  }

  /**
   * Match URL against route pattern and extract parameters
   * @param {string} url - URL to match
   * @param {object} route - Route object
   * @returns {object|null} Object with params if match, null otherwise
   */
  matchRoute(url, route) {
    const match = url.match(route.regex);
    if (!match) {
      return null;
    }

    const params = {};
    route.paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return { params };
  }

  /**
   * Route a request to the appropriate handler
   * @param {Request} request - Request object
   * @param {object} env - Environment bindings
   * @param {object} ctx - Execution context
   * @returns {Response} Response from handler
   */
  async route(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const pathname = url.pathname;

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method && route.method !== 'ALL') {
        continue;
      }

      const match = this.matchRoute(pathname, route);
      if (!match) {
        continue;
      }

      // Build request context
      const requestContext = {
        request,
        env,
        ctx,
        params: match.params,
        url,
        pathname,
        query: Object.fromEntries(url.searchParams),
      };

      try {
        // Execute middleware chain
        for (const middlewareFn of route.middleware) {
          const middlewareResult = await middlewareFn(requestContext);
          if (middlewareResult instanceof Response) {
            // Middleware returned a response (e.g., auth failed)
            return middlewareResult;
          }
          // Middleware can modify requestContext (e.g., add user)
        }

        // Execute handler
        return await route.handler(requestContext);
      } catch (error) {
        // Let global error handler catch this
        throw error;
      }
    }

    // No route matched
    return null;
  }

  /**
   * Convenience methods for common HTTP methods
   */
  get(pattern, handler, middleware = []) {
    this.register('GET', pattern, handler, middleware);
  }

  post(pattern, handler, middleware = []) {
    this.register('POST', pattern, handler, middleware);
  }

  put(pattern, handler, middleware = []) {
    this.register('PUT', pattern, handler, middleware);
  }

  delete(pattern, handler, middleware = []) {
    this.register('DELETE', pattern, handler, middleware);
  }

  all(pattern, handler, middleware = []) {
    this.register('ALL', pattern, handler, middleware);
  }
}
