// Shared custom-domain manager — used by the customize page AND the customer
// dashboard. Project-scoped: each panel carries data-project, and the JS reads
// it via closest('.domains-panel'), so any number of panels can coexist on one
// page (e.g. one per site in the dashboard).
//
// Adding a domain appends the new record row IN PLACE (no page reload) so the
// DNS records the customer must add stay visible — fixes the old "the box
// closed like nothing happened" glitch.

import { translator } from '../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// One DNS record shown as a labeled block: Type / Name / Value, each field
// clearly labeled with its own Copy button (so customers don't grab name+value
// as one string).
function recordBlock(type, name, value, tr) {
  return `
        <div class="d-record">
          <div class="d-field"><span class="d-flabel">${tr('dom.type')}</span><span class="d-type">${esc(type)}</span></div>
          <div class="d-field"><span class="d-flabel">${tr('dom.name')}</span><code class="d-code">${esc(name)}</code><button type="button" class="d-copy" onclick="dCopy(this)">${tr('dom.copy')}</button></div>
          <div class="d-field"><span class="d-flabel">${tr('dom.value')}</span><code class="d-code wrap">${esc(value)}</code><button type="button" class="d-copy" onclick="dCopy(this)">${tr('dom.copy')}</button></div>
        </div>`;
}

/** Server render of one domain row (mirrors the client buildDomainRow). */
function domainRowHtml(d, sitesBase, tr) {
  const active = d.status === 'active';
  return `
      <div class="d-row" data-id="${d.id}">
        <div class="d-host"><strong>${esc(d.hostname)}</strong> <span class="d-badge ${active ? 'ok' : 'pending'}">${active ? tr('dom.active') : tr('dom.pending')}</span></div>
        ${active
          ? `<div class="d-live">${tr('dom.live_at')} <a href="https://${esc(d.hostname)}" target="_blank" rel="noopener">https://${esc(d.hostname)}</a></div>`
          : `<div class="d-dns"><p>${tr('dom.add_record')}</p>
               ${recordBlock('CNAME', d.hostname, d.cname_target || sitesBase, tr)}
               ${d.dcv_name ? `<p>${tr('dom.and_verification')}</p>${recordBlock(d.dcv_type || 'TXT', d.dcv_name, d.dcv_value, tr)}` : ''}
               <p class="d-auto">${tr('dom.ssl_note')}</p>
             </div>`}
        <div class="d-actions">
          ${active ? '' : `<button class="d-btn" onclick="checkDomain(this,${d.id})">${tr('dom.check_status')}</button>`}
          <button class="d-btn danger" onclick="removeDomain(this,${d.id})">${tr('dom.remove')}</button>
        </div>
      </div>`;
}

/**
 * Render a custom-domain panel for one project.
 * @param {object} opts - { projectId, domains[], subdomain, saasOn, sitesBase, lang }
 */
export function renderDomainsPanel({ projectId, domains = [], subdomain = '', saasOn = true, sitesBase = 'caddisfly.app', lang = 'en' }) {
  const tr = translator(lang);
  const list = domains.length
    ? domains.map((d) => domainRowHtml(d, sitesBase, tr)).join('')
    : `<p class="d-empty">${tr('dom.none_yet')}</p>`;
  const note = !saasOn ? `<p class="d-note">${tr('dom.not_enabled')}</p>` : '';
  const form = subdomain
    ? `<form class="d-form" onsubmit="addDomain(event)">
         <input type="text" class="d-input" placeholder="www.yourbusiness.com" autocomplete="off">
         <button class="d-btn primary" type="submit">${tr('dom.connect')}</button>
         <div class="d-err"></div>
       </form>
       <p class="d-hint">${tr('dom.tip')}</p>`
    : `<p class="d-empty">${tr('dom.publish_first')}</p>`;
  const hub = `<p class="d-hub">${tr('dom.hub_link', { link: `<a href="/domains">${tr('dom.hub_link_a')}</a>` })}</p>`;
  return `<div class="domains-panel" data-project="${esc(projectId)}">${note}<div class="domains-list">${list}</div>${form}${hub}</div>`;
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
    .d-auto { font-size: .8rem; color: #03543f; background: #f0fdf9; border: 1px solid #c6f6e5; border-radius: 8px; padding: .5rem .7rem; margin-top: .6rem; }
    .d-hint { font-size: .78rem; color: #718096; margin: .55rem 0 0; line-height: 1.5; }
    .d-hint code { background: #f1f5f9; border-radius: 4px; padding: 0 .25rem; font-size: .92em; }
    .d-hub { font-size: .8rem; color: #718096; margin: .9rem 0 0; padding-top: .7rem; border-top: 1px solid #edf1f7; }
    .d-hub a { color: #667eea; font-weight: 700; text-decoration: none; }
    .d-hub a:hover { text-decoration: underline; }
    .d-form { display: flex; gap: .5rem; margin-top: .8rem; flex-wrap: wrap; }
    .d-input { flex: 1; min-width: 180px; padding: .5rem .7rem; border: 1px solid #e2e8f0; border-radius: 8px; font: inherit; font-size: .9rem; }
    .d-err { color: #c53030; font-size: .8rem; width: 100%; }
    .d-gate { width: 100%; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: .75rem .85rem; margin-top: .3rem; }
    .d-gate-msg { color: #6b21a8; font-size: .84rem; font-weight: 600; margin-bottom: .55rem; line-height: 1.45; }
    .d-gate-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
    .d-gate-actions a.d-btn { text-decoration: none; display: inline-block; }
    .d-gate-note { font-size: .77rem; color: #7c6f93; margin-top: .55rem; line-height: 1.5; }
`;

