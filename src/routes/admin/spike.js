// TEMPORARY feasibility spike — admin-only. Probes a Cloudflare image-to-video
// model (e.g. xai/grok-imagine-video-1.5-preview) via the env.AI binding so we
// learn, before building the real feature: does it work, sync or async, how
// long, and what the output looks like.
//
// Input shape matches CF's `ai/run` example: { prompt, image:{ url }, duration }.
// The binding auto-authenticates (no account id / API token needed).
//
// Usage (signed in as admin):
//   GET /api/admin/spike/i2v?model=xai/grok-imagine-video-1.5-preview&image=<public-img-url>&prompt=...&duration=8
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

  if (!env.AI) return json({ ok: false, error: 'env.AI binding not available' }, 500);

  const report = { model, prompt, imageUrl, duration };
  try {
    const t0 = Date.now();
    const res = await env.AI.run(model, { prompt, image: { url: imageUrl }, duration });
    report.elapsed_ms = Date.now() - t0;

    // Inspect the result shape without assuming.
    let videoBytes = null;
    if (res instanceof ReadableStream) {
      videoBytes = new Uint8Array(await new Response(res).arrayBuffer());
      report.shape = 'ReadableStream (binary)';
    } else if (res instanceof ArrayBuffer) {
      videoBytes = new Uint8Array(res);
      report.shape = 'ArrayBuffer';
    } else if (res && typeof res === 'object') {
      report.shape = `object keys: ${Object.keys(res).join(', ')}`;
      // Common shapes: { video: <b64> } | { url } | { video: { url } } | async job id
      const b64 = res.video && typeof res.video === 'string' ? res.video : (res.data && typeof res.data === 'string' ? res.data : null);
      if (b64) {
        try { const bin = atob(b64); videoBytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) videoBytes[i] = bin.charCodeAt(i); } catch { /* not base64 */ }
      }
      report.raw_sample = JSON.stringify(res).slice(0, 800);
    } else {
      report.shape = typeof res;
      report.raw_sample = String(res).slice(0, 800);
    }

    if (videoBytes) {
      const sig = Array.from(videoBytes.slice(4, 12)).map((b) => String.fromCharCode(b)).join('');
      const file = `${generateToken(8)}.mp4`;
      await uploadToR2(env.STORAGE, `assets/spike/${file}`, videoBytes, 'video/mp4').catch(() => {});
      report.video = { bytes: videoBytes.length, signature: sig, preview_url: `/preview-asset/spike/${file}` };
    }
    return json({ ok: true, report });
  } catch (e) {
    report.error = String(e && e.message || e);
    return json({ ok: false, report }, 502);
  }
}
