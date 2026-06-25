// GET /ai-builder/courses/:project_id/:course_id — Courses plugin course editor.
// Edits course meta + the curriculum tree (sections → lessons → quiz questions).
// Gated by pluginGate('courses') in index.js. Mutations go to the JSON API in
// routes/api/ai-builder/courses.js; structural changes reload, fields save inline.
// All inline handlers are this+closest()/no-string-arg (codebase gotcha #29).
import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject, getOrCreateConfig } from '../api/ai-builder/store.js';
import { getCourseFull } from '../../db/courses.js';

const T = {
  en: {
    meta_title: 'Edit course — Caddisfly', back: '← All courses', save: 'Save', saved: '✓ Saved', err: 'Something went wrong.',
    details: 'Course details', f_title: 'Title', f_subtitle: 'Subtitle', f_desc: 'Description', f_image: 'Cover image URL',
    f_cat: 'Category', f_instr: 'Instructor', f_level: 'Level', f_price: 'Price (0 = free)', f_status: 'Status',
    st_draft: 'Draft', st_published: 'Published',
    curriculum: 'Curriculum', add_section: '＋ Add section', section_ph: 'Section title',
    del_section: 'Delete section', confirm_section: 'Delete this section and its lessons?',
    add_lesson: '＋ Add lesson', lesson_ph: 'Lesson title', type: 'Type', create: 'Create', cancel: 'Cancel', edit: 'Edit', del: 'Delete',
    confirm_lesson: 'Delete this lesson?', no_lessons: 'No lessons yet.', no_sections: 'No sections yet — add one to start building.',
    lt_video: 'Video', lt_text: 'Text', lt_pdf: 'PDF', lt_url: 'Link', lt_quiz: 'Quiz',
    f_media_video: 'Video URL or embed', f_media_pdf: 'PDF URL', f_media_url: 'Link URL', f_body: 'Content',
    f_duration: 'Duration (e.g. 8 min)', f_preview: 'Free preview',
    quiz_q: 'Questions', q_ph: 'Question', q_add: '＋ Add question', q_type: 'Type', q_expl: 'Explanation (optional)',
    opt_ph: 'Option', opt_correct: 'Correct', add_opt: '＋ Option', q_del: 'Delete question',
    qt_single: 'Single choice', qt_multi: 'Multiple choice', qt_tf: 'True / False',
    pass: 'Pass score %',
  },
  es: {
    meta_title: 'Editar curso — Caddisfly', back: '← Todos los cursos', save: 'Guardar', saved: '✓ Guardado', err: 'Algo salió mal.',
    details: 'Detalles del curso', f_title: 'Título', f_subtitle: 'Subtítulo', f_desc: 'Descripción', f_image: 'URL de imagen de portada',
    f_cat: 'Categoría', f_instr: 'Instructor', f_level: 'Nivel', f_price: 'Precio (0 = gratis)', f_status: 'Estado',
    st_draft: 'Borrador', st_published: 'Publicado',
    curriculum: 'Temario', add_section: '＋ Añadir sección', section_ph: 'Título de la sección',
    del_section: 'Eliminar sección', confirm_section: '¿Eliminar esta sección y sus lecciones?',
    add_lesson: '＋ Añadir lección', lesson_ph: 'Título de la lección', type: 'Tipo', create: 'Crear', cancel: 'Cancelar', edit: 'Editar', del: 'Eliminar',
    confirm_lesson: '¿Eliminar esta lección?', no_lessons: 'No hay lecciones aún.', no_sections: 'No hay secciones aún — añade una para empezar.',
    lt_video: 'Video', lt_text: 'Texto', lt_pdf: 'PDF', lt_url: 'Enlace', lt_quiz: 'Cuestionario',
    f_media_video: 'URL o embed del video', f_media_pdf: 'URL del PDF', f_media_url: 'URL del enlace', f_body: 'Contenido',
    f_duration: 'Duración (p. ej. 8 min)', f_preview: 'Vista previa gratis',
    quiz_q: 'Preguntas', q_ph: 'Pregunta', q_add: '＋ Añadir pregunta', q_type: 'Tipo', q_expl: 'Explicación (opcional)',
    opt_ph: 'Opción', opt_correct: 'Correcta', add_opt: '＋ Opción', q_del: 'Eliminar pregunta',
    qt_single: 'Opción única', qt_multi: 'Opción múltiple', qt_tf: 'Verdadero / Falso',
    pass: '% para aprobar',
  },
  pt: {
    meta_title: 'Editar curso — Caddisfly', back: '← Todos os cursos', save: 'Salvar', saved: '✓ Salvo', err: 'Algo deu errado.',
    details: 'Detalhes do curso', f_title: 'Título', f_subtitle: 'Subtítulo', f_desc: 'Descrição', f_image: 'URL da imagem de capa',
    f_cat: 'Categoria', f_instr: 'Instrutor', f_level: 'Nível', f_price: 'Preço (0 = grátis)', f_status: 'Status',
    st_draft: 'Rascunho', st_published: 'Publicado',
    curriculum: 'Conteúdo', add_section: '＋ Adicionar seção', section_ph: 'Título da seção',
    del_section: 'Excluir seção', confirm_section: 'Excluir esta seção e suas aulas?',
    add_lesson: '＋ Adicionar aula', lesson_ph: 'Título da aula', type: 'Tipo', create: 'Criar', cancel: 'Cancelar', edit: 'Editar', del: 'Excluir',
    confirm_lesson: 'Excluir esta aula?', no_lessons: 'Ainda não há aulas.', no_sections: 'Ainda não há seções — adicione uma para começar.',
    lt_video: 'Vídeo', lt_text: 'Texto', lt_pdf: 'PDF', lt_url: 'Link', lt_quiz: 'Quiz',
    f_media_video: 'URL ou embed do vídeo', f_media_pdf: 'URL do PDF', f_media_url: 'URL do link', f_body: 'Conteúdo',
    f_duration: 'Duração (ex. 8 min)', f_preview: 'Prévia grátis',
    quiz_q: 'Perguntas', q_ph: 'Pergunta', q_add: '＋ Adicionar pergunta', q_type: 'Tipo', q_expl: 'Explicação (opcional)',
    opt_ph: 'Opção', opt_correct: 'Correta', add_opt: '＋ Opção', q_del: 'Excluir pergunta',
    qt_single: 'Escolha única', qt_multi: 'Múltipla escolha', qt_tf: 'Verdadeiro / Falso',
    pass: '% para passar',
  },
};

