// Shared custom-domain manager — used by the customize page AND the customer
// dashboard. Project-scoped: each panel carries data-project, and the JS reads
// it via closest('.domains-panel'), so any number of panels can coexist on one
// page (e.g. one per site in the dashboard).
//
// Adding a domain appends the new record row IN PLACE (no page reload) so the
// DNS records the customer must add stay visible — fixes the old "the box
// closed like nothing happened" glitch.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// One DNS record shown as a labeled block: Type / Name / Value, each field
// clearly labeled with its own Copy button (so customers don't grab name+value
// as one string).
function recordBlock(type, name, value) {
  return `
        <div class="d-record">
          <div class="d-field"><span class="d-flabel">Type</span><span class="d-type">${esc(type)}</span></div>
          <div class="d-field"><span class="d-flabel">Name</span><code class="d-code">${esc(name)}</code><button type="button" class="d-copy" onclick="dCopy(this)">Copy</button></div>
          <div class="d-field"><span class="d-flabel">Value</span><code class="d-code wrap">${esc(value)}</code><button type="button" class="d-copy" onclick="dCopy(this)">Copy</button></div>
        </div>`;
}

/** Server render of one domain row (mirrors the client buildDomainRow). */
function domainRowHtml(d, sitesBase) {
  const active = d.status === 'active';
  return `
      <div class="d-row" data-id="${d.id}">
        <div class="d-host"><strong>${esc(d.hostname)}</strong> <span class="d-badge ${active ? 'ok' : 'pending'}">${active ? 'Active' : 'Pending'}</span></div>
        ${active
          ? `<div class="d-live">Live at <a href="https://${esc(d.hostname)}" target="_blank" rel="noopener">https://${esc(d.hostname)}</a></div>`
          : `<div class="d-dns"><p>Add ${d.dcv_name ? 'these two DNS records' : 'this DNS record'} at your domain registrar, then click <em>Check status</em>:</p>
               ${recordBlock('CNAME', d.hostname, d.cname_target || sitesBase)}
               ${d.dcv_name ? recordBlock(d.dcv_type || 'TXT', d.dcv_name, d.dcv_value) : ''}
             </div>`}
        <div class="d-actions">
          ${active ? '' : `<button class="d-btn" onclick="checkDomain(this,${d.id})">Check status</button>`}
          <button class="d-btn danger" onclick="removeDomain(this,${d.id})">Remove</button>
        </div>
      </div>`;
}

/**
 * Render a custom-domain panel for one project.
 * @param {object} opts - { projectId, domains[], subdomain, saasOn, sitesBase }
 */
export function renderDomainsPanel({ projectId, domains = [], subdomain = '', saasOn = true, sitesBase = 'caddisfly.app' }) {
  const list = domains.length
    ? domains.map((d) => domainRowHtml(d, sitesBase)).join('')
    : '<p class="d-empty">No custom domain connected yet.</p>';
  const note = !saasOn ? `<p class="d-note">Custom domains aren't enabled in this environment yet — the form is here for setup.</p>` : '';
  const form = subdomain
    ? `<form class="d-form" onsubmit="addDomain(event)">
         <input type="text" class="d-input" placeholder="www.yourbusiness.com" autocomplete="off">
         <button class="d-btn primary" type="submit">Connect domain</button>
         <div class="d-err"></div>
       </form>`
    : `<p class="d-empty">Publish your site first — then you can point a domain at it.</p>`;
  return `<div class="domains-panel" data-project="${esc(projectId)}">${note}<div class="domains-list">${list}</div>${form}</div>`;
}

