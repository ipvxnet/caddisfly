// Reusable "Link to" picker — a searchable combobox so users set button/link
// destinations WITHOUT knowing anchor syntax (#contact etc.). Suggests the
// site's pages, sections, and phone/email actions as you type; also accepts a
// pasted web address. The stored value stays a semantic anchor (#slug / #type)
// so the assembler's anchor→route resolution keeps it correct single/multi-page.
//
// Data source (injected once by the section editor): window.linkPickerData =
//   { pages:[{label,anchor}], sections:[{label,anchor}], phone, email }
//
// Usage:
//   linkPickerAssets(tr)            → <style>+<script>, include ONCE per modal
//   renderLinkField({name,value,…}) → one widget's HTML (repeatable)

import { translator } from '../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

/**
 * One link-picker widget.
 * @param {object} o
 * @param {string} [o.name] - form field name for the value (omit inside a repeater)
 * @param {string} [o.value] - current href
 * @param {boolean} [o.newTab] - current open-in-new-tab state
 * @param {boolean} [o.showNewTab=true] - render the new-tab checkbox
 * @param {string} [o.placeholder]
 */
export function renderLinkField(o = {}) {
  const { name = '', value = '', newTab = false, showNewTab = true, placeholder = '' } = o;
  const nameAttr = name ? ` name="${esc(name)}"` : '';
  const cbName = name ? ` name="${esc(name)}_new_tab"` : '';
  return `
<div class="lp" data-lp>
  <div class="lp-box">
    <input type="text" class="lp-search" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false">
    <button type="button" class="lp-clear" title="Clear" tabindex="-1">&times;</button>
    <input type="hidden" class="lp-value"${nameAttr} value="${esc(value)}">
    <div class="lp-menu" hidden></div>
  </div>
  <div class="lp-warn" hidden></div>
  ${showNewTab ? `<label class="lp-newtab"><input type="checkbox" class="lp-newtab-cb"${cbName}${newTab ? ' checked' : ''}> <span class="lp-newtab-txt"></span></label>` : ''}
</div>`;
}

/**
 * Shared CSS + JS for ALL link pickers in a modal. Include once. `tr` localizes
 * the static strings; dynamic destination labels come from window.linkPickerData.
 */
