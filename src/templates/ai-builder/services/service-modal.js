// Shared building blocks for clickable service cards: an image tile (AI-generated
// picture, falling back to the emoji icon) and a single mobile-friendly modal
// that shows the full service description + a contact/booking CTA.
//
// Used by both services variants (cards, icon-grid). The modal markup + script
// are emitted once per services section; the script is idempotent (guarded) so
// re-injected previews don't double-bind — see the modal-injected-script lesson.

function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CTA = {
  en: { book: 'Book now', contact: 'Get in touch', close: 'Close', more: 'Learn more' },
  es: { book: 'Reservar ahora', contact: 'Contáctanos', close: 'Cerrar', more: 'Saber más' },
  pt: { book: 'Agendar agora', contact: 'Fale conosco', close: 'Fechar', more: 'Saber mais' },
};

export function serviceLabels(lang) {
  return CTA[lang] || CTA.en;
}

/** Per-card data attributes carrying the modal payload (full details + image). */
export function serviceCardAttrs(service) {
  const details = service.details || service.description || '';
  return `data-svc-card data-svc-title="${escAttr(service.title || '')}" data-svc-details="${escAttr(details)}" data-svc-img="${escAttr(service.image_url || '')}"`;
}

/**
 * The media tile for a card: the AI image when present, else the gradient icon
 * tile (keeps the old look as a graceful fallback).
 */
export function serviceMediaTile(service, primaryColor, secondaryColor) {
  if (service.image_url) {
    return `<div class="svc-media"><img src="${escAttr(service.image_url)}" alt="${escAttr(service.title || '')}" loading="lazy"></div>`;
  }
  return `<div class="svc-media svc-media--icon" style="background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});">${escHtml(service.icon || '✨')}</div>`;
}

/**
 * The single modal + its styles + idempotent open/close script, plus shared
 * media-tile CSS. Append once after the services grid.
 * @param {object} config - render config (lang, primary_color, booking_services)
 */
export function serviceModalAssets(config = {}) {
  const lang = config.lang || 'en';
  const t = serviceLabels(lang);
  const primary = config.primary_color || '#667eea';
  const hasBooking = Array.isArray(config.booking_services) && config.booking_services.length > 0;
  const ctaHref = hasBooking ? '#booking' : '#contact';
  const ctaLabel = hasBooking ? t.book : t.contact;

  return `
<div class="cf-svc-modal" id="cf-svc-modal" hidden>
  <div class="cf-svc-modal__backdrop" data-svc-close></div>
  <div class="cf-svc-modal__card" role="dialog" aria-modal="true" aria-labelledby="cf-svc-title">
    <button class="cf-svc-modal__x" type="button" data-svc-close aria-label="${escAttr(t.close)}">&times;</button>
    <img class="cf-svc-modal__img" id="cf-svc-img" alt="" hidden>
    <h3 class="cf-svc-modal__title" id="cf-svc-title"></h3>
    <p class="cf-svc-modal__body" id="cf-svc-body"></p>
    <a class="cf-svc-modal__cta" id="cf-svc-cta" href="${escAttr(ctaHref)}">${escHtml(ctaLabel)}</a>
  </div>
</div>

<style>
.svc-media {
  width: 100%; aspect-ratio: 16 / 10; border-radius: var(--cf-img-radius, 14px); overflow: hidden;
  margin-bottom: 1.5rem; background: #edf2f7;
}
.svc-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.svc-media--icon {
  aspect-ratio: auto; width: 70px; height: 70px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center; font-size: 2rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.svc-more { display: inline-block; margin-top: .25rem; font-weight: 600; color: ${primary}; }

.cf-svc-modal[hidden] { display: none; }
.cf-svc-modal {
  position: fixed; inset: 0; z-index: 10000; display: flex;
  align-items: center; justify-content: center; padding: 1rem;
}
.cf-svc-modal__backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); backdrop-filter: blur(2px); }
.cf-svc-modal__card {
  position: relative; z-index: 1; background: #fff; border-radius: var(--cf-radius, 16px);
  max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto;
  padding: 1.75rem; box-shadow: 0 24px 60px rgba(0,0,0,.35);
  animation: cfSvcIn .22s ease-out;
}
@keyframes cfSvcIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
.cf-svc-modal__x {
  position: absolute; top: .6rem; right: .8rem; background: none; border: none;
  font-size: 1.9rem; line-height: 1; color: #718096; cursor: pointer; padding: .2rem;
}
.cf-svc-modal__x:hover { color: #1a202c; }
.cf-svc-modal__img { width: 100%; border-radius: 12px; margin-bottom: 1.1rem; max-height: 260px; object-fit: cover; }
.cf-svc-modal__title { font-size: 1.6rem; font-weight: 700; color: #1a202c; margin: 0 0 .8rem; padding-right: 1.5rem; }
.cf-svc-modal__body { font-size: 1.05rem; line-height: 1.7; color: #4a5568; margin: 0 0 1.5rem; white-space: pre-line; }
.cf-svc-modal__cta {
  display: inline-block; background: ${primary}; color: #fff; text-decoration: none;
  padding: .85rem 1.8rem; border-radius: 10px; font-weight: 600;
}
.cf-svc-modal__cta:hover { opacity: .92; }
@media (max-width: 600px) {
  .cf-svc-modal { padding: 0; align-items: flex-end; }
  .cf-svc-modal__card { max-width: 100%; max-height: 92vh; border-radius: 18px 18px 0 0; padding: 1.5rem 1.25rem 2rem; }
}
</style>

<script>
(function () {
  if (window.__cfSvcModal) return; window.__cfSvcModal = 1;
  var modal = document.getElementById('cf-svc-modal');
  if (!modal) return;
  var imgEl = document.getElementById('cf-svc-img');
  var titleEl = document.getElementById('cf-svc-title');
  var bodyEl = document.getElementById('cf-svc-body');
  function open(card) {
    titleEl.textContent = card.getAttribute('data-svc-title') || '';
    bodyEl.textContent = card.getAttribute('data-svc-details') || '';
    var img = card.getAttribute('data-svc-img') || '';
    if (img) { imgEl.src = img; imgEl.hidden = false; } else { imgEl.hidden = true; imgEl.removeAttribute('src'); }
    modal.hidden = false; document.body.style.overflow = 'hidden';
  }
  function close() { modal.hidden = true; document.body.style.overflow = ''; }
  document.addEventListener('click', function (e) {
    var card = e.target.closest ? e.target.closest('[data-svc-card]') : null;
    if (card) { e.preventDefault(); open(card); return; }
    if (e.target.closest && e.target.closest('[data-svc-close]')) close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });
})();
</script>
`;
}
