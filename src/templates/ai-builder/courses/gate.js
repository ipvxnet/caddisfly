// Courses v2 — the enrollment gate. A published course player (/courses/:slug)
// ships ONLY this placeholder in its public HTML (course hero + curriculum outline
// + an enroll / sign-in CTA — never the real lessons). A one-per-page client script
// asks the app worker whether the visitor is an enrolled member; if so it fetches
// the real player from /api/courses/:site/player and injects it (re-executing the
// player's scripts). Sign-in is the same passwordless magic-link flow as the
// Members plugin (POST /api/members/:site/login). Classes `.crsgate-*` — registered
// in the dark-mode lists (gotcha #11). i18n en/es/pt.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SYMBOLS = { usd: '$', eur: '€', gbp: '£', brl: 'R$', cad: 'C$', aud: 'A$', mxn: '$' };
function money(cents, cur) {
  const sym = SYMBOLS[(cur || 'usd').toLowerCase()] || '';
  return `${sym}${((cents || 0) / 100).toFixed(2)}${sym ? '' : ' ' + (cur || '').toUpperCase()}`;
}

const T = {
  en: {
    free: 'Free', curriculum: "What you'll learn", lessons: 'lessons', section: 'Section',
    title_free: 'Enroll to start this course', title_paid: 'Enroll to unlock this course',
    sub_free: "It's free — sign in and you're in.", sub_paid: 'Get full, lifetime access to every lesson.',
    enroll_free: 'Enroll — free', enroll_paid: 'Enroll', signin_to_enroll: 'Sign in to enroll',
    ph: 'you@email.com', send: 'Email me a sign-in link', sent: 'Check your email for a sign-in link.',
    have_account: 'Already enrolled? Sign in', loading: 'Loading…',
    err: 'Something went wrong. Please try again.',
  },
  es: {
    free: 'Gratis', curriculum: 'Lo que aprenderás', lessons: 'lecciones', section: 'Sección',
    title_free: 'Inscríbete para empezar este curso', title_paid: 'Inscríbete para desbloquear este curso',
    sub_free: 'Es gratis — inicia sesión y listo.', sub_paid: 'Obtén acceso completo y de por vida a todas las lecciones.',
    enroll_free: 'Inscribirme — gratis', enroll_paid: 'Inscribirme', signin_to_enroll: 'Inicia sesión para inscribirte',
    ph: 'tu@correo.com', send: 'Envíame un enlace de acceso', sent: 'Revisa tu correo para el enlace de acceso.',
    have_account: '¿Ya inscrito? Inicia sesión', loading: 'Cargando…',
    err: 'Algo salió mal. Inténtalo de nuevo.',
  },
  pt: {
    free: 'Grátis', curriculum: 'O que você vai aprender', lessons: 'aulas', section: 'Seção',
    title_free: 'Inscreva-se para começar este curso', title_paid: 'Inscreva-se para desbloquear este curso',
    sub_free: 'É grátis — entre e pronto.', sub_paid: 'Tenha acesso completo e vitalício a todas as aulas.',
    enroll_free: 'Inscrever-me — grátis', enroll_paid: 'Inscrever-me', signin_to_enroll: 'Entre para se inscrever',
    ph: 'voce@email.com', send: 'Enviar link de acesso', sent: 'Verifique seu e-mail para o link de acesso.',
    have_account: 'Já inscrito? Entrar', loading: 'Carregando…',
    err: 'Algo deu errado. Tente novamente.',
  },
};

const TYPE_ICON = { video: '▶', text: '📄', pdf: '📑', url: '🔗', quiz: '❓' };

