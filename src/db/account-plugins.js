// account_plugins — per-account plugin entitlements (migration 048). Mirrors
// Stripe subscription items; the billing webhook is the only writer in prod.
// See PLUGIN_PLATFORM_DESIGN.md.

/** Grace window: entitlement survives this long past current_period_end. */
export const PLUGIN_GRACE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** All entitlement rows for an account. */
export async function getAccountPlugins(db, email) {
  if (!email) return [];
  const { results } = await db
    .prepare('SELECT plugin_key, status, stripe_item_id, current_period_end FROM account_plugins WHERE email = ?')
    .bind(email)
    .all();
  return results || [];
}

/** One entitlement row, or null. */
export async function getAccountPlugin(db, email, pluginKey) {
  if (!email || !pluginKey) return null;
  return db
    .prepare('SELECT plugin_key, status, stripe_item_id, current_period_end FROM account_plugins WHERE email = ? AND plugin_key = ?')
    .bind(email, pluginKey)
    .first();
}

/**
 * Is an entitlement row currently valid (incl. 7-day grace past period end)?
 * `active` is always valid; `canceling`/`canceled` stay valid until
 * current_period_end + grace, after which the plugin's content is hidden.
 * @param {{status:string,current_period_end:number|null}|null} row
 * @param {number} nowSec - unix seconds
 */
export function isEntitlementValid(row, nowSec) {
  if (!row) return false;
  if (row.status === 'active') return true;
  return row.current_period_end != null && nowSec < row.current_period_end + PLUGIN_GRACE_SECONDS;
}

/**
 * Upsert an entitlement (webhook sync writer). Keyed on (email, plugin_key).
 * @param {object} db
 * @param {{email:string, pluginKey:string, status:string, stripeItemId?:string, currentPeriodEnd?:number|null}} p
 */
export async function upsertAccountPlugin(db, { email, pluginKey, status, stripeItemId = null, currentPeriodEnd = null }) {
  await db
    .prepare(
      `INSERT INTO account_plugins (email, plugin_key, status, stripe_item_id, current_period_end, updated_at)
       VALUES (?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(email, plugin_key) DO UPDATE SET
         status = excluded.status,
         stripe_item_id = excluded.stripe_item_id,
         current_period_end = excluded.current_period_end,
         updated_at = unixepoch()`
    )
    .bind(email, pluginKey, status, stripeItemId, currentPeriodEnd)
    .run();
}