/** Client JS for the domains panel (include once per page). Project-scoped + localized. */
export function domainsJs(lang = 'en') {
  const tr = translator(lang);
  return `
    (function(){
      var SITES_BASE = 'caddisfly.app';
      function dEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
      function dPanel(el){ return el.closest('.domains-panel'); }
      function dRecord(type, name, value){
        return '<div class="d-record">'
          + '<div class="d-field"><span class="d-flabel">'+${JSON.stringify(tr('dom.type'))}+'</span><span class="d-type">'+dEsc(type)+'</span></div>'
          + '<div class="d-field"><span class="d-flabel">'+${JSON.stringify(tr('dom.name'))}+'</span><code class="d-code">'+dEsc(name)+'</code><button type="button" class="d-copy" onclick="dCopy(this)">'+${JSON.stringify(tr('dom.copy'))}+'</button></div>'
          + '<div class="d-field"><span class="d-flabel">'+${JSON.stringify(tr('dom.value'))}+'</span><code class="d-code wrap">'+dEsc(value)+'</code><button type="button" class="d-copy" onclick="dCopy(this)">'+${JSON.stringify(tr('dom.copy'))}+'</button></div>'
          + '</div>';
      }
      window.dCopy = function(btn){
        var field = btn.closest('.d-field');
        var code = field && field.querySelector('.d-code');
        var text = code ? code.textContent : '';
        function ok(){ var t = btn.textContent; btn.textContent=${JSON.stringify(tr('dom.copied'))}; btn.classList.add('copied'); setTimeout(function(){ btn.textContent=t; btn.classList.remove('copied'); }, 1400); }
        if (navigator.clipboard) { navigator.clipboard.writeText(text).then(ok).catch(function(){}); }
        else { try{ var r=document.createRange(); r.selectNode(code); var s=getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); s.removeAllRanges(); ok(); }catch(_){ } }
      };
      window.buildDomainRow = function(d){
        var active = d.status === 'active';
        var dns = active
          ? '<div class="d-live">'+${JSON.stringify(tr('dom.live_at'))}+' <a href="https://'+dEsc(d.hostname)+'" target="_blank" rel="noopener">https://'+dEsc(d.hostname)+'</a></div>'
          : '<div class="d-dns"><p>'+${JSON.stringify(tr('dom.add_record'))}+'</p>'
            + dRecord('CNAME', d.hostname, d.cname_target||SITES_BASE)
            + (d.dcv_name ? '<p>'+${JSON.stringify(tr('dom.and_verification'))}+'</p>'+dRecord(d.dcv_type||'TXT', d.dcv_name, d.dcv_value) : '')
            + '<p class="d-auto">'+${JSON.stringify(tr('dom.ssl_note'))}+'</p>'
            + '</div>';
        var actions = '<div class="d-actions">'
          + (active ? '' : '<button class="d-btn" onclick="checkDomain(this,'+d.id+')">'+${JSON.stringify(tr('dom.check_status'))}+'</button>')
          + '<button class="d-btn danger" onclick="removeDomain(this,'+d.id+')">'+${JSON.stringify(tr('dom.remove'))}+'</button></div>';
        return '<div class="d-row" data-id="'+d.id+'"><div class="d-host"><strong>'+dEsc(d.hostname)+'</strong> <span class="d-badge '+(active?'ok':'pending')+'">'+(active?${JSON.stringify(tr('dom.active'))}:${JSON.stringify(tr('dom.pending'))})+'</span></div>'+dns+actions+'</div>';
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
          } else if (data.billing_url || res.status === 402) {
            err.innerHTML = window.domainGateHtml(data.error, data.billing_url);
          } else { err.textContent = data.error || ${JSON.stringify(tr('dom.could_not_connect'))}; }
        }catch(_){ err.textContent=${JSON.stringify(tr('dom.network_err'))}; }
        finally{ btn.disabled=false; }
      };
      // Plan-gate / signed-out case: show what to do (upgrade + dashboard +
      // sign-in note) instead of a dead-end message.
      window.domainGateHtml = function(msg, billingUrl){
        var b = billingUrl || '/billing';
        return '<div class="d-gate">'
          + '<p class="d-gate-msg">'+dEsc(msg||${JSON.stringify(tr('dom.gate_default'))})+'</p>'
          + '<div class="d-gate-actions">'
          +   '<a class="d-btn primary" href="'+dEsc(b)+'" target="_blank" rel="noopener">'+${JSON.stringify(tr('dom.gate_upgrade'))}+'</a>'
          +   '<a class="d-btn" href="/dashboard" target="_blank" rel="noopener">'+${JSON.stringify(tr('dom.gate_dashboard'))}+'</a>'
          + '</div>'
          + '<p class="d-gate-note">'+${JSON.stringify(tr('dom.gate_note'))}+'</p>'
          + '</div>';
      };
      window.checkDomain = async function(btnEl, id){
        var panel = dPanel(btnEl), projectId = panel.dataset.project;
        try{
          var res = await fetch('/api/ai-builder/'+encodeURIComponent(projectId)+'/domains/'+id+'/status');
          var data = await res.json();
          if(data.success && data.domain){
            var row = panel.querySelector('.d-row[data-id="'+id+'"]');
            if(row) row.outerHTML = window.buildDomainRow(data.domain);
            if(data.domain.status !== 'active') alert(${JSON.stringify(tr('dom.still_pending'))});
          } else { alert(${JSON.stringify(tr('dom.could_not_check'))}); }
        }catch(_){ alert(${JSON.stringify(tr('dom.could_not_check'))}); }
      };
      window.removeDomain = async function(btnEl, id){
        if(!confirm(${JSON.stringify(tr('dom.disconnect_confirm'))})) return;
        var panel = dPanel(btnEl), projectId = panel.dataset.project;
        try{
          var res = await fetch('/api/ai-builder/'+encodeURIComponent(projectId)+'/domains/'+id,{method:'DELETE'});
          var data = await res.json();
          if(data.success){
            var row = panel.querySelector('.d-row[data-id="'+id+'"]'); if(row) row.remove();
            var list = panel.querySelector('.domains-list'); if(list && !list.querySelector('.d-row')) list.innerHTML='<p class="d-empty">'+${JSON.stringify(tr('dom.none_yet'))}+'</p>';
          } else alert(data.error || ${JSON.stringify(tr('dom.could_not_remove'))});
        }catch(_){ alert(${JSON.stringify(tr('dom.network_err'))}); }
      };
    })();
`;
}
