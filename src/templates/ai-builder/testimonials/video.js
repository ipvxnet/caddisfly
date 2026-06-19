// Video testimonials — a grid of cards that show a poster + play button and
// open the clip in a lightbox modal on click (facade pattern: nothing loads
// until the user clicks, so it never weighs on first paint). Each item may
// carry a `video_url` (YouTube / Vimeo / Loom link or an uploaded file); items
// without a video degrade to a clean text testimonial card. Token- & dark-aware.

import { TESTIMONIAL_DEFAULTS } from './cards.js';
import { parseVideo } from '../../../utils/video-embed.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

export function testimonialsVideoTemplate(data, config) {
  const {
    primary_color: primaryColor = '#667eea',
    secondary_color: secondaryColor = '#764ba2',
    font_heading: fontHeading = 'Inter',
    font_body: fontBody = 'Inter',
  } = config;
  const lang = config.lang || 'en';
  // Accessibility labels in the site language (play button + modal close).
  const A11Y = {
    en: { play: 'Play video testimonial', close: 'Close' },
    es: { play: 'Reproducir video testimonio', close: 'Cerrar' },
    pt: { play: 'Reproduzir vídeo depoimento', close: 'Fechar' },
  }[lang] || { play: 'Play video testimonial', close: 'Close' };
  const tx = TESTIMONIAL_DEFAULTS[lang] || TESTIMONIAL_DEFAULTS.en;
  const { heading = tx.heading, testimonials } = data;
  const list = (Array.isArray(testimonials) && testimonials.length) ? testimonials : tx.items;

  const cards = list.map((t) => {
    const quote = t.quote || t.text || '';
    const author = t.author || t.name || '';
    const role = t.position || t.role || '';
    const v = parseVideo(t.video_url || t.video);
    const initial = (author || 'A').charAt(0);
    const meta = `<div class="vt-meta">
        ${t.avatar ? `<img class="vt-avatar" src="${escAttr(t.avatar)}" alt="${escAttr(author)}" width="44" height="44" loading="lazy">` : `<span class="vt-avatar vt-avatar--mono" style="background:${primaryColor};">${esc(initial)}</span>`}
        <div><div class="vt-name">${esc(author)}</div>${role ? `<div class="vt-role" style="color:${primaryColor};">${esc(role)}</div>` : ''}</div>
      </div>`;

    if (!v) {
      // No video → graceful text testimonial.
      return `<figure class="vt-card vt-card--text">
        <blockquote class="vt-quote">${esc(quote)}</blockquote>
        ${meta}
      </figure>`;
    }

    const poster = t.video_poster || v.poster || '';
    const posterStyle = poster
      ? `background-image:url('${escAttr(poster)}')`
      : `background:linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;
    return `<figure class="vt-card">
      <button type="button" class="vt-play" style="${posterStyle}" data-kind="${escAttr(v.kind)}" data-embed="${escAttr(v.embedUrl)}" aria-label="${escAttr(A11Y.play)}${author ? ` — ${escAttr(author)}` : ''}">
        <span class="vt-play-icon" style="color:${primaryColor};">▶</span>
      </button>
      ${quote ? `<blockquote class="vt-quote">${esc(quote)}</blockquote>` : ''}
      ${meta}
    </figure>`;
  }).join('');

  return `
<section class="testimonials-video">
  <div class="vt-container">
    <h2 class="vt-heading" style="font-family:'${fontHeading}',sans-serif;">${esc(heading)}</h2>
    <div class="vt-grid" style="font-family:'${fontBody}',sans-serif;">${cards}</div>
  </div>
</section>

<style>
.testimonials-video { padding: var(--cf-section-pad, 6rem) 2rem; background: #f7fafc; }
.vt-container { max-width: var(--cf-container, 1200px); margin: 0 auto; }
.vt-heading { font-size: 2.6rem; font-weight: 700; color: #1a202c; text-align: center; margin: 0 0 3rem; }
.vt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
.vt-card { background: #fff; border-radius: var(--cf-radius, 16px); box-shadow: var(--cf-shadow-sm, 0 4px 20px rgba(0,0,0,0.08)); padding: 0; margin: 0; overflow: hidden; display: flex; flex-direction: column; }
.vt-card--text { padding: 2rem; }
.vt-play { position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; border: none; cursor: pointer; background-size: cover; background-position: center; }
.vt-play::after { content: ''; position: absolute; inset: 0; background: rgba(0,0,0,0.18); transition: background 0.2s; }
.vt-play:hover::after { background: rgba(0,0,0,0.30); }
.vt-play-icon { position: absolute; inset: 0; margin: auto; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 50%; font-size: 1.4rem; padding-left: 4px; box-shadow: 0 6px 18px rgba(0,0,0,0.25); z-index: 1; transition: transform 0.2s; }
.vt-play:hover .vt-play-icon { transform: scale(1.08); }
.vt-quote { font-size: 1.05rem; line-height: 1.7; color: #2d3748; font-style: italic; margin: 0; padding: 1.5rem 1.5rem 0.75rem; }
.vt-card--text .vt-quote { padding: 0 0 1.25rem; }
.vt-meta { display: flex; align-items: center; gap: 0.85rem; padding: 0 1.5rem 1.5rem; }
.vt-card--text .vt-meta { padding: 0; }
.vt-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
.vt-avatar--mono { display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; }
.vt-name { font-weight: 600; color: #1a202c; }
.vt-role { font-size: 0.9rem; font-weight: 500; }
/* Lightbox */
.vt-modal { position: fixed; inset: 0; z-index: 2147483000; background: rgba(0,0,0,0.82); display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.vt-modal-box { position: relative; width: min(960px, 100%); }
.vt-modal-frame { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 12px; overflow: hidden; }
.vt-modal-frame iframe, .vt-modal-frame video { width: 100%; height: 100%; border: 0; }
.vt-modal-x { position: absolute; top: -2.6rem; right: 0; background: none; border: none; color: #fff; font-size: 2rem; line-height: 1; cursor: pointer; }
@media (max-width: 768px) {
  .testimonials-video { padding: 4rem 1.25rem; }
  .vt-heading { font-size: 2rem; margin-bottom: 2rem; }
  .vt-grid { grid-template-columns: 1fr; }
}
</style>

<script>
(function(){
  if (window.__vtModalInit) return; window.__vtModalInit = true;
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.vt-play'); if (!btn) return;
    e.preventDefault();
    var kind = btn.getAttribute('data-kind'), embed = btn.getAttribute('data-embed');
    if (!embed) return;
    var ov = document.createElement('div'); ov.className = 'vt-modal';
    var player = kind === 'file'
      ? '<video src="' + embed + '" controls autoplay playsinline></video>'
      : '<iframe src="' + embed + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    ov.innerHTML = '<div class="vt-modal-box"><button class="vt-modal-x" aria-label="${escAttr(A11Y.close)}">\\u00D7</button><div class="vt-modal-frame">' + player + '</div></div>';
    function close(){ ov.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if (ev.key === 'Escape') close(); }
    ov.addEventListener('click', function(ev){ if (ev.target === ov || ev.target.closest('.vt-modal-x')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
  });
})();
</script>
  `.trim();
}
