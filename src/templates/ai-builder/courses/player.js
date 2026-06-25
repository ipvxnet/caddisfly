// 📚 course_player — the /courses/:slug page body (Courses plugin). Renders one
// course: hero + a two-pane player (curriculum sidebar + lesson content). All
// lesson content is pre-rendered into hidden panes and toggled CLIENT-SIDE (no
// auth, no server) — the static-v1 model. Lesson types: text/video/pdf/url/quiz;
// quizzes are SELF-CHECK (answers embedded, graded in the browser, nothing
// stored). Paywall + buy = Phase 5 (paid courses currently show all lessons).
// Inline JS uses event delegation + data-attrs (codebase gotcha #29 safe).
// Data comes via content_json (coursePlayerSection in utils/course-render.js).

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(cents, currency, lang) {
  try { return new Intl.NumberFormat(lang, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`; }
}

const T = {
  en: { free: 'Free', by: 'By', curriculum: 'Curriculum', check: 'Check answers', passed: 'You passed — {p}%', failed: 'Score: {p}% — review and try again', open_res: 'Open resource ↗', download: 'Download', back: '← All courses', lessons: 'lessons', preview: 'Preview' },
  es: { free: 'Gratis', by: 'Por', curriculum: 'Temario', check: 'Comprobar respuestas', passed: 'Aprobaste — {p}%', failed: 'Puntuación: {p}% — repasa e inténtalo de nuevo', open_res: 'Abrir recurso ↗', download: 'Descargar', back: '← Todos los cursos', lessons: 'lecciones', preview: 'Vista previa' },
  pt: { free: 'Grátis', by: 'Por', curriculum: 'Conteúdo', check: 'Verificar respostas', passed: 'Você passou — {p}%', failed: 'Pontuação: {p}% — revise e tente de novo', open_res: 'Abrir recurso ↗', download: 'Baixar', back: '← Todos os cursos', lessons: 'aulas', preview: 'Prévia' },
};

const ICON = { video: '🎬', text: '📄', pdf: '📕', url: '🔗', quiz: '❓' };

function videoEmbed(url) {
  const u = String(url || '');
  let m;
  if ((m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/))) {
    return `<div class="crs-video-wrap"><iframe class="crs-video" src="https://www.youtube.com/embed/${m[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  if ((m = u.match(/vimeo\.com\/(\d+)/))) {
    return `<div class="crs-video-wrap"><iframe class="crs-video" src="https://player.vimeo.com/video/${m[1]}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  if (u) return `<div class="crs-video-wrap"><video class="crs-video" controls src="${esc(u)}"></video></div>`;
  return '';
}

function lessonContent(l, tr) {
  if (l.type === 'video') return videoEmbed(l.media_url);
  if (l.type === 'pdf') {
    return l.media_url
      ? `<div class="crs-pdf-wrap"><iframe class="crs-pdf" src="${esc(l.media_url)}"></iframe></div><p><a class="crs-reslink" href="${esc(l.media_url)}" target="_blank" rel="noopener">${esc(tr.download)} ↓</a></p>`
      : '';
  }
  if (l.type === 'url') {
    return l.media_url ? `<p><a class="crs-reslink" href="${esc(l.media_url)}" target="_blank" rel="noopener">${esc(tr.open_res)}</a></p>` : '';
  }
  if (l.type === 'quiz') return quizHtml(l.quiz, tr);
  // text — body is trusted owner/AI HTML (constrained tags), render as-is.
  return `<div class="crs-text">${l.body_html || ''}</div>`;
}

function quizHtml(quiz, tr) {
  if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) return '';
  const pass = Number.isFinite(quiz.pass_score) ? quiz.pass_score : 70;
  const qs = quiz.questions.map((q, qi) => {
    const multi = q.type === 'mcq_multi';
    const inputType = multi ? 'checkbox' : 'radio';
    const opts = (q.options || []).map((o) =>
      `<label class="crs-opt" data-correct="${o.is_correct ? 1 : 0}"><input type="${inputType}" name="cq${qi}"><span>${esc(o.text)}</span></label>`).join('');
    return `<div class="crs-q" data-multi="${multi ? 1 : 0}">
      <p class="crs-q-text">${esc(q.question)}</p>
      <div class="crs-opts">${opts}</div>
      ${q.explanation ? `<div class="crs-expl" hidden>💡 ${esc(q.explanation)}</div>` : ''}
    </div>`;
  }).join('');
  return `<div class="crs-quiz" data-pass="${pass}">
    ${qs}
    <button type="button" class="crs-quiz-check">${esc(tr.check)}</button>
    <div class="crs-quiz-result" hidden></div>
  </div>`;
}

export function coursePlayerTemplate(data, config) {
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;
  const lang = data.lang || config.lang || 'en';
  const tr = T[lang] || T.en;
  const base = data.base || config.previewBase || '';
  const embedSuffix = config.embed ? '?embed=1' : '';
  const currency = data.currency || config.store_currency || 'usd';
  const c = data.course || {};
  const sections = Array.isArray(c.sections) ? c.sections : [];

  // Flatten lessons → stable pane indices; build the sidebar + panes together.
  let idx = 0;
  let lessonCount = 0;
  const navParts = [];
  const paneParts = [];
  for (const s of sections) {
    navParts.push(`<div class="crs-sec-title">${esc(s.title)}</div>`);
    for (const l of (s.lessons || [])) {
      const i = String(idx);
      navParts.push(`<button type="button" class="crs-lesson-item${idx === 0 ? ' active' : ''}" data-lesson="${i}">
        <span class="crs-li-ico">${ICON[l.type] || '📄'}</span>
        <span class="crs-li-title">${esc(l.title)}</span>
        ${l.duration ? `<span class="crs-li-dur">${esc(l.duration)}</span>` : ''}
      </button>`);
      paneParts.push(`<div class="crs-pane" data-pane="${i}"${idx === 0 ? '' : ' hidden'}>
        <h2 class="crs-pane-title">${esc(l.title)}</h2>
        ${lessonContent(l, tr)}
      </div>`);
      idx++; lessonCount++;
    }
  }

  const priceBadge = c.price_cents > 0
    ? `<span class="crs-hero-price">${money(c.price_cents, currency, lang)}</span>`
    : `<span class="crs-hero-free">${esc(tr.free)}</span>`;
  const meta = [c.instructor ? `${esc(tr.by)} ${esc(c.instructor)}` : '', c.level ? esc(c.level) : '', `${lessonCount} ${esc(tr.lessons)}`].filter(Boolean).join(' · ');

  const styles = `
<style>
.crs-player-page { background: #f7f8fb; }
.crs-hero { background: linear-gradient(135deg, ${primary_color}, ${primary_color}cc); color: #fff; padding: 3.5rem 2rem 3rem; }
.crs-hero-in { max-width: 1100px; margin: 0 auto; }
.crs-hero a.crs-back { color: #fff; opacity: .85; text-decoration: none; font-size: .9rem; }
.crs-hero h1 { font-family: ${font_heading}, sans-serif; font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 800; margin: .8rem 0 .4rem; }
.crs-hero-sub { font-size: 1.15rem; opacity: .92; max-width: 720px; }
.crs-hero-meta { margin-top: .9rem; font-size: .92rem; opacity: .9; display: flex; gap: .8rem; align-items: center; flex-wrap: wrap; }
.crs-hero-price { background: #fff; color: #1a202c; font-weight: 800; border-radius: 8px; padding: .25rem .7rem; }
.crs-hero-free { background: rgba(255,255,255,.22); color: #fff; font-weight: 800; border-radius: 8px; padding: .25rem .7rem; }
.crs-desc { max-width: 1100px; margin: 1.6rem auto 0; padding: 0 2rem; color: #4a5568; line-height: 1.7; }
.crs-player { max-width: 1100px; margin: 2rem auto 4rem; padding: 0 2rem; display: grid; grid-template-columns: 320px 1fr; gap: 1.8rem; align-items: start; }
.crs-side { background: #fff; border: 1px solid #e8eaf0; border-radius: 14px; padding: 1rem; position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto; }
.crs-side-h { font-weight: 800; color: #1a202c; padding: .3rem .5rem .7rem; }
.crs-sec-title { font-size: .74rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; padding: .8rem .5rem .35rem; }
.crs-lesson-item { display: flex; align-items: center; gap: .55rem; width: 100%; text-align: left; background: none; border: none; border-radius: 9px; padding: .55rem .6rem; cursor: pointer; font-family: inherit; font-size: .92rem; color: #334155; }
.crs-lesson-item:hover { background: #f1f5f9; }
.crs-lesson-item.active { background: ${primary_color}1a; color: ${primary_color}; font-weight: 700; }
.crs-li-ico { font-size: .95rem; }
.crs-li-title { flex: 1; line-height: 1.3; }
.crs-li-dur { font-size: .75rem; color: #94a3b8; }
.crs-main { background: #fff; border: 1px solid #e8eaf0; border-radius: 14px; padding: 2rem; min-height: 360px; }
.crs-pane-title { font-family: ${font_heading}, sans-serif; font-size: 1.5rem; font-weight: 800; color: #1a202c; margin: 0 0 1.2rem; }
.crs-text { color: #2d3748; line-height: 1.75; font-size: 1.02rem; }
.crs-text h3 { color: #1a202c; font-size: 1.2rem; margin: 1.4rem 0 .6rem; }
.crs-text p { margin: 0 0 1rem; }
.crs-text ul, .crs-text ol { margin: 0 0 1rem 1.3rem; }
.crs-text li { margin: .3rem 0; }
.crs-video-wrap { position: relative; padding-top: 56.25%; border-radius: 12px; overflow: hidden; background: #000; }
.crs-video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.crs-pdf-wrap { border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
.crs-pdf { width: 100%; height: 640px; border: 0; }
.crs-reslink { display: inline-block; color: ${primary_color}; font-weight: 700; text-decoration: none; }
.crs-quiz { display: flex; flex-direction: column; gap: 1.3rem; }
.crs-q-text { font-weight: 700; color: #1a202c; margin: 0 0 .6rem; }
.crs-opts { display: flex; flex-direction: column; gap: .45rem; }
.crs-opt { display: flex; align-items: center; gap: .6rem; padding: .55rem .75rem; border: 1.5px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: background .15s, border-color .15s; }
.crs-opt:hover { background: #f8fafc; }
.crs-opt.right { border-color: #22c55e; background: #f0fdf4; }
.crs-opt.wrong { border-color: #ef4444; background: #fef2f2; }
.crs-expl { font-size: .9rem; color: #475569; background: #f8fafc; border-radius: 9px; padding: .6rem .8rem; margin-top: .5rem; }
.crs-quiz-check { align-self: flex-start; background: ${primary_color}; color: #fff; border: none; border-radius: 10px; padding: .65rem 1.4rem; font-weight: 700; font-size: .95rem; cursor: pointer; }
.crs-quiz-check:hover { opacity: .9; }
.crs-quiz-result { font-weight: 700; border-radius: 10px; padding: .7rem 1rem; }
.crs-quiz-result.pass { background: #f0fdf4; color: #166534; }
.crs-quiz-result.fail { background: #fef2f2; color: #991b1b; }
@media (max-width: 860px) { .crs-player { grid-template-columns: 1fr; } .crs-side { position: static; max-height: none; } }
</style>`;

  return `
<div class="crs-player-page">
  <div class="crs-hero"><div class="crs-hero-in">
    <a class="crs-back" href="${esc(base)}/courses${embedSuffix}">${esc(tr.back)}</a>
    <h1>${esc(c.title)}</h1>
    ${c.subtitle ? `<p class="crs-hero-sub">${esc(c.subtitle)}</p>` : ''}
    <div class="crs-hero-meta">${priceBadge}${meta ? `<span>${meta}</span>` : ''}</div>
  </div></div>
  ${c.description_html ? `<div class="crs-desc">${c.description_html}</div>` : ''}
  <div class="crs-player" id="crs-player">
    <aside class="crs-side">
      <div class="crs-side-h">${esc(tr.curriculum)}</div>
      ${navParts.join('\n')}
    </aside>
    <main class="crs-main">
      ${paneParts.join('\n') || '<p>—</p>'}
    </main>
  </div>
</div>${styles}
<script>
(function(){
  var root=document.getElementById('crs-player'); if(!root) return;
  var Q=${JSON.stringify({ passed: tr.passed, failed: tr.failed })};
  var items=root.querySelectorAll('.crs-lesson-item');
  var panes=root.querySelectorAll('.crs-pane');
  function show(i){
    for(var k=0;k<panes.length;k++){ panes[k].hidden = panes[k].getAttribute('data-pane')!==i; }
    for(var j=0;j<items.length;j++){ items[j].classList.toggle('active', items[j].getAttribute('data-lesson')===i); }
  }
  root.addEventListener('click', function(e){
    var it=e.target.closest('.crs-lesson-item');
    if(it){ show(it.getAttribute('data-lesson')); if(window.innerWidth<860){ var m=root.querySelector('.crs-main'); if(m) m.scrollIntoView({behavior:'smooth'}); } return; }
    var btn=e.target.closest('.crs-quiz-check');
    if(btn){
      var quiz=btn.closest('.crs-quiz'); var qrows=quiz.querySelectorAll('.crs-q'); var correct=0;
      for(var a=0;a<qrows.length;a++){
        var row=qrows[a]; var opts=row.querySelectorAll('.crs-opt'); var allRight=true;
        for(var b=0;b<opts.length;b++){
          var o=opts[b]; var inp=o.querySelector('input'); var isC=o.getAttribute('data-correct')==='1';
          o.classList.remove('right','wrong');
          if(isC) o.classList.add('right');
          if(inp.checked && !isC){ o.classList.add('wrong'); allRight=false; }
          if(!inp.checked && isC){ allRight=false; }
        }
        var ex=row.querySelector('.crs-expl'); if(ex) ex.hidden=false;
        if(allRight) correct++;
      }
      var pct=qrows.length?Math.round(correct/qrows.length*100):0;
      var pass=parseInt(quiz.getAttribute('data-pass')||'70',10);
      var res=quiz.querySelector('.crs-quiz-result'); res.hidden=false;
      res.className='crs-quiz-result '+(pct>=pass?'pass':'fail');
      res.textContent=(pct>=pass?Q.passed:Q.failed).replace('{p}',pct);
    }
  });
})();
</script>`.trim();
}
