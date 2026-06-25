// GET /ai-builder/report/:project_id — the site report on the owner's dashboard:
//   1. Third-party content dependencies (external URLs the site loads) — live scan.
//   2. Speed & quality (PageSpeed/Lighthouse) for Desktop + Mobile — cached, on-demand.
// Gated by projectAccess. i18n: local REP dict (en/es/pt) by ctx.lang.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { getDomainsByProject } from '../../db/custom-domains.js';
import { scanExternalDeps, getSpeedReport, saveSpeedReport, runPageSpeed, countSpeedRuns, logSpeedRun, SPEED_LIMIT, SPEED_WINDOW } from '../../db/site-report.js';

const SITES_BASE = 'caddisfly.app';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const fmtDate = (ts) => { if (!ts) return ''; try { return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; } catch { return ''; } };

const REP = {
  en: {
    meta_title: 'Site report — Caddisfly', title: 'Site report', back: '← Dashboard',
    sub: 'Third-party content dependencies and a speed & quality test for {name}.',
    deps_h: 'Third-party content dependencies',
    deps_sub: 'External addresses your site loads content from. Hotlinked images and off-site files are a dependency on someone else and can slow your site.',
    deps_none: 'None — all your content is served from your own site. 🎉', deps_summary: '{total} external resource(s) · {img} hotlinked image(s)',
    th_resource: 'Resource', th_kind: 'Type', th_where: 'Used in', th_uses: 'Uses',
    kind_image: 'Image', kind_video: 'Video', kind_pdf: 'PDF', kind_font: 'Font', kind_script: 'Script', kind_link: 'Link',
    speed_h: 'Speed & quality', speed_sub: 'Google Lighthouse (PageSpeed) scores for Desktop and Mobile.',
    not_published: 'Publish your site first to run a speed test.',
    run_btn: 'Run speed test', running: 'Testing… this takes about 30 seconds', run_again: 'Re-run test',
    last_tested: 'Last tested {when}', tested_url: 'Tested {url}', desktop: 'Desktop', mobile: 'Mobile',
    m_perf: 'Performance', m_access: 'Accessibility', m_bp: 'Best practices', m_seo: 'SEO',
    metrics_h: 'Load metrics', met_lcp: 'Largest paint', met_fcp: 'First paint', met_tbt: 'Blocking time', met_cls: 'Layout shift', met_si: 'Speed index', met_tti: 'Interactive',
    err: 'Could not run the test.', err_psi: 'Speed test unavailable — the PageSpeed API may need to be enabled on the Google key.',
    rate_limited: "You've reached the limit of {n} speed tests per 24 h for this site. Try again later.", runs_left: '{n} of {max} tests left today',
  },
  es: {
    meta_title: 'Informe del sitio — Caddisfly', title: 'Informe del sitio', back: '← Dashboard',
    sub: 'Dependencias de contenido de terceros y una prueba de velocidad y calidad para {name}.',
    deps_h: 'Dependencias de contenido de terceros',
    deps_sub: 'Las direcciones externas de las que tu sitio carga contenido. Las imágenes hotlink y archivos fuera del sitio son una dependencia de terceros y pueden ralentizar tu sitio.',
    deps_none: 'Ninguna — todo tu contenido se sirve desde tu propio sitio. 🎉', deps_summary: '{total} recurso(s) externo(s) · {img} imagen(es) hotlink',
    th_resource: 'Recurso', th_kind: 'Tipo', th_where: 'Usado en', th_uses: 'Usos',
    kind_image: 'Imagen', kind_video: 'Video', kind_pdf: 'PDF', kind_font: 'Fuente', kind_script: 'Script', kind_link: 'Enlace',
    speed_h: 'Velocidad y calidad', speed_sub: 'Puntuaciones de Google Lighthouse (PageSpeed) para Desktop y Mobile.',
    not_published: 'Publica tu sitio primero para realizar una prueba de velocidad.',
    run_btn: 'Ejecutar prueba de velocidad', running: 'Probando… esto toma aproximadamente 30 segundos', run_again: 'Reiniciar prueba',
    last_tested: 'Última prueba realizada {when}', tested_url: 'Prueba realizada en {url}', desktop: 'Escritorio', mobile: 'Móvil',
    m_perf: 'Rendimiento', m_access: 'Accesibilidad', m_bp: 'Mejores prácticas', m_seo: 'SEO',
    metrics_h: 'Métricas de carga', met_lcp: 'Pintura más grande', met_fcp: 'Primera pintura', met_tbt: 'Tiempo de bloqueo', met_cls: 'Desplazamiento de diseño', met_si: 'Índice de velocidad', met_tti: 'Interactivo',
    err: 'No se pudo ejecutar la prueba.', err_psi: 'Prueba de velocidad no disponible — es posible que debas habilitar la API de PageSpeed en la clave de Google.',
    rate_limited: 'Has alcanzado el límite de {n} pruebas de velocidad por 24 h para este sitio. Inténtalo más tarde.', runs_left: '{n} de {max} pruebas restantes hoy',
  },
  pt: {
    meta_title: 'Relatório do site — Caddisfly', title: 'Relatório do site', back: '← Dashboard',
    sub: 'Dependências de conteúdo de terceiros e uma avaliação de velocidade e qualidade para {name}.',
    deps_h: 'Dependências de conteúdo de terceiros',
    deps_sub: 'Endereços externos dos quais seu site carrega conteúdo. Imagens hotlink e arquivos fora do site são dependências de terceiros e podem desacelerar seu site.',
    deps_none: 'Nenhuma — todo seu conteúdo é servido diretamente do seu próprio site. 🎉', deps_summary: '{total} recurso(s) externo(s) · {img} imagem(ns) hotlink',
    th_resource: 'Recurso', th_kind: 'Tipo', th_where: 'Usado em', th_uses: 'Usos',
    kind_image: 'Imagem', kind_video: 'Vídeo', kind_pdf: 'PDF', kind_font: 'Fonte', kind_script: 'Script', kind_link: 'Link',
    speed_h: 'Velocidade e qualidade', speed_sub: 'Pontuação do Google Lighthouse (PageSpeed) para Desktop e Mobile.',
    not_published: 'Publique seu site primeiro para executar um teste de velocidade.',
    run_btn: 'Executar teste de velocidade', running: 'Testando… isso leva cerca de 30 segundos', run_again: 'Reexecutar teste',
    last_tested: 'Último teste realizado {when}', tested_url: 'Testado em {url}', desktop: 'Desktop', mobile: 'Móvel',
    m_perf: 'Desempenho', m_access: 'Acessibilidade', m_bp: 'Melhores práticas', m_seo: 'SEO',
    metrics_h: 'Métricas de carregamento', met_lcp: 'Pintura mais larga', met_fcp: 'Primeira pintura', met_tbt: 'Tempo de bloqueio', met_cls: 'Deslocamento de layout', met_si: 'Índice de velocidade', met_tti: 'Interativo',
    err: 'Não foi possível executar o teste.', err_psi: 'Teste de velocidade indisponível — talvez seja necessário habilitar a API de PageSpeed na chave do Google.',
    rate_limited: 'Você atingiu o limite de {n} testes de velocidade por 24 h para este site. Tente novamente mais tarde.', runs_left: '{n} de {max} testes restantes hoje',
  },
};
const pick = (lang) => REP[lang] || REP.en;
const KIND_KEY = { image: 'kind_image', video: 'kind_video', pdf: 'kind_pdf', font: 'kind_font', script: 'kind_script', link: 'kind_link' };

