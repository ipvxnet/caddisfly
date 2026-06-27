// GET /ai-builder/refactor — the LOGGED-IN "Refactor my site" flow.
//
// Until now, refactoring while signed in fell into the build-from-scratch /
// conversational generator (flat inferIndustry, no Places scrape) → poor,
// inconsistent results. This page reuses the SAME proven pipeline as the public
// homepage refactor card: POST /api/preview/search (scrape + Google Places +
// inferIndustryPreferring + photo pool) → POST /api/preview/build. Because the
// user is authenticated, search.js owns the resulting project under their email,
// so on build we drop them straight into the editor (no email round-trip).
//
// billingAuth runs before this (non-blocking) and sets ctx.billingEmail.
import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { translator } from '../../i18n/index.js';
import { buildLoaderAssets, buildLoaderMarkup } from '../../components/build-loader.js';
import { cannedJoke } from '../../utils/jokes.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function handleAIBuilderRefactor(ctx) {
  const { env, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/ai-builder/refactor', 302);
  const origin = env.APP_URL || (url ? new URL(url).origin : '');

  const inner = `
    <div class="rfx-wrap">
      <h1>${esc(tr('landing.refactor_title'))}</h1>
      <p class="rfx-lead">${esc(tr('landing.refactor_lead'))}</p>
      <div class="rfx-signed">✓ ${esc(tr('builder.signed_in_as'))} <strong>${esc(email)}</strong></div>

      <form id="rfx-form" novalidate>
        <label for="rfx-url">${esc(tr('landing.refactor_url'))}</label>
        <input type="url" id="rfx-url" placeholder="https://your-site.com" required>
        <div class="rfx-err" id="rfx-url-err"></div>

        <details class="rfx-more">
          <summary>${esc(tr('landing.rf_optional') || 'Add details (optional)')}</summary>
          <label for="rfx-name">${esc(tr('convo.form.business_name') || 'Business name')}</label>
          <input type="text" id="rfx-name" placeholder="">
          <label for="rfx-search">${esc(tr('landing.rf_search_label') || 'Best way to find you on Google')}</label>
          <input type="text" id="rfx-search" placeholder="">
          <label for="rfx-services">${esc(tr('convo.form.services') || 'What you offer')}</label>
          <input type="text" id="rfx-services" placeholder="">
        </details>

        <label for="rfx-lang">${esc(tr('builder.lang_label'))}</label>
        <select id="rfx-lang">
          <option value="en"${lang === 'en' ? ' selected' : ''}>English</option>
          <option value="es"${lang === 'es' ? ' selected' : ''}>Español</option>
          <option value="pt"${lang === 'pt' ? ' selected' : ''}>Português</option>
        </select>

        <button type="submit" class="btn btn-primary btn-full" id="rfx-btn">
          <span id="rfx-label">${esc(tr('landing.rf_btn_preview'))}</span>
          <span class="rfx-spin" id="rfx-spin"></span>
        </button>
      </form>
      <div class="rfx-bad" id="rfx-bad"></div>
      <div id="rfx-preview" hidden></div>
    </div>

    <div id="cf-overlay" style="display:none;position:fixed;inset:0;z-index:10070;color:#fff;padding:24px;overflow:auto;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 55%,#f093fb 120%)">
      ${buildLoaderMarkup({ lang, title: tr('loading.building_title'), sub: tr('loading.building_sub'), joke: cannedJoke(0, lang), errHtml: '' })}
    </div>
    ${buildLoaderAssets(lang)}

    <style>
      .rfx-wrap{max-width:560px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
      .rfx-wrap h1{font-size:clamp(1.7rem,4vw,2.3rem);font-weight:900;color:var(--ink,#1a202c);letter-spacing:-.02em;margin:0 0 .4rem}
      .rfx-lead{color:var(--body,#4a5568);margin:0 0 1.3rem}
      .rfx-signed{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:.6rem .9rem;font-size:.92rem;color:#166534;margin-bottom:1.2rem}
      #rfx-form{display:flex;flex-direction:column;gap:.4rem}
      #rfx-form label{font-weight:700;font-size:.9rem;color:var(--ink,#1a202c);margin-top:.6rem}
      #rfx-form input,#rfx-form select{padding:.75rem .85rem;border:1.5px solid var(--line,#e2e8f0);border-radius:10px;font:inherit;width:100%;box-sizing:border-box}
      #rfx-form input.error{border-color:#dc2626}
      .rfx-more{margin-top:.6rem;border:1px solid var(--line,#e2e8f0);border-radius:10px;padding:.4rem .8rem}
      .rfx-more summary{cursor:pointer;font-weight:700;font-size:.88rem;color:var(--p2,#764ba2);padding:.3rem 0}
      .btn-full{width:100%;justify-content:center;margin-top:1rem}
      .rfx-err{color:#dc2626;font-size:.82rem;min-height:1em;display:none}
      .rfx-err.show{display:block}
      .rfx-bad{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:.8rem 1rem;margin-top:1rem;display:none}
      .rfx-bad.show{display:block}
      .rfx-spin{display:none;width:15px;height:15px;border:2px solid rgba(255,255,255,.5);border-top-color:#fff;border-radius:50%;animation:rfxspin .7s linear infinite;margin-left:.5rem;vertical-align:middle}
      .rfx-spin.show{display:inline-block}
      @keyframes rfxspin{to{transform:rotate(360deg)}}
    </style>

    <script>
      (function(){
        var form=document.getElementById('rfx-form');
        var urlEl=document.getElementById('rfx-url'), urlErr=document.getElementById('rfx-url-err');
        var btn=document.getElementById('rfx-btn'), label=document.getElementById('rfx-label'), spin=document.getElementById('rfx-spin');
        var bad=document.getElementById('rfx-bad'), preview=document.getElementById('rfx-preview');
        var RF=${JSON.stringify({
          preview: tr('landing.rf_btn_preview'), searching: tr('landing.rf_searching'),
          err_url: tr('landing.rf_err_url'), err_generic: tr('landing.rf_err_generic'), err_network: tr('landing.rf_err_network'),
          card_title: tr('landing.rf_card_title'), build: tr('landing.rf_build'), refine: tr('landing.rf_refine'),
          nomatch: tr('landing.rf_nomatch'),
          mode_label: tr('landing.rf_mode_label'), mode_match: tr('landing.rf_mode_match'), mode_match_hint: tr('landing.rf_mode_match_hint'),
          mode_fresh: tr('landing.rf_mode_fresh'), mode_fresh_hint: tr('landing.rf_mode_fresh_hint'),
        })};
        function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
        function isUrl(v){try{var u=new URL(v.indexOf('http')===0?v:'https://'+v);return u.protocol==='http:'||u.protocol==='https:';}catch(e){return false;}}

        async function doBuild(previewId, token, mode){
          bad.classList.remove('show');
          var ov=document.getElementById('cf-overlay');
          if(ov){ov.style.display='flex'; if(window.CFLoader) CFLoader.startSteps();}
          try{
            var res=await fetch('/api/preview/build/'+previewId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token,import_mode:mode||'faithful'})});
            var d=await res.json();
            if(d.success){
              if(window.CFLoader) CFLoader.complete();
              // Authed owner → straight into the editor (not the emailed preview link).
              setTimeout(function(){location.href='/ai-builder/customize/'+previewId;},900);
            } else {
              if(ov) ov.style.display='none';
              bad.textContent=d.error||RF.err_generic; bad.classList.add('show');
            }
          }catch(e){ if(ov) ov.style.display='none'; bad.textContent=RF.err_network; bad.classList.add('show'); }
        }

        function renderPreview(data){
          var photos=(data.photos||[]).slice(0,4).map(function(u){return '<img src="'+esc(u)+'" alt="" loading="lazy" style="width:84px;height:84px;object-fit:cover;border-radius:9px;flex:none">';}).join('');
          var meta=[]; if(data.address)meta.push(esc(data.address)); if(data.phone)meta.push(esc(data.phone)); if(data.rating)meta.push('★ '+data.rating+' ('+(data.rating_count||0)+')');
          preview.innerHTML=
            '<div style="margin-top:1.2rem;border:1px solid var(--line,#e2e8f0);border-radius:14px;padding:1.1rem;background:var(--soft,#f8fafc)">'
            +'<div style="font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--p2,#764ba2);margin-bottom:.5rem">'+esc(RF.card_title)+'</div>'
            +'<div style="font-size:1.15rem;font-weight:800;color:var(--ink,#1a202c)">'+esc(data.name||'')+(data.category?(' <span style="font-weight:500;color:var(--muted,#718096);font-size:.9rem">· '+esc(data.category)+'</span>'):'')+'</div>'
            +(meta.length?('<div style="font-size:.83rem;color:var(--body,#4a5568);margin-top:.25rem">'+meta.join(' · ')+'</div>'):'')
            +(photos?('<div style="display:flex;gap:.45rem;overflow-x:auto;margin:.8rem 0">'+photos+'</div>'):'')
            +(data.sample?('<p style="font-size:.85rem;color:var(--body,#4a5568);margin-top:.5rem">'+esc(data.sample)+'…</p>'):'')
            +(data.found?'':('<p style="font-size:.8rem;color:#92722a;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.5rem .7rem;margin-top:.7rem">'+esc(RF.nomatch)+'</p>'))
            +'<div style="margin-top:.95rem;display:grid;gap:.5rem">'
            +'<div style="font-size:.72rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted,#718096)">'+esc(RF.mode_label)+'</div>'
            +'<label class="rfx-mode-opt" style="display:flex;gap:.55rem;align-items:flex-start;border:1.5px solid var(--p2,#764ba2);border-radius:11px;padding:.6rem .7rem;cursor:pointer;background:var(--soft,#f8fafc)"><input type="radio" name="rfx-mode" value="faithful" checked style="margin-top:.2rem"><span><b style="color:var(--ink,#1a202c);font-size:.9rem">'+esc(RF.mode_match)+'</b><br><span style="font-size:.8rem;color:var(--body,#4a5568)">'+esc(RF.mode_match_hint)+'</span></span></label>'
            +'<label class="rfx-mode-opt" style="display:flex;gap:.55rem;align-items:flex-start;border:1.5px solid var(--line,#e2e8f0);border-radius:11px;padding:.6rem .7rem;cursor:pointer"><input type="radio" name="rfx-mode" value="reimagine" style="margin-top:.2rem"><span><b style="color:var(--ink,#1a202c);font-size:.9rem">'+esc(RF.mode_fresh)+'</b><br><span style="font-size:.8rem;color:var(--body,#4a5568)">'+esc(RF.mode_fresh_hint)+'</span></span></label>'
            +'</div>'
            +'<div style="display:flex;gap:.5rem;margin-top:.9rem"><button type="button" class="btn btn-primary rfx-build" style="flex:1;justify-content:center">'+esc(RF.build)+'</button>'
            +'<button type="button" class="btn btn-ghost rfx-refine">'+esc(RF.refine)+'</button></div>'
            +'</div>';
          preview.hidden=false;
          preview.querySelector('.rfx-build').addEventListener('click',function(){var sel=preview.querySelector('input[name="rfx-mode"]:checked');doBuild(data.preview_id,data.build_token,sel?sel.value:'faithful');});
          preview.querySelectorAll('input[name="rfx-mode"]').forEach(function(r){r.addEventListener('change',function(){preview.querySelectorAll('.rfx-mode-opt').forEach(function(l){var on=l.querySelector('input').checked;l.style.borderColor=on?'var(--p2,#764ba2)':'var(--line,#e2e8f0)';l.style.background=on?'var(--soft,#f8fafc)':'transparent';});});});
          preview.querySelector('.rfx-refine').addEventListener('click',function(){preview.hidden=true;urlEl.focus();});
          preview.scrollIntoView({behavior:'smooth',block:'nearest'});
        }

        form.addEventListener('submit',async function(e){
          e.preventDefault();
          urlErr.classList.remove('show'); urlEl.classList.remove('error'); bad.classList.remove('show'); preview.hidden=true;
          var website=urlEl.value.trim();
          if(!isUrl(website)){urlErr.textContent=RF.err_url;urlErr.classList.add('show');urlEl.classList.add('error');return;}
          btn.disabled=true; label.textContent=RF.searching; spin.classList.add('show');
          try{
            var v=function(id){var el=document.getElementById(id);return el?el.value.trim():'';};
            var res=await fetch('/api/preview/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
              website:website, accepted_terms:true, language:document.getElementById('rfx-lang').value,
              business_name:v('rfx-name'), search_query:v('rfx-search'), services:v('rfx-services')
            })});
            var data=await res.json();
            if(data.success){ renderPreview(data); }
            else { bad.textContent=data.error||RF.err_generic; bad.classList.add('show'); }
          }catch(err){ bad.textContent=RF.err_network; bad.classList.add('show'); }
          finally{ btn.disabled=false; label.textContent=RF.preview; spin.classList.remove('show'); }
        });
      })();
    </script>`;

  const html = `<!DOCTYPE html><html lang="${lang}"><head>${headTags({ title: tr('landing.refactor_title') + ' — Caddisfly', description: 'Refactor your existing website.', origin, path: '/ai-builder/refactor' })}<meta name="robots" content="noindex"><style>${baseCss()}</style></head>
  <body>${siteHeader('', {})}<main>${inner}</main>${siteFooter({ lang })}</body></html>`;
  return htmlResponse(html);
}
