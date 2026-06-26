// Public proxy for a merchant's Behold.so Instagram feed (Instagram Feed plugin).
//
//   GET /api/instagram/feed?feed=<beholdId>&n=<count>
//
// The instagram_feed section's client JS calls this from the published site so
// the feed stays fresh WITHOUT a republish. Behold feeds are public + keyless
// (https://feeds.behold.so/{feedId}); we normalize + cap the posts and lean on
// Cloudflare's edge cache (cf.cacheTtl) to be polite to Behold's free tier
// (~6 posts, refreshes ~daily). No auth, no DB, no per-site config — the feed
// id travels in the section content_json. CORS is applied globally in index.js.

import { jsonResponse } from '../../utils/response.js';

// Behold feed ids are short url-safe tokens. Constrain to avoid SSRF / abuse.
const FEED_RE = /^[A-Za-z0-9_-]{4,64}$/;

export async function handleInstagramFeed(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);
  const feed = (url.searchParams.get('feed') || '').trim();
  const n = Math.min(Math.max(parseInt(url.searchParams.get('n'), 10) || 6, 1), 24);

  if (!FEED_RE.test(feed)) {
    return jsonResponse({ posts: [], error: 'invalid_feed' }, 400);
  }

  try {
    const res = await fetch(`https://feeds.behold.so/${feed}`, {
      headers: { accept: 'application/json' },
      // Edge-cache the upstream feed for 30 min (Behold refreshes ~daily anyway).
      cf: { cacheTtl: 1800, cacheEverything: true },
    });
    if (!res.ok) {
      // Don't leak Behold's status as our own error — return an empty feed so
      // the section just hides itself gracefully on the live site.
      return jsonResponse({ posts: [], error: 'feed_unavailable' }, 200);
    }
    const data = await res.json().catch(() => ({}));
    const raw = Array.isArray(data && data.posts) ? data.posts : [];
    const posts = raw.slice(0, n).map((p) => {
      const sizes = (p && p.sizes) || {};
      const image =
        (sizes.medium && sizes.medium.mediaUrl) ||
        (sizes.small && sizes.small.mediaUrl) ||
        p.thumbnailUrl ||
        p.mediaUrl ||
        '';
      return {
        permalink: p.permalink || '',
        image,
        alt: p.altText || p.prunedCaption || p.caption || '',
        video: p.mediaType === 'VIDEO',
      };
    }).filter((p) => p.image && p.permalink);

    return jsonResponse({ posts, username: (data && data.username) || '' }, 200, {
      // App-level cache header so repeated client fetches are cheap.
      'Cache-Control': 'public, max-age=900',
    });
  } catch (e) {
    return jsonResponse({ posts: [], error: 'fetch_failed' }, 200);
  }
}
