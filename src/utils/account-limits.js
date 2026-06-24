// Account-level limit status — used for the over-limit (downgrade) banner.
//
// Plan downgrades happen inside Stripe's hosted billing portal, so we can't
// reject the change at click-time. Instead we (a) hard-block NEW publishes once
// owned+managed published sites reach the cap (see deploy.js) and (b) surface an
// over-limit banner here so an account that downgraded (or received a transfer)
// while over the cap knows to unpublish or re-upgrade. Live sites are never
// auto-unpublished — that would be destructive.

import { PUBLISH_LIMITS } from './credits.js';
import { countPublishedSites } from '../db/billing.js';
import { countManagedPublishedSites } from '../db/site-transfer.js';

/**
 * Compute whether an account is over its published-site cap.
 * publishedCount = owned deployed sites + managed (per-site delegate) deployed
 * sites — the same total the publish gate enforces.
 * @returns {{tier, limit, count, over, overBy}}
 */
export async function accountLimitStatus(db, email, tier) {
  const limit = PUBLISH_LIMITS[tier] != null ? PUBLISH_LIMITS[tier] : 1;
  if (limit === Infinity) return { tier, limit, count: 0, over: false, overBy: 0 };
  const [owned, managed] = await Promise.all([
    countPublishedSites(db, email),
    countManagedPublishedSites(db, email),
  ]);
  const count = owned + managed;
  const over = count > limit;
  return { tier, limit, count, over, overBy: over ? count - limit : 0 };
}
