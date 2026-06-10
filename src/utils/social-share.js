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

import { callWorkersAI } from './ai-content-generator.js';
import { POLICY_INSTRUCTION } from './content-policy.js';
import { parseLabeled } from './blog-draft.js';
import { mdLiteExcerpt } from './md-lite.js';

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

/** AI-written announcements toggle (stored alongside the connections; default ON). */
export function aiCaptionsEnabled(conns) {
  return !conns || conns.ai_captions !== false;
}

// Per-platform prompt instructions + a hard cap on the returned text. The AI
// never writes the link — postToPlatform attaches it, so a hallucinated or
// truncated URL can't ship. Mastodon's cap leaves room for the URL within 500.
const VARIANT_SPECS = {
  discord: { cap: 1000, instruction: '1-2 energetic sentences for a community feed (the post title and link render separately, do not repeat them).' },
  slack: { cap: 600, instruction: '1-2 friendly, conversational sentences for a team channel.' },
  telegram: { cap: 900, instruction: 'a 1-3 sentence channel announcement; one emoji is fine.' },
  mastodon: { cap: 400, instruction: 'under 300 characters, conversational, ending with 1-3 relevant hashtags.' },
};

const VARIANT_LANG_NAMES = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

/**
 * One LLM call → platform-tuned announcement copy for the given platforms.
 * Returns { discord?, slack?, telegram?, mastodon? } (a platform may be missing
 * if its text came back empty), or null when the call fails or parses empty —
 * callers fall back to the plain template. Never throws.
 */
export async function generateAnnouncementVariants(env, { post, businessName, industry, language, platforms }) {
  try {
    const targets = (platforms || []).filter((p) => VARIANT_SPECS[p]);
    if (!targets.length) return null;
    const langName = VARIANT_LANG_NAMES[language] || 'English';
    const summary = (post.excerpt || mdLiteExcerpt(post.content || '') || '').slice(0, 500);

    const list = targets.map((p, i) => `${i + 1}. ${p.toUpperCase()}: ${VARIANT_SPECS[p].instruction}`).join('\n');
    const format = targets.map((p) => `${p.toUpperCase()}: the ${p} announcement`).join('\n');
    const prompt = `A small business ("${businessName}"${industry ? `, ${industry}` : ''}) just published this blog post:

Title: ${post.title}
Summary: ${summary}

Write a short announcement of the post for each channel below, ALL in ${langName}. Do NOT include any URL or link — the link is attached automatically. No quotation marks around the text.
${list}

Respond in EXACTLY this format (plain text, no JSON, no commentary, keep the uppercase labels):
${format}
${POLICY_INSTRUCTION}`;

    const raw = await callWorkersAI(env, prompt, { max_tokens: 700, temperature: 0.7, system_message: 'You are a social media copywriter for small businesses.' });
    const pack = parseLabeled(raw, targets.map((p) => p.toUpperCase()));
    if (!pack) return null;

    const out = {};
    for (const p of targets) {
      // Strip stray URL placeholders/quotes the model may add despite instructions.
      const text = String(pack[p] || '').replace(/\{URL\}/g, '').replace(/^["'“”]+|["'“”]+$/g, '').replace(/[ \t]{2,}/g, ' ').trim();
      if (text) out[p] = text.slice(0, VARIANT_SPECS[p].cap);
    }
    return Object.keys(out).length ? out : null;
  } catch (e) {
    console.error('announcement variants failed:', e.message);
    return null;
  }
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
function discordPayload({ title, excerpt, url, image }, variant) {
  return {
    embeds: [{
      title: String(title).slice(0, 256),
      description: String(variant || excerpt || '').slice(0, 2000),
      url,
      ...(image ? { image: { url: image } } : {}),
      color: 0x764ba2,
    }],
  };
}
// Slack / Telegram unfurl the link into a preview from the post's OG tags.
const lines = ({ title, excerpt, url }, sep = '\n') => `${title}${sep}${excerpt ? excerpt + sep : ''}${url}`;
// AI variant text never contains the link — attach it here, always.
const variantLines = (variant, url, sep = '\n') => `${variant}${sep}${url}`;

/**
 * Post one announcement to a platform. config is the stored connection object;
 * ann.variants may carry AI-written per-platform copy (each platform falls back
 * to the plain title+excerpt template when its variant is missing).
 */
export async function postToPlatform(platform, config, ann) {
  const v = (ann.variants && ann.variants[platform]) || '';
  if (platform === 'discord') return postJson(config.webhook, discordPayload(ann, v));
  if (platform === 'slack') return postJson(config.webhook, { text: v ? variantLines(v, ann.url) : lines(ann) });
  if (platform === 'telegram') {
    return postJson(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      chat_id: config.chat, text: v ? variantLines(v, ann.url) : lines(ann), disable_web_page_preview: false,
    });
  }
  if (platform === 'mastodon') {
    return postJson(`${config.instance}/api/v1/statuses`, { status: v ? variantLines(v, ann.url, '\n\n') : lines(ann, '\n\n') }, { Authorization: `Bearer ${config.token}` });
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
export async function sharePost(env, { config, post, liveUrl, variants }) {
  const conns = parseConnections(config);
  const ann = { ...buildAnnouncement(env, post, liveUrl), variants: variants || null };
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
