/**
 * GET /preview-asset/:preview_id/:filename
 *
 * Serves project images stored in R2 under assets/<preview_id>/<filename>
 * (e.g. Google Places photos fetched at generation time). Binary-safe — streams
 * the R2 object body rather than decoding to text.
 */

export async function handlePreviewAsset(ctx) {
  const { env, params, request } = ctx;
  const { preview_id, filename } = params;

  // Guard against path traversal; filenames we write are simple (e.g. "0.jpg").
  if (!preview_id || !filename || filename.includes('/') || filename.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  const key = `assets/${preview_id}/${filename}`;
  // Honor Range requests — <video> playback needs 206/Accept-Ranges (required on
  // Safari, more reliable everywhere). R2 parses the Range header for us.
  const rangeHeader = request && request.headers.get('range');
  const object = await env.STORAGE.get(key, rangeHeader ? { range: request.headers } : undefined);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const contentType =
    (object.httpMetadata && object.httpMetadata.contentType) || 'image/jpeg';
  const headers = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
  };

  if (rangeHeader && object.range && object.size != null) {
    const offset = object.range.offset || 0;
    const length = object.range.length != null ? object.range.length : object.size - offset;
    headers['Content-Range'] = `bytes ${offset}-${offset + length - 1}/${object.size}`;
    headers['Content-Length'] = String(length);
    return new Response(object.body, { status: 206, headers });
  }

  if (object.size != null) headers['Content-Length'] = String(object.size);
  return new Response(object.body, { status: 200, headers });
}
