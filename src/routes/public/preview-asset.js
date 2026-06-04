/**
 * GET /preview-asset/:preview_id/:filename
 *
 * Serves project images stored in R2 under assets/<preview_id>/<filename>
 * (e.g. Google Places photos fetched at generation time). Binary-safe — streams
 * the R2 object body rather than decoding to text.
 */

export async function handlePreviewAsset(ctx) {
  const { env, params } = ctx;
  const { preview_id, filename } = params;

  // Guard against path traversal; filenames we write are simple (e.g. "0.jpg").
  if (!preview_id || !filename || filename.includes('/') || filename.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  const key = `assets/${preview_id}/${filename}`;
  const object = await env.STORAGE.get(key);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const contentType =
    (object.httpMetadata && object.httpMetadata.contentType) || 'image/jpeg';

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
