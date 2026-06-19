// Shared "building your site" loader — one look for BOTH AI generation and
// refactoring. Combines the staged checklist (Analyzing → Generating → Design →
// Sections → SEO → Finalizing) with the rotating "joke while you wait" card.
//
// Usage in a page:
//   <head> … ${buildLoaderAssets(lang)} </head>
//   <body> ${buildLoaderMarkup({ lang, title, sub, joke, errHtml })} … </body>
//   <script> CFLoader.startSteps(); … CFLoader.complete()/CFLoader.fail(msg) </script>

import { brandMark } from '../routes/public/landing.js';
import { escapeHtml } from '../utils/ai-page-assembler.js';
import { translator } from '../i18n/index.js';

/** Shared CSS + the CFLoader controller script. Include once in <head>. */
export function buildLoaderAssets(lang = 'en') {
  const tr = translator(lang);
  // 6 step status texts + the final "complete" text (index 6).
  const steps = [
    tr('loading.step_analyzing') + '…',
    tr('loading.step_generating') + '…',
    tr('loading.step_design') + '…',
    tr('loading.step_sections') + '…',
    tr('loading.step_seo') + '…',
    tr('loading.step_finalizing') + '…',
    tr('loading.status_complete'),
  ];
  return `
<style>
  .cf-wrap{text-align:center;max-width:600px;width:100%;margin:0 auto}
  .cf-logo{width:104px;height:104px;margin:0 auto 6px;filter:drop-shadow(0 10px 28px rgba(0,0,0,.28))}
  .cf-logo svg{width:100%;height:100%}
  .cf-h1{font-size:clamp(1.6rem,4vw,2.3rem);margin:.3rem 0 .6rem;font-weight:800;letter-spacing:-.01em;animation:cf-fade .5s ease-out}
  .cf-sub{opacity:.92;margin:0 auto 1.8rem;max-width:460px;line-height:1.55;animation:cf-fade .5s ease-out .15s both}
  .cf-card{background:rgba(255,255,255,.16);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
           border:1px solid rgba(255,255,255,.22);border-radius:16px;padding:1.6rem;margin-bottom:1.6rem;animation:cf-fade .5s ease-out .3s both}
  .cf-spinner{width:52px;height:52px;border:5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;
              animation:cf-spin 1s linear infinite;margin:.2rem auto 1.4rem}
  .cf-status{font-size:1.05rem;font-weight:600;margin-bottom:1.1rem;min-height:1.3em}
  .cf-steps{text-align:left;display:grid;gap:.45rem}
  .cf-step{display:flex;align-items:center;gap:.85rem;padding:.65rem .8rem;border-radius:9px;
           background:rgba(255,255,255,.1);opacity:.5;transition:all .3s ease;font-size:.95rem}
  .cf-step.active{opacity:1;background:rgba(255,255,255,.2)}
  .cf-step.complete{opacity:1}
  .cf-ic{width:22px;height:22px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;
         font-size:.72rem;flex-shrink:0}
  .cf-step.active .cf-ic{border-width:3px}
  .cf-step.complete .cf-ic{background:#fff;color:#764ba2}
  .cf-joke-label{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.82;margin:0 0 10px}
  .cf-joke{background:rgba(255,255,255,.15);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
           border:1px solid rgba(255,255,255,.28);border-radius:16px;padding:20px 24px;min-height:84px;
           display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1.5;transition:opacity .45s ease}
  .cf-dots{margin-top:26px;display:flex;gap:8px;justify-content:center}
  .cf-dots i{width:10px;height:10px;border-radius:50%;background:#fff;opacity:.5;animation:cf-bob 1.2s infinite ease-in-out}
  .cf-dots i:nth-child(2){animation-delay:.18s}.cf-dots i:nth-child(3){animation-delay:.36s}
  .cf-err{display:none;margin-top:22px;line-height:1.6}
  .cf-err a{color:#fff;font-weight:700}
  @keyframes cf-spin{to{transform:rotate(360deg)}}
  @keyframes cf-bob{0%,100%{opacity:.35;transform:translateY(0)}50%{opacity:1;transform:translateY(-6px)}}
  @keyframes cf-fade{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @media (prefers-reduced-motion:reduce){.cf-dots i,.cf-spinner{animation:none}}
</style>
<script>
  window.CFLoader = (function(){
    var STEPS = ${JSON.stringify(steps)};
    var cur = 0, stepTimer = null, jokeTimer = null;
    function paint(){
      var st = document.getElementById('cf-status'); if (st) st.textContent = STEPS[cur] || '';
      for (var i=1;i<=6;i++){
        var el = document.getElementById('cf-step-'+i); if (!el) continue;
        el.classList.remove('active','complete');
        if (i < cur){ el.classList.add('complete'); var ic=el.querySelector('.cf-ic'); if (ic) ic.textContent='✓'; }
        else if (i === cur){ el.classList.add('active'); }
      }
    }
    function advance(){ if (cur < STEPS.length-1){ cur++; paint(); stepTimer=setTimeout(advance, 2200); } }
    function rotateJoke(){
      var j = document.getElementById('cf-joke'); if (!j) return;
      fetch('/api/fun/joke').then(function(r){return r.json()}).then(function(d){
        if (d && d.joke){ j.style.opacity=0; setTimeout(function(){ j.textContent=d.joke; j.style.opacity=1; }, 450); }
      }).catch(function(){});
    }
    function startSteps(){ cur=1; paint(); stepTimer=setTimeout(advance,2200); jokeTimer=setInterval(rotateJoke,12000); }
    function stop(){ if (stepTimer) clearTimeout(stepTimer); if (jokeTimer) clearInterval(jokeTimer); }
    function complete(){
      stop(); cur = STEPS.length-1;
      for (var i=1;i<=6;i++){ var el=document.getElementById('cf-step-'+i); if (el){ el.classList.remove('active'); el.classList.add('complete'); var ic=el.querySelector('.cf-ic'); if (ic) ic.textContent='✓'; } }
      var st=document.getElementById('cf-status'); if (st) st.textContent = STEPS[STEPS.length-1];
    }
    function fail(msg){ stop(); var e=document.getElementById('cf-err'); if (e){ e.style.display='block'; var m=document.getElementById('cf-err-msg'); if (m && msg) m.textContent=msg; } }
    return { startSteps:startSteps, complete:complete, fail:fail, stop:stop };
  })();
</script>`;
}