/** Curriculum outline (section + lesson TITLES only — safe to show non-members). */
function outline(course, tr) {
  const sections = course.sections || [];
  if (!sections.length) return '';
  const total = sections.reduce((n, s) => n + ((s.lessons || []).length), 0);
  const blocks = sections.map((s) => {
    const lis = (s.lessons || []).map((l) =>
      `<li class="crsgate-lesson"><span class="crsgate-licon" aria-hidden="true">${TYPE_ICON[l.type] || '•'}</span><span class="crsgate-ltitle">${esc(l.title || '')}</span>${l.duration ? `<span class="crsgate-ldur">${esc(l.duration)}</span>` : ''}</li>`
    ).join('');
    return `<div class="crsgate-sec"><div class="crsgate-sectitle">${esc(s.title || '')}</div><ul class="crsgate-lessons">${lis}</ul></div>`;
  }).join('');
  return `<div class="crsgate-curriculum"><h3 class="crsgate-curtitle">${esc(tr.curriculum)} <span class="crsgate-count">· ${total} ${esc(tr.lessons)}</span></h3>${blocks}</div>`;
}

/**
 * Server-rendered placeholder that replaces a course player's body. `course` =
 * getCourseFull result. Shows the hero, marketing copy, curriculum outline and an
 * enroll/sign-in CTA; the gate script swaps in the real player for enrolled members.
 */
export function coursePlayerGate(course, lang = 'en', primaryColor = '#667eea', currency = 'usd') {
  const tr = T[lang] || T.en;
  const isPaid = (course.price_cents || 0) > 0;
  const priceLabel = isPaid ? money(course.price_cents, currency) : tr.free;
  const heroImg = course.image
    ? `<div class="crsgate-hero-img" style="background-image:url('${esc(course.image)}')"></div>` : '';
  const desc = course.subtitle ? `<p class="crsgate-sub">${esc(course.subtitle)}</p>` : '';
  return `
<section class="crsgate" data-course-gate="${esc(course.slug || '')}" data-course-paid="${isPaid ? '1' : '0'}">
  <div class="crsgate-wrap">
    <div class="crsgate-main">
      ${heroImg}
      <h1 class="crsgate-title">${esc(course.title || '')}</h1>
      ${desc}
      ${outline(course, tr)}
    </div>
    <aside class="crsgate-card">
      <div class="crsgate-price">${esc(priceLabel)}</div>
      <h2 class="crsgate-cardtitle">${esc(isPaid ? tr.title_paid : tr.title_free)}</h2>
      <p class="crsgate-cardsub">${esc(isPaid ? tr.sub_paid : tr.sub_free)}</p>
      <div class="crsgate-cta" data-state="loading"><div class="crsgate-loading">${esc(tr.loading)}</div></div>
      <form class="crsgate-form" novalidate hidden>
        <input type="email" class="crsgate-input" placeholder="${esc(tr.ph)}" required autocomplete="email">
        <input type="text" class="crsgate-hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
        <button type="submit" class="crsgate-btn">${esc(tr.send)}</button>
      </form>
      <div class="crsgate-msg" role="status"></div>
    </aside>
  </div>
</section>${gateStyles(primaryColor)}`;
}

