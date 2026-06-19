// Parse a testimonial video reference into the pieces a facade player needs.
// Accepts YouTube / Vimeo / Loom share or embed links, or an uploaded file
// (our /preview-asset R2 url, or any .mp4/.webm/.mov). Returns null when the
// string is empty or unrecognized so the caller can fall back to a text card.

export function parseVideo(url) {
  const u = String(url || '').trim();
  if (!u) return null;

  // Direct / uploaded file → played in a native <video>.
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(u) || u.startsWith('/preview-asset/')) {
    return { provider: 'file', kind: 'file', embedUrl: u, poster: '' };
  }

  // YouTube (watch, youtu.be, embed, shorts)
  let m = u.match(/(?:youtube\.com\/(?:watch\?[^#]*\bv=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  if (m) {
    const id = m[1];
    return {
      provider: 'youtube', kind: 'iframe', id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`,
      poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }

  // Vimeo
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (m) {
    const id = m[1];
    return { provider: 'vimeo', kind: 'iframe', id, embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`, poster: '' };
  }

  // Loom
  m = u.match(/loom\.com\/(?:share|embed)\/([A-Za-z0-9]+)/i);
  if (m) {
    const id = m[1];
    return { provider: 'loom', kind: 'iframe', id, embedUrl: `https://www.loom.com/embed/${id}?autoplay=1`, poster: '' };
  }

  return null;
}