/** Styles for the domains panel (include once per page). */
export const DOMAINS_CSS = `
    .d-row { border: 1px solid #e2e8f0; border-radius: 10px; padding: .8rem; margin-bottom: .7rem; }
    .d-host { font-size: .95rem; color: #1a202c; display: flex; align-items: center; gap: .5rem; }
    .d-badge { font-size: .7rem; font-weight: 800; padding: .12rem .5rem; border-radius: 999px; }
    .d-badge.ok { background: #def7ec; color: #03543f; }
    .d-badge.pending { background: #fef3c7; color: #92400e; }
    .d-dns { margin: .6rem 0; font-size: .82rem; color: #4a5568; }
    .d-dns p { margin-bottom: .5rem; }
    .d-record { border: 1px solid #e2e8f0; border-radius: 8px; padding: .5rem .6rem; margin-bottom: .55rem; background: #fbfcfe; }
    .d-field { display: flex; align-items: center; gap: .5rem; padding: .22rem 0; flex-wrap: wrap; }
    .d-field + .d-field { border-top: 1px dashed #edf1f7; }
    .d-flabel { font-weight: 800; color: #94a3b8; min-width: 46px; font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; }
    .d-type { font-weight: 700; color: #1a202c; font-size: .82rem; }
    .d-code { flex: 1; min-width: 120px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: .25rem .45rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .76rem; color: #1a202c; }
    .d-code.wrap { word-break: break-all; }
    .d-copy { flex: 0 0 auto; font: inherit; font-size: .72rem; font-weight: 700; padding: .22rem .55rem; border-radius: 6px; border: 1px solid #cbd5e0; background: #fff; color: #4a5568; cursor: pointer; }
    .d-copy:hover { border-color: #667eea; color: #667eea; }
    .d-copy.copied { background: #def7ec; border-color: #84e1bc; color: #03543f; }
    .d-live { font-size: .85rem; margin: .5rem 0; }
    .d-live a { color: #667eea; font-weight: 600; }
    .d-actions { display: flex; gap: .4rem; margin-top: .5rem; }
    .d-btn { font: inherit; font-size: .8rem; font-weight: 700; padding: .35rem .7rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; }
    .d-btn.primary { background: #667eea; color: #fff; border-color: #667eea; }
    .d-btn.danger { color: #c53030; border-color: #fed7d7; }
    .d-empty, .d-note { font-size: .85rem; color: #718096; margin: .3rem 0; }
    .d-form { display: flex; gap: .5rem; margin-top: .8rem; flex-wrap: wrap; }
    .d-input { flex: 1; min-width: 180px; padding: .5rem .7rem; border: 1px solid #e2e8f0; border-radius: 8px; font: inherit; font-size: .9rem; }
    .d-err { color: #c53030; font-size: .8rem; width: 100%; }
`;

