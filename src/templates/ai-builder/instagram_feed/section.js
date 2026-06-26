// 📷 Instagram Feed — ADDABLE body section (Instagram Feed plugin). Shows the
// merchant's latest Instagram posts in a grid, each linking to the post on
// Instagram. The feed is fetched LIVE in the browser from our public proxy
// (/api/instagram/feed) which reads the merchant's keyless Behold.so feed and
// edge-caches it — so a published static site stays fresh WITHOUT a republish.
// Config (Behold feed id, heading, count) lives in the section content_json.
// Classes are `.igf-*`. Registered in DARK_SURFACE_SECTIONS/.igf-card (gotcha #11).

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const T = {
  en: { heading: "What's happening", empty: 'Add your Instagram feed ID to show your latest posts here.', follow: 'Follow us on Instagram →' },
  es: { heading: 'Lo último', empty: 'Agrega el ID de tu feed de Instagram para mostrar tus publicaciones aquí.', follow: 'Síguenos en Instagram →' },
  pt: { heading: 'O que há de novo', empty: 'Adicione o ID do seu feed do Instagram para exibir suas publicações aqui.', follow: 'Siga-nos no Instagram →' },
};

export function instagramFeedSectionTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const tr = T[lang] || T.en;
  const heading = data.heading || tr.heading;
  const feedId = String(data.feed_id || '').trim();
  const count = Math.min(Math.max(parseInt(data.count, 10) || 6, 1), 24);
  // The app origin that hosts the proxy. Published sites live on a different
  // origin (caddisfly.app) and call cross-origin (CORS is applied globally);
  // the editor/preview is same-origin so it uses a relative path. Mirrors the
  // booking widget's apiBase pattern.
  const published = !!config.trackId;
  const apiBase = published ? (config.appOrigin || 'https://caddisfly.ai') : '';

  const styles = `
<style>
.igf-section { padding: 5rem 2rem; background: #fff; }
.igf-container { max-width: 1100px; margin: 0 auto; }
.igf-header { text-align: center; margin-bottom: 2.5rem; }
.igf-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(2rem, 3vw, 2.5rem); font-weight: 700; color: #1a202c; }
.igf-sub { font-size: 1.15rem; color: #4a5568; margin-top: .6rem; }
.igf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 1rem; }
.igf-card { position: relative; display: block; aspect-ratio: 1 / 1; border-radius: 12px; overflow: hidden; background: #f1f1f4; text-decoration: none; }
.igf-card img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s ease; }
.igf-card:hover img { transform: scale(1.05); }
.igf-vid-badge { position: absolute; top: .5rem; right: .5rem; font-size: 1rem; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
.igf-follow { display: inline-block; margin-top: 2rem; color: ${primary_color}; font-weight: 700; text-decoration: none; }
.igf-empty { text-align: center; color: #718096; border: 2px dashed #e2e8f0; border-radius: 14px; padding: 2.5rem 1.5rem; max-width: 640px; margin: 0 auto; }
@media (max-width: 768px) { .igf-section { padding: 3rem 1.25rem; } .igf-grid { grid-template-columns: repeat(2, 1fr); gap: .6rem; } }
</style>`;

  // No feed configured yet — show a hint in the editor/preview, hide on a live site.
  if (!feedId) {
    if (published) return ''; // published site: render nothing
    return `<section class="igf-section"><div class="igf-container"><div class="igf-empty">📷 ${esc(tr.empty)}</div></div></section>${styles}`;
  }

  const cfg = {
    api: apiBase + '/api/instagram/feed',
    feed: feedId,
    n: count,
    follow: tr.follow,
  };

  // Self-contained loader: fetches the cached feed and fills the grid. Guarded
  // so multiple Instagram sections on one page each initialize once (gotcha #11).
  const script = `
<script>
(function(){
  var root = document.currentScript && document.currentScript.previousElementSibling;
  if (!root || !root.classList || !root.classList.contains('igf-section')) {
    var all = document.querySelectorAll('.igf-section[data-igf]'); root = all[all.length-1];
  }
  if (!root || root.__igfInit) return; root.__igfInit = 1;
  var c = ${JSON.stringify(cfg)};
  var grid = root.querySelector('.igf-grid');
  var follow = root.querySelector('.igf-follow');
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];}); }
  fetch(c.api + '?feed=' + encodeURIComponent(c.feed) + '&n=' + c.n)
    .then(function(r){ return r.json(); })
    .then(function(d){
      var posts = (d && d.posts) || [];
      if (!posts.length) { root.style.display = 'none'; return; }
      grid.innerHTML = posts.map(function(p){
        return '<a class="igf-card" href="' + esc(p.permalink) + '" target="_blank" rel="noopener">'
          + '<img src="' + esc(p.image) + '" alt="' + esc(p.alt) + '" loading="lazy">'
          + (p.video ? '<span class="igf-vid-badge">\\u25B6</span>' : '')
          + '</a>';
      }).join('');
      if (follow && d.username) { follow.href = 'https://www.instagram.com/' + esc(d.username) + '/'; follow.style.display = 'inline-block'; }
    })
    .catch(function(){ root.style.display = 'none'; });
})();
</script>`;

  return `
<section class="igf-section" data-igf="1">
  <div class="igf-container">
    <div class="igf-header">
      <h2 class="igf-heading">${esc(heading)}</h2>
      ${data.subheading ? `<p class="igf-sub">${esc(data.subheading)}</p>` : ''}
    </div>
    <div class="igf-grid" aria-busy="true"></div>
    <div style="text-align:center"><a class="igf-follow" href="https://www.instagram.com/" target="_blank" rel="noopener" style="display:none">${esc(tr.follow)}</a></div>
  </div>
</section>${styles}${script}`.trim();
}