/** Resolve a public id → { projectKey, subdomain, status, name }, or null. */
async function resolve(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) return { projectKey: { aiProjectId: ai.id }, subdomain: ai.subdomain || '', status: ai.status, name: ai.project_name || 'Untitled' };
  const rg = await getProjectByPreviewId(env.DB, publicId);
  if (rg) { let n = rg.website_url || 'Untitled'; try { const p = JSON.parse(rg.company_profile_json || '{}'); if (p && p.name) n = p.name; } catch { /* */ } return { projectKey: { projectId: rg.id }, subdomain: rg.subdomain || '', status: rg.status, name: n }; }
  return null;
}

/** Live URL + the set of hostnames considered "ours". */
async function siteHosts(env, projectKey, subdomain) {
  const suffix = env.SITES_PREVIEW_SUFFIX || '';
  const base = env.SITES_BASE || SITES_BASE;
  const domains = await getDomainsByProject(env.DB, projectKey).catch(() => []);
  const own = new Set();
  if (subdomain) own.add(`${subdomain}${suffix}.${base}`.toLowerCase());
  for (const d of domains) { const h = String(d.hostname || '').toLowerCase(); if (h) { own.add(h); own.add(h.startsWith('www.') ? h.slice(4) : 'www.' + h); } }
  const active = domains.find((d) => d.status === 'active');
  const liveUrl = active ? `https://${active.hostname}` : (subdomain ? `https://${subdomain}${suffix}.${base}` : '');
  return { liveUrl, own };
}

