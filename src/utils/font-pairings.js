/**
 * Curated heading+body font pairings for the customize-page font picker.
 *
 * Changing a site's fonts is just updating config.font_heading/font_body — the
 * preview's Google Fonts <link> (ai-page-assembler.js) is built dynamically from
 * those values, and templates read the family while keeping hardcoded sizes. So
 * the picker only needs to offer good, real Google Font pairings.
 *
 * Includes the 4 light-theme pairings (see site-themes.js) so that after a theme
 * is applied, the matching font card shows as selected. All names are valid
 * Google Fonts. NOTE: distinct from ai-prompts.js getFontPairing(style), which is
 * keyed by a style word (modern/classic/...) — different concept.
 */

export const FONT_PAIRINGS = [
  { key: 'poppins-inter', label: 'Poppins / Inter', heading: 'Poppins', body: 'Inter' },
  { key: 'playfair-lato', label: 'Playfair / Lato', heading: 'Playfair Display', body: 'Lato' },
  { key: 'oswald-roboto', label: 'Oswald / Roboto', heading: 'Oswald', body: 'Roboto' },
  { key: 'merriweather-sourcesans', label: 'Merriweather / Source Sans', heading: 'Merriweather', body: 'Source Sans Pro' },
  { key: 'inter-inter', label: 'Inter / Inter', heading: 'Inter', body: 'Inter' },
  { key: 'space-worksans', label: 'Space Grotesk / Work Sans', heading: 'Space Grotesk', body: 'Work Sans' },
  { key: 'cormorant-montserrat', label: 'Cormorant / Montserrat', heading: 'Cormorant Garamond', body: 'Montserrat' },
  { key: 'montserrat-opensans', label: 'Montserrat / Open Sans', heading: 'Montserrat', body: 'Open Sans' },
  { key: 'raleway-roboto', label: 'Raleway / Roboto', heading: 'Raleway', body: 'Roboto' },
  { key: 'quicksand-nunito', label: 'Quicksand / Nunito', heading: 'Quicksand', body: 'Nunito' },
];

/** All pairings, in display order. */
export function listFontPairings() {
  return FONT_PAIRINGS;
}

/**
 * Find the pairing matching a heading+body combo (case-insensitive), or null.
 * Used to mark the selected card and to validate the update endpoint's input.
 * @param {string} heading
 * @param {string} body
 * @returns {object|null}
 */
export function findPairing(heading, body) {
  if (!heading || !body) return null;
  const h = String(heading).trim().toLowerCase();
  const b = String(body).trim().toLowerCase();
  return (
    FONT_PAIRINGS.find((p) => p.heading.toLowerCase() === h && p.body.toLowerCase() === b) || null
  );
}
