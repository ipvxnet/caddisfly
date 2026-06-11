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
const SANTA_SVG = `<svg viewBox="0 0 560 140" xmlns="http://www.w3.org/2000/svg">
  <!-- sleigh (right; flight is right→left so the reindeer lead) -->
  <path d="M448 86 q44 0 52 -26 q6 -16 22 -16 q8 0 8 8 q0 8 -8 8 q-8 0 -10 8 q-10 34 -64 34 h-22 z" fill="#c0392b"/>
  <path d="M442 66 h64 v22 q-30 14 -64 6 z" fill="#e74c3c"/>
  <path d="M434 102 h84 q10 0 10 7 q0 7 -10 7 h-90 z" fill="#d4a017"/>
  <circle cx="498" cy="58" r="13" fill="#1e6b40"/>
  <path d="M458 60 q12 -8 22 0 l6 20 h-32 z" fill="#d63031"/>
  <circle cx="468" cy="48" r="8.5" fill="#f5cba7"/>
  <path d="M460 42 q8 -10 18 -5 l-3 7 z" fill="#d63031"/>
  <circle cx="477" cy="36" r="3" fill="#ffffff"/>
  <path d="M461 52 q7 6 14 0 l0 5 q-7 4 -14 0 z" fill="#ffffff"/>
  <!-- reins: sleigh → over the team → lead deer's head -->
  <path d="M452 64 Q300 26 42 42" stroke="#5d3a1a" stroke-width="2.6" fill="none"/>
  <!-- reindeer ×3 — slender gallop, facing LEFT; Rudolph leads -->
  <g transform="translate(6,8)">
    <path d="M20 26 l-9 -16 m9 16 l-15 -7 m15 7 l-2 -18 m2 18 l8 -15" stroke="#5d3a1a" stroke-width="2.6" fill="none"/>
    <path d="M6 36 q9 -8 22 -5 l5 6 q-1 6 -9 6 l-13 -2 z" fill="#8d5a2b"/>
    <path d="M26 30 l9 -7 -1 9 z" fill="#8d5a2b"/>
    <path d="M26 40 q9 -1 14 8 l6 5 -5 9 -14 -8 z" fill="#8d5a2b"/>
    <path d="M38 52 q26 -11 54 -5 q9 2 7 9 q-2 7 -11 7 l-46 -1 q-7 -4 -4 -10 z" fill="#8d5a2b"/>
    <path d="M46 62 l-14 18 m19 -16 l-7 20" stroke="#8d5a2b" stroke-width="4.2" stroke-linecap="round" fill="none"/>
    <path d="M86 62 l11 18 m-4 -20 l16 13" stroke="#8d5a2b" stroke-width="4.2" stroke-linecap="round" fill="none"/>
    <path d="M97 50 l9 -7" stroke="#8d5a2b" stroke-width="4" stroke-linecap="round"/>
    <circle cx="7" cy="40" r="6" fill="#ff3b30" opacity=".4"/>
    <circle cx="7" cy="40" r="3.6" fill="#ff3b30"/>
  </g>
  <g transform="translate(146,2)">
    <path d="M20 26 l-9 -16 m9 16 l-15 -7 m15 7 l-2 -18" stroke="#5d3a1a" stroke-width="2.6" fill="none"/>
    <path d="M6 36 q9 -8 22 -5 l5 6 q-1 6 -9 6 l-13 -2 z" fill="#8d5a2b"/>
    <path d="M26 30 l9 -7 -1 9 z" fill="#8d5a2b"/>
    <path d="M26 40 q9 -1 14 8 l6 5 -5 9 -14 -8 z" fill="#8d5a2b"/>
    <path d="M38 52 q26 -11 54 -5 q9 2 7 9 q-2 7 -11 7 l-46 -1 q-7 -4 -4 -10 z" fill="#8d5a2b"/>
    <path d="M46 62 l-14 18 m19 -16 l-7 20" stroke="#8d5a2b" stroke-width="4.2" stroke-linecap="round" fill="none"/>
    <path d="M86 62 l11 18 m-4 -20 l16 13" stroke="#8d5a2b" stroke-width="4.2" stroke-linecap="round" fill="none"/>
    <path d="M97 50 l9 -7" stroke="#8d5a2b" stroke-width="4" stroke-linecap="round"/>
  </g>
  <g transform="translate(286,8)">
    <path d="M20 26 l-9 -16 m9 16 l-15 -7 m15 7 l-2 -18" stroke="#5d3a1a" stroke-width="2.6" fill="none"/>
    <path d="M6 36 q9 -8 22 -5 l5 6 q-1 6 -9 6 l-13 -2 z" fill="#8d5a2b"/>
    <path d="M26 30 l9 -7 -1 9 z" fill="#8d5a2b"/>
    <path d="M26 40 q9 -1 14 8 l6 5 -5 9 -14 -8 z" fill="#8d5a2b"/>
    <path d="M38 52 q26 -11 54 -5 q9 2 7 9 q-2 7 -11 7 l-46 -1 q-7 -4 -4 -10 z" fill="#8d5a2b"/>
    <path d="M46 62 l-14 18 m19 -16 l-7 20" stroke="#8d5a2b" stroke-width="4.2" stroke-linecap="round" fill="none"/>
    <path d="M86 62 l11 18 m-4 -20 l16 13" stroke="#8d5a2b" stroke-width="4.2" stroke-linecap="round" fill="none"/>
    <path d="M97 50 l9 -7" stroke="#8d5a2b" stroke-width="4" stroke-linecap="round"/>
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
  position: fixed; top: 7vh; left: 0; width: 265px;
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
  .cf-holiday-decor { width: 165px; top: 9vh; }
}
@media (prefers-reduced-motion: reduce) {
  .cf-holiday-decor { display: none; }
}
</style>`;
}
