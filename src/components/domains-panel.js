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

/** Server render of one domain row (mirrors the client buildDomainRow). */
function domainRowHtml(d, sitesBase) {
  const active = d.status === 'active';
  return `
      <div class="d-row" data-id="${d.id}">
        <div class="d-host"><strong>${esc(d.hostname)}</strong> <span class="d-badge ${active ? 'ok' : 'pending'}">${active ? 'Active' : 'Pending'}</span></div>
        ${active
          ? `<div class="d-live">Live at <a href="https://${esc(d.hostname)}" target="_blank" rel="noopener">https://${esc(d.hostname)}</a></div>`
          : `<div class="d-dns"><p>Add these DNS records at your domain registrar, then click <em>Check status</em>:</p>
               <div class="d-rec"><span>CNAME</span><code>${esc(d.hostname)}</code><code>${esc(d.cname_target || sitesBase)}</code></div>
               ${d.dcv_name ? `<div class="d-rec"><span>${esc(d.dcv_type || 'TXT')}</span><code>${esc(d.dcv_name)}</code><code class="wrap">${esc(d.dcv_value)}</code></div>` : ''}
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
    .d-dns p { margin-bottom: .4rem; }
    .d-rec { display: flex; gap: .4rem; align-items: center; margin-bottom: .3rem; flex-wrap: wrap; }
    .d-rec > span { font-weight: 800; color: #718096; min-width: 48px; font-size: .72rem; }
    .d-rec code { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: .15rem .4rem; font-size: .78rem; }
    .d-rec code.wrap { word-break: break-all; }
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
      window.buildDomainRow = function(d){
        var active = d.status === 'active';
        var dns = active
          ? '<div class="d-live">Live at <a href="https://'+dEsc(d.hostname)+'" target="_blank" rel="noopener">https://'+dEsc(d.hostname)+'</a></div>'
          : '<div class="d-dns"><p>Add these DNS records at your domain registrar, then click <em>Check status</em>:</p>'
            + '<div class="d-rec"><span>CNAME</span><code>'+dEsc(d.hostname)+'</code><code>'+dEsc(d.cname_target||SITES_BASE)+'</code></div>'
            + (d.dcv_name ? '<div class="d-rec"><span>'+dEsc(d.dcv_type||'TXT')+'</span><code>'+dEsc(d.dcv_name)+'</code><code class="wrap">'+dEsc(d.dcv_value)+'</code></div>' : '')
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
