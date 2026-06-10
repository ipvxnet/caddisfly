// Social syndication (webhook-tier) — announce a published blog post to the
// owner's connected accounts. No OAuth, no app review: the owner pastes a
// webhook URL (Discord/Slack) or a token (Telegram/Mastodon).
//
// Connections are stored as JSON on the site config (social_connections_json),
// one entry per connected platform:
//   discord:  { webhook }
//   slack:    { webhook }
//   telegram: { token, chat }      // bot token + chat/channel id (@name or -100…)
//   mastodon: { instance, token }  // https://instance + access token

export const SOCIAL_PLATFORMS = ['discord', 'slack', 'telegram', 'mastodon'];

// Fields each platform stores / collects from the settings form. The settings
// API + UI use flat `${platform}_${field}` body keys (e.g. telegram_token).
export const PLATFORM_FIELDS = {
  discord: ['webhook'],
  slack: ['webhook'],
  telegram: ['token', 'chat'],
  mastodon: ['instance', 'token'],
};

/** Pull a platform's raw field values out of a flat request body. */
export function fieldsFromBody(platform, body) {
  const out = {};
  for (const f of PLATFORM_FIELDS[platform] || []) {
    out[f] = body && body[`${platform}_${f}`] != null ? String(body[`${platform}_${f}`]).trim() : '';
  }
  return out;
}

// Reject obviously-internal hosts (light SSRF hygiene for the Mastodon instance,
// the only platform where the host is fully owner-supplied).
function isPublicHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h.includes('.')) return false;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}

/**
 * Validate one platform's fields. Returns { ok, value } where value is the
 * config object to store (or null to REMOVE when all fields are blank), or
 * { ok:false, error }.
 */
export function validateConnection(platform, fields) {
  const f = fields || {};
  const req = PLATFORM_FIELDS[platform] || [];
  const filled = req.filter((k) => (f[k] || '').trim());
  if (filled.length === 0) return { ok: true, value: null }; // remove
  if (filled.length < req.length) return { ok: false, error: 'Fill in all fields for this platform (or clear them all to disconnect).' };

  if (platform === 'discord' || platform === 'slack') {
    let u;
    try { u = new URL(f.webhook); } catch { return { ok: false, error: 'Enter a valid URL.' }; }
    if (u.protocol !== 'https:') return { ok: false, error: 'Webhook URL must start with https://' };
    if (platform === 'discord') {
      const okHost = /^(canary\.|ptb\.)?discord(app)?\.com$/.test(u.hostname);
      if (!okHost || !u.pathname.startsWith('/api/webhooks/')) return { ok: false, error: "That doesn't look like a Discord webhook URL." };
    } else if (u.hostname !== 'hooks.slack.com' || !u.pathname.startsWith('/services/')) {
      return { ok: false, error: "That doesn't look like a Slack webhook URL." };
    }
    return { ok: true, value: { webhook: f.webhook } };
  }

  if (platform === 'telegram') {
    if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(f.token)) return { ok: false, error: 'That bot token looks wrong — get it from @BotFather (e.g. 123456789:AA…).' };
    const chat = f.chat.replace(/\s+/g, '');
    if (!/^(@[A-Za-z0-9_]{4,}|-?\d{3,})$/.test(chat)) return { ok: false, error: 'Chat must be a @channelusername or a numeric chat id.' };
    return { ok: true, value: { token: f.token, chat } };
  }

  if (platform === 'mastodon') {
    let u;
    try { u = new URL(f.instance); } catch { return { ok: false, error: 'Enter your Mastodon instance URL (e.g. https://mastodon.social).' }; }
    if (u.protocol !== 'https:' || !isPublicHost(u.hostname)) return { ok: false, error: 'Instance must be a public https:// URL.' };
    if (f.token.length < 16 || /\s/.test(f.token)) return { ok: false, error: 'That access token looks wrong — create one in Preferences → Development.' };
    return { ok: true, value: { instance: `https://${u.hostname}`, token: f.token } };
  }

  return { ok: false, error: 'Unknown platform.' };
}

/** Parse the connections blob off a site config row (safe). */
export function parseConnections(config) {
  try { return JSON.parse((config && config.social_connections_json) || '{}') || {}; } catch { return {}; }
}

/** Platforms with a COMPLETE config. */
export function enabledPlatforms(conns) {
  return SOCIAL_PLATFORMS.filter((p) => {
    const c = conns && conns[p];
    return c && (PLATFORM_FIELDS[p] || []).every((f) => c[f]);
  });
}

async function postJson(url, payload, headers = {}) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status} ${detail.slice(0, 140)}`.trim() };
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
// Slack / Telegram unfurl the link into a preview from the post's OG tags.
const lines = ({ title, excerpt, url }, sep = '\n') => `${title}${sep}${excerpt ? excerpt + sep : ''}${url}`;

/** Post one announcement to a platform. config is the stored connection object. */
export async function postToPlatform(platform, config, ann) {
  if (platform === 'discord') return postJson(config.webhook, discordPayload(ann));
  if (platform === 'slack') return postJson(config.webhook, { text: lines(ann) });
  if (platform === 'telegram') {
    return postJson(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      chat_id: config.chat, text: lines(ann), disable_web_page_preview: false,
    });
  }
  if (platform === 'mastodon') {
    return postJson(`${config.instance}/api/v1/statuses`, { status: lines(ann, '\n\n') }, { Authorization: `Bearer ${config.token}` });
  }
  return { ok: false, error: 'Unknown platform' };
}

/** Build the announcement payload from a post + its live URL. */
export function buildAnnouncement(env, post, liveUrl) {
  const ci = (post && post.cover_image) || '';
  const image = ci ? (/^https?:\/\//.test(ci) ? ci : `${env.APP_URL || ''}${ci}`) : '';
  return { title: post.title || 'New post', excerpt: post.excerpt || '', url: liveUrl, image };
}

/**
 * Share one post to every enabled platform. Fire-and-forget per platform — one
 * platform failing never blocks the others. Returns [{platform, ok, error?}].
 */
export async function sharePost(env, { config, post, liveUrl }) {
  const conns = parseConnections(config);
  const ann = buildAnnouncement(env, post, liveUrl);
  const out = [];
  for (const p of enabledPlatforms(conns)) {
    const r = await postToPlatform(p, conns[p], ann);
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
