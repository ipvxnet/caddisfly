// Admin revenue aggregations — read-only rollups from D1 for /admin/revenue.
// Stripe has no list API wired here; D1 is the source of truth (webhooks keep it
// current). MRR uses the known list prices below (estimate — annual subs are
// counted at their monthly-equivalent list price).

// Monthly list prices (USD) per paid tier — pricing decided at launch.
export const PLAN_USD = { starter: 9, pro: 19, agency: 49 };

const DAY = 86400;

async function rows(db, sql, ...binds) {
  const r = await db.prepare(sql).bind(...binds).all();
  return r.results || [];
}
async function one(db, sql, ...binds) {
  return (await db.prepare(sql).bind(...binds).first()) || {};
}

/**
 * Whole-panel rollup. cents-based sums stay in cents; the page formats.
 */
export async function getRevenueOverview(db) {
  const now = Math.floor(Date.now() / 1000);
  const cut30 = now - 30 * DAY;

  // --- Subscriptions (current state) ---
  const subsByTier = await rows(
    db,
    `SELECT pricing_tier AS tier, plan_interval AS interval, COUNT(*) AS n
       FROM billing_accounts
      WHERE subscription_status = 'active' AND pricing_tier != 'free_trial'
      GROUP BY pricing_tier, plan_interval`
  );
  const statusCounts = await rows(
    db,
    `SELECT subscription_status AS status, COUNT(*) AS n
       FROM billing_accounts
      WHERE pricing_tier != 'free_trial' AND subscription_status IS NOT NULL
      GROUP BY subscription_status`
  );
  const accountTotals = await one(
    db,
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN pricing_tier = 'free_trial' OR pricing_tier IS NULL THEN 1 ELSE 0 END) AS free,
       SUM(CASE WHEN cancel_at_period_end = 1 AND subscription_status = 'active' THEN 1 ELSE 0 END) AS canceling
       FROM billing_accounts`
  );

  // Per-tier active counts + est. MRR (monthly list price × active subs).
  const tierRollup = { starter: 0, pro: 0, agency: 0 };
  let activePaying = 0;
  for (const r of subsByTier) {
    if (tierRollup[r.tier] != null) tierRollup[r.tier] += r.n;
    activePaying += r.n;
  }
  const mrrCents = Object.entries(tierRollup).reduce((sum, [tier, n]) => sum + n * (PLAN_USD[tier] || 0) * 100, 0);

  // --- Domains (gross, wholesale cost, margin) ---
  const domAll = await one(
    db,
    `SELECT COUNT(*) AS n, COALESCE(SUM(price_cents),0) AS gross, COALESCE(SUM(wholesale_cents),0) AS cost
       FROM domain_orders WHERE status IN ('paid','registered')`
  );
  const dom30 = await one(
    db,
    `SELECT COUNT(*) AS n, COALESCE(SUM(price_cents),0) AS gross, COALESCE(SUM(wholesale_cents),0) AS cost
       FROM domain_orders WHERE status IN ('paid','registered') AND created_at >= ?`,
    cut30
  );

  // --- Commerce (merchant GMV — we take no platform fee yet) ---
  const gmvAll = await one(
    db,
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount_total),0) AS v FROM store_orders WHERE status IN ('paid','fulfilled')`
  );
  const gmv30 = await one(
    db,
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount_total),0) AS v FROM store_orders WHERE status IN ('paid','fulfilled') AND created_at >= ?`,
    cut30
  );

  // --- Credit packs (real ledger, migration 032) ---
  const credAll = await one(db, `SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents),0) AS v FROM credit_pack_purchases`);
  const cred30 = await one(db, `SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents),0) AS v FROM credit_pack_purchases WHERE created_at >= ?`, cut30);

  // Connected merchants (commerce enabled).
  const merchants = await one(db, `SELECT COUNT(*) AS n FROM ai_website_configs WHERE stripe_account_id != ''`);

  return {
    subscriptions: {
      activePaying,
      tierRollup,
      mrrCents,
      statusCounts,
      canceling: accountTotals.canceling || 0,
      freeTrial: accountTotals.free || 0,
      totalAccounts: accountTotals.total || 0,
    },
    domains: {
      all: { n: domAll.n || 0, gross: domAll.gross || 0, cost: domAll.cost || 0, margin: (domAll.gross || 0) - (domAll.cost || 0) },
      d30: { n: dom30.n || 0, gross: dom30.gross || 0, cost: dom30.cost || 0, margin: (dom30.gross || 0) - (dom30.cost || 0) },
    },
    commerce: { all: { n: gmvAll.n || 0, v: gmvAll.v || 0 }, d30: { n: gmv30.n || 0, v: gmv30.v || 0 }, merchants: merchants.n || 0 },
    credits: { all: { n: credAll.n || 0, v: credAll.v || 0 }, d30: { n: cred30.n || 0, v: cred30.v || 0 } },
  };
}

/**
 * Recent platform payments across domains, store orders, and credit packs.
 * Subscriptions aren't included (D1 holds current state, not per-invoice rows).
 */
export async function getRecentPayments(db, limit = 40) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100);
  return rows(
    db,
    `SELECT * FROM (
        SELECT created_at, 'domain' AS kind, customer_email AS email, price_cents AS amount_cents, domain AS detail, status
          FROM domain_orders WHERE status IN ('paid','registered')
        UNION ALL
        SELECT created_at, 'store' AS kind, customer_email AS email, amount_total AS amount_cents, '' AS detail, status
          FROM store_orders WHERE status IN ('paid','fulfilled')
        UNION ALL
        SELECT created_at, 'credit' AS kind, email, amount_cents, (credits || ' credits') AS detail, 'paid' AS status
          FROM credit_pack_purchases
     ) ORDER BY created_at DESC LIMIT ?`,
    lim
  );
}
