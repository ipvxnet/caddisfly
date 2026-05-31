// Query builder utility for flexible database queries

export class QueryBuilder {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.whereClauses = [];
    this.whereBindings = [];
    this.orderByClause = null;
    this.limitValue = null;
    this.offsetValue = null;
  }

  /**
   * Add WHERE condition
   * @param {string} field - Field name
   * @param {string} operator - Comparison operator (=, !=, >, <, >=, <=, LIKE)
   * @param {any} value - Value to compare
   * @returns {QueryBuilder} This instance for chaining
   */
  where(field, operator, value) {
    this.whereClauses.push(`${field} ${operator} ?`);
    this.whereBindings.push(value);
    return this;
  }

  /**
   * Add ORDER BY clause
   * @param {string} field - Field name
   * @param {string} direction - Sort direction (ASC or DESC)
   * @returns {QueryBuilder} This instance for chaining
   */
  orderBy(field, direction = 'ASC') {
    this.orderByClause = `ORDER BY ${field} ${direction.toUpperCase()}`;
    return this;
  }

  /**
   * Add LIMIT clause
   * @param {number} limit - Maximum number of rows
   * @returns {QueryBuilder} This instance for chaining
   */
  limit(limit) {
    this.limitValue = limit;
    return this;
  }

  /**
   * Add OFFSET clause
   * @param {number} offset - Number of rows to skip
   * @returns {QueryBuilder} This instance for chaining
   */
  offset(offset) {
    this.offsetValue = offset;
    return this;
  }

  /**
   * Build and execute query to get all results
   * @returns {array} Array of results
   */
  async get() {
    let query = `SELECT * FROM ${this.table}`;

    if (this.whereClauses.length > 0) {
      query += ` WHERE ${this.whereClauses.join(' AND ')}`;
    }

    if (this.orderByClause) {
      query += ` ${this.orderByClause}`;
    }

    if (this.limitValue !== null) {
      query += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== null) {
      query += ` OFFSET ${this.offsetValue}`;
    }

    const result = await this.db
      .prepare(query)
      .bind(...this.whereBindings)
      .all();

    return result.results || [];
  }

  /**
   * Build and execute query to get first result
   * @returns {object|null} First result or null
   */
  async first() {
    this.limit(1);
    const results = await this.get();
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Build and execute COUNT query
   * @returns {number} Count of matching rows
   */
  async count() {
    let query = `SELECT COUNT(*) as total FROM ${this.table}`;

    if (this.whereClauses.length > 0) {
      query += ` WHERE ${this.whereClauses.join(' AND ')}`;
    }

    const result = await this.db
      .prepare(query)
      .bind(...this.whereBindings)
      .first();

    return result?.total || 0;
  }
}
