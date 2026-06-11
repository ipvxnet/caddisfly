// Holiday DECOR overlays — the delight layer on top of the color skins.
// Injected into published pages ONLY while a holiday skin is applied (the
// assembler reads opts.holiday, set from holiday_themes_json.applied), so it
// appears and disappears with the colors on the cron's republishes.
//
// Every decor obeys the same production rules:
//   - pointer-events:none (never blocks a click or a booking)
//   - aria-hidden + hidden under prefers-reduced-motion
//   - pure CSS animation, no JS, no external assets, scaled down on mobile
//
// Artwork stays SWAPPABLE: a builder can render an imageUrl (AI-generated art
// on pure white via mix-blend-mode:multiply) instead of its inline SVG.

// ---------------------------------------------------------------- christmas
// Sleigh on the right, slender galloping reindeer facing LEFT (Rudolph leads
// with the glowing nose) — so the flight runs right→left.
const SANTA_SVG = `<svg viewBox="0 0 560 140" xmlns="http://www.w3.org/2000/svg">
  <path d="M448 86 q44 0 52 -26 q6 -16 22 -16 q8 0 8 8 q0 8 -8 8 q-8 0 -10 8 q-10 34 -64 34 h-22 z" fill="#c0392b"/>
  <path d="M442 66 h64 v22 q-30 14 -64 6 z" fill="#e74c3c"/>
  <path d="M434 102 h84 q10 0 10 7 q0 7 -10 7 h-90 z" fill="#d4a017"/>
  <circle cx="498" cy="58" r="13" fill="#1e6b40"/>
  <path d="M458 60 q12 -8 22 0 l6 20 h-32 z" fill="#d63031"/>
  <circle cx="468" cy="48" r="8.5" fill="#f5cba7"/>
  <path d="M460 42 q8 -10 18 -5 l-3 7 z" fill="#d63031"/>
  <circle cx="477" cy="36" r="3" fill="#ffffff"/>
  <path d="M461 52 q7 6 14 0 l0 5 q-7 4 -14 0 z" fill="#ffffff"/>
  <path d="M452 64 Q300 26 42 42" stroke="#5d3a1a" stroke-width="2.6" fill="none"/>
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

// ---------------------------------------------------------------- halloween
// A small colony of bats, wings flapping (scaleY oscillation per wing).
const BAT = (x, y, s, dly) => `<g transform="translate(${x},${y}) scale(${s})">
  <ellipse cx="0" cy="0" rx="7" ry="10" fill="#241b35"/>
  <circle cx="0" cy="-11" r="5.5" fill="#241b35"/>
  <path d="M-3 -15 l-3 -6 4 1 z M3 -15 l3 -6 -4 1 z" fill="#241b35"/>
  <g class="cf-bat-wing" style="animation-delay:${dly}s">
    <path d="M-6 -4 q-16 -12 -34 -6 q10 4 12 10 q8 -6 22 0 z" fill="#241b35"/>
  </g>
  <g class="cf-bat-wing" style="animation-delay:${dly}s">
    <path d="M6 -4 q16 -12 34 -6 q-10 4 -12 10 q-8 -6 -22 0 z" fill="#241b35"/>
  </g>
</g>`;
const BATS_SVG = `<svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg">
  ${BAT(60, 50, 1.15, 0)}${BAT(150, 30, 0.9, 0.18)}${BAT(225, 64, 0.75, 0.35)}
</svg>`;

// ---------------------------------------------------------------- valentines
const HEART = (fill) => `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 28 C4 18 0 12 0 8 a8 8 0 0 1 16 -3 a8 8 0 0 1 16 3 c0 4 -4 10 -16 20 z" fill="${fill}"/>
</svg>`;

// ---------------------------------------------------------------- july4
const BURST = (color) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="${color}" stroke-width="3" stroke-linecap="round">
  ${Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<line x1="${(50 + Math.cos(a) * 14).toFixed(1)}" y1="${(50 + Math.sin(a) * 14).toFixed(1)}" x2="${(50 + Math.cos(a) * 46).toFixed(1)}" y2="${(50 + Math.sin(a) * 46).toFixed(1)}"/>`;
  }).join('')}