export function linkPickerAssets(lang = 'en') {
  const tr = translator(lang);
  const T = {
    search_ph: tr('lp.search_ph'),
    new_tab: tr('lp.new_tab'),
    g_pages: tr('lp.g_pages'),
    g_sections: tr('lp.g_sections'),
    g_actions: tr('lp.g_actions'),
    g_web: tr('lp.g_web'),
    use_web: tr('lp.use_web'),
    top: tr('lp.top'),
    call: tr('lp.call'),
    email: tr('lp.email'),
    none: tr('lp.none'),
    missing: tr('lp.missing'),
  };
  return `
<style>
  .lp { position: relative; }
  .lp-box { position: relative; display: flex; align-items: center; }
  .lp-search { width: 100%; padding: 0.6rem 2rem 0.6rem 0.7rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; }
  .lp-search:focus { outline: none; border-color: #7c3aed; }
  .lp-clear { position: absolute; right: 6px; border: none; background: none; font-size: 1.1rem; color: #a0aec0; cursor: pointer; line-height: 1; padding: 2px 6px; display: none; }
  .lp-clear.show { display: block; }
  .lp-menu { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.14); max-height: 280px; overflow-y: auto; z-index: 50; padding: 4px; }
  .lp-group { font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #a0aec0; padding: 8px 10px 4px; }
  .lp-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 7px; cursor: pointer; font-size: .88rem; color: #2d3748; }
  .lp-item:hover, .lp-item.active { background: #f3f0ff; }
  .lp-item .lp-ic { width: 18px; text-align: center; flex: none; }
  .lp-item .lp-sub { color: #a0aec0; font-size: .76rem; margin-left: auto; font-family: monospace; }
  .lp-warn { font-size: .78rem; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 7px; padding: 5px 9px; margin-top: 6px; }
  .lp-newtab { display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; color: #4a5568; margin-top: 7px; cursor: pointer; }
</style>
<script>
(function(){
  // Define-once, but ALWAYS init the pickers in the freshly injected modal:
  // the old early-return swallowed the trailing initLinkPickers() call on
  // every modal after the first, leaving DEAD pickers — blank search box and
  // typed URLs never committed to the hidden field ("the link is empty again").
  if (window.__lpInit) { window.initLinkPickers(); return; }
  window.__lpInit = true;
  var T = ${JSON.stringify(T)};
  function data(){ return window.linkPickerData || { pages: [], sections: [], phone: '', email: '' }; }
  function knownAnchors(){
    var d = data(), set = {};
    (d.pages||[]).forEach(function(p){ set[p.anchor] = p.label; });
    (d.sections||[]).forEach(function(s){ set[s.anchor] = s.label; });
    set['#top'] = T.top;
    return set;
  }
  function strip(s){ return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,''); }
  // Build a normalized-alias -> canonical #anchor map from the picker data:
  // both the english anchor key (#contact -> contact) AND the localized label
  // (Contato -> #contact) so stored links like "#Contato" resolve correctly.
  function aliasMap(){
    var d = data(), m = {};
    (d.sections||[]).forEach(function(s){ m[strip(s.anchor.slice(1))] = s.anchor; m[strip(s.label)] = s.anchor; });
    (d.pages||[]).forEach(function(p){ m[strip(p.anchor.slice(1))] = p.anchor; m[strip(p.label)] = p.anchor; });
    return m;
  }
  // Map a localized/mis-cased #anchor back to its canonical form; pass through
  // #top, external and unknown links unchanged.
  function canon(href){
    if (!href || href.charAt(0) !== '#' || href === '#top') return href;
    return aliasMap()[strip(href.slice(1))] || href;
  }
  // Resolve a stored href to a friendly label for the search box.
  function labelFor(href){
    if (!href) return '';
    var k = knownAnchors(), c = canon(href);
    if (k[c]) return k[c];
    if (href.indexOf('tel:') === 0) return T.call + ' ' + href.slice(4);
    if (href.indexOf('mailto:') === 0) return T.email + ' ' + href.slice(7);
    return href; // external / custom — show as typed
  }
  function looksLikeUrl(q){
    return /^(https?:\\/\\/|\\/|#|tel:|mailto:)/i.test(q) || /^[\\w-]+\\.[a-z]{2,}/i.test(q);
  }
  function normalizeUrl(q){
    if (/^[\\w-]+\\.[a-z]{2,}/i.test(q) && !/^https?:\\/\\//i.test(q) && q.indexOf('/') !== 0) return 'https://' + q;
    return q;
  }
  function suggestions(query){
    var d = data(), q = (query||'').trim().toLowerCase(), groups = [];
    function filt(items){ return q ? items.filter(function(it){ return (it.label+' '+it.href).toLowerCase().indexOf(q) >= 0; }) : items; }
    var pages = filt((d.pages||[]).map(function(p){ return { ic:'📄', label:p.label, href:p.anchor, sub:p.anchor }; }));
    if (pages.length) groups.push({ name: T.g_pages, items: pages });
    var secs = filt((d.sections||[]).map(function(s){ return { ic:'🔗', label:s.label, href:s.anchor, sub:s.anchor }; }));
    if (secs.length) groups.push({ name: T.g_sections, items: secs });
    var actions = [];
    if (d.phone) actions.push({ ic:'📞', label: T.call + ' ' + d.phone, href: 'tel:' + String(d.phone).replace(/[^\\d+]/g,''), sub:'tel:' });
    if (d.email) actions.push({ ic:'✉', label: T.email + ' ' + d.email, href: 'mailto:' + d.email, sub:'mailto:' });
    actions.push({ ic:'⬆', label: T.top, href: '#top', sub:'#top' });
    actions = filt(actions);
    if (actions.length) groups.push({ name: T.g_actions, items: actions });
    if (query && looksLikeUrl(query)) {
      groups.push({ name: T.g_web, items: [{ ic:'🌐', label: T.use_web + ' "' + query + '"', href: normalizeUrl(query), sub:'' }] });
    }
    return groups;
  }
  function checkWarn(lp){
    var v = lp.querySelector('.lp-value').value || '';
    var warn = lp.querySelector('.lp-warn');
    if (v && v.charAt(0) === '#' && v !== '#top' && !knownAnchors()[canon(v)]) {
      warn.textContent = '⚠ ' + T.missing.replace('{a}', v); warn.hidden = false;
    } else { warn.hidden = true; }
  }
  function setValue(lp, href){
    lp.querySelector('.lp-value').value = href || '';
    lp.querySelector('.lp-search').value = labelFor(href);
    lp.querySelector('.lp-clear').classList.toggle('show', !!href);
    checkWarn(lp);
    lp.dispatchEvent(new CustomEvent('lp-change', { bubbles: true }));
  }
  function renderMenu(lp, query){
    var menu = lp.querySelector('.lp-menu');
    var groups = suggestions(query);
    if (!groups.length) { menu.hidden = true; return; }
    menu.innerHTML = groups.map(function(g){
      return '<div class="lp-group">' + g.name + '</div>' + g.items.map(function(it){
        return '<div class="lp-item" data-href="' + it.href.replace(/"/g,'&quot;') + '"><span class="lp-ic">' + it.ic + '</span><span>' + it.label.replace(/</g,'&lt;') + '</span>' + (it.sub ? '<span class="lp-sub">' + it.sub + '</span>' : '') + '</div>';
      }).join('');
    }).join('');
    menu.hidden = false;
    menu.querySelectorAll('.lp-item').forEach(function(el){
      el.addEventListener('mousedown', function(e){ e.preventDefault(); setValue(lp, el.getAttribute('data-href')); menu.hidden = true; });
    });
  }
  function initLp(lp){
    if (lp.__lpReady) return; lp.__lpReady = true;
    var search = lp.querySelector('.lp-search');
    var clear = lp.querySelector('.lp-clear');
    var cbTxt = lp.querySelector('.lp-newtab-txt');
    search.placeholder = T.search_ph;
    if (cbTxt) cbTxt.textContent = T.new_tab;
    setValue(lp, lp.querySelector('.lp-value').value); // resolve existing value → label
    search.addEventListener('focus', function(){ renderMenu(lp, ''); });
    search.addEventListener('input', function(){
      clear.classList.toggle('show', !!search.value);
      // If the typed text is itself a URL/anchor, treat it as the value live.
      if (looksLikeUrl(search.value)) lp.querySelector('.lp-value').value = normalizeUrl(search.value.trim());
      renderMenu(lp, search.value);
    });
    search.addEventListener('blur', function(){
      setTimeout(function(){ lp.querySelector('.lp-menu').hidden = true; }, 150);
      // Commit a typed URL even if no suggestion was clicked.
      if (looksLikeUrl(search.value)) { setValue(lp, normalizeUrl(search.value.trim())); }
      else if (!search.value) { setValue(lp, ''); }
      else { search.value = labelFor(lp.querySelector('.lp-value').value); } // revert stray text
    });
    clear.addEventListener('click', function(){ setValue(lp, ''); search.focus(); });
    var cb = lp.querySelector('.lp-newtab-cb');
    if (cb) cb.addEventListener('change', function(){ lp.dispatchEvent(new CustomEvent('lp-change', { bubbles: true })); });
  }
  window.initLinkPickers = function(root){ (root || document).querySelectorAll('.lp[data-lp]').forEach(initLp); };
  // Init now (modal scripts run after injection) and expose for dynamically added rows.
  window.initLinkPickers();
})();
</script>`;
}
