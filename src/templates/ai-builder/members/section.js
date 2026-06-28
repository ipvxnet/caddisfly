// 👤 Members — ADDABLE body section (Members/Auth plugin). A passwordless
// sign-in / account widget the merchant can drop on any page. Renders BOTH
// states (logged-out form + logged-in greeting) and toggles client-side after
// asking the app worker (GET /api/members/:site/me, credentialed) — published
// static sites have no server render per-visitor. Login emails a magic link.
// Classes `.mbr-*`; registered in the dark-mode lists (gotcha #11).

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const T = {
  en: { heading: 'Member sign-in', sub: 'Sign in to your account.', email_ph: 'you@email.com', send: 'Email me a sign-in link', sent: 'Check your email for a sign-in link.', signed_in: 'Signed in as', logout: 'Log out', err: 'Something went wrong. Please try again.' },
  es: { heading: 'Acceso de miembros', sub: 'Inicia sesión en tu cuenta.', email_ph: 'tu@correo.com', send: 'Envíame un enlace de acceso', sent: 'Revisa tu correo para el enlace de acceso.', signed_in: 'Sesión iniciada como', logout: 'Cerrar sesión', err: 'Algo salió mal. Inténtalo de nuevo.' },
  pt: { heading: 'Acesso de membros', sub: 'Entre na sua conta.', email_ph: 'voce@email.com', send: 'Enviar link de acesso', sent: 'Verifique seu e-mail para o link de acesso.', signed_in: 'Conectado como', logout: 'Sair', err: 'Algo deu errado. Tente novamente.' },
};

export function membersSectionTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = config.lang || 'en';
  const tr = T[lang] || T.en;
  const heading = data.heading || tr.heading;
  const subheading = data.subheading || tr.sub;
  const published = !!config.trackId;
  const siteId = config.trackId || '';
  const apiBase = published ? (config.appOrigin || 'https://caddisfly.ai') : '';

  const styles = `
<style>
.mbr-section { padding: 4rem 2rem; background: #fff; }
.mbr-card { max-width: 460px; margin: 0 auto; background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 16px; padding: 2.2rem 2rem; box-shadow: 0 8px 28px rgba(0,0,0,.07); text-align: center; }
.mbr-heading { font-family: ${font_heading}, sans-serif; font-size: clamp(1.6rem, 2.5vw, 2rem); font-weight: 700; color: #1a202c; margin: 0 0 .4rem; }
.mbr-sub { color: #4a5568; margin: 0 0 1.4rem; font-size: 1rem; }
.mbr-form { display: flex; flex-direction: column; gap: .7rem; }
.mbr-input { padding: .8rem .9rem; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 1rem; font-family: inherit; }
.mbr-btn { background: ${primary_color}; color: var(--on-primary, #fff); border: none; padding: .8rem 1rem; border-radius: 10px; font-size: 1rem; font-weight: 700; cursor: pointer; font-family: inherit; }
.mbr-btn:hover { filter: brightness(.95); }
.mbr-msg { margin-top: .9rem; color: #166534; font-weight: 600; min-height: 1.2em; }
.mbr-msg.err { color: #b91c1c; }
.mbr-account { display: none; }
.mbr-who { color: #1a202c; font-weight: 600; margin-bottom: 1rem; }
.mbr-who span { color: ${primary_color}; }
.mbr-logout { background: transparent; color: #4a5568; border: 1.5px solid #e2e8f0; padding: .6rem 1.1rem; border-radius: 10px; font-weight: 600; cursor: pointer; font-family: inherit; }
@media (max-width: 600px) { .mbr-section { padding: 2.5rem 1.25rem; } }
</style>`;

  const cfg = {
    site: siteId,
    api: apiBase + '/api/members/' + encodeURIComponent(siteId),
    msgs: { sent: tr.sent, signed_in: tr.signed_in, err: tr.err },
  };

  const script = `
<script>
(function(){
  var all = document.querySelectorAll('.mbr-section[data-mbr]');
  var root = all[all.length-1];
  if (!root || root.__mbrInit) return; root.__mbrInit = 1;
  var c = ${JSON.stringify(cfg)};
  if (!c.site) return; // not published yet — login only works on the live site
  var login = root.querySelector('.mbr-login');
  var account = root.querySelector('.mbr-account');
  var form = root.querySelector('.mbr-form');
  var msg = root.querySelector('.mbr-msg');
  var who = root.querySelector('.mbr-who span');
  function show(authed, email){
    login.style.display = authed ? 'none' : '';
    account.style.display = authed ? 'block' : 'none';
    if (authed && who) who.textContent = email || '';
  }
  fetch(c.api + '/me', { credentials: 'include' })
    .then(function(r){ return r.json(); })
    .then(function(d){ show(!!(d && d.logged_in), d && d.email); })
    .catch(function(){ show(false); });
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var email = form.querySelector('.mbr-input').value.trim();
    if (!email) return;
    var btn = form.querySelector('.mbr-btn'); btn.disabled = true;
    msg.className = 'mbr-msg';
    fetch(c.api + '/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, return_url: location.href, website: form.querySelector('.mbr-hp').value })
    }).then(function(r){ return r.json(); })
      .then(function(d){ msg.textContent = (d && d.success) ? c.msgs.sent : c.msgs.err; if (!(d&&d.success)) msg.className='mbr-msg err'; })
      .catch(function(){ msg.textContent = c.msgs.err; msg.className='mbr-msg err'; })
      .finally(function(){ btn.disabled = false; });
  });
  root.querySelector('.mbr-logout').addEventListener('click', function(){
    fetch(c.api + '/logout', { method: 'POST', credentials: 'include' })
      .then(function(){ show(false); });
  });
})();
</script>`;

  return `
<section class="mbr-section" data-mbr="1">
  <div class="mbr-card">
    <h2 class="mbr-heading">${esc(heading)}</h2>
    <p class="mbr-sub">${esc(subheading)}</p>
    <div class="mbr-login">
      <form class="mbr-form" novalidate>
        <input type="email" class="mbr-input" placeholder="${esc(tr.email_ph)}" required autocomplete="email">
        <input type="text" class="mbr-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
        <button type="submit" class="mbr-btn">${esc(tr.send)}</button>
      </form>
      <div class="mbr-msg"></div>
    </div>
    <div class="mbr-account">
      <p class="mbr-who">${esc(tr.signed_in)} <span></span></p>
      <button type="button" class="mbr-logout">${esc(tr.logout)}</button>
    </div>
  </div>
</section>${styles}${script}`.trim();
}
