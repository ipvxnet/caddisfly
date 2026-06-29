// Shared "Insert from Drive" picker — used by the section editor, the Design
// panel (logo/favicon), and the store manager. File-type aware
// (image/pdf/video/media/doc/all) and supports a browse-only "explorer" mode so
// a manager can open the owner's shared files (txt/xlsx/pdf) while building.
// Owner-scoped for managers via GET /api/ai-builder/:id/drive/files.
//
// Exposes (idempotent — safe to include on a page more than once):
//   window.__drivePicker(cb, opts)   opts = { kind='image', mode='pick'|'explore' }
//       cb(url, file) fires when the user picks a file (pick mode). Images render
//       as a thumbnail grid; other kinds as a list with Open + Use.
//   window.__driveExplorer(opts)     browse-only (defaults to kind 'all').
//   window.__drivePicker(...).__shared marks the shared impl so it isn't redefined.
// Reads the project id from window.currentProjectId.

import { translator } from '../i18n/index.js';

export function drivePickerAssets(lang = 'en') {
  const tr = translator(lang);
  const T = {
    title: tr('sed.drive_title'), explore_title: tr('drivex.title'),
    loading: tr('sed.drive_loading'), empty: tr('sed.drive_empty'), err: tr('sed.drive_err'),
    site: tr('sed.drive_site'), mine: tr('sed.drive_mine'),
    shared_hint: tr('sed.drive_shared_hint'), shared_empty: tr('sed.drive_shared_empty'),
    folder_empty: tr('sed.drive_folder_empty'), all_folders: tr('sed.drive_all_folders'),
    open: tr('drivex.open'), use: tr('drivex.use'), no_files: tr('drivex.no_files'),
  };
  return `
<script>
(function(){
  if (window.__drivePicker && window.__drivePicker.__shared) return;
  var T = ${JSON.stringify(T)};
  var overlay = null, cb = null, st = { kind: 'image', mode: 'pick', source: 'owner', folder: null };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]; }); }
  function fmtSize(n){ n = Number(n) || 0; if (n < 1024) return n + ' B'; if (n < 1048576) return (n/1024).toFixed(0) + ' KB'; return (n/1048576).toFixed(1) + ' MB'; }
  function isImg(ct){ return String(ct || '').indexOf('image/') === 0; }
  function iconFor(ct){ ct = String(ct || ''); if (ct.indexOf('pdf') >= 0) return '📕'; if (ct.indexOf('video') >= 0) return '🎬'; if (ct.indexOf('sheet') >= 0 || ct.indexOf('excel') >= 0 || ct.indexOf('csv') >= 0) return '📊'; if (ct.indexOf('word') >= 0 || ct.indexOf('msword') >= 0) return '📝'; if (ct.indexOf('text/') === 0) return '📄'; if (isImg(ct)) return '🖼'; return '📎'; }
  function ensure(){
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;z-index:10060;padding:1rem';
    overlay.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:680px;width:100%;max-height:82vh;overflow:auto;padding:1.2rem"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem"><strong class="dpk-title"></strong><button type="button" class="dpk-x" style="border:none;background:none;font-size:1.2rem;cursor:pointer">✕</button></div><div class="dpk-toggle" style="display:none;gap:.4rem;margin-bottom:.5rem"></div><div class="dpk-hint" style="display:none;font-size:.8rem;color:#718096;margin-bottom:.5rem"></div><div class="dpk-nav" style="display:none;margin-bottom:.6rem"></div><div class="dpk-body"></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.style.display = 'none'; });
    overlay.querySelector('.dpk-x').addEventListener('click', function(){ overlay.style.display = 'none'; });
    return overlay;
  }
  function tgl(label, active, on){ var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'border:1px solid ' + (active ? '#7c3aed' : '#cbd5e0') + ';background:' + (active ? '#7c3aed' : '#fff') + ';color:' + (active ? '#fff' : '#4a5568') + ';border-radius:8px;padding:.3rem .75rem;font-size:.82rem;font-weight:600;cursor:pointer'; b.addEventListener('click', on); return b; }
  function pick(f){ overlay.style.display = 'none'; if (cb) cb(f.url, f); }
  function renderNav(d){
    var nav = overlay.querySelector('.dpk-nav'); var crumbs = (d && d.breadcrumb) || [], subs = (d && d.subfolders) || [];
    if (!crumbs.length && !subs.length) { nav.style.display = 'none'; nav.innerHTML = ''; return; }
    var bc = ['<a href="#" data-f="" class="dpk-cr" style="color:#7c3aed;text-decoration:none;font-weight:600">' + esc(T.all_folders) + '</a>'];
    crumbs.forEach(function(c){ bc.push('<a href="#" data-f="' + c.id + '" class="dpk-cr" style="color:#7c3aed;text-decoration:none;font-weight:600">' + esc(c.name) + '</a>'); });
    var html = '<div style="font-size:.85rem;margin-bottom:.4rem">' + bc.join(' <span style="color:#cbd5e0">/</span> ') + '</div>';
    if (subs.length) html += '<div style="display:flex;flex-wrap:wrap;gap:.4rem">' + subs.map(function(s){ return '<button type="button" data-f="' + s.id + '" style="border:1px solid #cbd5e0;background:#f8fafc;border-radius:8px;padding:.3rem .65rem;font-size:.82rem;font-weight:600;color:#334155;cursor:pointer">📁 ' + esc(s.name) + '</button>'; }).join('') + '</div>';
    nav.innerHTML = html; nav.style.display = 'block';
    nav.querySelectorAll('[data-f]').forEach(function(el){ el.addEventListener('click', function(ev){ ev.preventDefault(); var f = el.getAttribute('data-f'); st.folder = f ? Number(f) : null; load(); }); });
  }
  function renderImages(body, files){
    body.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem';
    body.innerHTML = '';
    files.forEach(function(im){
      var b = document.createElement('button'); b.type = 'button'; b.title = im.name;
      b.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:0;cursor:pointer;background:#fff;overflow:hidden;aspect-ratio:1';
      var img = document.createElement('img'); img.src = im.url; img.loading = 'lazy'; img.style.cssText = 'width:100%;height:100%;object-fit:cover'; b.appendChild(img);
      b.addEventListener('click', function(){ if (st.mode === 'explore') window.open(im.url, '_blank', 'noopener'); else pick(im); });
      body.appendChild(b);
    });
  }
  function renderList(body, files){
    body.style.cssText = 'display:flex;flex-direction:column;gap:.4rem';
    body.innerHTML = '';
    files.forEach(function(f){
      var row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:.6rem;border:1px solid #e2e8f0;border-radius:8px;padding:.5rem .6rem';
      var ic = document.createElement('span'); ic.textContent = iconFor(f.content_type); ic.style.cssText = 'font-size:1.2rem;flex:0 0 auto';
      var meta = document.createElement('div'); meta.style.cssText = 'flex:1;min-width:0';
      meta.innerHTML = '<div style="font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(f.name) + '</div><div style="font-size:.75rem;color:#94a3b8">' + fmtSize(f.size) + '</div>';
      var open = document.createElement('a'); open.href = f.url; open.target = '_blank'; open.rel = 'noopener'; open.textContent = T.open; open.style.cssText = 'font-size:.8rem;font-weight:600;color:#7c3aed;text-decoration:none;flex:0 0 auto';
      row.appendChild(ic); row.appendChild(meta); row.appendChild(open);
      if (st.mode !== 'explore' && cb) {
        var use = document.createElement('button'); use.type = 'button'; use.textContent = T.use;
        use.style.cssText = 'border:1px solid #7c3aed;background:#7c3aed;color:#fff;border-radius:8px;padding:.3rem .7rem;font-size:.8rem;font-weight:600;cursor:pointer;flex:0 0 auto';
        use.addEventListener('click', function(){ pick(f); }); row.appendChild(use);
      }
      body.appendChild(row);
    });
  }
  async function load(){
    var o = ensure(); var body = o.querySelector('.dpk-body'); var tog = o.querySelector('.dpk-toggle'); var hint = o.querySelector('.dpk-hint');
    o.querySelector('.dpk-title').textContent = (st.mode === 'explore') ? T.explore_title : T.title;
    body.style.cssText = ''; body.innerHTML = '<p style="color:#718096">' + T.loading + '</p>';
    var pid = window.currentProjectId;
    try {
      var qs = '?kind=' + st.kind + '&source=' + st.source + (st.folder != null ? '&folder=' + st.folder : '');
      var res = await fetch('/api/ai-builder/' + pid + '/drive/files' + qs);
      var d = await res.json(); var files = (d && d.files) || (d && d.images) || [];
      if (d && d.can_switch) {
        var cur = (d && d.source) || 'owner';
        tog.style.display = 'flex'; tog.innerHTML = '';
        tog.appendChild(tgl(T.site, cur === 'owner', function(){ st.source = 'owner'; st.folder = null; load(); }));
        tog.appendChild(tgl(T.mine, cur === 'mine', function(){ st.source = 'mine'; st.folder = null; load(); }));
      } else { tog.style.display = 'none'; }
      if (hint) { if (d && d.scoped && st.folder == null) { hint.textContent = T.shared_hint; hint.style.display = 'block'; } else { hint.style.display = 'none'; } }
      renderNav(d);
      if (!files.length) { body.style.cssText = ''; body.innerHTML = '<p style="color:#718096">' + (st.folder != null ? T.folder_empty : (d && d.scoped ? T.shared_empty : (st.kind === 'image' ? T.empty : T.no_files))) + '</p>'; return; }
      if (st.kind === 'image') renderImages(body, files); else renderList(body, files);
    } catch (e) { body.style.cssText = ''; body.innerHTML = '<p style="color:#b91c1c">' + T.err + '</p>'; }
  }
  window.__drivePicker = function(callback, opts){ opts = opts || {}; cb = callback || null; st = { kind: opts.kind || 'image', mode: opts.mode || (callback ? 'pick' : 'explore'), source: 'owner', folder: null }; ensure().style.display = 'flex'; load(); };
  window.__drivePicker.__shared = 1;
  window.__driveExplorer = function(opts){ opts = opts || {}; window.__drivePicker(null, { kind: opts.kind || 'all', mode: 'explore' }); };
})();
</script>`;
}