const LTYPES = ['video', 'text', 'pdf', 'url', 'quiz'];
const QTYPES = ['mcq_single', 'mcq_multi', 'true_false'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function lessonIcon(type) { return { video: '🎬', text: '📄', pdf: '📕', url: '🔗', quiz: '❓' }[type] || '📄'; }

function renderQuestion(q, t) {
  const opts = (q.options || []).map((o) =>
    `<li class="${o.is_correct ? 'correct' : ''}">${o.is_correct ? '✓ ' : ''}${esc(o.text)}</li>`).join('');
  return `<div class="q-row" data-qid="${q.id}">
    <div class="q-head"><strong>${esc(q.question)}</strong>
      <button class="btn ghost xs q-del-btn" type="button" onclick="delQuestion(this)" title="${t.q_del}">✕</button></div>
    ${opts ? `<ul class="q-opts">${opts}</ul>` : ''}
    ${q.explanation ? `<div class="q-expl">${esc(q.explanation)}</div>` : ''}
  </div>`;
}

function renderLesson(l, t) {
  const isQuiz = l.type === 'quiz';
  const mediaField = l.type === 'video' ? t.f_media_video : l.type === 'pdf' ? t.f_media_pdf : l.type === 'url' ? t.f_media_url : '';
  const questions = isQuiz && l.quiz ? (l.quiz.questions || []).map((q) => renderQuestion(q, t)).join('') : '';
  return `<li class="lesson" data-lesson-id="${l.id}" data-type="${l.type}" data-quiz-id="${l.quiz ? l.quiz.id : ''}">
    <div class="lesson-row">
      <span class="lesson-ico">${lessonIcon(l.type)}</span>
      <span class="lesson-title">${esc(l.title || '—')}</span>
      ${l.is_preview ? '<span class="lesson-tag">👁</span>' : ''}
      ${l.duration ? `<span class="lesson-dur">${esc(l.duration)}</span>` : ''}
      <span class="spacer"></span>
      <button class="btn ghost xs" type="button" onclick="toggleLesson(this)">${t.edit}</button>
      <button class="btn ghost xs" type="button" onclick="delLesson(this)">${t.del}</button>
    </div>
    <div class="lesson-edit" hidden>
      <label>${t.f_title}<input class="le-title" value="${esc(l.title)}"></label>
      ${l.type === 'text'
        ? `<label>${t.f_body}<textarea class="le-body" rows="5">${esc(l.body)}</textarea></label>`
        : isQuiz ? '' : `<label>${mediaField}<input class="le-media" value="${esc(l.media_url)}"></label>`}
      <div class="le-meta">
        <label>${t.f_duration}<input class="le-dur" value="${esc(l.duration)}"></label>
        <label class="le-prev"><input type="checkbox" class="le-preview"${l.is_preview ? ' checked' : ''}> ${t.f_preview}</label>
      </div>
      ${isQuiz ? `<div class="quizbox">
        <div class="quiz-head"><strong>${t.quiz_q}</strong>
          <label class="pass-lbl">${t.pass} <input type="number" class="le-pass" min="0" max="100" value="${l.quiz ? l.quiz.pass_score : 70}" style="width:64px"></label></div>
        <div class="q-list">${questions}</div>
        <button class="btn ghost xs" type="button" onclick="openQForm(this)">${t.q_add}</button>
        <div class="qform" hidden>
          <input class="qf-q" placeholder="${t.q_ph}">
          <select class="qf-type">${QTYPES.map((qt) => `<option value="${qt}">${qt === 'mcq_single' ? t.qt_single : qt === 'mcq_multi' ? t.qt_multi : t.qt_tf}</option>`).join('')}</select>
          <div class="qf-opts">
            <div class="qf-opt"><input class="qf-ot" placeholder="${t.opt_ph} 1"><label><input type="checkbox" class="qf-oc"> ${t.opt_correct}</label></div>
            <div class="qf-opt"><input class="qf-ot" placeholder="${t.opt_ph} 2"><label><input type="checkbox" class="qf-oc"> ${t.opt_correct}</label></div>
          </div>
          <button class="btn ghost xs" type="button" onclick="addOpt(this)">${t.add_opt}</button>
          <input class="qf-expl" placeholder="${t.q_expl}">
          <div class="qform-actions">
            <button class="btn xs" type="button" onclick="saveQuestion(this)">${t.create}</button>
            <button class="btn ghost xs" type="button" onclick="closeQForm(this)">${t.cancel}</button>
          </div>
        </div>
      </div>` : ''}
      <div class="le-actions">
        <button class="btn xs" type="button" onclick="saveLesson(this)">${t.save}</button>
        <button class="btn ghost xs" type="button" onclick="toggleLesson(this)">${t.cancel}</button>
      </div>
    </div>
  </li>`;
}

function renderSection(s, t) {
  const lessons = (s.lessons || []).map((l) => renderLesson(l, t)).join('');
  return `<div class="section" data-section-id="${s.id}">
    <div class="section-head">
      <input class="sec-title" value="${esc(s.title)}" placeholder="${t.section_ph}" onchange="saveSection(this)">
      <button class="btn ghost sm" type="button" onclick="delSection(this)">${t.del_section}</button>
    </div>
    <ul class="lessons">${lessons || `<li class="muted small">${t.no_lessons}</li>`}</ul>
    <div class="addlesson">
      <select class="al-type">${LTYPES.map((lt) => `<option value="${lt}">${t['lt_' + lt]}</option>`).join('')}</select>
      <input class="al-title" placeholder="${t.lesson_ph}">
      <button class="btn ghost sm" type="button" onclick="addLesson(this)">${t.add_lesson}</button>
    </div>
  </div>`;
}

export async function handleCourseEditor(ctx) {
  const { env, params, url } = ctx;
  const origin = env.APP_URL || (url ? new URL(url).origin : '');
  const lang = (ctx && ctx.lang) || 'en';
  const t = T[lang] || T.en;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const course = await getCourseFull(env.DB, r.projectKey, params.course_id);
  if (!course) return redirect(`/ai-builder/courses/${params.project_id}`, 303);
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  const currency = ((config && config.currency) || 'usd').toUpperCase();

  const sectionsHtml = (course.sections || []).map((s) => renderSection(s, t)).join('');

  const inner = `
    <div class="ce-head">
      <a class="btn ghost" href="/ai-builder/courses/${esc(params.project_id)}">${t.back}</a>
      <h1>${esc(course.title)}</h1>
    </div>

    <div class="ce-panel">
      <h2>${t.details}</h2>
      <div class="ce-grid">
        <label class="full">${t.f_title}<input id="c-title" value="${esc(course.title)}"></label>
        <label class="full">${t.f_subtitle}<input id="c-subtitle" value="${esc(course.subtitle)}"></label>
        <label class="full">${t.f_desc}<textarea id="c-description" rows="4">${esc(course.description)}</textarea></label>
        <label class="full">${t.f_image}<input id="c-image" value="${esc(course.image)}" placeholder="https://…"></label>
        <label>${t.f_cat}<input id="c-category" value="${esc(course.category)}"></label>
        <label>${t.f_instr}<input id="c-instructor" value="${esc(course.instructor)}"></label>
        <label>${t.f_level}<input id="c-level" value="${esc(course.level)}"></label>
        <label>${t.f_price} (${esc(currency)})<input id="c-price" type="number" min="0" step="0.01" value="${(course.price_cents / 100).toFixed(2)}"></label>
        <label>${t.f_status}<select id="c-status"><option value="draft"${course.status !== 'published' ? ' selected' : ''}>${t.st_draft}</option><option value="published"${course.status === 'published' ? ' selected' : ''}>${t.st_published}</option></select></label>
      </div>
      <button class="btn" type="button" id="saveMetaBtn" onclick="saveMeta(this)">${t.save}</button>
    </div>

    <div class="ce-panel">
      <h2>${t.curriculum}</h2>
      <div id="sections">${sectionsHtml || `<p class="muted">${t.no_sections}</p>`}</div>
      <div class="addsection">
        <input id="new-section" placeholder="${t.section_ph}">
        <button class="btn" type="button" onclick="addSection(this)">${t.add_section}</button>
      </div>
    </div>
    <div id="ce-msg"></div>
    <script>
      var BASE='/api/ai-builder/'+${JSON.stringify(params.project_id)}+'/courses/'+${JSON.stringify(String(course.id))};
      var S=${JSON.stringify({ err: t.err, saved: t.saved, save: t.save, confirmSection: t.confirm_section, confirmLesson: t.confirm_lesson, optPh: t.opt_ph, correct: t.opt_correct })};
      function J(method,path,bodyObj){ return fetch(BASE+path,{method:method,headers:{'Content-Type':'application/json'},body:bodyObj?JSON.stringify(bodyObj):undefined}).then(function(res){return res.json();}); }
      async function saveMeta(btn){
        var v=function(id){return document.getElementById(id).value;};
        var price=Math.round(parseFloat(v('c-price')||'0')*100)||0;
        btn.disabled=true; var old=btn.textContent;
        try{
          var d=await J('PUT','',{title:v('c-title'),subtitle:v('c-subtitle'),description:v('c-description'),image:v('c-image'),category:v('c-category'),instructor:v('c-instructor'),level:v('c-level'),price_cents:price,status:v('c-status')});
          btn.textContent=d&&d.success?S.saved:S.err;
        }catch(e){ btn.textContent=S.err; }
        setTimeout(function(){ btn.disabled=false; btn.textContent=old; },1400);
      }
      async function addSection(btn){
        var inp=document.getElementById('new-section'); var title=inp.value.trim(); if(!title){ inp.focus(); return; }
        btn.disabled=true;
        try{ var d=await J('POST','/sections',{title:title}); if(d&&d.success){ location.reload(); return; } alert(S.err); }
        catch(e){ alert(S.err); }
        btn.disabled=false;
      }
      function secId(el){ return el.closest('[data-section-id]').getAttribute('data-section-id'); }
      function lesId(el){ return el.closest('[data-lesson-id]').getAttribute('data-lesson-id'); }
      async function saveSection(inp){
        try{ await J('PUT','/sections/'+secId(inp),{title:inp.value}); }catch(e){}
      }
      async function delSection(btn){
        if(!confirm(S.confirmSection)) return;
        try{ var d=await J('DELETE','/sections/'+secId(btn)); if(d&&d.success){ btn.closest('.section').remove(); return; } alert(S.err); }
        catch(e){ alert(S.err); }
      }
      async function addLesson(btn){
        var card=btn.closest('.section'); var type=card.querySelector('.al-type').value; var titleInp=card.querySelector('.al-title');
        var title=titleInp.value.trim(); if(!title){ titleInp.focus(); return; }
        btn.disabled=true;
        try{ var d=await J('POST','/sections/'+secId(btn)+'/lessons',{type:type,title:title}); if(d&&d.success){ location.reload(); return; } alert(S.err); }
        catch(e){ alert(S.err); }
        btn.disabled=false;
      }
      function toggleLesson(btn){ var box=btn.closest('.lesson').querySelector('.lesson-edit'); box.hidden=!box.hidden; }
      async function saveLesson(btn){
        var li=btn.closest('.lesson'); var body={ title:li.querySelector('.le-title').value, duration:li.querySelector('.le-dur').value, is_preview:li.querySelector('.le-preview').checked?1:0 };
        var media=li.querySelector('.le-media'); if(media) body.media_url=media.value;
        var txt=li.querySelector('.le-body'); if(txt) body.body=txt.value;
        btn.disabled=true; var old=btn.textContent;
        try{ var d=await J('PUT','/lessons/'+lesId(btn),body); btn.textContent=d&&d.success?S.saved:S.err; var ti=li.querySelector('.lesson-title'); if(d&&d.success&&ti) ti.textContent=body.title; }
        catch(e){ btn.textContent=S.err; }
        setTimeout(function(){ btn.disabled=false; btn.textContent=old; },1200);
      }
      async function delLesson(btn){
        if(!confirm(S.confirmLesson)) return;
        try{ var d=await J('DELETE','/lessons/'+lesId(btn)); if(d&&d.success){ btn.closest('.lesson').remove(); return; } alert(S.err); }
        catch(e){ alert(S.err); }
      }
      // Quiz question editor
      function openQForm(btn){ btn.nextElementSibling.hidden=false; btn.hidden=true; }
      function closeQForm(btn){ var f=btn.closest('.qform'); f.hidden=true; f.previousElementSibling.hidden=false; }
      function addOpt(btn){
        var wrap=btn.previousElementSibling; var n=wrap.children.length+1;
        var div=document.createElement('div'); div.className='qf-opt';
        div.innerHTML='<input class="qf-ot" placeholder="'+S.optPh+' '+n+'"><label><input type="checkbox" class="qf-oc"> '+S.correct+'</label>';
        wrap.appendChild(div);
      }
      async function saveQuestion(btn){
        var f=btn.closest('.qform'); var q=f.querySelector('.qf-q').value.trim(); if(!q){ f.querySelector('.qf-q').focus(); return; }
        var type=f.querySelector('.qf-type').value;
        var options=Array.prototype.map.call(f.querySelectorAll('.qf-opt'),function(o){ return { text:o.querySelector('.qf-ot').value, is_correct:o.querySelector('.qf-oc').checked?1:0 }; }).filter(function(o){ return o.text.trim(); });
        var pass=f.closest('.quizbox').querySelector('.le-pass').value;
        var lessonId=btn.closest('.lesson').getAttribute('data-lesson-id');
        btn.disabled=true;
        try{ var d=await fetch(BASE+'/lessons/'+lessonId+'/questions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,type:type,options:options,explanation:f.querySelector('.qf-expl').value,pass_score:pass})}).then(function(r){return r.json();});
          if(d&&d.success){ location.reload(); return; } alert(S.err); }
        catch(e){ alert(S.err); }
        btn.disabled=false;
      }
      async function delQuestion(btn){
        var row=btn.closest('.q-row'); var qid=row.getAttribute('data-qid'); var quizId=btn.closest('.lesson').getAttribute('data-quiz-id');
        if(!quizId) { row.remove(); return; }
        try{ var d=await fetch(BASE+'/quiz/'+quizId+'/questions/'+qid,{method:'DELETE'}).then(function(r){return r.json();}); if(d&&d.success){ row.remove(); return; } alert(S.err); }
        catch(e){ alert(S.err); }
      }
    </script>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: t.meta_title, description: '', origin, path: '/ai-builder/courses' })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .cwrap{max-width:920px;margin:0 auto;padding:2rem 1.5rem}
    .ce-head{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.2rem}
    .ce-head h1{font-size:clamp(1.4rem,3vw,1.9rem);font-weight:900;color:var(--ink)}
    .ce-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem 1.5rem;margin-bottom:1.4rem}
    .ce-panel h2{font-size:1.1rem;font-weight:800;color:var(--ink);margin:0 0 1rem}
    .ce-grid{display:grid;grid-template-columns:1fr 1fr;gap:.9rem;margin-bottom:1rem}
    .ce-grid label,.lesson-edit label,.section label{display:flex;flex-direction:column;gap:.3rem;font-size:.82rem;font-weight:600;color:var(--muted)}
    .ce-grid .full{grid-column:1 / -1}
    .ce-grid input,.ce-grid textarea,.ce-grid select,.lesson-edit input,.lesson-edit textarea,.lesson-edit select{padding:.5rem .6rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.9rem;font-weight:400;color:var(--ink);background:#fff}
    .section{border:1px solid var(--line);border-radius:12px;padding:1rem;margin-bottom:1rem;background:#fbfbfd}
    .section-head{display:flex;gap:.6rem;align-items:center;margin-bottom:.7rem}
    .sec-title{flex:1;font-weight:700;padding:.45rem .6rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.95rem}
    .lessons{list-style:none;padding:0;margin:0 0 .7rem}
    .lesson{border:1px solid var(--line);border-radius:9px;margin-bottom:.4rem;background:#fff}
    .lesson-row{display:flex;align-items:center;gap:.5rem;padding:.5rem .7rem}
    .lesson-ico{font-size:1rem}
    .lesson-title{font-weight:600;color:var(--ink)}
    .lesson-tag,.lesson-dur{font-size:.75rem;color:var(--muted)}
    .spacer{flex:1}
    .lesson-edit{padding:.7rem;border-top:1px dashed var(--line);display:flex;flex-direction:column;gap:.6rem}
    .le-meta{display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap}
    .le-prev{flex-direction:row!important;align-items:center;gap:.4rem!important}
    .le-actions,.qform-actions{display:flex;gap:.5rem}
    .addlesson,.addsection,.cm-newform{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
    .addlesson select,.addlesson input,.addsection input{padding:.45rem .6rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.88rem}
    .addlesson input{flex:1;min-width:160px}
    .addsection{margin-top:1rem}
    .addsection input{flex:1;min-width:200px}
    .quizbox{border:1px dashed var(--line);border-radius:9px;padding:.7rem;background:#fafafe}
    .quiz-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.5rem;flex-wrap:wrap}
    .pass-lbl{flex-direction:row!important;align-items:center;gap:.4rem!important;font-weight:600}
    .q-row{border:1px solid var(--line);border-radius:8px;padding:.5rem .6rem;margin-bottom:.4rem;background:#fff}
    .q-head{display:flex;justify-content:space-between;align-items:center;gap:.5rem}
    .q-opts{margin:.3rem 0 0;padding-left:1.1rem;font-size:.85rem}
    .q-opts li.correct{color:#166534;font-weight:600}
    .q-expl{font-size:.8rem;color:var(--muted);margin-top:.3rem}
    .qform{display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem;padding:.6rem;border:1px solid var(--line);border-radius:8px;background:#fff}
    .qform input,.qform select{padding:.4rem .55rem;border:1.5px solid var(--line);border-radius:8px;font-family:inherit;font-size:.85rem}
    .qf-opt{display:flex;gap:.5rem;align-items:center;margin-bottom:.35rem}
    .qf-opt input[type=text],.qf-opt .qf-ot{flex:1}
    .qf-opt label{flex-direction:row!important;align-items:center;gap:.3rem!important;font-size:.78rem;white-space:nowrap}
    .btn.xs{font-size:.76rem;padding:.3rem .55rem}
    .btn.sm{font-size:.8rem;padding:.35rem .65rem}
    .small{font-size:.82rem}
    @media (max-width:680px){ .ce-grid{grid-template-columns:1fr} }
  </style>
</head>
<body>
  ${siteHeader('/dashboard', {})}
  <main><div class="cwrap">${inner}</div></main>
  ${siteFooter({ lang })}
</body>
</html>`;

  return htmlResponse(html);
}
