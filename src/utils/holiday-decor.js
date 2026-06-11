// Holiday DECOR overlays — the delight layer on top of the color skins.
// Injected into published pages ONLY while a holiday skin is applied (the
// assembler reads opts.holiday, set by deploy.js from
// holiday_themes_json.applied), so it appears and disappears with the colors
// on the cron's republishes. Pure CSS animation, one fixed element:
//   - pointer-events:none (never blocks a click or a booking)
//   - aria-hidden + prefers-reduced-motion honored
//   - smaller + slower on small screens
// The artwork is SWAPPABLE: each decor can carry an imageUrl (e.g. AI-generated
// art in R2, rendered with mix-blend-mode so a white background disappears);
// the inline SVG silhouette is the zero-asset default.

// Stylized flat silhouette: sleigh + Santa + three reindeer, drawn as simple
// composed shapes so it reads cleanly at 160-260px wide.
const SANTA_SVG = `<svg viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <!-- sleigh -->
  <path d="M428 78 q44 0 52 -26 q6 -16 22 -16 q8 0 8 8 q0 8 -8 8 q-8 0 -10 8 q-10 34 -64 34 h-22 z"/>
  <path d="M414 94 h84 q10 0 10 7 q0 7 -10 7 h-90 z"/>
  <!-- santa -->
  <circle cx="448" cy="44" r="9"/>
  <path d="M438 52 q12 -6 20 2 l6 18 h-30 z"/>
  <path d="M444 34 q6 -10 14 -6 l-4 8 z"/>
  <!-- reins -->
  <path d="M118 52 Q260 30 436 52" stroke="currentColor" stroke-width="3" fill="none"/>
  <!-- reindeer x3 (rudolph leads) -->
  <g>
    <path d="M52 66 q16 -12 34 -8 l26 6 q10 2 8 12 l-4 14 h-10 l2 -12 -18 -4 -6 16 h-10 l4 -18 q-16 2 -26 -6 z"/>
    <path d="M48 60 l-10 -16 m10 16 l-16 -8 m16 8 l-4 -20" stroke="currentColor" stroke-width="3" fill="none"/>
    <circle cx="40" cy="58" r="3.4" class="cf-rudolph-nose"/>
  </g>
  <g transform="translate(132,4)">
    <path d="M52 66 q16 -12 34 -8 l26 6 q10 2 8 12 l-4 14 h-10 l2 -12 -18 -4 -6 16 h-10 l4 -18 q-16 2 -26 -6 z"/>
    <path d="M48 60 l-10 -16 m10 16 l-16 -8" stroke="currentColor" stroke-width="3" fill="none"/>
  </g>
  <g transform="translate(264,-2)">
    <path d="M52 66 q16 -12 34 -8 l26 6 q10 2 8 12 l-4 14 h-10 l2 -12 -18 -4 -6 16 h-10 l4 -18 q-16 2 -26 -6 z"/>
    <path d="M48 60 l-10 -16 m10 16 l-16 -8" stroke="currentColor" stroke-width="3" fill="none"/>
  </g>
</svg>`;

// Per-holiday decor registry. `imageUrl` (when set) replaces the inline SVG —
// drop AI-generated art (dark subject on PURE WHITE, rendered with
// mix-blend-mode:multiply so the white vanishes) into R2 and point here.
const DECOR = {
  christmas: {
    html: SANTA_SVG,
    imageUrl: null,
    color: 'rgba(20,28,48,.82)', // night-sky silhouette
    flyDuration: 14,             // seconds per pass
    flyEvery: 75,                // seconds between passes
  },
};

/** Decor snippet for an applied holiday — '' when none exists. */
export function holidayDecorHtml(holidayKey) {
  const d = DECOR[holidayKey];
  if (!d) return '';
  const art = d.imageUrl
    ? `<img src="${d.imageUrl}" alt="" style="width:100%;height:auto;mix-blend-mode:multiply;">`
    : d.html;
  // One animation cycle = flight + pause; the flight occupies the first slice.
  const cycle = d.flyEvery + d.flyDuration;
  const flyPct = Math.round((d.flyDuration / cycle) * 1000) / 10;
  return `
<!-- holiday decor (auto-applied with the ${holidayKey} theme; reverts with it) -->
<div class="cf-holiday-decor" aria-hidden="true">${art}</div>
<style>
.cf-holiday-decor {
  position: fixed; top: 7vh; left: 0; width: 240px; color: ${d.color};
  z-index: 9999; pointer-events: none; opacity: 0;
  animation: cfHolidayFly ${cycle}s linear infinite;
  animation-delay: 3s;
}
.cf-rudolph-nose { fill: #e0312f; }
@keyframes cfHolidayFly {
  0%    { transform: translateX(-280px) translateY(0); opacity: 0; }
  0.6%  { opacity: 1; }
  ${(flyPct * 0.33).toFixed(1)}% { transform: translateX(30vw) translateY(-2.2vh); }
  ${(flyPct * 0.66).toFixed(1)}% { transform: translateX(62vw) translateY(1.4vh); }
  ${(flyPct - 0.6).toFixed(1)}% { opacity: 1; }
  ${flyPct}%  { transform: translateX(104vw) translateY(-1vh); opacity: 0; }
  100%  { transform: translateX(104vw) translateY(-1vh); opacity: 0; }
}
@media (max-width: 640px) {
  .cf-holiday-decor { width: 150px; top: 9vh; }
}
@media (prefers-reduced-motion: reduce) {
  .cf-holiday-decor { display: none; }
}
</style>`;
}