/** Shared gate styles (.crsgate-* are registered in the dark lists). */
function gateStyles(primaryColor = '#667eea') {
  return `
<style>
.crsgate { padding:2.5rem 1.25rem 4rem; background:#fff; }
.crsgate-wrap { max-width:1040px; margin:0 auto; display:grid; grid-template-columns:1fr 340px; gap:2.2rem; align-items:start; }
.crsgate-hero-img { width:100%; aspect-ratio:16/9; background-size:cover; background-position:center; border-radius:16px; margin-bottom:1.3rem; }
.crsgate-title { font-size:2rem; font-weight:800; color:#1a202c; margin:0 0 .5rem; line-height:1.15; }
.crsgate-sub { font-size:1.1rem; color:#4a5568; margin:0 0 1.6rem; }
.crsgate-curriculum { margin-top:1.4rem; }
.crsgate-curtitle { font-size:1.2rem; font-weight:700; color:#2d3748; margin:0 0 .9rem; }
.crsgate-count { color:#718096; font-weight:500; font-size:.95rem; }
.crsgate-sec { border:1px solid #edf0f5; border-radius:12px; margin-bottom:.8rem; overflow:hidden; }
.crsgate-sectitle { background:#f8fafc; padding:.7rem .95rem; font-weight:700; color:#475569; font-size:.95rem; }
.crsgate-lessons { list-style:none; margin:0; padding:.4rem 0; }
.crsgate-lesson { display:flex; align-items:center; gap:.6rem; padding:.5rem .95rem; font-size:.93rem; color:#4a5568; }
.crsgate-licon { width:1.3em; text-align:center; opacity:.7; }
.crsgate-ltitle { flex:1; }
.crsgate-ldur { color:#a0aec0; font-size:.82rem; }
.crsgate-card { position:sticky; top:1.5rem; background:#fff; border:1px solid rgba(0,0,0,.09); border-radius:18px; padding:1.8rem 1.6rem; box-shadow:0 10px 34px rgba(0,0,0,.08); }
.crsgate-price { font-size:1.7rem; font-weight:800; color:#1a202c; margin-bottom:.3rem; }
.crsgate-cardtitle { font-size:1.15rem; font-weight:700; color:#1a202c; margin:0 0 .35rem; }
.crsgate-cardsub { color:#4a5568; font-size:.95rem; margin:0 0 1.2rem; }
.crsgate-cta { min-height:2.6rem; }
.crsgate-loading { color:#a0aec0; font-size:.92rem; }
.crsgate-btn, .crsgate-enroll { display:block; width:100%; background:${primaryColor}; color:var(--on-primary,#fff); border:none; padding:.85rem 1rem; border-radius:11px; font-size:1rem; font-weight:700; cursor:pointer; font-family:inherit; text-align:center; }
.crsgate-btn:hover, .crsgate-enroll:hover { filter:brightness(.95); }
.crsgate-enroll[disabled] { opacity:.6; cursor:default; }
.crsgate-form { display:flex; flex-direction:column; gap:.7rem; margin-top:.9rem; }
.crsgate-input { padding:.8rem .9rem; border:1.5px solid #e2e8f0; border-radius:10px; font-size:1rem; font-family:inherit; }
.crsgate-link { display:inline-block; margin-top:.9rem; background:none; border:none; color:${primaryColor}; font-size:.9rem; font-weight:600; cursor:pointer; padding:0; font-family:inherit; }
.crsgate-msg { margin-top:.9rem; color:#166534; font-weight:600; min-height:1.2em; font-size:.93rem; }
@media (max-width:820px){ .crsgate-wrap{ grid-template-columns:1fr; } .crsgate-card{ position:static; } }
</style>`;
}

/**
 * Registry template for the synthetic `course_gate` section (baked by deploy.js in
 * place of the real player). `data` = { course (trimmed), currency, lang }; reads
 * trackId/appOrigin/primary_color from the assembled render config and emits the
 * gate placeholder + its client script together.
 */
export function coursePlayerGateTemplate(data = {}, config = {}) {
  const lang = data.lang || config.lang || 'en';
  const currency = data.currency || config.store_currency || 'usd';
  const primary = config.primary_color || config.primaryColor || '#667eea';
  const course = data.course || {};
  return coursePlayerGate(course, lang, primary, currency)
    + courseGateScript({ siteId: config.trackId || '', appOrigin: config.appOrigin || '', slug: course.slug || '', lang });
}

/**
 * One-per-page client script: resolve enrollment state and reveal the player, or
 * render the right CTA (enroll free / enroll paid / sign in). `appOrigin` is the
 * app worker; member sign-in posts to /api/members/:site/login (shared session).
 */