const sCls = (s) => (s == null ? 'na' : s >= 90 ? 'good' : s >= 50 ? 'avg' : 'bad');

function strategyBlock(T, label, d) {
  if (!d) return '';
  const card = (k, s) => `<div class="sc ${sCls(s)}"><div class="sc-n">${s == null ? '—' : s}</div><div class="sc-l">${T[k]}</div></div>`;
  const met = (k, v) => `<div class="met"><span class="met-l">${T[k]}</span><span class="met-v">${esc(v || '—')}</span></div>`;
  return `<div class="strat"><h3 class="strat-h">${label}</h3>
    <div class="scores">${card('m_perf', d.performance)}${card('m_access', d.accessibility)}${card('m_bp', d.best_practices)}${card('m_seo', d.seo)}</div>
    <div class="mets">${met('met_lcp', d.lcp)}${met('met_fcp', d.fcp)}${met('met_tbt', d.tbt)}${met('met_cls', d.cls)}${met('met_si', d.si)}${met('met_tti', d.tti)}</div></div>`;
}

/** GET /ai-builder/report/:project_id */
export async function handleSiteReport(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const r = await resolve(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const { liveUrl, own } = await siteHosts(env, r.projectKey, r.subdomain);
  const published = r.status === 'deployed' && !!r.subdomain;

  const deps = await scanExternalDeps(env, r.projectKey, params.project_id, own).catch(() => ({ total: 0, hotlinkedImages: 0, byKind: {}, items: [] }));
  const report = await getSpeedReport(env.DB, r.projectKey).catch(() => null);

  const depsBody = deps.total
    ? `<p class="rsummary">${T.deps_summary.replace('{total}', deps.total).replace('{img}', deps.hotlinkedImages)}</p>
       <div class="rtwrap"><table class="rtable"><thead><tr><th>${T.th_resource}</th><th>${T.th_kind}</th><th>${T.th_where}</th><th>${T.th_uses}</th></tr></thead><tbody>
       ${deps.items.map((it) => `<tr>
          <td><a href="${esc(it.url)}" target="_blank" rel="noopener" title="${esc(it.url)}">${esc(it.host)}</a></td>
          <td><span class="kb k-${it.kind}">${T[KIND_KEY[it.kind]] || it.kind}</span></td>
          <td class="muted">${esc(it.where)}</td><td>${it.count}</td></tr>`).join('')}
       </tbody></table></div>`
    : `<p class="rnone">${T.deps_none}</p>`;

  let speedBody;
  if (!published) {
    speedBody = `<p class="rnone">${T.not_published}</p>`;
  } else {
    const hasReport = report && report.data && (report.data.mobile || report.data.desktop);
    const meta = hasReport
      ? `<p class="muted rmeta">${T.last_tested.replace('{when}', esc(fmtDate(report.created_at)))} · ${T.tested_url.replace('{url}', `<a href="${esc(report.tested_url)}" target="_blank" rel="noopener">${esc(report.tested_url)}</a>`)}</p>`
      : '';
    const blocks = hasReport
      ? `<div class="strats">${strategyBlock(T, T.mobile, report.data.mobile)}${strategyBlock(T, T.desktop, report.data.desktop)}</div>`
      : '';
    const since = Math.floor(Date.now() / 1000) - SPEED_WINDOW;
    const used = await countSpeedRuns(env.DB, r.projectKey, since).catch(() => 0);
    const remaining = Math.max(0, SPEED_LIMIT - used);
    const runBtn = remaining > 0
      ? `<button class="btn" type="button" id="run-speed">${hasReport ? T.run_again : T.run_btn}</button>
         <span class="muted rleft">${T.runs_left.replace('{n}', remaining).replace('{max}', SPEED_LIMIT)}</span>`
      : `<button class="btn" type="button" disabled style="opacity:.5;cursor:not-allowed">${hasReport ? T.run_again : T.run_btn}</button>
         <span class="muted">${T.rate_limited.replace('{n}', SPEED_LIMIT)}</span>`;
    speedBody = `${blocks}${meta}<div class="runline">${runBtn}<span id="run-msg" class="muted"></span></div>`;
  }

  const base = '/ai-builder';
  const inner = `
    <div class="rhead"><h1>📊 ${T.title} <span class="muted rname">— ${esc(r.name)}</span></h1>
      <a class="btn ghost" href="/dashboard">${T.back}</a></div>
    <p class="sub">${T.sub.replace('{name}', esc(r.name))}</p>

    <div class="rcard"><h2>${T.deps_h}</h2><p class="rcard-sub">${T.deps_sub}</p>${depsBody}</div>
    <div class="rcard"><h2>${T.speed_h}</h2><p class="rcard-sub">${T.speed_sub}</p>${speedBody}</div>

    <script>
      var SPEED = '/api/ai-builder/' + ${JSON.stringify(params.project_id)} + '/report/speed';
      var M = ${JSON.stringify({ running: T.running, err: T.err })};
      var btn = document.getElementById('run-speed');
      if (btn) btn.addEventListener('click', async function(){
        btn.disabled = true; var msg = document.getElementById('run-msg'); msg.textContent = M.running;
        try {
          var res = await fetch(SPEED, { method:'POST' });
          var d = await res.json();
          if (res.ok && d.success) { location.reload(); return; }
          msg.textContent = (d && d.error) || M.err; btn.disabled = false;
        } catch(e) { msg.textContent = M.err; btn.disabled = false; }
      });
    </script>`;

  return htmlResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: 'Your site report.', origin: url.origin, path: base + '/report' })}<meta name="robots" content="noindex">
  <style>${baseCss()}
    main{min-height:60vh}.rwrap{max-width:920px;margin:0 auto;padding:2.4rem 1.5rem}
    .rhead{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .rhead h1{font-size:clamp(1.5rem,3.5vw,2rem);font-weight:900;color:var(--ink)}.rname{font-weight:400;font-size:1rem}
    .sub{color:var(--body);margin:.3rem 0 1.4rem}.muted{color:var(--muted)}
    .rcard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem;margin-bottom:1.2rem}
    .rcard h2{font-size:1.1rem;color:var(--ink);margin:0 0 .2rem}.rcard-sub{color:var(--muted);font-size:.85rem;margin:0 0 1rem}
    .rsummary{font-weight:700;color:var(--ink);margin:0 0 .8rem}.rnone{color:var(--muted);margin:0}
    .rtwrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px}
    .rtable{width:100%;border-collapse:collapse;font-size:.86rem}
    .rtable th{text-align:left;padding:.5rem .7rem;color:var(--muted);font-size:.7rem;text-transform:uppercase;border-bottom:1px solid var(--line)}
    .rtable td{padding:.5rem .7rem;border-bottom:1px solid var(--line);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rtable tr:last-child td{border-bottom:none}.rtable a{color:var(--p2);text-decoration:none}
    .kb{display:inline-block;border-radius:999px;padding:.08rem .55rem;font-size:.72rem;font-weight:700;background:#f1f5f9;color:#475569}
    .k-image{background:#fef3c7;color:#92400e}.k-video{background:#ede9fe;color:#6d28d9}.k-pdf{background:#fee2e2;color:#991b1b}.k-script{background:#e0e7ff;color:#3730a3}
    .strats{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:.6rem}
    @media (max-width:640px){.strats{grid-template-columns:1fr}}
    .strat{border:1px solid var(--line);border-radius:12px;padding:1rem}.strat-h{margin:0 0 .7rem;font-size:.95rem;color:var(--ink)}
    .scores{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:.8rem}
    .sc{text-align:center;border-radius:9px;padding:.5rem .2rem;background:#f8fafc}
    .sc-n{font-size:1.3rem;font-weight:900;line-height:1}.sc-l{font-size:.64rem;color:var(--muted);margin-top:.2rem;text-transform:uppercase;letter-spacing:.02em}
    .sc.good .sc-n{color:#0a7d33}.sc.good{background:#ecfdf5}.sc.avg .sc-n{color:#b45309}.sc.avg{background:#fffbeb}.sc.bad .sc-n{color:#b91c1c}.sc.bad{background:#fef2f2}.sc.na .sc-n{color:#94a3b8}
    .mets{display:grid;grid-template-columns:1fr 1fr;gap:.25rem .8rem}
    .met{display:flex;justify-content:space-between;font-size:.78rem;border-bottom:1px dotted var(--line);padding:.15rem 0}.met-l{color:var(--muted)}.met-v{font-weight:700;color:var(--ink)}
    .rmeta{font-size:.78rem;margin:.2rem 0 1rem}.rmeta a{color:var(--p2)}
    .runline{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap}
  </style></head><body>${siteHeader('/dashboard', {})}<main><div class="rwrap">${inner}</div></main>${siteFooter({ lang })}</body></html>`);
}

/** POST /api/ai-builder/:project_id/report/speed — run PageSpeed (mobile+desktop), cache, return. */
export async function handleRunSpeed(ctx) {
  const { env, params } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const r = await resolve(env, params.project_id);
  if (!r) return json({ success: false, error: 'Project not found' }, 404);
  const published = r.status === 'deployed' && !!r.subdomain;
  if (!published) return json({ success: false, error: T.not_published }, 400);
  const { liveUrl } = await siteHosts(env, r.projectKey, r.subdomain);
  if (!liveUrl) return json({ success: false, error: T.not_published }, 400);
  // Rate limit: SPEED_LIMIT runs per rolling SPEED_WINDOW per site (protects the PSI quota).
  const since = Math.floor(Date.now() / 1000) - SPEED_WINDOW;
  if (await countSpeedRuns(env.DB, r.projectKey, since) >= SPEED_LIMIT) {
    return json({ success: false, error: T.rate_limited.replace('{n}', SPEED_LIMIT) }, 429);
  }
  await logSpeedRun(env.DB, r.projectKey); // count the call (consumes PSI quota regardless of outcome)
  try {
    const data = await runPageSpeed(env, liveUrl);
    await saveSpeedReport(env.DB, r.projectKey, liveUrl, data);
    return json({ success: true, data, tested_url: liveUrl });
  } catch (e) {
    console.error('pagespeed error:', e.message);
    const msg = /not been used|disabled|API_KEY|403|enable/i.test(e.message) ? T.err_psi : T.err;
    return json({ success: false, error: msg }, 502);
  }
}
