// Transaction utilities for D1 database

/**
 * Execute multiple queries in a batch
 * Note: D1 doesn't support traditional transactions, but batch() ensures atomicity
 * @param {object} db - D1 database instance
 * @param {array} queries - Array of { sql, bindings } objects
 * @returns {array} Results from all queries
 */
export async function batchExecute(db, queries) {
  const statements = queries.map(({ sql, bindings }) =>
    db.prepare(sql).bind(...(bindings || []))
  );

  const results = await db.batch(statements);
  return results;
}

/**
 * Execute a function with transaction-like behavior
 * Note: This is a wrapper for batch execution, not a true transaction
 * @param {object} db - D1 database instance
 * @param {function} fn - Function that returns array of query objects
 * @returns {any} Result from the function
 */
export async function withTransaction(db, fn) {
  try {
    const queries = await fn();

    if (!Array.isArray(queries)) {
      throw new Error('Transaction function must return an array of queries');
    }

    return await batchExecute(db, queries);
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

/**
 * Example usage:
 *
 * await withTransaction(db, async () => [
 *   {
 *     sql: 'INSERT INTO users (email, name) VALUES (?, ?)',
 *     bindings: ['test@example.com', 'Test User']
 *   },
 *   {
 *     sql: 'INSERT INTO sessions (user_id, token) VALUES (?, ?)',
 *     bindings: [1, 'token123']
 *   }
 * ]);
 */
