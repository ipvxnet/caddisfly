// TEMPORARY feasibility spike — admin-only. Probes a Cloudflare image-to-video
// model on our env.AI binding so we learn, before building the real feature:
//   • does the binding accept it (model id valid)?
//   • sync or async (does it return bytes, or a job id to poll)?
//   • how long does one clip take, and how big is the output?
//
// Usage (signed in as an admin):
//   GET /api/admin/spike/i2v?model=<exact-model-id>&prompt=...
//   (copy the model id from https://developers.cloudflare.com/ai/models/?tasks=Image-to-Video)
// Remove this file once the real video feature lands.

import { uploadToR2 } from '../../utils/r2-storage.js';
import { generateToken } from '../../utils/crypto.js';

const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handleSpikeI2V(ctx) {
  const { env, query } = ctx;
  const model = (query.model || '').trim();
  const prompt = (query.prompt || 'gentle cinematic camera push-in, subtle motion, looping background').trim();

  if (!env.AI) return json({ ok: false, error: 'env.AI binding not available' }, 500);
  if (!model) {
    return json({
      ok: false,
      need: 'Pass ?model=<exact id> from the Cloudflare Image-to-Video models page.',
      example: '/api/admin/spike/i2v?model=@cf/some/image-to-video-model',
      ai_binding: 'present',
    }, 400);
  }

  const report = { model, prompt, steps: {} };

  // 1) Make a real starting image (flux) to feed the i2v model.
  let imageBytes;
  try {
    const t0 = Date.now();
    const img = await env.AI.run(IMAGE_MODEL, { prompt: 'a calm modern storefront at golden hour, cinematic', steps: 6 });
    const b64 = img && img.image;
    if (!b64) throw new Error('no image returned');
    const bin = atob(b64);
    imageBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) imageBytes[i] = bin.charCodeAt(i);
    report.steps.starting_image = { ok: true, bytes: imageBytes.length, ms: Date.now() - t0 };
  } catch (e) {
    report.steps.starting_image = { ok: false, error: String(e && e.message || e) };
    return json({ ok: false, report }, 502);
  }

  // 2) Call the image-to-video model. Input shape is model-specific — we try the
  //    common Workers AI form (image as a byte array) and report whatever comes back.
  try {
    const t0 = Date.now();
    const res = await env.AI.run(model, { image: Array.from(imageBytes), prompt });
    const ms = Date.now() - t0;

    // Inspect the result shape without assuming.
    let shape;
    let videoBytes = null;
    if (res instanceof ReadableStream) {
      videoBytes = new Uint8Array(await new Response(res).arrayBuffer());
      shape = 'ReadableStream';
    } else if (res && typeof res === 'object' && (res.video || res.data)) {
      const b64 = res.video || res.data;
      try { const bin = atob(b64); videoBytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) videoBytes[i] = bin.charCodeAt(i); } catch { /* not base64 */ }
      shape = 'object{video|data}';
    } else if (res instanceof ArrayBuffer) {
      videoBytes = new Uint8Array(res); shape = 'ArrayBuffer';
    } else {
      shape = res && typeof res === 'object' ? `object keys: ${Object.keys(res).join(',')}` : typeof res;
    }

    report.steps.i2v = { ok: true, ms, shape };
    if (videoBytes) {
      // Signature check (mp4 'ftyp' / webm) + stash so we can eyeball it.
      const sig = Array.from(videoBytes.slice(4, 8)).map((b) => String.fromCharCode(b)).join('');
      const key = `assets/spike/${generateToken(8)}.mp4`;
      await uploadToR2(env.STORAGE, key, videoBytes, 'video/mp4').catch(() => {});
      report.steps.i2v.bytes = videoBytes.length;
      report.steps.i2v.signature = sig;
      report.steps.i2v.preview_url = `/preview-asset/spike/${key.split('/').pop()}`;
    } else {
      report.steps.i2v.raw_sample = JSON.stringify(res).slice(0, 500);
    }
    return json({ ok: true, report });
  } catch (e) {
    report.steps.i2v = { ok: false, error: String(e && e.message || e) };
    return json({ ok: false, report }, 502);
  }
}