/**
 * The loader markup. Caller supplies title/sub (so generation vs refactor read
 * right), the initial joke, and the error-state inner HTML (retry vs links).
 */
export function buildLoaderMarkup({ lang = 'en', title = '', sub = '', joke = '', errHtml = '' } = {}) {
  const tr = translator(lang);
  const labels = [
    tr('loading.step_analyzing'), tr('loading.step_generating'), tr('loading.step_design'),
    tr('loading.step_sections'), tr('loading.step_seo'), tr('loading.step_finalizing'),
  ];
  const stepsHtml = labels.map((l, i) =>
    `<div class="cf-step" id="cf-step-${i + 1}"><div class="cf-ic"></div><div>${escapeHtml(l)}</div></div>`
  ).join('');
  return `
  <div class="cf-wrap">
    <div class="cf-logo">${brandMark('cf-logo-svg', '', true)}</div>
    <div class="cf-h1">${escapeHtml(title)}</div>
    <p class="cf-sub">${escapeHtml(sub)}</p>
    <div class="cf-card">
      <div class="cf-spinner"></div>
      <div class="cf-status" id="cf-status"></div>
      <div class="cf-steps">${stepsHtml}</div>
    </div>
    <p class="cf-joke-label">${escapeHtml(tr('loading.joke_label'))}</p>
    <div class="cf-joke" id="cf-joke">${escapeHtml(joke)}</div>
    <div class="cf-dots"><i></i><i></i><i></i></div>
    <div class="cf-err" id="cf-err"><p id="cf-err-msg"></p>${errHtml}</div>
  </div>`;
}
