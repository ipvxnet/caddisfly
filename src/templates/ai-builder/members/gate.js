// Members stage 2 — the REAL content gate. A members-only PAGE ships only this
// placeholder in its public HTML (no real content baked in). A one-per-page
// client script asks the app worker if the visitor is a signed-in member; if so
// it fetches the real page body from /api/members/:site/content and injects it
// (re-executing any section scripts). Not signed in → a passwordless sign-in
// form (same magic-link flow as the members widget). Classes `.mbr-gate*` —
// registered in the dark-mode lists (gotcha #11).

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const T = {
  en: { title: 'Members only', sub: 'Sign in to view this page.', ph: 'you@email.com', send: 'Email me a sign-in link', sent: 'Check your email for a sign-in link.', err: 'Something went wrong. Please try again.' },
  es: { title: 'Solo para miembros', sub: 'Inicia sesión para ver esta página.', ph: 'tu@correo.com', send: 'Envíame un enlace de acceso', sent: 'Revisa tu correo para el enlace de acceso.', err: 'Algo salió mal. Inténtalo de nuevo.' },
  pt: { title: 'Somente para membros', sub: 'Entre para ver esta página.', ph: 'voce@email.com', send: 'Enviar link de acesso', sent: 'Verifique seu e-mail para o link de acesso.', err: 'Algo deu errado. Tente novamente.' },
};

/** Server-rendered placeholder that replaces a members-only page's body. */
export function memberGatePlaceholder(lang = 'en', primaryColor = '#667eea') {
  const tr = T[lang] || T.en;
  return `
<section class="mbr-gate" data-member-gate-page="1">
  <div class="mbr-gate-card">
    <div class="mbr-gate-lock" aria-hidden="true">🔒</div>
    <h2 class="mbr-gate-title">${esc(tr.title)}</h2>
    <p class="mbr-gate-sub">${esc(tr.sub)}</p>
    <form class="mbr-gate-form" novalidate>
      <input type="email" class="mbr-gate-input" placeholder="${esc(tr.ph)}" required autocomplete="email">
      <input type="text" class="mbr-gate-hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
      <button type="submit" class="mbr-gate-btn">${esc(tr.send)}</button>
    </form>
    <div class="mbr-gate-msg" role="status"></div>
  </div>
</section>${gateStyles(primaryColor)}`;
}

/** Shared gate card styles (light card; the mbr-gate classes are registered in the dark lists). */
function gateStyles(primaryColor = '#667eea') {
  return `
<style>
.mbr-gate { display:flex; align-items:center; justify-content:center; padding:5rem 1.5rem; min-height:50vh; background:#fff; }
.mbr-gate-card { max-width:440px; width:100%; text-align:center; background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:18px; padding:2.6rem 2rem; box-shadow:0 10px 34px rgba(0,0,0,.08); }
.mbr-gate-lock { font-size:2.4rem; line-height:1; margin-bottom:.6rem; }
.mbr-gate-title { font-size:1.5rem; font-weight:800; color:#1a202c; margin:0 0 .35rem; }
.mbr-gate-sub { color:#4a5568; margin:0 0 1.4rem; }
.mbr-gate-form { display:flex; flex-direction:column; gap:.7rem; }
.mbr-gate-input { padding:.8rem .9rem; border:1.5px solid #e2e8f0; border-radius:10px; font-size:1rem; font-family:inherit; }
.mbr-gate-btn { background:${primaryColor}; color:var(--on-primary,#fff); border:none; padding:.8rem 1rem; border-radius:10px; font-size:1rem; font-weight:700; cursor:pointer; font-family:inherit; }
.mbr-gate-btn:hover { filter:brightness(.95); }
.mbr-gate-msg { margin-top:.9rem; color:#166534; font-weight:600; min-height:1.2em; }
</style>`;
}

/** Per-SECTION gate placeholder (stage 2b): replaces one members-only section's
 *  content. The wrapper carries data-member-gate-section so the gate script can
 *  inject the real section for signed-in members. Reuses the same card + form. */
export function memberGateSectionPlaceholder(sectionId, lang = 'en', primaryColor = '#667eea') {
  const tr = T[lang] || T.en;
  return `
<section class="mbr-gate" data-member-gate-section="${esc(String(sectionId))}">
  <div class="mbr-gate-card">
    <div class="mbr-gate-lock" aria-hidden="true">🔒</div>
    <h2 class="mbr-gate-title">${esc(tr.title)}</h2>
    <p class="mbr-gate-sub">${esc(tr.sub)}</p>
    <form class="mbr-gate-form" novalidate>
      <input type="email" class="mbr-gate-input" placeholder="${esc(tr.ph)}" required autocomplete="email">
      <input type="text" class="mbr-gate-hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
      <button type="submit" class="mbr-gate-btn">${esc(tr.send)}</button>
    </form>
    <div class="mbr-gate-msg" role="status"></div>
  </div>
</section>${gateStyles(primaryColor)}`;
}

/** One-per-page client script: reveal for members, else wire the sign-in form. */
export function memberGateScript({ siteId, appOrigin, slug, lang = 'en' }) {
  const tr = T[lang] || T.en;
  const cfg = { api: `${appOrigin || ''}/api/members/${encodeURIComponent(siteId || '')}`, page: slug || 'index', sent: tr.sent, err: tr.err };
  return `
<script>
(function(){
  var gates = document.querySelectorAll('[data-member-gate-page],[data-member-gate-section]');
  if (!gates.length) return;
  var c = ${JSON.stringify(cfg)};
  if (!c.api || c.api.indexOf('/api/members/') === -1) return;
  // innerHTML doesn't run <script> — re-create them so injected interactive
  // sections (booking, instagram, members widget) initialize.
  function execScripts(node){
    node.querySelectorAll('script').forEach(function(old){
      var s = document.createElement('script');
      if (old.src) s.src = old.src; else s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  }
  function inject(el, html){ var w = document.createElement('div'); w.innerHTML = html; el.replaceWith(w); execScripts(w); }
  function reveal(){
    fetch(c.api + '/content?page=' + encodeURIComponent(c.page), { credentials: 'include' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.html) { var pg = document.querySelector('[data-member-gate-page]'); if (pg) inject(pg, d.html); }
        if (d && d.sections) d.sections.forEach(function(s){ var el = document.querySelector('[data-member-gate-section="' + s.id + '"]'); if (el) inject(el, s.html); });
      }).catch(function(){});
  }
  fetch(c.api + '/me', { credentials: 'include' })
    .then(function(r){ return r.json(); })
    .then(function(d){ if (d && d.logged_in) reveal(); })
    .catch(function(){});
  gates.forEach(function(gate){
    var form = gate.querySelector('.mbr-gate-form'); if (!form) return;
    var msg = gate.querySelector('.mbr-gate-msg');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var email = form.querySelector('.mbr-gate-input').value.trim();
      if (!email) return;
      var btn = form.querySelector('.mbr-gate-btn'); btn.disabled = true;
      fetch(c.api + '/login', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: email, return_url: location.href, website: form.querySelector('.mbr-gate-hp').value }) })
        .then(function(r){ return r.json(); })
        .then(function(d){ msg.textContent = (d && d.success) ? c.sent : c.err; })
        .catch(function(){ msg.textContent = c.err; })
        .finally(function(){ btn.disabled = false; });
    });
  });
})();
</script>`;
}
