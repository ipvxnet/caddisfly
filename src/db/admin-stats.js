// Cross-customer aggregates for the SaaS admin dashboard. Read-only; targeted
// SQL (no per-row N+1). All counts span ai_projects + projects (the two site
// tables) and billing_accounts.

/** Platform-wide headline metrics. */
export async function getPlatformMetrics(db) {
  const one = async (sql) => (await db.prepare(sql).first()) || {};

  const customers = await one(
    `SELECT COUNT(DISTINCT email) AS n FROM (
       SELECT email FROM billing_accounts
       UNION SELECT customer_email AS email FROM ai_projects
       UNION SELECT customer_email AS email FROM projects
     )`
  );
  const paid = await one(
    `SELECT COUNT(*) AS n FROM billing_accounts WHERE subscription_status = 'active' AND pricing_tier != 'free_trial'`
  );
  const sites = await one(
    `SELECT
       (SELECT COUNT(*) FROM ai_projects) + (SELECT COUNT(*) FROM projects) AS total,
       (SELECT COUNT(*) FROM ai_projects WHERE status='deployed') + (SELECT COUNT(*) FROM projects WHERE status='deployed') AS deployed`
  );
  const domains = await one(`SELECT COUNT(*) AS n FROM custom_domains WHERE status='active'`);
  const views = await one(
    `SELECT COUNT(*) AS n FROM site_events WHERE day >= strftime('%Y-%m-%d','now','-30 days')`
  );
  const byTier = await db
    .prepare(`SELECT pricing_tier AS tier, COUNT(*) AS n FROM billing_accounts GROUP BY pricing_tier`)
    .all();

  return {
    customers: customers.n || 0,
    activeSubs: paid.n || 0,
    totalSites: sites.total || 0,
    deployedSites: sites.deployed || 0,
    activeDomains: domains.n || 0,
    views30d: views.n || 0,
    byTier: (byTier.results || []).reduce((m, r) => ((m[r.tier] = r.n), m), {}),
  };
}

/**
 * One row per customer email, with billing + site + team stats. Anchored on the
 * set of all known emails (billing accounts ∪ site owners) so customers without
 * a billing row (free, never upgraded) still appear.
 */
export async function getCustomerRows(db) {
  const { results } = await db
    .prepare(
      `WITH emails AS (
         SELECT email FROM billing_accounts
         UNION SELECT customer_email FROM ai_projects
         UNION SELECT customer_email FROM projects
       )
       SELECT
         e.email AS email,
         b.pricing_tier AS pricing_tier,
         b.subscription_status AS subscription_status,
         b.plan_interval AS plan_interval,
         b.current_period_end AS current_period_end,
         b.ai_credits_used AS ai_credits_used,
         COALESCE((SELECT COUNT(*) FROM ai_projects a WHERE a.customer_email = e.email), 0)
           + COALESCE((SELECT COUNT(*) FROM projects p WHERE p.customer_email = e.email), 0) AS sites,
         COALESCE((SELECT COUNT(*) FROM ai_projects a WHERE a.customer_email = e.email AND a.status='deployed'), 0)
           + COALESCE((SELECT COUNT(*) FROM projects p WHERE p.customer_email = e.email AND p.status='deployed'), 0) AS deployed,
         1 + COALESCE((SELECT COUNT(*) FROM team_members t WHERE t.owner_email = e.email), 0) AS team_size
       FROM emails e
       LEFT JOIN billing_accounts b ON b.email = e.email
       ORDER BY sites DESC, e.email ASC`
    )
    .all();
  return results || [];
}
