// AI image-to-video via Cloudflare's REST ai/run (partner model, billed through
// the account's AI Gateway). The Workers AI BINDING returns "2021: Invalid User
// Credentials" for partner models, so we call the REST endpoint with a
// Workers-AI-scoped token. Synchronous: one call blocks ~30s and returns a
// (temporary) video URL — the caller re-hosts it in R2.
//
// Secrets/vars: CF_ACCOUNT_ID (var), CF_AI_TOKEN (secret, Workers AI Run perm).

const VIDEO_MODEL = 'xai/grok-imagine-video-1.5-preview';

export function isVideoGenConfigured(env) {
  return !!(env && env.CF_ACCOUNT_ID && env.CF_AI_TOKEN);
}

/**
 * Generate a short background video from a starting image.
 * @param {object} env
 * @param {object} o - { imageUrl (public), prompt, duration=8, uploadUrl? }
 *   uploadUrl: a destination the model uploads the finished clip to. REQUIRED for
 *   Zero Data Retention accounts (Cloudflare relays Workers-AI→xAI as a ZDR team,
 *   so xAI won't return a temp URL — it must upload to `output.upload_url`).
 * @returns {Promise<string|null>} the temp video URL when the provider returns one
 *   (non-ZDR); null when the clip was uploaded to `uploadUrl` instead.
 */
export async function generateImageToVideo(env, { imageUrl, prompt, duration = 8, uploadUrl = null }) {
  if (!isVideoGenConfigured(env)) throw new Error('Video generation is not configured.');
  if (!imageUrl) throw new Error('A starting image is required.');

  const input = { prompt, image: { url: imageUrl }, duration };
  if (uploadUrl) input.output = { upload_url: uploadUrl };

  let r;
  try {
    r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_AI_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: VIDEO_MODEL, input }),
      signal: AbortSignal.timeout(110000), // generation runs ~30s; bound it well above that
    });
  } catch (e) {
    throw new Error(e && e.name === 'TimeoutError' ? 'Video generation timed out — please try again.' : `Could not reach the video service: ${e.message}`);
  }

  const data = await r.json().catch(() => null);
  const video = data && data.result && data.result.result && data.result.result.video;
  // With an upload_url the provider uploads to us and returns no temp `video` —
  // success alone is enough; the caller reads the clip from where it was uploaded.
  if (!r.ok || !data || data.success === false || (!video && !uploadUrl)) {
    const msg = data && data.errors && data.errors[0] && data.errors[0].message;
    // 402 / "Insufficient balance" → out of gateway funds.
    if (r.status === 402 || (msg && /balance/i.test(msg))) throw new Error('The video service is out of credits. Please top up the Cloudflare AI Gateway.');
    throw new Error(msg || `Video generation failed (HTTP ${r.status}).`);
  }
  return video || null;
}