</svg>`;

// ---------------------------------------------------------------- easter
// Reverent composition (per Fernando): a softly glowing cross faded in the
// background, communion bread and wine in front. No motion gimmicks — a slow
// fade-in and a gentle breathing glow.
const EASTER_SVG = `<svg viewBox="0 0 220 230" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="cfEgGlow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#f7e8b8" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#f7e8b8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="110" cy="92" r="92" fill="url(#cfEgGlow)" class="cf-eg-halo"/>
  <!-- cross, faded into the glow -->
  <g fill="#caa84f" opacity=".5">
    <rect x="102" y="18" width="16" height="138" rx="4"/>
    <rect x="62" y="56" width="96" height="16" rx="4"/>
  </g>
  <!-- chalice of wine (front left) -->
  <g>
    <path d="M58 158 q0 22 22 26 v14 h-18 q-6 0 -6 6 h52 q0 -6 -6 -6 h-18 v-14 q22 -4 22 -26 l0 -10 h-48 z" fill="#d4a017"/>
    <ellipse cx="82" cy="150" rx="23" ry="6" fill="#7b2230"/>
  </g>
  <!-- bread (front right): loaf with score lines -->
  <g>
    <ellipse cx="148" cy="190" rx="34" ry="17" fill="#c98e4a"/>
    <ellipse cx="148" cy="186" rx="34" ry="15" fill="#dca55f"/>
    <path d="M130 180 q8 -6 14 0 M146 178 q8 -6 14 0 M138 188 q8 -6 14 0" stroke="#a8743a" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;

const REDUCED = '@media (prefers-reduced-motion: reduce) { .cf-holiday-decor { display: none !important; } }';

/** Generic horizontal flyby (right→left), used by christmas + halloween. */
function flyby({ key, art, width, top, duration, every, extraCss = '', mobileWidth }) {
  const cycle = every + duration;
  const flyPct = Math.round((duration / cycle) * 1000) / 10;
  return `
<!-- holiday decor (${key}) -->
<div class="cf-holiday-decor cf-hd-${key}" aria-hidden="true">${art}</div>
<style>
.cf-hd-${key} {
  position: fixed; top: ${top}; left: 0; width: ${width}px;
  z-index: 9999; pointer-events: none; opacity: 0;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.18));
  animation: cfFly${key} ${cycle}s linear infinite;
  animation-delay: 3s;
}
@keyframes cfFly${key} {
  0%    { transform: translateX(104vw) translateY(0); opacity: 0; }
  0.6%  { opacity: 1; }
  ${(flyPct * 0.33).toFixed(1)}% { transform: translateX(62vw) translateY(-2.2vh); }
  ${(flyPct * 0.66).toFixed(1)}% { transform: translateX(30vw) translateY(1.4vh); }
  ${(flyPct - 0.6).toFixed(1)}% { opacity: 1; }
  ${flyPct}%  { transform: translateX(-${width + 60}px) translateY(-1vh); opacity: 0; }
  100%  { transform: translateX(-${width + 60}px) translateY(-1vh); opacity: 0; }
}
@media (max-width: 640px) { .cf-hd-${key} { width: ${mobileWidth}px; top: 9vh; } }
${extraCss}
${REDUCED}
</style>`;
}

