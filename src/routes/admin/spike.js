// TEMPORARY feasibility spike — admin-only. Probes a Cloudflare image-to-video
// model via the REST `ai/run` endpoint (the binding gave "2021: Invalid User
// Credentials" for the xai partner model). Matches the curl example shape:
//   POST /accounts/{id}/ai/run  Bearer <token>
//   { model, input: { prompt, image: { url }, duration } }
//
// Needs two Worker secrets:
//   CF_ACCOUNT_ID  — Cloudflare account id
//   CF_AI_TOKEN    — API token with Workers AI (Run) permission
//
// Usage (signed in as admin):
//   GET /api/admin/spike/i2v?model=xai/grok-imagine-video-1.5-preview&image=<url>&prompt=...&duration=8
// Remove this file once the real video feature lands.

import { uploadToR2 } from '../../utils/r2-storage.js';
import { generateToken } from '../../utils/crypto.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handleSpikeI2V(ctx) {
  const { env, query } = ctx;
  const model = (query.model || 'xai/grok-imagine-video-1.5-preview').trim();
  const prompt = (query.prompt || 'slow, serene cinematic time-lapse with subtle motion').trim();
  const imageUrl = (query.image || 'https://docs.x.ai/assets/api-examples/video/milkyway-still.png').trim();
  const duration = Math.min(Math.max(parseInt(query.duration, 10) || 8, 2), 20);

  const accountId = env.CF_ACCOUNT_ID;
  const token = env.CF_AI_TOKEN;
  if (!accountId || !token) {
    return json({ ok: false, error: 'Missing secrets', need: { CF_ACCOUNT_ID: !!accountId, CF_AI_TOKEN: !!token },
      how: 'npx wrangler secret put CF_ACCOUNT_ID  /  CF_AI_TOKEN  (token needs Workers AI Run permission)' }, 400);
  }

  const report = { model, prompt, imageUrl, duration };
  try {
    const t0 = Date.now();
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: { prompt, image: { url: imageUrl }, duration } }),
    });
    report.elapsed_ms = Date.now() - t0;
    report.http_status = r.status;
    const ct = r.headers.get('content-type') || '';
    report.content_type = ct;

    if (ct.includes('application/json')) {
      const data = await r.json().catch(() => null);
      report.shape = data && typeof data === 'object' ? `json keys: ${Object.keys(data).join(', ')}` : typeof data;
      report.body_sample = JSON.stringify(data).slice(0, 1200);
      // Common: { result: { video|url|... }, success, errors } — surface a video URL or base64 if present.
      const res = data && data.result;
      const url = res && (res.url || (res.video && res.video.url));
      const b64 = res && typeof res.video === 'string' ? res.video : null;
      if (url) report.video_url = url;
      if (b64) {
        try { const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const file = `${generateToken(8)}.mp4`; await uploadToR2(env.STORAGE, `assets/spike/${file}`, bytes, 'video/mp4').catch(() => {});
          report.video = { bytes: bytes.length, preview_url: `/preview-asset/spike/${file}` }; } catch { /* not b64 */ }
      }
      return json({ ok: r.ok && data && data.success !== false, report });
    }

    // Binary video response → store + report.
    if (ct.startsWith('video/') || ct === 'application/octet-stream') {
      const bytes = new Uint8Array(await r.arrayBuffer());
      const file = `${generateToken(8)}.mp4`;
      await uploadToR2(env.STORAGE, `assets/spike/${file}`, bytes, ct.startsWith('video/') ? ct : 'video/mp4').catch(() => {});
      report.shape = 'binary';
      report.video = { bytes: bytes.length, preview_url: `/preview-asset/spike/${file}` };
      return json({ ok: r.ok, report });
    }

    report.shape = 'unknown';
    report.body_sample = (await r.text().catch(() => '')).slice(0, 1200);
    return json({ ok: r.ok, report });
  } catch (e) {
    report.error = String(e && e.message || e);
    return json({ ok: false, report }, 502);
  }
}
