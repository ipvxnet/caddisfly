// QR code generation — first-party (no external service), used by the dashboard
// "QR code" action to turn a site's live URL into a printable/shareable code.
// qrcode-svg is a tiny zero-dependency pure-JS encoder, so it bundles and runs
// fine in the Worker. We emit a single-path SVG (join:true) to keep it small.

import QRCode from 'qrcode-svg';

/**
 * Build an SVG QR code for arbitrary content.
 * @param {string} content - text/URL to encode.
 * @param {{ size?: number }} [opts] - pixel size of the square SVG (default 1024,
 *   chosen so a client-side <canvas> PNG export is print-crisp).
 * @returns {string} an `<svg>…</svg>` document.
 */
export function buildQrSvg(content, opts = {}) {
  const size = Math.max(64, Math.min(2048, opts.size || 1024));
  return new QRCode({
    content: String(content || '').slice(0, 1000),
    width: size,
    height: size,
    padding: 2, // quiet zone (modules) — required for reliable scanning
    color: '#111111',
    background: '#ffffff',
    ecl: 'M', // medium error correction — good balance for URLs
    join: true, // merge modules into one path → ~3x smaller SVG
  }).svg();
}
