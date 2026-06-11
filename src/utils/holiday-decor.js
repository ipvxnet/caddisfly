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
const SANTA_SVG = `<svg viewBox="0 0 520 130" xmlns="http://www.w3.org/2000/svg">
  <!-- sleigh (trails on the right; flight is right→left so the deer lead) -->
  <path d="M428 80 q44 0 52 -26 q6 -16 22 -16 q8 0 8 8 q0 8 -8 8 q-8 0 -10 8 q-10 34 -64 34 h-22 z" fill="#c0392b"/>
  <path d="M422 60 h64 v22 q-30 14 -64 6 z" fill="#e74c3c"/>
  <path d="M414 96 h84 q10 0 10 7 q0 7 -10 7 h-90 z" fill="#d4a017"/>
  <!-- gift sack -->
  <circle cx="478" cy="52" r="13" fill="#1e6b40"/>
  <!-- santa -->
  <path d="M438 54 q12 -8 22 0 l6 20 h-32 z" fill="#d63031"/>
  <circle cx="448" cy="42" r="8.5" fill="#f5cba7"/>
  <path d="M440 36 q8 -10 18 -5 l-3 7 z" fill="#d63031"/>
  <circle cx="457" cy="30" r="3" fill="#ffffff"/>
  <path d="M441 46 q7 6 14 0 l0 5 q-7 4 -14 0 z" fill="#ffffff"/>
  <!-- reins -->
  <path d="M118 54 Q260 32 436 56" stroke="#5d3a1a" stroke-width="3" fill="none"/>
  <!-- reindeer ×3, facing LEFT (Rudolph leads at the far left) -->
  <g>
    <path d="M52 68 q16 -12 34 -8 l26 6 q10 2 8 12 l-4 14 h-10 l2 -12 -18 -4 -6 16 h-10 l4 -18 q-16 2 -26 -6 z" fill="#8d5a2b"/>
    <path d="M48 62 l-10 -16 m10 16 l-16 -8 m16 8 l-4 -20" stroke="#5d3a1a" stroke-width="3" fill="none"/>
    <circle cx="40" cy="60" r="5.5" fill="#ff3b30" opacity=".45"/>
    <circle cx="40" cy="60" r="3.4" fill="#ff3b30"/>
  </g>
  <g transform="translate(132,4)">
    <path d="M52 68 q16 -12 34 -8 l26 6 q10 2 8 12 l-4 14 h-10 l2 -12 -18 -4 -6 16 h-10 l4 -18 q-16 2 -26 -6 z" fill="#8d5a2b"/>
    <path d="M48 62 l-10 -16 m10 16 l-16 -8" stroke="#5d3a1a" stroke-width="3" fill="none"/>
  </g>
  <g transform="translate(264,-2)">
    <path d="M52 68 q16 -12 34 -8 l26 6 q10 2 8 12 l-4 14 h-10 l2 -12 -18 -4 -6 16 h-10 l4 -18 q-16 2 -26 -6 z" fill="#8d5a2b"/>
    <path d="M48 62 l-10 -16 m10 16 l-16 -8" stroke="#5d3a1a" stroke-width="3" fill="none"/>
  </g>
</svg>`;

// Per-holiday decor registry. `imageUrl` (when set) replaces the inline SVG —
// drop AI-generated art (dark subject on PURE WHITE, rendered with
// mix-blend-mode:multiply so the white vanishes) into R2 and point here.
const DECOR = {
  christmas: {
    html: SANTA_SVG,
    imageUrl: null,
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
  position: fixed; top: 7vh; left: 0; width: 240px;
  z-index: 9999; pointer-events: none; opacity: 0;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.18));
  animation: cfHolidayFly ${cycle}s linear infinite;
  animation-delay: 3s;
}
/* Flight is RIGHT → LEFT — the artwork faces left, so the reindeer lead. */
@keyframes cfHolidayFly {
  0%    { transform: translateX(104vw) translateY(0); opacity: 0; }
  0.6%  { opacity: 1; }
  ${(flyPct * 0.33).toFixed(1)}% { transform: translateX(62vw) translateY(-2.2vh); }
  ${(flyPct * 0.66).toFixed(1)}% { transform: translateX(30vw) translateY(1.4vh); }
  ${(flyPct - 0.6).toFixed(1)}% { opacity: 1; }
  ${flyPct}%  { transform: translateX(-280px) translateY(-1vh); opacity: 0; }
  100%  { transform: translateX(-280px) translateY(-1vh); opacity: 0; }
}
@media (max-width: 640px) {
  .cf-holiday-decor { width: 150px; top: 9vh; }
}
@media (prefers-reduced-motion: reduce) {
  .cf-holiday-decor { display: none; }
}
</style>`;
}
