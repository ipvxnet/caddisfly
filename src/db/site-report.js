// Site report data layer.
//  - scanExternalDeps: walk the site's own data (sections + products + config)
//    and surface every EXTERNAL (third-party) URL it depends on for content —
//    hotlinked images, external PDFs/videos, off-site links. Computed live.
//  - runPageSpeed: PageSpeed Insights (Lighthouse) for mobile + desktop.
//  - get/saveSpeedReport: cache the latest PSI run (migration 064).

import { keyCol } from './bridge.js';
import { getSiteSections } from './ai-sections.js';
import { getProductsByProject } from './products.js';
import { getOrCreateConfig } from '../routes/api/ai-builder/store.js';
import { getDomainsByProject } from './custom-domains.js';

const URL_RE = /\bhttps?:\/\/[^\s"'<>)\]}\\]+/gi;
const trimUrl = (u) => u.replace(/[).,;:'"]+$/, '');

/** Recursively collect URL strings from any JSON value into `out`. */
function collectUrls(value, out) {
  if (value == null) return;
  if (typeof value === 'string') {
    const m = value.match(URL_RE);
    if (m) for (const u of m) out.push(trimUrl(u));
  } else if (Array.isArray(value)) {
    for (const v of value) collectUrls(v, out);
  } else if (typeof value === 'object') {
    for (const v of Object.values(value)) collectUrls(v, out);
  }
}

function parse(json) { try { return JSON.parse(json || '{}'); } catch { return {}; } }

/** Classify an external URL into a content-dependency kind. */
function classify(url) {
  const u = url.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif|svg)(\?|#|$)/.test(u) || /\b(images\.unsplash|images\.pexels|cloudinary|imgix|gravatar)\b/.test(u)) return 'image';
  if (/\b(youtube\.com|youtu\.be|vimeo\.com)\b/.test(u) || /\.(mp4|webm|mov|m3u8)(\?|#|$)/.test(u)) return 'video';
  if (/\.pdf(\?|#|$)/.test(u)) return 'pdf';
  if (/\.(woff2?|ttf|otf|eot)(\?|#|$)/.test(u)) return 'font';
  if (/\.js(\?|#|$)/.test(u)) return 'script';
  return 'link';
}

/**
 * Scan the site's own content for external (third-party) dependencies.
 * @param {Set<string>} ownHosts lowercased hostnames treated as "ours".
 * @returns {{total, hotlinkedImages, byKind, items:[{url,kind,where,count}]}}
 */
export async function scanExternalDeps(env, projectKey, publicId, ownHosts) {
  const found = []; // { url, where }

  const sections = await getSiteSections(env.DB, projectKey).catch(() => []);
  for (const s of sections) {
    const urls = [];
    collectUrls(parse(s.content_json), urls);
    for (const u of urls) found.push({ url: u, where: `section: ${s.section_type || 'section'}` });
  }

  const products = await getProductsByProject(env.DB, projectKey, false).catch(() => []);
  for (const p of products) {
    const urls = [];
    if (p.image) collectUrls(p.image, urls);
    collectUrls(parse(p.media_json), urls);
    if (p.body) collectUrls(p.body, urls);
    for (const u of urls) found.push({ url: u, where: `product: ${p.name || p.slug || ''}`.trim() });
  }

  try {
    const cfg = await getOrCreateConfig(env.DB, projectKey);
    const urls = [];
    collectUrls(parse(cfg.social_connections_json), urls);
    if (cfg.logo) collectUrls(cfg.logo, urls);
    for (const u of urls) found.push({ url: u, where: 'site settings' });
  } catch { /* config optional */ }

  // Filter to external + dedupe by URL (keep first context, count uses).
  const byUrl = new Map();
  for (const { url, where } of found) {
    let host;
    try { host = new URL(url).hostname.toLowerCase(); } catch { continue; }
    const isOurs = ownHosts.has(host) || host === 'caddisfly.ai' || host.endsWith('.caddisfly.ai') || host === 'caddisfly.app' || host.endsWith('.caddisfly.app');
    if (isOurs) continue;
    const ex = byUrl.get(url);
    if (ex) { ex.count++; } else { byUrl.set(url, { url, host, kind: classify(url), where, count: 1 }); }
  }

  const items = [...byUrl.values()].sort((a, b) => a.kind.localeCompare(b.kind) || b.count - a.count);
  const byKind = {};
  for (const it of items) byKind[it.kind] = (byKind[it.kind] || 0) + 1;
  return { total: items.length, hotlinkedImages: byKind.image || 0, byKind, items };
}

// ---- PageSpeed Insights -----------------------------------------------------

async function runOne(url, strategy, key) {
  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', url);
  api.searchParams.set('strategy', strategy);
  for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) api.searchParams.append('category', c);
  if (key) api.searchParams.set('key', key);
  const res = await fetch(api.toString(), { headers: { 'Content-Type': 'application/json' } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error((j.error && j.error.message) || `PageSpeed API ${res.status}`);
  const cats = (j.lighthouseResult && j.lighthouseResult.categories) || {};
  const a = (j.lighthouseResult && j.lighthouseResult.audits) || {};
  const pct = (s) => (s == null ? null : Math.round(s * 100));
  const dv = (k) => (a[k] && a[k].displayValue) || '';
  return {
    performance: pct(cats.performance && cats.performance.score),
    accessibility: pct(cats.accessibility && cats.accessibility.score),
    best_practices: pct(cats['best-practices'] && cats['best-practices'].score),
    seo: pct(cats.seo && cats.seo.score),
    lcp: dv('largest-contentful-paint'), fcp: dv('first-contentful-paint'),
    tbt: dv('total-blocking-time'), cls: dv('cumulative-layout-shift'),
    si: dv('speed-index'), tti: dv('interactive'),
  };
}

/** Run PSI for mobile + desktop (parallel). Uses the Google API key. */
export async function runPageSpeed(env, url) {
  const key = env.GOOGLE_PLACES_API_KEY || '';
  const [mobile, desktop] = await Promise.all([runOne(url, 'mobile', key), runOne(url, 'desktop', key)]);
  return { mobile, desktop };
}

/** Latest cached speed report for a project (or null). */
export async function getSpeedReport(db, projectKey) {
  const k = keyCol(projectKey);
  const row = await db.prepare(`SELECT tested_url, data_json, created_at FROM site_speed_reports WHERE ${k.col} = ?`).bind(k.val).first();
  if (!row) return null;
  return { tested_url: row.tested_url, created_at: row.created_at, data: parse(row.data_json) };
}

/** Speed-test rate limit: 4 runs per rolling 24h per site. */
export const SPEED_LIMIT = 4;
export const SPEED_WINDOW = 24 * 60 * 60;

/** Count speed-test runs for a project since `sinceTs`. */
export async function countSpeedRuns(db, projectKey, sinceTs) {
  const k = keyCol(projectKey);
  const row = await db.prepare(`SELECT COUNT(*) AS c FROM speed_runs WHERE ${k.col} = ? AND created_at >= ?`).bind(k.val, sinceTs).first();
  return (row && row.c) || 0;
}

/** Log a speed-test run (and prune rows older than the window for this project). */
export async function logSpeedRun(db, projectKey) {
  const k = keyCol(projectKey);
  const ai = k.col === 'ai_project_id' ? k.val : null;
  const rg = k.col === 'project_id' ? k.val : null;
  await db.batch([
    db.prepare(`DELETE FROM speed_runs WHERE ${k.col} = ? AND created_at < ?`).bind(k.val, Math.floor(Date.now() / 1000) - SPEED_WINDOW),
    db.prepare(`INSERT INTO speed_runs (ai_project_id, project_id) VALUES (?, ?)`).bind(ai, rg),
  ]);
}

/** Upsert the latest speed report for a project. */
export async function saveSpeedReport(db, projectKey, testedUrl, data) {
  const k = keyCol(projectKey);
  const ai = k.col === 'ai_project_id' ? k.val : null;
  const rg = k.col === 'project_id' ? k.val : null;
  await db.batch([
    db.prepare(`DELETE FROM site_speed_reports WHERE ${k.col} = ?`).bind(k.val),
    db.prepare(`INSERT INTO site_speed_reports (ai_project_id, project_id, tested_url, data_json) VALUES (?, ?, ?, ?)`)
      .bind(ai, rg, testedUrl, JSON.stringify(data)),
  ]);
}
