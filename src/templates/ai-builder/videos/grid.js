// Videos section — a grid of video cards (YouTube / Vimeo / Loom / uploaded
// file). Each card shows the auto thumbnail (unless a custom picture is set) +
// a play button; clicking opens the clip in a lightbox that supports fullscreen.
// Facade pattern: nothing loads until the user clicks (no weight on first paint).

import { parseVideo } from '../../../utils/video-embed.js';
import { sectionDefault, defaultItems } from '../section-defaults.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

export function videosGridTemplate(data, config) {
  const {
    primary_color: primaryColor = '#667eea',
    secondary_color: secondaryColor = '#764ba2',
    font_heading: fontHeading = 'Inter',
    font_body: fontBody = 'Inter',
  } = config;
  const lang = config.lang || 'en';
  const A11Y = {
    en: { play: 'Play video', close: 'Close', expand: 'Fullscreen' },
    es: { play: 'Reproducir video', close: 'Cerrar', expand: 'Pantalla completa' },
    pt: { play: 'Reproduzir vídeo', close: 'Fechar', expand: 'Tela cheia' },
  }[lang] || { play: 'Play video', close: 'Close', expand: 'Fullscreen' };

  const {
    heading = sectionDefault(lang, 'videos', 0),
    subheading = sectionDefault(lang, 'videos', 1),
    videos,
  } = data;
  const list = (Array.isArray(videos) && videos.length) ? videos : defaultItems(lang, 'videos-grid');

  const cards = list.map((it) => {
    const v = parseVideo(it.video_url || it.video || '');
    const title = it.title || '';
    const desc = it.description || '';
    const poster = it.thumbnail || it.video_poster || (v && v.poster) || '';
    const posterStyle = poster
      ? `background-image:url('${escAttr(poster)}')`
      : `background:linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;
    const playInner = `<span class="vg-play-icon" style="color:${primaryColor};">▶</span>`;
    const media = v
      ? `<button type="button" class="vg-play" style="${posterStyle}" data-kind="${escAttr(v.kind)}" data-embed="${escAttr(v.embedUrl)}" aria-label="${escAttr(A11Y.play)}${title ? ` — ${escAttr(title)}` : ''}">${playInner}</button>`
      : `<div class="vg-play vg-play--empty" style="${posterStyle}"></div>`;
    const body = (title || desc)
      ? `<figcaption class="vg-body">${title ? `<h3 class="vg-title">${esc(title)}</h3>` : ''}${desc ? `<p class="vg-desc">${esc(desc)}</p>` : ''}</figcaption>`
      : '';
    return `<figure class="vg-card">${media}${body}</figure>`;
  }).join('');

  return `
<section class="videos-section">
  <div class="vg-container">
    <div class="vg-header">
      <h2 class="vg-heading" style="font-family:'${fontHeading}',sans-serif;">${esc(heading)}</h2>
      ${subheading ? `<p class="vg-sub">${esc(subheading)}</p>` : ''}
    </div>
    <div class="vg-grid" style="font-family:'${fontBody}',sans-serif;">${cards}</div>
  </div>
</section>

<style>
.videos-section { padding: var(--cf-section-pad, 5rem) 2rem; background: #f7fafc; }
.vg-container { max-width: var(--cf-container, 1200px); margin: 0 auto; }
.vg-header { text-align: center; margin-bottom: 3rem; }
.vg-heading { font-size: clamp(1.8rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; margin: 0 0 0.75rem; }
.vg-sub { font-size: 1.15rem; color: #4a5568; margin: 0; }
.vg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
.vg-card { background: #fff; border-radius: var(--cf-radius, 16px); box-shadow: var(--cf-shadow-sm, 0 4px 20px rgba(0,0,0,0.08)); overflow: hidden; margin: 0; display: flex; flex-direction: column; }
.vg-play { position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; border: none; cursor: pointer; background-size: cover; background-position: center; }
.vg-play--empty { cursor: default; }
.vg-play::after { content: ''; position: absolute; inset: 0; background: rgba(0,0,0,0.18); transition: background 0.2s; }
.vg-play:hover::after { background: rgba(0,0,0,0.32); }
.vg-play-icon { position: absolute; inset: 0; margin: auto; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 50%; font-size: 1.4rem; padding-left: 4px; box-shadow: 0 6px 18px rgba(0,0,0,0.25); z-index: 1; transition: transform 0.2s; }
.vg-play:hover .vg-play-icon { transform: scale(1.08); }
.vg-body { padding: 1.25rem 1.4rem 1.5rem; }
.vg-title { font-family: '${fontHeading}', sans-serif; font-size: 1.2rem; font-weight: 700; color: #1a202c; margin: 0 0 0.4rem; }
.vg-desc { font-size: 1rem; line-height: 1.6; color: #4a5568; margin: 0; }
.vg-modal { position: fixed; inset: 0; z-index: 2147483000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.vg-modal-box { position: relative; width: min(1040px, 100%); }
.vg-modal-frame { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 12px; overflow: hidden; }
.vg-modal-frame iframe, .vg-modal-frame video { width: 100%; height: 100%; border: 0; }
.vg-modal-bar { position: absolute; top: -2.7rem; right: 0; display: flex; gap: 1rem; }
.vg-modal-bar button { background: none; border: none; color: #fff; font-size: 1.5rem; line-height: 1; cursor: pointer; }
@media (max-width: 768px) {
  .videos-section { padding: 3.5rem 1.25rem; }
  .vg-grid { grid-template-columns: 1fr; }
}
</style>

<script>
(function(){
  if (window.__vgModalInit) return; window.__vgModalInit = true;
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.vg-play'); if (!btn) return;
    var kind = btn.getAttribute('data-kind'), embed = btn.getAttribute('data-embed');
    if (!embed) return;
    e.preventDefault();
    var ov = document.createElement('div'); ov.className = 'vg-modal';
    var player = kind === 'file'
      ? '<video src="' + embed + '" controls autoplay playsinline></video>'
      : '<iframe src="' + embed + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    ov.innerHTML = '<div class="vg-modal-box"><div class="vg-modal-bar"><button class="vg-modal-full" aria-label="${escAttr(A11Y.expand)}" title="${escAttr(A11Y.expand)}">⛶</button><button class="vg-modal-x" aria-label="${escAttr(A11Y.close)}">\\u00D7</button></div><div class="vg-modal-frame">' + player + '</div></div>';
    function close(){ ov.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if (ev.key === 'Escape') close(); }
    ov.addEventListener('click', function(ev){
      if (ev.target === ov || ev.target.closest('.vg-modal-x')) { close(); return; }
      if (ev.target.closest('.vg-modal-full')) {
        var fr = ov.querySelector('.vg-modal-frame');
        if (fr && fr.requestFullscreen) fr.requestFullscreen();
        else { var m = fr && fr.firstElementChild; if (m && m.requestFullscreen) m.requestFullscreen(); }
      }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
  });
})();
</script>
  `.trim();
}
