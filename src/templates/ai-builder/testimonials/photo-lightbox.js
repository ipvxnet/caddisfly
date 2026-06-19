// Shared "customer photo" lightbox for testimonial variants. A photo with the
// `data-tst-img` attribute (added via lightboxAttrs) becomes clickable and opens
// a centered modal showing the larger picture plus the quote and name/role —
// the same facade→modal feel as the video variant. Lazy: nothing happens until
// the user clicks. One delegated listener per page (guarded).

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

const CLOSE_LABEL = { en: 'Close', es: 'Cerrar', pt: 'Fechar' };
const VIEW_LABEL = { en: 'View photo', es: 'Ver foto', pt: 'Ver foto' };

/** data-* attributes (+ aria-label) for a clickable testimonial photo. */
export function lightboxAttrs({ img, name, role, quote }, lang = 'en') {
  const view = VIEW_LABEL[lang] || VIEW_LABEL.en;
  return `data-tst-img="${escAttr(img || '')}" data-tst-name="${escAttr(name || '')}" data-tst-role="${escAttr(role || '')}" data-tst-quote="${escAttr(quote || '')}" aria-label="${escAttr(view)}${name ? ` — ${escAttr(name)}` : ''}"`;
}

/** Shared lightbox CSS + JS — include once per section (guarded globally). */
export function photoLightboxAssets(primaryColor = '#667eea', lang = 'en') {
  const close = (CLOSE_LABEL[lang] || CLOSE_LABEL.en);
  return `
<style>
.tstlb-trigger { cursor: zoom-in; }
.tstlb { position: fixed; inset: 0; z-index: 2147483000; background: rgba(0,0,0,0.82); display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.tstlb-box { position: relative; background: #fff; border-radius: 16px; max-width: 460px; width: 100%; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,0.4); }
.tstlb-img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; object-position: center 28%; display: block; }
.tstlb-body { padding: 1.5rem 1.75rem 1.75rem; text-align: center; }
.tstlb-quote { font-size: 1.15rem; line-height: 1.6; color: #2d3748; font-style: italic; margin: 0 0 1rem; }
.tstlb-name { font-weight: 700; color: #1a202c; font-size: 1.05rem; }
.tstlb-role { font-size: 0.9rem; font-weight: 500; color: ${primaryColor}; margin-top: 0.15rem; }
.tstlb-x { position: absolute; top: 0.6rem; right: 0.6rem; width: 36px; height: 36px; border: none; border-radius: 50%; background: rgba(0,0,0,0.45); color: #fff; font-size: 1.4rem; line-height: 1; cursor: pointer; }
</style>
<script>
(function(){
  if (window.__tstPhotoLightbox) return; window.__tstPhotoLightbox = true;
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-tst-img]'); if (!t) return;
    var img = t.getAttribute('data-tst-img'); if (!img) return;
    e.preventDefault();
    var ov = document.createElement('div'); ov.className = 'tstlb';
    var box = document.createElement('div'); box.className = 'tstlb-box';
    var x = document.createElement('button'); x.className = 'tstlb-x'; x.type = 'button'; x.setAttribute('aria-label', ${JSON.stringify(close)}); x.textContent = '\\u00D7';
    var im = document.createElement('img'); im.className = 'tstlb-img'; im.src = img; im.alt = t.getAttribute('data-tst-name') || '';
    var body = document.createElement('div'); body.className = 'tstlb-body';
    var q = t.getAttribute('data-tst-quote'); if (q) { var bq = document.createElement('blockquote'); bq.className = 'tstlb-quote'; bq.textContent = '\\u201C' + q + '\\u201D'; body.appendChild(bq); }
    var nm = t.getAttribute('data-tst-name'); if (nm) { var nd = document.createElement('div'); nd.className = 'tstlb-name'; nd.textContent = nm; body.appendChild(nd); }
    var rl = t.getAttribute('data-tst-role'); if (rl) { var rd = document.createElement('div'); rd.className = 'tstlb-role'; rd.textContent = rl; body.appendChild(rd); }
    box.appendChild(x); box.appendChild(im); box.appendChild(body); ov.appendChild(box); document.body.appendChild(ov);
    function done(){ ov.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev){ if (ev.key === 'Escape') done(); }
    ov.addEventListener('click', function(ev){ if (ev.target === ov || ev.target.closest('.tstlb-x')) done(); });
    document.addEventListener('keydown', onKey);
  });
})();
</script>`;
}
