// Drive — account-level file storage with folders. Upload site assets to R2,
// organize into (nestable) folders, move/copy files between them, see usage vs
// the plan quota, copy public links. Owner-scoped via billingAuth. Every mutation
// is audit-logged. Files served from /drive/f/:token (unguessable). See db/drive.js.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import {
  getDriveUsage, listDriveFiles, addDriveFile, deleteDriveFile, getDriveFileByToken,
  getDriveFileById, moveDriveFile, listFolders, listAllFolders, getFolder, createFolder,
  renameFolder, folderHasContents, deleteFolder, listDriveImages,
} from '../../db/drive.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { DRIVE_LIMITS, DRIVE_MAX_FILE } from '../../utils/credits.js';
import { generateToken } from '../../utils/crypto.js';
import { audit } from '../../utils/audit.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

const TYPES = {
  jpg: { mime: 'image/jpeg', inline: true }, jpeg: { mime: 'image/jpeg', inline: true }, png: { mime: 'image/png', inline: true },
  gif: { mime: 'image/gif', inline: true }, webp: { mime: 'image/webp', inline: true }, avif: { mime: 'image/avif', inline: true },
  pdf: { mime: 'application/pdf', inline: true },
  mp4: { mime: 'video/mp4', inline: true }, webm: { mime: 'video/webm', inline: true }, mov: { mime: 'video/quicktime', inline: true },
  mp3: { mime: 'audio/mpeg', inline: true }, wav: { mime: 'audio/wav', inline: true }, ogg: { mime: 'audio/ogg', inline: true },
  woff: { mime: 'font/woff', inline: true }, woff2: { mime: 'font/woff2', inline: true }, ttf: { mime: 'font/ttf', inline: true }, otf: { mime: 'font/otf', inline: true },
  doc: { mime: 'application/msword', inline: false }, docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', inline: false },
  xls: { mime: 'application/vnd.ms-excel', inline: false }, xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', inline: false },
  ppt: { mime: 'application/vnd.ms-powerpoint', inline: false }, pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', inline: false },
  txt: { mime: 'text/plain', inline: false }, csv: { mime: 'text/csv', inline: false }, zip: { mime: 'application/zip', inline: false },
};
const extOf = (name) => { const m = /\.([a-z0-9]+)$/i.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; };

function fmtBytes(n) {
  if (!n || n < 1024) return (n || 0) + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let v = n, i = -1;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ' + u[i];
}

