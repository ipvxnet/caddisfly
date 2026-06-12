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

// Nativity vignette (alternates with the Santa flyby): stable, Star of
// Bethlehem, Mary in blue kneeling left, Joseph in brown with staff right,
// the manger with the Child (halo) between them.
const NATIVITY_SVG = `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="cfNatGlow" cx="50%" cy="38%" r="60%">
      <stop offset="0%" stop-color="#f7e8b8" stop-opacity=".5"/>
      <stop offset="100%" stop-color="#f7e8b8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="120" cy="84" r="95" fill="url(#cfNatGlow)" class="cf-nat-glow"/>
  <!-- stable -->
  <path d="M22 86 L120 26 L218 86" stroke="#7a5a3a" stroke-width="9" fill="none" stroke-linecap="round"/>
  <rect x="30" y="84" width="8" height="92" fill="#7a5a3a"/>
  <rect x="202" y="84" width="8" height="92" fill="#7a5a3a"/>
  <!-- star of Bethlehem -->
  <g fill="#f2c14e">
    <path d="M120 8 l4.5 12 12 4.5 -12 4.5 -4.5 12 -4.5 -12 -12 -4.5 12 -4.5 z"/>
    <rect x="118.6" y="40" width="2.8" height="16" rx="1.4" opacity=".7"/>
  </g>
  <!-- Mary (blue, kneeling, inclined toward the manger) -->
  <g>
    <path d="M64 176 q-6 -34 18 -46 q14 -6 20 6 l-4 40 z" fill="#3f6bb0"/>
    <circle cx="92" cy="124" r="11" fill="#f5cba7"/>
    <path d="M80 116 q12 -12 24 0 q2 10 -4 12 q-8 -8 -16 0 q-6 -2 -4 -12 z" fill="#35599a"/>
  </g>
  <!-- Joseph (brown, standing, staff) -->
  <g>
    <path d="M156 176 l2 -52 q4 -12 16 -10 q12 2 12 14 l2 48 z" fill="#7a5230"/>
    <circle cx="170" cy="106" r="11" fill="#e8b88a"/>
    <path d="M158 100 q12 -10 24 0 l-2 8 q-10 -6 -20 0 z" fill="#5e3e22"/>
    <rect x="190" y="96" width="4.5" height="80" rx="2" fill="#9a7245"/>
  </g>
  <!-- manger + the Child -->
  <g>
    <path d="M102 168 h44 l-8 14 h-28 z" fill="#9a7245"/>
    <path d="M100 168 l-8 16 M148 168 l8 16" stroke="#7a5a3a" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="124" cy="162" rx="20" ry="8" fill="#e9d8a6"/>
    <circle cx="124" cy="156" r="7" fill="#f5cba7"/>
    <circle cx="124" cy="156" r="10.5" fill="none" stroke="#f2c14e" stroke-width="2" opacity=".85"/>
    <path d="M112 162 q12 8 24 0 l-2 6 q-10 6 -20 0 z" fill="#ffffff"/>
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
// Burst shapes: rays, a halo ring, and sparkle dots — varied per instance.
const BURST = (color, variant = 0) => `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <g stroke="${color}" stroke-width="3.5" stroke-linecap="round" fill="none">
  ${Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + (variant ? 0.26 : 0);
    return `<line x1="${(60 + Math.cos(a) * 16).toFixed(1)}" y1="${(60 + Math.sin(a) * 16).toFixed(1)}" x2="${(60 + Math.cos(a) * 52).toFixed(1)}" y2="${(60 + Math.sin(a) * 52).toFixed(1)}"/>`;
  }).join('')}
  ${variant ? `<circle cx="60" cy="60" r="34" stroke-width="2.2" stroke-dasharray="3 7"/>` : ''}
  </g>
  ${Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    return `<circle cx="${(60 + Math.cos(a) * 56).toFixed(1)}" cy="${(60 + Math.sin(a) * 56).toFixed(1)}" r="2.4" fill="${color}"/>`;
  }).join('')}
</svg>`;

// Small waving US flag (pole on the LEFT — it leads the right→left flight).
const SMALL_FLAG = (x, y, s, waveClass) => `<g transform="translate(${x},${y}) scale(${s})">
  <rect x="0" y="0" width="5" height="92" rx="2.5" fill="#8a6d3b"/>
  <circle cx="2.5" cy="1" r="4" fill="#d4a017"/>
  <g class="cf-flag-cloth ${waveClass}">
    ${Array.from({ length: 7 }, (_, i) => `<rect x="5" y="${4 + i * 8}" width="120" height="8" fill="${i % 2 ? '#ffffff' : '#b22234'}"/>`).join('')}
    <rect x="5" y="4" width="48" height="24" fill="#3c3b6e"/>
    ${Array.from({ length: 6 }, (_, i) => `<circle cx="${13 + (i % 3) * 16}" cy="${11 + Math.floor(i / 3) * 11}" r="2.4" fill="#ffffff"/>`).join('')}
  </g>
