// GET /ai-builder/courses/:project_id — Courses plugin manager (landing).
// Lists the project's courses; create / publish / delete here, edit content in
// the per-course editor (courses-editor.js). Gated by pluginGate('courses') in
// index.js. i18n: local dict (en/es/pt) by ctx.lang. Adapted from the 4vrxp LMS.
import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject, getOrCreateConfig } from '../api/ai-builder/store.js';
import { getCoursesByProject } from '../../db/courses.js';
import { countEnrollmentsByCourse } from '../../db/course-enrollments.js';

const T = {
  en: {
    meta_title: 'Courses — Caddisfly', meta_desc: 'Build and sell online courses.', title: 'Courses', back: '← Back to editor',
    sub: 'Build training courses for your site — lessons, videos, PDFs and quizzes. {count} {label}.',
    course_one: 'course', course_many: 'courses',
    new_course: '＋ New course', new_ph: 'Course title', create: 'Create', cancel: 'Cancel',
    th_title: 'Course', th_status: 'Status', th_price: 'Price', th_cat: 'Category', th_enrolled: 'Enrolled', edit: 'Edit', del: 'Delete',
    publish: 'Publish', unpublish: 'Unpublish', free: 'Free',
    st_draft: 'Draft', st_published: 'Published',
    empty: 'No courses yet — create your first one above.',
    confirm_del: 'Delete this course and all its lessons? This cannot be undone.',
    err: 'Something went wrong.',
    gen_btn: '✨ Generate with AI', gen_ph: 'What should the course teach? e.g. Home composting for beginners',
    generate: 'Generate', generating: 'Generating… (~20s)', gen_err: 'Could not generate the course — try a different topic.',
  },
  es: {
    meta_title: 'Cursos — Caddisfly', meta_desc: 'Crea y vende cursos en línea.', title: 'Cursos', back: '← Volver al editor',
    sub: 'Crea cursos de formación para tu sitio — lecciones, videos, PDFs y cuestionarios. {count} {label}.',
    course_one: 'curso', course_many: 'cursos',
    new_course: '＋ Nuevo curso', new_ph: 'Título del curso', create: 'Crear', cancel: 'Cancelar',
    th_title: 'Curso', th_status: 'Estado', th_price: 'Precio', th_cat: 'Categoría', th_enrolled: 'Inscritos', edit: 'Editar', del: 'Eliminar',
    publish: 'Publicar', unpublish: 'Despublicar', free: 'Gratis',
    st_draft: 'Borrador', st_published: 'Publicado',
    empty: 'No hay cursos aún — crea el primero arriba.',
    confirm_del: '¿Eliminar este curso y todas sus lecciones? No se puede deshacer.',
    err: 'Algo salió mal.',
    gen_btn: '✨ Generar con IA', gen_ph: '¿Qué debe enseñar el curso? p. ej. Compostaje casero para principiantes',
    generate: 'Generar', generating: 'Generando… (~20s)', gen_err: 'No se pudo generar el curso — prueba con otro tema.',
  },
  pt: {
    meta_title: 'Cursos — Caddisfly', meta_desc: 'Crie e venda cursos online.', title: 'Cursos', back: '← Voltar ao editor',
    sub: 'Crie cursos de treinamento para seu site — aulas, vídeos, PDFs e quizzes. {count} {label}.',
    course_one: 'curso', course_many: 'cursos',
    new_course: '＋ Novo curso', new_ph: 'Título do curso', create: 'Criar', cancel: 'Cancelar',
    th_title: 'Curso', th_status: 'Status', th_price: 'Preço', th_cat: 'Categoria', th_enrolled: 'Inscritos', edit: 'Editar', del: 'Excluir',
    publish: 'Publicar', unpublish: 'Despublicar', free: 'Grátis',
    st_draft: 'Rascunho', st_published: 'Publicado',
    empty: 'Ainda não há cursos — crie o primeiro acima.',
    confirm_del: 'Excluir este curso e todas as suas aulas? Isso não pode ser desfeito.',
    err: 'Algo deu errado.',
    gen_btn: '✨ Gerar com IA', gen_ph: 'O que o curso deve ensinar? ex. Compostagem caseira para iniciantes',
    generate: 'Gerar', generating: 'Gerando… (~20s)', gen_err: 'Não foi possível gerar o curso — tente outro tema.',
  },
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const SYMBOLS = { usd: '$', eur: '€', gbp: '£', brl: 'R$', cad: 'C$', aud: 'A$', mxn: '$' };
function money(cents, cur) {
  const sym = SYMBOLS[(cur || 'usd').toLowerCase()] || '';
  return `${sym}${((cents || 0) / 100).toFixed(2)}${sym ? '' : ' ' + (cur || '').toUpperCase()}`;
}

export async function handleCoursesManager(ctx) {
  const { env, params, url } = ctx;
  const origin = env.APP_URL || (url ? new URL(url).origin : '');
  const lang = (ctx && ctx.lang) || 'en';
  const t = T[lang] || T.en;
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const config = await getOrCreateConfig(env.DB, r.projectKey);
  const currency = (config && config.currency) || 'usd';
  const courses = await getCoursesByProject(env.DB, r.projectKey);
  const enrollCounts = await countEnrollmentsByCourse(env.DB, courses.map((c) => c.id));

  const rows = courses.map((c) => {
    const published = c.status === 'published';
    return `<tr data-id="${c.id}">
      <td><a class="cm-title" href="/ai-builder/courses/${esc(params.project_id)}/${c.id}">${esc(c.title || '—')}</a>${c.subtitle ? `<div class="cm-sub">${esc(c.subtitle)}</div>` : ''}</td>
      <td><span class="cm-badge ${published ? 'pub' : 'draft'}">${published ? t.st_published : t.st_draft}</span></td>
      <td>${c.price_cents > 0 ? money(c.price_cents, currency) : t.free}</td>
      <td>${esc(c.category || '—')}</td>
      <td class="cm-enrolled">${enrollCounts[c.id] || 0}</td>
      <td class="cm-actions">
        <a class="btn ghost sm" href="/ai-builder/courses/${esc(params.project_id)}/${c.id}">${t.edit}</a>
        <button class="btn ghost sm cm-pub" type="button" onclick="togglePublish(this)">${published ? t.unpublish : t.publish}</button>
        <button class="btn ghost sm cm-del" type="button" onclick="delCourse(this)">${t.del}</button>
      </td>
    </tr>`;
  }).join('');

  const countLabel = courses.length === 1 ? t.course_one : t.course_many;
  const inner = `
    <div class="cm-head">
      <h1>📚 ${t.title} <span class="muted">— ${esc(r.businessName)}</span></h1>
      <a class="btn ghost" href="/ai-builder/customize/${esc(params.project_id)}">${t.back}</a>
    </div>
    <p class="sub">${t.sub.replace('{count}', courses.length).replace('{label}', countLabel)}</p>

    <div class="cm-toolbar">
      <button class="btn" type="button" onclick="toggleGen()">${t.gen_btn}</button>
      <button class="btn ghost" type="button" id="newBtn" onclick="toggleNew()">${t.new_course}</button>
    </div>
    <div class="cm-newform" id="genform">
      <input id="gen-topic" placeholder="${t.gen_ph}" maxlength="200">
      <button class="btn" type="button" onclick="genCourse(this)">${t.generate}</button>
      <button class="btn ghost" type="button" onclick="toggleGen()">${t.cancel}</button>
    </div>
    <div class="cm-newform" id="newform">
      <input id="nc-title" placeholder="${t.new_ph}" maxlength="160">
      <button class="btn" type="button" onclick="createCourse(this)">${t.create}</button>
      <button class="btn ghost" type="button" onclick="toggleNew()">${t.cancel}</button>
    </div>

    ${courses.length ? `<div class="cm-tablewrap"><table class="cm-table">
      <thead><tr><th>${t.th_title}</th><th>${t.th_status}</th><th>${t.th_price}</th><th>${t.th_cat}</th><th>${t.th_enrolled}</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>` : `<div class="cm-empty">${t.empty}</div>`}
    <div id="cm-msg"></div>
    <script>
      var BASE = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/courses';
      var EDIT = '/ai-builder/courses/' + ${JSON.stringify(params.project_id)} + '/';
      var S = ${JSON.stringify({ err: t.err, confirmDel: t.confirm_del })};
      var GEN = ${JSON.stringify({ generating: t.generating, genErr: t.gen_err, generate: t.generate })};
      function toggleNew(){ var f=document.getElementById('newform'); var on=f.style.display==='flex'; f.style.display=on?'none':'flex'; if(!on) document.getElementById('nc-title').focus(); }
      function toggleGen(){ var f=document.getElementById('genform'); var on=f.style.display==='flex'; f.style.display=on?'none':'flex'; if(!on) document.getElementById('gen-topic').focus(); }
      async function genCourse(btn){
        var topic=document.getElementById('gen-topic').value.trim();
        if(topic.length<3){ document.getElementById('gen-topic').focus(); return; }
        btn.disabled=true; var old=btn.textContent; btn.textContent=GEN.generating;
        try{
          var res=await fetch(BASE+'/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:topic})});
          var d=await res.json();
          if(d&&d.success&&d.course_id){ location.href=EDIT+d.course_id; return; }
          alert((d&&d.error)||GEN.genErr);
        }catch(e){ alert(GEN.genErr); }
        btn.disabled=false; btn.textContent=GEN.generate;
      }
      async function createCourse(btn){
        var title=document.getElementById('nc-title').value.trim();
        if(!title){ document.getElementById('nc-title').focus(); return; }
        btn.disabled=true;
        try{
          var res=await fetch(BASE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title})});
          var d=await res.json();
          if(d&&d.success&&d.course){ location.href=EDIT+d.course.id; return; }
          alert(S.err);
        }catch(e){ alert(S.err); }
        btn.disabled=false;
      }
      async function togglePublish(btn){
        var row=btn.closest('tr'); var id=row.getAttribute('data-id');
        var pub=btn.textContent.trim()===${JSON.stringify(t.publish)};
        btn.disabled=true;
        try{
          var res=await fetch(BASE+'/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:pub?'published':'draft'})});
          var d=await res.json();
          if(d&&d.success){ location.reload(); return; }
          alert(S.err);
        }catch(e){ alert(S.err); }
        btn.disabled=false;
      }
      async function delCourse(btn){
        if(!confirm(S.confirmDel)) return;
        var row=btn.closest('tr'); var id=row.getAttribute('data-id');
        btn.disabled=true;
        try{
          var res=await fetch(BASE+'/'+id,{method:'DELETE'});
          var d=await res.json();
          if(d&&d.success){ row.remove(); return; }
          alert(S.err);
        }catch(e){ alert(S.err); }
        btn.disabled=false;
      }
    </script>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: t.meta_title, description: t.meta_desc, origin, path: '/ai-builder/courses' })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .cwrap{max-width:1080px;margin:0 auto;padding:2.5rem 1.5rem}
    .cm-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .cm-head h1{font-size:clamp(1.6rem,3.5vw,2.1rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);margin:.3rem 0 1.6rem}
    .cm-toolbar{margin-bottom:1rem}
    .cm-newform{display:none;gap:.6rem;align-items:center;border:1px solid var(--line);border-radius:14px;background:#fff;padding:1rem 1.1rem;margin-bottom:1.2rem;flex-wrap:wrap}
    .cm-newform input{flex:1;min-width:220px;padding:.55rem .7rem;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.95rem}
    .cm-tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
    .cm-table{width:100%;border-collapse:collapse;font-size:.92rem}
    .cm-table th{text-align:left;padding:.7rem .9rem;color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid var(--line)}
    .cm-table td{padding:.7rem .9rem;border-bottom:1px solid var(--line);vertical-align:middle}
    .cm-table tr:last-child td{border-bottom:none}
    .cm-title{font-weight:700;color:var(--ink);text-decoration:none}
    .cm-title:hover{color:#4f46e5;text-decoration:underline}
    .cm-sub{color:var(--muted);font-size:.82rem;margin-top:.15rem}
    .cm-badge{display:inline-block;padding:.2rem .55rem;border-radius:999px;font-size:.72rem;font-weight:700}
    .cm-badge.pub{background:#dcfce7;color:#166534}
    .cm-badge.draft{background:#f1f5f9;color:#475569}
    .cm-actions{white-space:nowrap;display:flex;gap:.4rem;flex-wrap:wrap}
    .btn.sm{font-size:.8rem;padding:.35rem .65rem}
    .cm-empty{text-align:center;color:var(--muted);border:2px dashed var(--line);border-radius:14px;padding:3rem 1.5rem}
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