const DRV = {
  en: {
    meta_title: 'Drive — Caddisfly', title: 'Drive', back: '← Dashboard',
    sub: 'Upload images, PDFs and files to use across your sites. Stored in your own space — no need to share via Google Drive.',
    usage: '{used} of {total} used', upload_btn: 'Upload files', upload_folder: '📁 Upload folder', uploading: 'Uploading…', drop_hint: 'Drag files or a folder here, or click to choose',
    empty: 'This folder is empty — upload a file or create a folder.', th_file: 'File', th_size: 'Size', th_added: 'Added',
    copy_link: 'Copy link', copied: 'Copied ✓', del: 'Delete', del_confirm: 'Delete this file? Links to it will stop working.',
    err: 'Something went wrong.', err_size: 'File too large — the limit is 50 MB.', err_type: "That file type isn't allowed.", err_quota: 'Not enough space. Delete some files or upgrade your plan.',
    new_folder: 'New folder', folder_name_prompt: 'Folder name:', rename: 'Rename', rename_prompt: 'New name:',
    move: 'Move', copy: 'Copy', move_title: 'Move "{name}" to:', copy_title: 'Copy "{name}" to:', root_label: 'Drive (root)',
    confirm: 'Confirm', cancel: 'Cancel', folder_del_confirm: 'Delete this folder?', folder_not_empty: "The folder isn't empty — move or delete its contents first.",
  },
  es: {
    meta_title: 'Drive — Caddisfly', title: 'Drive', back: '← Dashboard',
    sub: 'Sube imágenes, PDF y archivos para usarlos en tus sitios. Almacenados en tu propio espacio — no es necesario compartirlos a través de Google Drive.',
    usage: '{used} de {total} utilizado', upload_btn: 'Subir archivos', upload_folder: '📁 Subir carpeta', uploading: 'Subiendo…', drop_hint: 'Arrastra archivos o una carpeta aquí, o haz clic para elegir',
    empty: 'Esta carpeta está vacía — sube un archivo o crea una carpeta.', th_file: 'Archivo', th_size: 'Tamaño', th_added: 'Añadido',
    copy_link: 'Copiar enlace', copied: 'Copiado ✓', del: 'Eliminar', del_confirm: '¿Eliminar este archivo? Los enlaces a él dejarán de funcionar.',
    err: 'Algo salió mal.', err_size: 'Archivo demasiado grande — el límite es 50 MB.', err_type: 'Ese tipo de archivo no está permitido.', err_quota: 'No hay suficiente espacio. Elimina algunos archivos o actualiza tu plan.',
    new_folder: 'Nueva carpeta', folder_name_prompt: 'Nombre de la carpeta:', rename: 'Renombrar', rename_prompt: 'Nuevo nombre:',
    move: 'Mover', copy: 'Copiar', move_title: 'Mover "{name}" a:', copy_title: 'Copiar "{name}" a:', root_label: 'Drive (raíz)',
    confirm: 'Confirmar', cancel: 'Cancelar', folder_del_confirm: '¿Eliminar esta carpeta?', folder_not_empty: 'La carpeta no está vacía — mueve o elimina su contenido primero.',
  },
  pt: {
    meta_title: 'Drive — Caddisfly', title: 'Drive', back: '← Dashboard',
    sub: 'Faça o upload de imagens, PDFs e arquivos para usar em seus sites. Armazenados no seu próprio espaço — não é necessário compartilhar via Google Drive.',
    usage: '{used} de {total} usado', upload_btn: 'Carregar arquivos', upload_folder: '📁 Carregar pasta', uploading: 'Carregando…', drop_hint: 'Arraste arquivos ou uma pasta aqui, ou clique para escolher',
    empty: 'Esta pasta está vazia — carregue um arquivo ou crie uma pasta.', th_file: 'Arquivo', th_size: 'Tamanho', th_added: 'Adicionado',
    copy_link: 'Copiar link', copied: 'Copiado ✓', del: 'Excluir', del_confirm: 'Excluir este arquivo? Os links para ele deixarão de funcionar.',
    err: 'Algo deu errado.', err_size: 'Arquivo muito grande — o limite é 50 MB.', err_type: 'Esse tipo de arquivo não é permitido.', err_quota: 'Espaço insuficiente. Exclua alguns arquivos ou atualize seu plano.',
    new_folder: 'Nova pasta', folder_name_prompt: 'Nome da pasta:', rename: 'Renomear', rename_prompt: 'Novo nome:',
    move: 'Mover', copy: 'Copiar', move_title: 'Mover "{name}" para:', copy_title: 'Copiar "{name}" para:', root_label: 'Drive (raiz)',
    confirm: 'Confirmar', cancel: 'Cancelar', folder_del_confirm: 'Excluir esta pasta?', folder_not_empty: 'A pasta não está vazia — mova ou exclua seu conteúdo primeiro.',
  },
};
const pick = (lang) => DRV[lang] || DRV.en;
const tier2limit = (t) => (DRIVE_LIMITS[t] != null ? DRIVE_LIMITS[t] : DRIVE_LIMITS.free_trial);

function folderPath(f, byId) {
  const parts = []; let cur = f, g = 0;
  while (cur && g++ < 25) { parts.unshift(cur.name); cur = cur.parent_id != null ? byId.get(cur.parent_id) : null; }
  return parts.join(' / ');
}

