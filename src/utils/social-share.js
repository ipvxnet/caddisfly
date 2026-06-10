// Social syndication (P3, webhook-tier) — post a published blog post to the
// owner's connected Discord/Slack incoming webhooks. No OAuth, no app review:
// the owner pastes a webhook URL, we POST a JSON announcement to it.
//
// Connections are stored as JSON on the site config (social_connections_json):
//   { "discord": { "webhook": "https://discord.com/api/webhooks/…" },
//     "slack":   { "webhook": "https://hooks.slack.com/services/…" } }

export const SOCIAL_PLATFORMS = ['discord', 'slack'];

/**
 * Validate a webhook URL for a platform. Returns { ok, value } or { ok:false,
 * error }. Empty string is valid (means "remove this connection"). The host
 * checks double as a light SSRF guard — we only ever POST to the platform hosts.
 */
export function validateWebhook(platform, url) {
  const u = String(url || '').trim();
  if (!u) return { ok: true, value: '' };
  let parsed;
  try { parsed = new URL(u); } catch { return { ok: false, error: 'Enter a valid URL.' }; }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'Webhook URL must start with https://' };
  if (platform === 'discord') {
    const okHost = /^(canary\.|ptb\.)?discord(app)?\.com$/.test(parsed.hostname);
    if (!okHost || !parsed.pathname.startsWith('/api/webhooks/')) {
      return { ok: false, error: "That doesn't look like a Discord webhook URL." };
    }
  } else if (platform === 'slack') {
    if (parsed.hostname !== 'hooks.slack.com' || !parsed.pathname.startsWith('/services/')) {
      return { ok: false, error: "That doesn't look like a Slack webhook URL." };
    }
  } else {
    return { ok: false, error: 'Unknown platform.' };
  }
  return { ok: true, value: u };
}

/** Parse the connections blob off a site config row (safe). */
export function parseConnections(config) {
  try { return JSON.parse((config && config.social_connections_json) || '{}') || {}; } catch { return {}; }
}

/** Platforms that have a webhook configured. */
export function enabledPlatforms(conns) {
  return SOCIAL_PLATFORMS.filter((p) => conns && conns[p] && conns[p].webhook);
}

async function postJson(url, payload) {
  try {
    const res = await fetch(String(url).trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status} ${body.slice(0, 140)}`.trim() };
  } catch (e) {
    return { ok: false, error: e.message || 'Network error' };
  }
}

// Discord renders a rich embed card (title links out, cover image inline).
function discordPayload({ title, excerpt, url, image }) {
  return {
    embeds: [{
      title: String(title).slice(0, 256),
      description: String(excerpt || '').slice(0, 2000),
      url,
      ...(image ? { image: { url: image } } : {}),
      color: 0x764ba2,
    }],
  };
}
// Slack unfurls the link into a preview from the post's own OG tags.
function slackPayload({ title, excerpt, url }) {
  return { text: `*${title}*\n${excerpt ? `${excerpt}\n` : ''}${url}` };
}

export async function postToPlatform(platform, webhook, ann) {
  if (platform === 'discord') return postJson(webhook, discordPayload(ann));
  if (platform === 'slack') return postJson(webhook, slackPayload(ann));
  return { ok: false, error: 'Unknown platform' };
}

/** Build the announcement payload from a post + its live URL. */
export function buildAnnouncement(env, post, liveUrl) {
  const ci = (post && post.cover_image) || '';
  const image = ci ? (/^https?:\/\//.test(ci) ? ci : `${env.APP_URL || ''}${ci}`) : '';
  return { title: post.title || 'New post', excerpt: post.excerpt || '', url: liveUrl, image };
}

/**
 * Share one post to every enabled platform. Fire-and-forget per platform —
 * one platform failing never blocks the others. Returns [{platform, ok, error?}].
 */
export async function sharePost(env, { config, post, liveUrl }) {
  const conns = parseConnections(config);
  const ann = buildAnnouncement(env, post, liveUrl);
  const out = [];
  for (const p of enabledPlatforms(conns)) {
    const r = await postToPlatform(p, conns[p].webhook, ann);
    out.push({ platform: p, ...r });
  }
  return out;
}

/** Live URL for a published post (bare subdomain + env preview suffix). */
export function buildLiveUrl(env, subdomain, slug) {
  const base = env.SITES_BASE || 'caddisfly.app';
  const host = `${subdomain}${env.SITES_PREVIEW_SUFFIX || ''}.${base}`;
  return `https://${host}/blog/${slug}`;
}
