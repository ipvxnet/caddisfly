// Video upload sink (PUBLIC, token-authorized). Under Zero Data Retention the
// xAI video model won't hand back a temp URL — it uploads the finished clip to an
// `output.upload_url` we provide. This endpoint IS that URL: the model PUTs the
// raw mp4 here, and we store it in R2 at the exact path encoded in the signed
// token. No session auth (the model server has no cookie); the short-lived HMAC
// token authorizes the single write and pins the destination path.
//   PUT|POST /api/video-sink/:token

import { verifyToken } from '../../../utils/signed-token.js';
import { uploadToR2 } from '../../../utils/r2-storage.js';

const MAX_VIDEO_BYTES = 80 * 1024 * 1024; // generous cap for a ~6s clip

export async function handleVideoSink(ctx) {
  const { env, request, params } = ctx;
  const payload = await verifyToken(env.STRIPE_SECRET_KEY, 'vsink', params.token);
  // payload: { p: <project public_id>, f: <filename> }
  if (!payload || !payload.p || !payload.f) return new Response('Forbidden', { status: 403 });
  // Filename is one we minted; reject anything that could escape the project dir.
  if (!/^[\w.-]+$/.test(payload.f) || payload.f.includes('..')) return new Response('Bad path', { status: 400 });

  const buf = await request.arrayBuffer().catch(() => null);
  if (!buf || buf.byteLength === 0) return new Response('Empty body', { status: 400 });
  if (buf.byteLength > MAX_VIDEO_BYTES) return new Response('Too large', { status: 413 });

  await uploadToR2(env.STORAGE, `assets/${payload.p}/${payload.f}`, new Uint8Array(buf), 'video/mp4');
  return new Response('OK', { status: 200 });
}