/** GET /drive[?folder=ID] — the Drive page. */
export async function handleDrive(ctx) {
  const { env, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/drive', 302);

  const folderId = url.searchParams.get('folder') ? Number(url.searchParams.get('folder')) : null;
  const current = folderId != null ? await getFolder(env.DB, email, folderId) : null;
  if (folderId != null && !current) return redirect('/drive', 302); // not owned / gone
  const curId = current ? current.id : null;

  const tier = await getUserTier(env.DB, email);
  const limit = tier2limit(tier);
  const { used } = await getDriveUsage(env.DB, email);
  const folders = await listFolders(env.DB, email, curId);
  const files = await listDriveFiles(env.DB, email, curId);
  const allFolders = await listAllFolders(env.DB, email);
  const byId = new Map(allFolders.map((f) => [f.id, f]));
  const pct = Math.min(100, Math.round(limit > 0 ? (used / limit) * 100 : 0));
  const barCls = pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok';

  // Breadcrumb (root → current).
  const crumbs = []; let c = current, g = 0;
  while (c && g++ < 25) { crumbs.unshift(c); c = c.parent_id != null ? byId.get(c.parent_id) : null; }
  const breadcrumb = `<a href="/drive">🗂 ${T.title}</a>` + crumbs.map((cr) => ` <span class="bc-sep">/</span> <a href="/drive?folder=${cr.id}">${esc(cr.name)}</a>`).join('');

  const folderRows = folders.map((f) => `<tr class="dr-folder">
      <td><a href="/drive?folder=${f.id}" class="dr-fname">📁 ${esc(f.name)}</a></td>
      <td class="muted">—</td><td class="muted">${esc(f.created_at ? new Date(f.created_at * 1000).toISOString().slice(0, 10) : '')}</td>
      <td class="dr-acts"><button class="link-btn dr-frename" data-id="${f.id}" data-name="${esc(f.name)}">${T.rename}</button><button class="link-btn danger dr-fdel" data-id="${f.id}">${T.del}</button></td></tr>`).join('');

  const fileRows = files.map((f) => `<tr>
      <td><a href="/drive/f/${esc(f.token)}" target="_blank" rel="noopener" title="${esc(f.name)}">${esc(f.name)}</a></td>
      <td class="muted">${fmtBytes(f.size)}</td>
      <td class="muted">${esc(f.created_at ? new Date(f.created_at * 1000).toISOString().slice(0, 10) : '')}</td>
      <td class="dr-acts">
        <button class="link-btn dr-copy" data-url="${esc(url.origin)}/drive/f/${esc(f.token)}">${T.copy_link}</button>
        <button class="link-btn dr-move" data-id="${f.id}" data-name="${esc(f.name)}">${T.move}</button>
        <button class="link-btn dr-cp" data-id="${f.id}" data-name="${esc(f.name)}">${T.copy}</button>
        <button class="link-btn danger dr-del" data-id="${f.id}">${T.del}</button>
      </td></tr>`).join('');

  const folderOpts = `<option value="">${T.root_label}</option>` + allFolders.map((f) => `<option value="${f.id}">${esc(folderPath(f, byId))}</option>`).join('');

  const inner = `
    <div class="dr-head"><h1>🗂 ${T.title}</h1><a class="btn ghost" href="/dashboard">${T.back}</a></div>
    <p class="sub">${T.sub}</p>
    <div class="dr-usage"><div class="dr-bar"><div class="dr-fill ${barCls}" style="width:${pct}%"></div></div>
      <div class="dr-ulabel">${T.usage.replace('{used}', fmtBytes(used)).replace('{total}', fmtBytes(limit))} · ${pct}%</div></div>
    <div class="dr-toolbar"><nav class="dr-crumb">${breadcrumb}</nav><button class="btn ghost" type="button" id="dr-newfolder">＋ ${T.new_folder}</button></div>
    <div class="dr-drop" id="dr-drop"><input type="file" id="dr-input" multiple hidden><input type="file" id="dr-folder-input" webkitdirectory hidden>
      <p>${T.drop_hint}</p>
      <button class="btn" type="button" id="dr-pick">${T.upload_btn}</button>
      <button class="btn ghost" type="button" id="dr-pickfolder">${T.upload_folder}</button>
      <span id="dr-msg" class="muted"></span></div>
    ${(folders.length || files.length)
      ? `<div class="dr-twrap"><table class="dr-table"><thead><tr><th>${T.th_file}</th><th>${T.th_size}</th><th>${T.th_added}</th><th></th></tr></thead><tbody>${folderRows}${fileRows}</tbody></table></div>`
      : `<div class="dr-empty">${T.empty}</div>`}

    <div class="mc-overlay" id="mc-modal" hidden><div class="mc-box">
      <h3 id="mc-title"></h3>
      <select id="mc-folder">${folderOpts}</select>
      <div class="mc-acts"><button class="btn ghost" type="button" id="mc-cancel">${T.cancel}</button><button class="btn" type="button" id="mc-go">${T.confirm}</button></div>
    </div></div>

    <script>
      var MAX = ${DRIVE_MAX_FILE};
      var CUR = ${curId == null ? 'null' : curId};
      var S = ${JSON.stringify({ uploading: T.uploading, err: T.err, errSize: T.err_size, copied: T.copied, copy: T.copy_link, delConfirm: T.del_confirm, folderName: T.folder_name_prompt, renamePrompt: T.rename_prompt, folderDel: T.folder_del_confirm, notEmpty: T.folder_not_empty, moveTitle: T.move_title, copyTitle: T.copy_title })};
      function post(u, body){ return fetch(u, { method:'POST', headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined }).then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); }); }
      // upload (into current folder)
      var input=document.getElementById('dr-input'), drop=document.getElementById('dr-drop'), msg=document.getElementById('dr-msg');
      var folderInput=document.getElementById('dr-folder-input');
      document.getElementById('dr-pick').addEventListener('click', function(){ input.click(); });
      document.getElementById('dr-pickfolder').addEventListener('click', function(){ folderInput.click(); });
      input.addEventListener('change', function(){ uploadTree(itemsFromFiles(input.files)); });
      folderInput.addEventListener('change', function(){ uploadTree(itemsFromFiles(folderInput.files)); });
      ['dragover','dragenter'].forEach(function(e){ drop.addEventListener(e, function(ev){ ev.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave'].forEach(function(e){ drop.addEventListener(e, function(ev){ ev.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', async function(ev){
        ev.preventDefault(); drop.classList.remove('over');
        var its = ev.dataTransfer && ev.dataTransfer.items;
        if(its && its.length && its[0].webkitGetAsEntry){
          var entries=[]; for(var i=0;i<its.length;i++){ var e=its[i].webkitGetAsEntry&&its[i].webkitGetAsEntry(); if(e) entries.push(e); }
          if(entries.some(function(e){return e.isDirectory;})){ var out=[]; for(var j=0;j<entries.length;j++){ await walkEntry(entries[j],'',out); } uploadTree(out); return; }
        }
        if(ev.dataTransfer&&ev.dataTransfer.files) uploadTree(itemsFromFiles(ev.dataTransfer.files));
      });
      // Map a flat FileList → [{path, file}] using webkitRelativePath (dir part) when present.
      function itemsFromFiles(list){ return Array.prototype.slice.call(list||[]).map(function(f){ var rp=f.webkitRelativePath||f.name; var slash=rp.lastIndexOf('/'); return { path: slash>=0?rp.substring(0,slash):'', file:f }; }); }
      // Recursively read a dropped DirectoryEntry into [{path, file}] (path = containing dir, relative).
      function walkEntry(entry, base, out){ return new Promise(function(resolve){
        if(entry.isFile){ entry.file(function(file){ out.push({path:base, file:file}); resolve(); }, function(){ resolve(); }); }
        else if(entry.isDirectory){ var childBase=base?base+'/'+entry.name:entry.name; var rd=entry.createReader(); var acc=[];
          (function more(){ rd.readEntries(function(ents){ if(!ents.length){ var p=acc.map(function(c){ return walkEntry(c, childBase, out); }); Promise.all(p).then(resolve); return; } acc=acc.concat(Array.prototype.slice.call(ents)); more(); }, function(){ resolve(); }); })();
        } else resolve();
      }); }
      // Create folders as needed (cache by path), then upload each file into its folder.
      async function ensureFolder(path, cache){
        if(!path) return CUR;
        if(cache[path]!=null) return cache[path];
        var parts=path.split('/'); var name=parts.pop(); var parentId=await ensureFolder(parts.join('/'), cache);
        var r=await post('/api/drive/folder',{name:name, parent_id:parentId});
        if(!r.ok||!r.d.success) throw new Error((r.d&&r.d.error)||S.err);
        cache[path]=r.d.id; return r.d.id;
      }
      async function uploadTree(items){
        if(!items||!items.length) return; var cache={};
        for(var i=0;i<items.length;i++){ var it=items[i]; if(it.file.size>MAX){ msg.textContent=S.errSize; continue; }
          msg.textContent=S.uploading+' ('+(i+1)+'/'+items.length+')';
          var fid; try{ fid=await ensureFolder(it.path, cache); }catch(e){ msg.textContent=S.err; return; }
          try{ var q='/api/drive/upload?name='+encodeURIComponent(it.file.name)+(fid!=null?'&folder='+fid:'');
            var res=await fetch(q,{method:'POST',headers:{'Content-Type':it.file.type||'application/octet-stream'},body:it.file}); var d=await res.json();
            if(!res.ok||!d.success){ msg.textContent=(d&&d.error)||S.err; return; } }catch(e){ msg.textContent=S.err; return; } }
        location.reload();
      }
      // copy link
      document.querySelectorAll('.dr-copy').forEach(function(b){ b.addEventListener('click', function(){ navigator.clipboard.writeText(b.dataset.url).then(function(){ var t=b.textContent; b.textContent=S.copied; setTimeout(function(){ b.textContent=S.copy; },1400); }); }); });
      // delete file
      document.querySelectorAll('.dr-del').forEach(function(b){ b.addEventListener('click', async function(){ if(!confirm(S.delConfirm))return; b.disabled=true; var r=await fetch('/api/drive/'+b.dataset.id,{method:'DELETE'}).then(function(x){return x.json();}).catch(function(){return{};}); if(r.success){location.reload();return;} alert(r.error||S.err); b.disabled=false; }); });
      // new folder
      document.getElementById('dr-newfolder').addEventListener('click', async function(){ var n=prompt(S.folderName); if(!n)return; var r=await post('/api/drive/folder',{name:n,parent_id:CUR}); if(r.ok&&r.d.success){location.reload();return;} alert((r.d&&r.d.error)||S.err); });
      // folder rename / delete
      document.querySelectorAll('.dr-frename').forEach(function(b){ b.addEventListener('click', async function(){ var n=prompt(S.renamePrompt, b.dataset.name); if(!n)return; var r=await fetch('/api/drive/folder/'+b.dataset.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})}).then(function(x){return x.json();}); if(r.success){location.reload();return;} alert(r.error||S.err); }); });
      document.querySelectorAll('.dr-fdel').forEach(function(b){ b.addEventListener('click', async function(){ if(!confirm(S.folderDel))return; var r=await fetch('/api/drive/folder/'+b.dataset.id,{method:'DELETE'}).then(function(x){return x.json();}); if(r.success){location.reload();return;} alert(r.error||S.err); }); });
      // move / copy modal
      var modal=document.getElementById('mc-modal'), mcTitle=document.getElementById('mc-title'), mcFolder=document.getElementById('mc-folder'), mcGo=document.getElementById('mc-go');
      var mcState={ id:null, mode:null };
      function openMC(id, name, mode){ mcState={id:id,mode:mode}; mcTitle.textContent=(mode==='move'?S.moveTitle:S.copyTitle).replace('{name}', name); mcFolder.value=CUR!=null?String(CUR):''; modal.hidden=false; }
      document.querySelectorAll('.dr-move').forEach(function(b){ b.addEventListener('click', function(){ openMC(b.dataset.id, b.dataset.name, 'move'); }); });
      document.querySelectorAll('.dr-cp').forEach(function(b){ b.addEventListener('click', function(){ openMC(b.dataset.id, b.dataset.name, 'copy'); }); });
      document.getElementById('mc-cancel').addEventListener('click', function(){ modal.hidden=true; });
      modal.addEventListener('click', function(e){ if(e.target===modal) modal.hidden=true; });
      mcGo.addEventListener('click', async function(){ mcGo.disabled=true; var fid=mcFolder.value?Number(mcFolder.value):null;
        var r=await post('/api/drive/'+mcState.id+'/'+mcState.mode, { folder_id: fid });
        mcGo.disabled=false; if(r.ok&&r.d.success){ location.reload(); return; } alert((r.d&&r.d.error)||S.err); });
    </script>`;

  return htmlResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: 'Your file storage.', origin: url.origin, path: '/drive' })}<meta name="robots" content="noindex">
  <style>${baseCss()}
    main{min-height:60vh}.drwrap{max-width:880px;margin:0 auto;padding:2.4rem 1.5rem}
    .dr-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .dr-head h1{font-size:clamp(1.5rem,3.5vw,2rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);margin:.3rem 0 1.2rem}.muted{color:var(--muted)}
    .dr-usage{margin-bottom:1.1rem}.dr-bar{height:10px;background:#eef2f7;border-radius:999px;overflow:hidden}
    .dr-fill{height:100%;border-radius:999px;transition:width .3s}.dr-fill.ok{background:#10b981}.dr-fill.warn{background:#f59e0b}.dr-fill.bad{background:#ef4444}
    .dr-ulabel{font-size:.82rem;color:var(--muted);margin-top:.4rem}
    .dr-toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:.9rem}
    .dr-crumb{font-size:.92rem;font-weight:600}.dr-crumb a{color:var(--p2);text-decoration:none}.bc-sep{color:var(--muted);margin:0 .15rem}
    .dr-drop{border:2px dashed var(--line);border-radius:14px;padding:1.4rem;text-align:center;margin-bottom:1.3rem;background:#fafbfc}
    .dr-drop.over{border-color:var(--p1);background:#eef2ff}.dr-drop p{color:var(--muted);margin:0 0 .7rem}
    .dr-twrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
    .dr-table{width:100%;border-collapse:collapse;font-size:.9rem}
    .dr-table th{text-align:left;padding:.6rem .8rem;color:var(--muted);font-size:.72rem;text-transform:uppercase;border-bottom:1px solid var(--line)}
    .dr-table td{padding:.55rem .8rem;border-bottom:1px solid var(--line);vertical-align:middle}
    .dr-table tr:last-child td{border-bottom:none}.dr-table a{color:var(--p2);text-decoration:none;font-weight:600}
    .dr-folder .dr-fname{color:var(--ink)}
    .dr-acts{white-space:nowrap;text-align:right}
    .link-btn{background:none;border:none;color:var(--p2);cursor:pointer;font-size:.8rem;font-weight:600;padding:0 .3rem}.link-btn.danger{color:#b91c1c}
    .dr-empty{text-align:center;color:var(--muted);border:2px dashed var(--line);border-radius:14px;padding:2.5rem 1.5rem}
    .mc-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem}
    .mc-overlay[hidden]{display:none}
    .mc-box{background:#fff;border-radius:14px;padding:1.4rem;max-width:420px;width:100%}
    .mc-box h3{margin:0 0 .8rem;font-size:1rem;color:var(--ink)}
    .mc-box select{width:100%;padding:.6rem .7rem;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;font-size:.9rem}
    .mc-acts{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1rem}
  </style></head><body>${siteHeader('/dashboard', {})}<main><div class="drwrap">${inner}</div></main>${siteFooter({ lang })}</body></html>`);
}

/** POST /api/drive/upload?name=&folder= — raw file body → R2 + ledger. */
export async function handleDriveUpload(ctx) {
  const { env, request, url } = ctx;
  const T = pick((ctx && ctx.lang) || 'en');
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);

  const name = (url.searchParams.get('name') || 'file').slice(0, 255);
  const type = TYPES[extOf(name)];
  if (!type) return json({ success: false, error: T.err_type }, 415);
  let folderId = url.searchParams.get('folder') ? Number(url.searchParams.get('folder')) : null;
  if (folderId != null && !(await getFolder(env.DB, email, folderId))) folderId = null;

  const claimed = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (Number.isFinite(claimed) && claimed > DRIVE_MAX_FILE) return json({ success: false, error: T.err_size }, 413);
  const buf = await request.arrayBuffer();
  const size = buf.byteLength;
  if (size > DRIVE_MAX_FILE) return json({ success: false, error: T.err_size }, 413);
  if (size === 0) return json({ success: false, error: T.err }, 400);

  const limit = tier2limit(await getUserTier(env.DB, email));
  const { used } = await getDriveUsage(env.DB, email);
  if (used + size > limit) return json({ success: false, error: T.err_quota }, 413);

  const token = generateToken(16);
  const r2_key = `drive/${token}`;
  await env.STORAGE.put(r2_key, buf, { httpMetadata: { contentType: type.mime } });
  await addDriveFile(env.DB, email, { token, name, r2_key, size, content_type: type.mime, folder_id: folderId });
  audit(ctx, 'drive.upload', { resourceType: 'file', resourceId: token, resourceName: name, metadata: { size, folder: folderId } });
  return json({ success: true, token, url: `${url.origin}/drive/f/${token}`, size });
}

/** DELETE /api/drive/:id — remove a file (owner-scoped). */
export async function handleDriveDelete(ctx) {
  const { env, params } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid id' }, 400);
  const f = await getDriveFileById(env.DB, email, id);
  const key = await deleteDriveFile(env.DB, email, id);
  if (!key) return json({ success: false, error: 'Not found' }, 404);
  await env.STORAGE.delete(key).catch(() => {});
  audit(ctx, 'drive.file.delete', { resourceType: 'file', resourceId: id, resourceName: f ? f.name : '' });
  return json({ success: true });
}

/** POST /api/drive/folder — create { name, parent_id }. */
export async function handleFolderCreate(ctx) {
  const { env, request } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ success: false, error: 'Name required' }, 400);
  let parentId = body.parent_id != null ? Number(body.parent_id) : null;
  if (parentId != null && !(await getFolder(env.DB, email, parentId))) parentId = null;
  const id = await createFolder(env.DB, email, name, parentId);
  audit(ctx, 'drive.folder.create', { resourceType: 'folder', resourceId: id, resourceName: name, metadata: { parent: parentId } });
  return json({ success: true, id });
}

/** PUT /api/drive/folder/:id — rename { name }. */
export async function handleFolderRename(ctx) {
  const { env, request, params } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ success: false, error: 'Name required' }, 400);
  const ok = await renameFolder(env.DB, email, id, name);
  if (!ok) return json({ success: false, error: 'Not found' }, 404);
  audit(ctx, 'drive.folder.rename', { resourceType: 'folder', resourceId: id, resourceName: name });
  return json({ success: true });
}

/** DELETE /api/drive/folder/:id — delete an empty folder. */
export async function handleFolderDelete(ctx) {
  const { env, params } = ctx;
  const T = pick((ctx && ctx.lang) || 'en');
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  const folder = await getFolder(env.DB, email, id);
  if (!folder) return json({ success: false, error: 'Not found' }, 404);
  if (await folderHasContents(env.DB, email, id)) return json({ success: false, error: T.folder_not_empty }, 409);
  await deleteFolder(env.DB, email, id);
  audit(ctx, 'drive.folder.delete', { resourceType: 'folder', resourceId: id, resourceName: folder.name });
  return json({ success: true });
}

/** POST /api/drive/:id/move — { folder_id } move a file to a folder. */
export async function handleFileMove(ctx) {
  const { env, request, params } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  const f = await getDriveFileById(env.DB, email, id);
  if (!f) return json({ success: false, error: 'Not found' }, 404);
  const body = await request.json().catch(() => ({}));
  let folderId = body.folder_id != null ? Number(body.folder_id) : null;
  if (folderId != null && !(await getFolder(env.DB, email, folderId))) return json({ success: false, error: 'Invalid folder' }, 400);
  await moveDriveFile(env.DB, email, id, folderId);
  audit(ctx, 'drive.file.move', { resourceType: 'file', resourceId: id, resourceName: f.name, metadata: { from: f.folder_id, to: folderId } });
  return json({ success: true });
}

/** POST /api/drive/:id/copy — { folder_id } duplicate a file into a folder (quota-checked). */
export async function handleFileCopy(ctx) {
  const { env, request, params, url } = ctx;
  const T = pick((ctx && ctx.lang) || 'en');
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  const src = await getDriveFileById(env.DB, email, id);
  if (!src) return json({ success: false, error: 'Not found' }, 404);
  const body = await request.json().catch(() => ({}));
  let folderId = body.folder_id != null ? Number(body.folder_id) : null;
  if (folderId != null && !(await getFolder(env.DB, email, folderId))) return json({ success: false, error: 'Invalid folder' }, 400);

  const limit = tier2limit(await getUserTier(env.DB, email));
  const { used } = await getDriveUsage(env.DB, email);
  if (used + src.size > limit) return json({ success: false, error: T.err_quota }, 413);

  const obj = await env.STORAGE.get(src.r2_key);
  if (!obj) return json({ success: false, error: T.err }, 404);
  const token = generateToken(16);
  const r2_key = `drive/${token}`;
  await env.STORAGE.put(r2_key, obj.body, { httpMetadata: { contentType: src.content_type } });
  await addDriveFile(env.DB, email, { token, name: src.name, r2_key, size: src.size, content_type: src.content_type, folder_id: folderId });
  audit(ctx, 'drive.file.copy', { resourceType: 'file', resourceId: token, resourceName: src.name, metadata: { from: id, to: folderId, size: src.size } });
  return json({ success: true, token, url: `${url.origin}/drive/f/${token}` });
}

/** GET /api/drive/images — the owner's Drive images (for the editor picker). */
export async function handleDriveImages(ctx) {
  const { env, url } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const rows = await listDriveImages(env.DB, email);
  return json({ success: true, images: rows.map((r) => ({ token: r.token, name: r.name, url: `${url.origin}/drive/f/${r.token}` })) });
}

/** GET /drive/f/:token — serve a file publicly (token is the unguessable auth). */
export async function handleDriveFile(ctx) {
  const { env, params } = ctx;
  const f = await getDriveFileByToken(env.DB, params.token);
  if (!f) return new Response('Not found', { status: 404 });
  const obj = await env.STORAGE.get(f.r2_key);
  if (!obj) return new Response('Not found', { status: 404 });
  const inline = TYPES[extOf(f.name)] ? TYPES[extOf(f.name)].inline : false;
  const headers = {
    'Content-Type': f.content_type || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
  if (!inline) headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(f.name)}"`;
  return new Response(obj.body, { headers });
}