const DECOR = {
  christmas: () => flyby({
    key: 'christmas', art: SANTA_SVG, width: 265, mobileWidth: 165, top: '7vh', duration: 14, every: 75,
  }),

  halloween: () => flyby({
    key: 'halloween', art: BATS_SVG, width: 190, mobileWidth: 120, top: '10vh', duration: 11, every: 55,
    extraCss: `.cf-bat-wing { animation: cfBatFlap .45s ease-in-out infinite alternate; transform-origin: 0 -4px; }
@keyframes cfBatFlap { from { transform: scaleY(1); } to { transform: scaleY(.45); } }`,
  }),

  // Hearts drift up from the bottom edge, staggered and softly transparent.
  valentines: () => {
    const hearts = [
      { x: '8vw', s: 22, d: 0, o: 0.5, c: '#e05a8a' }, { x: '24vw', s: 14, d: 6, o: 0.4, c: '#e98aae' },
      { x: '46vw', s: 18, d: 11, o: 0.45, c: '#d6336c' }, { x: '68vw', s: 13, d: 4, o: 0.35, c: '#e98aae' },
      { x: '86vw', s: 20, d: 9, o: 0.5, c: '#e05a8a' },
    ].map((h) => `<span class="cf-heart" style="left:${h.x};width:${h.s}px;animation-delay:${h.d}s;--o:${h.o}">${HEART(h.c)}</span>`).join('');
    return `
<!-- holiday decor (valentines) -->
<div class="cf-holiday-decor cf-hd-valentines" aria-hidden="true">${hearts}</div>
<style>
.cf-hd-valentines { position: fixed; inset: 0; z-index: 9999; pointer-events: none; }
.cf-hd-valentines .cf-heart { position: absolute; bottom: -36px; opacity: 0; animation: cfHeartRise 16s linear infinite; }
@keyframes cfHeartRise {
  0%   { transform: translateY(0) rotate(-6deg); opacity: 0; }
  6%   { opacity: var(--o); }
  50%  { transform: translateY(-55vh) rotate(7deg) translateX(14px); }
  88%  { opacity: var(--o); }
  100% { transform: translateY(-108vh) rotate(-5deg); opacity: 0; }
}
@media (max-width: 640px) { .cf-hd-valentines .cf-heart { transform: scale(.8); } }
${REDUCED}
</style>`;
  },

  // Subtle firework bursts near the top, staggered around a 9s cycle.
  july4: () => {
    const bursts = [
      { x: '12vw', y: '12vh', s: 90, d: 0, c: '#d23c45' }, { x: '78vw', y: '9vh', s: 110, d: 2.4, c: '#3f51b5' },
      { x: '52vw', y: '6vh', s: 75, d: 4.6, c: '#d4a017' }, { x: '30vw', y: '16vh', s: 70, d: 6.5, c: '#3f51b5' },
    ].map((b) => `<span class="cf-burst" style="left:${b.x};top:${b.y};width:${b.s}px;animation-delay:${b.d}s">${BURST(b.c)}</span>`).join('');
    return `
<!-- holiday decor (july4) -->
<div class="cf-holiday-decor cf-hd-july4" aria-hidden="true">${bursts}</div>
<style>
.cf-hd-july4 { position: fixed; inset: 0; z-index: 9999; pointer-events: none; }
.cf-hd-july4 .cf-burst { position: absolute; opacity: 0; animation: cfBurst 9s ease-out infinite; }
@keyframes cfBurst {
  0%   { transform: scale(.15); opacity: 0; }
  4%   { opacity: .85; }
  13%  { transform: scale(1); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
@media (max-width: 640px) { .cf-hd-july4 .cf-burst { transform: scale(.6); } }
${REDUCED}
</style>`;
  },

  // Bottom-right vignette: slow fade-in, then a gentle breathing glow.
  easter: () => `
<!-- holiday decor (easter) -->
<div class="cf-holiday-decor cf-hd-easter" aria-hidden="true">${EASTER_SVG}</div>
<style>
.cf-hd-easter {
  position: fixed; bottom: 2vh; right: 2vw; width: 170px;
  z-index: 9999; pointer-events: none; opacity: 0;
  animation: cfEasterIn 3.5s ease-out forwards;
  animation-delay: 1.5s;
}
.cf-hd-easter .cf-eg-halo { animation: cfEasterBreathe 7s ease-in-out infinite alternate; transform-origin: 110px 92px; }
@keyframes cfEasterIn { to { opacity: .92; } }
@keyframes cfEasterBreathe { from { opacity: .75; } to { opacity: 1; transform: scale(1.06); } }
@media (max-width: 640px) { .cf-hd-easter { width: 110px; bottom: 1vh; right: 2vw; } }
${REDUCED}
</style>`,
};

/** Decor snippet for an applied holiday — '' when none exists. */
export function holidayDecorHtml(holidayKey) {
  const build = DECOR[holidayKey];
  if (!build) return '';
  try { return build(); } catch (e) { console.error('holiday decor failed:', holidayKey, e.message); return ''; }
}