export function courseGateScript({ siteId, appOrigin, slug, lang = 'en' }) {
  const tr = T[lang] || T.en;
  const cfg = {
    courses: `${appOrigin || ''}/api/courses/${encodeURIComponent(siteId || '')}`,
    members: `${appOrigin || ''}/api/members/${encodeURIComponent(siteId || '')}`,
    slug: slug || '',
    t: {
      enroll_free: tr.enroll_free, enroll_paid: tr.enroll_paid, signin_to_enroll: tr.signin_to_enroll,
      have_account: tr.have_account, sent: tr.sent, err: tr.err,
    },
  };
  return `
<script>
(function(){
  var gate = document.querySelector('[data-course-gate]');
  if (!gate) return;
  var c = ${JSON.stringify(cfg)};
  if (!c.courses || c.courses.indexOf('/api/courses/') === -1) return;
  var slug = encodeURIComponent(c.slug);
  var cta = gate.querySelector('.crsgate-cta');
  var form = gate.querySelector('.crsgate-form');
  var msg = gate.querySelector('.crsgate-msg');

  function execScripts(node){
    node.querySelectorAll('script').forEach(function(old){
      var s = document.createElement('script');
      if (old.src) s.src = old.src; else s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  }
  function revealPlayer(){
    fetch(c.courses + '/player?slug=' + slug, { credentials:'include' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.html){ var w = document.createElement('div'); w.innerHTML = d.html; gate.replaceWith(w); execScripts(w); }
      }).catch(function(){});
  }
  function setMsg(text){ if (msg) msg.textContent = text; }
  function showForm(){ form.hidden = false; var i = form.querySelector('.crsgate-input'); if (i) i.focus(); }

  function enroll(paid, btn){
    if (btn) btn.disabled = true;
    fetch(c.courses + '/enroll', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ slug: c.slug, path: location.pathname }) })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.checkout_url){ location.href = d.checkout_url; return; }
        if (d && d.enrolled){ revealPlayer(); return; }
        if (btn) btn.disabled = false; setMsg(c.t.err);
      }).catch(function(){ if (btn) btn.disabled = false; setMsg(c.t.err); });
  }

  function render(state){
    cta.innerHTML = '';
    cta.setAttribute('data-state', state.enrolled ? 'enrolled' : (state.logged_in ? 'enroll' : 'signin'));
    if (state.enrolled){ revealPlayer(); return; }
    if (state.logged_in){
      // Signed in, not enrolled → one-click enroll (free) or checkout (paid).
      var b = document.createElement('button');
      b.className = 'crsgate-enroll'; b.type = 'button';
      b.textContent = state.is_paid ? c.t.enroll_paid : c.t.enroll_free;
      b.addEventListener('click', function(){ enroll(state.is_paid, b); });
      cta.appendChild(b);
    } else if (state.is_paid){
      // Not signed in, paid → buy directly (email collected at checkout); offer sign-in for past buyers.
      var bp = document.createElement('button');
      bp.className = 'crsgate-enroll'; bp.type = 'button'; bp.textContent = c.t.enroll_paid;
      bp.addEventListener('click', function(){ enroll(true, bp); });
      cta.appendChild(bp);
      var link = document.createElement('button');
      link.className = 'crsgate-link'; link.type = 'button'; link.textContent = c.t.have_account;
      link.addEventListener('click', showForm);
      cta.appendChild(link);
    } else {
      // Not signed in, free → sign in to enroll.
      var bf = document.createElement('button');
      bf.className = 'crsgate-enroll'; bf.type = 'button'; bf.textContent = c.t.signin_to_enroll;
      bf.addEventListener('click', showForm);
      cta.appendChild(bf);
    }
  }

  fetch(c.courses + '/access?slug=' + slug, { credentials:'include' })
    .then(function(r){ return r.json(); })
    .then(function(d){ render(d || {}); })
    .catch(function(){ render({}); });

  // Passwordless sign-in (shared member session) — return here so access re-resolves.
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var email = form.querySelector('.crsgate-input').value.trim();
    if (!email) return;
    var btn = form.querySelector('.crsgate-btn'); btn.disabled = true;
    fetch(c.members + '/login', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: email, return_url: location.href, website: form.querySelector('.crsgate-hp').value }) })
      .then(function(r){ return r.json(); })
      .then(function(d){ setMsg((d && d.success) ? c.t.sent : c.t.err); })
      .catch(function(){ setMsg(c.t.err); })
      .finally(function(){ btn.disabled = false; });
  });
})();
</script>`;
}