</g>`;
// Loose echelon of three flags flying together.
const FLAG_FORMATION_SVG = `<svg viewBox="0 0 330 200" xmlns="http://www.w3.org/2000/svg">
  ${SMALL_FLAG(8, 10, 1.0, 'w1')}
  ${SMALL_FLAG(150, 52, 0.85, 'w2')}
  ${SMALL_FLAG(60, 110, 0.72, 'w3')}
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

const REDUCED = `.cf-holiday-decor svg { width: 100%; height: auto; display: block; }
@media (prefers-reduced-motion: reduce) { .cf-holiday-decor { display: none !important; } }`;

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
  // Santa and the nativity take turns: Santa flies at the top of each 100s
  // cycle; the nativity vignette glows in the corner during the middle.
  christmas: () => {
    const santa = flyby({
      key: 'christmas', art: SANTA_SVG, width: 265, mobileWidth: 165, top: '7vh', duration: 14, every: 86,
    });
    return `${santa}
<!-- holiday decor (christmas nativity) -->
<div class="cf-holiday-decor cf-hd-nativity" aria-hidden="true">${NATIVITY_SVG}</div>
<style>
.cf-hd-nativity {
  position: fixed; bottom: 4vh; right: 2.5vw; width: 215px;
  z-index: 9998; pointer-events: none; opacity: 0;
  animation: cfNativity 100s linear infinite;
  animation-delay: 3s;
}
.cf-hd-nativity .cf-nat-glow { animation: cfNatBreathe 7s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
@keyframes cfNativity {
  0%, 28%  { opacity: 0; }
  33%      { opacity: .95; }
  60%      { opacity: .95; }
  65%, 100%{ opacity: 0; }
}
@keyframes cfNatBreathe { from { opacity: .7; } to { opacity: 1; transform: scale(1.05); } }
@media (max-width: 640px) { .cf-hd-nativity { width: 140px; bottom: 2vh; } }
${REDUCED}
</style>`;
  },

  halloween: () => flyby({
    key: 'halloween', art: BATS_SVG, width: 215, mobileWidth: 135, top: '10vh', duration: 11, every: 19,
    extraCss: `.cf-bat-wing { animation: cfBatFlap .4s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
@keyframes cfBatFlap { from { transform: scaleY(1); } to { transform: scaleY(.4); } }`,
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

  // Flag flies across like Santa; big bold bursts bloom around the top.
  july4: () => {
    const bursts = [
      { x: '8vw', y: '10vh', s: 150, d: 0, c: '#e63946', v: 0 }, { x: '74vw', y: '7vh', s: 180, d: 1.6, c: '#3f51b5', v: 1 },
      { x: '46vw', y: '4vh', s: 130, d: 3.1, c: '#ffd166', v: 0 }, { x: '26vw', y: '15vh', s: 120, d: 4.4, c: '#9aa5b1', v: 1 },
      { x: '88vw', y: '18vh', s: 110, d: 5.6, c: '#e63946', v: 1 }, { x: '60vw', y: '13vh', s: 160, d: 6.8, c: '#3f51b5', v: 0 },
    ].map((b) => `<span class="cf-burst" style="left:${b.x};top:${b.y};width:${b.s}px;animation-delay:${b.d}s">${BURST(b.c, b.v)}</span>`).join('');
    const flag = flyby({
      key: 'july4flag', art: FLAG_FORMATION_SVG, width: 250, mobileWidth: 150, top: '6vh', duration: 13, every: 22,
      extraCss: `.cf-flag-cloth { animation: cfFlagWave 1.1s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: left center; }
.cf-flag-cloth.w2 { animation-delay: .25s; } .cf-flag-cloth.w3 { animation-delay: .5s; }
@keyframes cfFlagWave { from { transform: skewY(-2.4deg); } to { transform: skewY(2.6deg); } }`,
    });
    return `${flag}
<!-- holiday decor (july4 bursts) -->
<div class="cf-holiday-decor cf-hd-july4" aria-hidden="true">${bursts}</div>
<style>
.cf-hd-july4 { position: fixed; inset: 0; z-index: 9998; pointer-events: none; }
.cf-hd-july4 .cf-burst { position: absolute; opacity: 0; animation: cfBurst 8s ease-out infinite; }
@keyframes cfBurst {
  0%   { transform: scale(.1); opacity: 0; }
  5%   { opacity: .95; }
  16%  { transform: scale(1); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
@media (max-width: 640px) { .cf-hd-july4 .cf-burst { transform: scale(.55); } }
${REDUCED}
</style>`;
  },

  // Bottom-right vignette: slow fade-in, then a gentle breathing glow.
  easter: () => `
<!-- holiday decor (easter) -->
<div class="cf-holiday-decor cf-hd-easter" aria-hidden="true">${EASTER_SVG}</div>
<style>
.cf-hd-easter {
  position: fixed; bottom: 4vh; right: 2.5vw; width: 210px;
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
