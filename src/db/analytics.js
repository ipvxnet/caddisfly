// First-party, cookieless site analytics (see migrations/011_site_analytics.sql).
// Records one row per published-site pageview and aggregates it for the owner.

/** Insert a single pageview event. */
export async function recordEvent(db, e) {
  await db
    .prepare(
      `INSERT INTO site_events (public_id, day, path, referrer_host, country, device, visitor_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      e.public_id,
      e.day,
      e.path || '/',
      e.referrer_host || '',
      e.country || '',
      e.device || '',
      e.visitor_hash || '',
      e.created_at || Math.floor(Date.now() / 1000)
    )
    .run();
}

/**
 * Aggregate the last `days` of traffic for a site:
 * { totals:{views,uniques}, byDay:[{day,views,uniques}], topPaths, topReferrers, topCountries }.
 */
export async function getSiteAnalytics(db, publicId, days = 30) {
  const sinceTs = Math.floor(Date.now() / 1000) - days * 86400;

  const totals = await db
    .prepare(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS uniques
       FROM site_events WHERE public_id = ? AND created_at >= ?`
    )
    .bind(publicId, sinceTs)
    .first();

  const byDay = await db
    .prepare(
      `SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS uniques
       FROM site_events WHERE public_id = ? AND created_at >= ?
       GROUP BY day ORDER BY day ASC`
    )
    .bind(publicId, sinceTs)
    .all();

  const topPaths = await db
    .prepare(
      `SELECT path, COUNT(*) AS views FROM site_events
       WHERE public_id = ? AND created_at >= ?
       GROUP BY path ORDER BY views DESC LIMIT 8`
    )
    .bind(publicId, sinceTs)
    .all();

  const topReferrers = await db
    .prepare(
      `SELECT referrer_host, COUNT(*) AS views FROM site_events
       WHERE public_id = ? AND created_at >= ? AND referrer_host != ''
       GROUP BY referrer_host ORDER BY views DESC LIMIT 8`
    )
    .bind(publicId, sinceTs)
    .all();

  const topCountries = await db
    .prepare(
      `SELECT country, COUNT(*) AS views FROM site_events
       WHERE public_id = ? AND created_at >= ? AND country != ''
       GROUP BY country ORDER BY views DESC LIMIT 8`
    )
    .bind(publicId, sinceTs)
    .all();

  return {
    totals: { views: (totals && totals.views) || 0, uniques: (totals && totals.uniques) || 0 },
    byDay: byDay.results || [],
    topPaths: topPaths.results || [],
    topReferrers: topReferrers.results || [],
    topCountries: topCountries.results || [],
  };
}