/** Client JS for the domains panel (include once per page). Project-scoped. */
export const DOMAINS_JS = `
    (function(){
      var SITES_BASE = 'caddisfly.app';
      function dEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
      function dPanel(el){ return el.closest('.domains-panel'); }
      function dRecord(type, name, value){
        return '<div class="d-record">'
          + '<div class="d-field"><span class="d-flabel">Type</span><span class="d-type">'+dEsc(type)+'</span></div>'
          + '<div class="d-field"><span class="d-flabel">Name</span><code class="d-code">'+dEsc(name)+'</code><button type="button" class="d-copy" onclick="dCopy(this)">Copy</button></div>'
          + '<div class="d-field"><span class="d-flabel">Value</span><code class="d-code wrap">'+dEsc(value)+'</code><button type="button" class="d-copy" onclick="dCopy(this)">Copy</button></div>'
          + '</div>';
      }
      window.dCopy = function(btn){
        var field = btn.closest('.d-field');
        var code = field && field.querySelector('.d-code');
        var text = code ? code.textContent : '';
        function ok(){ var t = btn.textContent; btn.textContent='Copied!'; btn.classList.add('copied'); setTimeout(function(){ btn.textContent=t; btn.classList.remove('copied'); }, 1400); }
        if (navigator.clipboard) { navigator.clipboard.writeText(text).then(ok).catch(function(){}); }
        else { try{ var r=document.createRange(); r.selectNode(code); var s=getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); s.removeAllRanges(); ok(); }catch(_){ } }
      };
      window.buildDomainRow = function(d){
        var active = d.status === 'active';
        var dns = active
          ? '<div class="d-live">Live at <a href="https://'+dEsc(d.hostname)+'" target="_blank" rel="noopener">https://'+dEsc(d.hostname)+'</a></div>'
          : '<div class="d-dns"><p>Add '+(d.dcv_name?'these two DNS records':'this DNS record')+' at your domain registrar, then click <em>Check status</em>:</p>'
            + dRecord('CNAME', d.hostname, d.cname_target||SITES_BASE)
            + (d.dcv_name ? dRecord(d.dcv_type||'TXT', d.dcv_name, d.dcv_value) : '')
            + '</div>';
        var actions = '<div class="d-actions">'
          + (active ? '' : '<button class="d-btn" onclick="checkDomain(this,'+d.id+')">Check status</button>')
          + '<button class="d-btn danger" onclick="removeDomain(this,'+d.id+')">Remove</button></div>';
        return '<div class="d-row" data-id="'+d.id+'"><div class="d-host"><strong>'+dEsc(d.hostname)+'</strong> <span class="d-badge '+(active?'ok':'pending')+'">'+(active?'Active':'Pending')+'</span></div>'+dns+actions+'</div>';
      };
      window.addDomain = async function(e){
        e.preventDefault();
        var form = e.target, panel = dPanel(form), projectId = panel.dataset.project;
        var input = form.querySelector('.d-input'), err = form.querySelector('.d-err');
        err.textContent=''; var hostname=(input.value||'').trim(); if(!hostname) return;
        var btn = form.querySelector('button[type=submit]'); btn.disabled=true;
        try{
          var res = await fetch('/api/ai-builder/'+encodeURIComponent(projectId)+'/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hostname:hostname})});
          var data = await res.json();
          if(data.success && data.domain){
            var list = panel.querySelector('.domains-list');
            var empty = list.querySelector('.d-empty'); if(empty) empty.remove();
            list.insertAdjacentHTML('beforeend', window.buildDomainRow(data.domain));
            input.value='';
          } else { err.textContent = data.error || 'Could not connect that domain.'; }
        }catch(_){ err.textContent='Network error. Please try again.'; }
        finally{ btn.disabled=false; }
      };
      window.checkDomain = async function(btnEl, id){
        var panel = dPanel(btnEl), projectId = panel.dataset.project;
        try{
          var res = await fetch('/api/ai-builder/'+encodeURIComponent(projectId)+'/domains/'+id+'/status');
          var data = await res.json();
          if(data.success && data.domain){
            var row = panel.querySelector('.d-row[data-id="'+id+'"]');
            if(row) row.outerHTML = window.buildDomainRow(data.domain);
            if(data.domain.status !== 'active') alert('Still pending — DNS and SSL can take a few minutes to validate after you add the records. Check again shortly.');
          } else { alert('Could not check status right now.'); }
        }catch(_){ alert('Could not check status right now.'); }
      };
      window.removeDomain = async function(btnEl, id){
        if(!confirm('Disconnect this domain from your site?')) return;
        var panel = dPanel(btnEl), projectId = panel.dataset.project;
        try{
          var res = await fetch('/api/ai-builder/'+encodeURIComponent(projectId)+'/domains/'+id,{method:'DELETE'});
          var data = await res.json();
          if(data.success){
            var row = panel.querySelector('.d-row[data-id="'+id+'"]'); if(row) row.remove();
            var list = panel.querySelector('.domains-list'); if(list && !list.querySelector('.d-row')) list.innerHTML='<p class="d-empty">No custom domain connected yet.</p>';
          } else alert(data.error || 'Could not remove the domain.');
        }catch(_){ alert('Network error. Please try again.'); }
      };
    })();
`;
