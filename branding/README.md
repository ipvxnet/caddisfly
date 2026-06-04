# Caddisfly brand assets

Logo direction: **Concept 2 — Continuous Wing "C"**. One unbroken gradient stroke that reads
as both a caddisfly wing and a lowercase "c". The animated version draws itself, then the head
dot and antenna pop in — a generative, "made-by-AI" feel.

## Colors

Brand gradient (top-left → bottom-right):

| Stop | Hex |
|------|-----|
| 0%   | `#667eea` |
| 55%  | `#764ba2` |
| 100% | `#f093fb` |

`.ai` suffix neutral: `#9aa3b8` on light, `#7c84a0` on dark.

## Files

| File | Use |
|------|-----|
| `caddisfly-mark-animated.svg` | Mark only, self-drawing animation (loops). App icon / hero accent. |
| `caddisfly-mark.svg` | Mark only, static. Favicon, small sizes, print. |
| `caddisfly-wordmark-light.svg` | Mark + `caddisfly.ai`, for light backgrounds. |
| `caddisfly-wordmark-dark.svg` | Mark + `caddisfly.ai`, for dark backgrounds. |
| `caddisfly-wordmark-reversed.svg` | All-white version for the purple hero / colored backgrounds. |
| `caddisfly-logos.html` | The full concept exploration (all 4 directions + taglines). |

All SVGs honor `prefers-reduced-motion` (animation disabled, mark shown fully resolved).

## In the app

The reversed animated wordmark is inlined into the landing-page header
(`src/routes/public/ai-builder-landing.js`) so the animation runs without an extra request.

## Notes

- Wordmark text uses **Inter** (`font-weight: 800`), matching the site. For pixel-perfect
  rendering in environments without Inter, convert the `<text>` to outlined paths before export.
- The animation loop is 3.4s. To play once instead of looping, change `infinite` → `1` in the
  `.cf-*` animation rules.
