// Drive — account-level file storage with folders. Upload site assets to R2,
// organize into (nestable) folders, move/copy files between them, see usage vs
// the plan quota, copy public links. Owner-scoped via billingAuth. Every mutation
// is audit-logged. Files served from /drive/f/:token (unguessable). See db/drive.js.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import {
  getDriveUsage, listDriveFiles, addDriveFile, deleteDriveFile, getDriveFileByToken,
  getDriveFileById, moveDriveFile, listFolders, listAllFolders, getFolder, createFolder,
  renameFolder, collectFolderTree, purgeFolderTree, listDriveImages,
  softDeleteFile, softDeleteTree, restoreTree, restoreFile, getDeletedFile, getDeletedFolder,
  getTrashStats, listTrashRoots, listAllDeleted,
} from '../../db/drive.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { DRIVE_LIMITS, DRIVE_MAX_FILE } from '../../utils/credits.js';
import { generateToken } from '../../utils/crypto.js';
import { audit } from '../../utils/audit.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

// Drive is a general-purpose asset store ("network drive"), so we DENY only
// executable / system files and allow everything else. Serving stays safe:
// only known media renders inline, everything else downloads (attachment +
// nosniff), and SVG carries a script-blocking CSP — so html/js/etc. can be
// stored but never execute on our origin.
const DENIED = new Set([
  'exe', 'msi', 'msix', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'dll', 'sys', 'drv', 'vxd', 'msc', 'msu', 'gadget',
  'vbs', 'vbe', 'vb', 'ws', 'wsf', 'wsh', 'ps1', 'ps1xml', 'psc1', 'scf', 'lnk', 'inf', 'reg', 'hta', 'jse', 'jar',
  'app', 'dmg', 'pkg', 'mpkg', 'deb', 'rpm', 'apk', 'appimage', 'run', 'command', 'sh', 'bash', 'zsh', 'csh', 'ksh',
]);
// Proper Content-Type for common types (default application/octet-stream).
const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon', heic: 'image/heic', tiff: 'image/tiff', tif: 'image/tiff',
  pdf: 'application/pdf',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv', rtf: 'application/rtf', md: 'text/markdown', json: 'application/json', xml: 'application/xml',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed', gz: 'application/gzip', tar: 'application/x-tar',
};
// Extensions we render inline in the browser; everything else downloads.
const INLINE = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'pdf',
  'mp4', 'webm', 'mov', 'm4v', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'txt',
  'woff', 'woff2', 'ttf', 'otf',
]);
const extOf = (name) => { const m = /\.([a-z0-9]+)$/i.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; };
const mimeOf = (name) => MIME[extOf(name)] || 'application/octet-stream';

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
    copy_link: 'Copy link', copied: 'Copied ✓', del: 'Delete', del_confirm: 'Move this file to the Trash? Links to it will stop working until you restore it.',
    err: 'Something went wrong.', err_size: 'File too large — the limit is 50 MB.', err_type: 'For security, executable and system files can’t be uploaded.', err_quota: 'Not enough space. Delete some files or upgrade your plan.',
    new_folder: 'New folder', folder_name_prompt: 'Folder name:', rename: 'Rename', rename_prompt: 'New name:',
    move: 'Move', copy: 'Copy', move_title: 'Move "{name}" to:', copy_title: 'Copy "{name}" to:', root_label: 'Drive (root)',
    confirm: 'Confirm', cancel: 'Cancel', folder_del_confirm: 'Move this folder to the Trash?', folder_not_empty: "The folder isn't empty — move or delete its contents first.", folder_del_full: 'This folder contains {files} file(s) and {folders} subfolder(s). Deleting it moves EVERYTHING inside to the Trash, and links will stop working until you restore them.', folder_del_title: 'Delete “{name}”?', del_type_hint: 'Type DELETE to confirm',
    trash_title: 'Trash', trash_link: '🗑 Trash', trash_sub: 'Deleted files and folders stay here until you restore them or delete them forever. They still count toward your storage until purged.', trash_none: 'Trash is empty.', th_deleted: 'Deleted', items: '{n} items', restore: 'Restore', restoring: 'Restoring…', del_forever: 'Delete forever', del_forever_confirm: 'Permanently delete “{name}”? This frees the space but can’t be undone.', empty_trash: 'Empty trash', empty_trash_confirm: 'Permanently delete everything in the Trash? This can’t be undone.', trash_size: '{size} in trash',
  },
  es: {
    meta_title: 'Drive — Caddisfly', title: 'Drive', back: '← Dashboard',
    sub: 'Sube imágenes, PDF y archivos para usarlos en tus sitios. Almacenados en tu propio espacio — no es necesario compartirlos a través de Google Drive.',
    usage: '{used} de {total} utilizado', upload_btn: 'Subir archivos', upload_folder: '📁 Subir carpeta', uploading: 'Subiendo…', drop_hint: 'Arrastra archivos o una carpeta aquí, o haz clic para elegir',
    empty: 'Esta carpeta está vacía — sube un archivo o crea una carpeta.', th_file: 'Archivo', th_size: 'Tamaño', th_added: 'Añadido',
    copy_link: 'Copiar enlace', copied: 'Copiado ✓', del: 'Eliminar', del_confirm: '¿Mover este archivo a la Papelera? Los enlaces a él dejarán de funcionar hasta que lo restaures.',
    err: 'Algo salió mal.', err_size: 'Archivo demasiado grande — el límite es 50 MB.', err_type: 'Por seguridad, no se pueden subir archivos ejecutables o de sistema.', err_quota: 'No hay suficiente espacio. Elimina algunos archivos o actualiza tu plan.',
    new_folder: 'Nueva carpeta', folder_name_prompt: 'Nombre de la carpeta:', rename: 'Renombrar', rename_prompt: 'Nuevo nombre:',
    move: 'Mover', copy: 'Copiar', move_title: 'Mover "{name}" a:', copy_title: 'Copiar "{name}" a:', root_label: 'Drive (raíz)',
    confirm: 'Confirmar', cancel: 'Cancelar', folder_del_confirm: '¿Mover esta carpeta a la Papelera?', folder_not_empty: 'La carpeta no está vacía — mueve o elimina su contenido primero.', folder_del_full: 'Esta carpeta contiene {files} archivo(s) y {folders} subcarpeta(s). Al eliminarla se mueve TODO su contenido a la Papelera, y los enlaces dejarán de funcionar hasta que los restaures.', folder_del_title: '¿Eliminar “{name}”?', del_type_hint: 'Escribe DELETE para confirmar',
    trash_title: 'Papelera', trash_link: '🗑 Papelera', trash_sub: 'Los archivos y carpetas eliminados quedan aquí hasta que los restaures o los elimines para siempre. Siguen contando para tu almacenamiento hasta que se purguen.', trash_none: 'La papelera está vacía.', th_deleted: 'Eliminado', items: '{n} elementos', restore: 'Restaurar', restoring: 'Restaurando…', del_forever: 'Eliminar para siempre', del_forever_confirm: '¿Eliminar “{name}” para siempre? Libera el espacio pero no se puede deshacer.', empty_trash: 'Vaciar papelera', empty_trash_confirm: '¿Eliminar para siempre todo el contenido de la papelera? No se puede deshacer.', trash_size: '{size} en la papelera',
  },
  pt: {
    meta_title: 'Drive — Caddisfly', title: 'Drive', back: '← Dashboard',
    sub: 'Faça o upload de imagens, PDFs e arquivos para usar em seus sites. Armazenados no seu próprio espaço — não é necessário compartilhar via Google Drive.',
    usage: '{used} de {total} usado', upload_btn: 'Carregar arquivos', upload_folder: '📁 Carregar pasta', uploading: 'Carregando…', drop_hint: 'Arraste arquivos ou uma pasta aqui, ou clique para escolher',
    empty: 'Esta pasta está vazia — carregue um arquivo ou crie uma pasta.', th_file: 'Arquivo', th_size: 'Tamanho', th_added: 'Adicionado',
    copy_link: 'Copiar link', copied: 'Copiado ✓', del: 'Excluir', del_confirm: 'Mover este arquivo para a Lixeira? Os links para ele deixarão de funcionar até você restaurá-lo.',
    err: 'Algo deu errado.', err_size: 'Arquivo muito grande — o limite é 50 MB.', err_type: 'Por segurança, arquivos executáveis e de sistema não podem ser enviados.', err_quota: 'Espaço insuficiente. Exclua alguns arquivos ou atualize seu plano.',
    new_folder: 'Nova pasta', folder_name_prompt: 'Nome da pasta:', rename: 'Renomear', rename_prompt: 'Novo nome:',
    move: 'Mover', copy: 'Copiar', move_title: 'Mover "{name}" para:', copy_title: 'Copiar "{name}" para:', root_label: 'Drive (raiz)',
    confirm: 'Confirmar', cancel: 'Cancelar', folder_del_confirm: 'Mover esta pasta para a Lixeira?', folder_not_empty: 'A pasta não está vazia — mova ou exclua seu conteúdo primeiro.', folder_del_full: 'Esta pasta contém {files} arquivo(s) e {folders} subpasta(s). Ao excluí-la, TUDO dentro vai para a Lixeira, e os links deixarão de funcionar até você restaurá-los.', folder_del_title: 'Excluir “{name}”?', del_type_hint: 'Digite DELETE para confirmar',
    trash_title: 'Lixeira', trash_link: '🗑 Lixeira', trash_sub: 'Arquivos e pastas excluídos ficam aqui até você restaurá-los ou excluí-los definitivamente. Eles continuam contando para o seu armazenamento até serem removidos.', trash_none: 'A lixeira está vazia.', th_deleted: 'Excluído', items: '{n} itens', restore: 'Restaurar', restoring: 'Restaurando…', del_forever: 'Excluir definitivamente', del_forever_confirm: 'Excluir “{name}” definitivamente? Libera o espaço, mas não pode ser desfeito.', empty_trash: 'Esvaziar lixeira', empty_trash_confirm: 'Excluir definitivamente tudo na lixeira? Não pode ser desfeito.', trash_size: '{size} na lixeira',
  },
};
const pick = (lang) => DRV[lang] || DRV.en;
const tier2limit = (t) => (DRIVE_LIMITS[t] != null ? DRIVE_LIMITS[t] : DRIVE_LIMITS.free_trial);

/** Page styles shared by the Drive page and the Trash page. */
function driveCss() {
  return `
    main{min-height:60vh}.drwrap{max-width:880px;margin:0 auto;padding:2.4rem 1.5rem}
    .dr-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .dr-head h1{font-size:clamp(1.5rem,3.5vw,2rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);margin:.3rem 0 1.2rem}.muted{color:var(--muted)}
    .dr-usage{margin-bottom:1.1rem}.dr-bar{height:10px;background:#eef2f7;border-radius:999px;overflow:hidden}
    .dr-fill{height:100%;border-radius:999px;transition:width .3s}.dr-fill.ok{background:#10b981}.dr-fill.warn{background:#f59e0b}.dr-fill.bad{background:#ef4444}
    .dr-ulabel{font-size:.82rem;color:var(--muted);margin-top:.4rem}
    .dr-toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:.9rem}
    .dr-crumb{font-size:.92rem;font-weight:600}.dr-crumb a{color:var(--p2);text-decoration:none}.bc-sep{color:var(--muted);margin:0 .15rem}
    .dr-tools{display:flex;gap:.5rem;flex-wrap:wrap}
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
    .mc-box select,.mc-box input{width:100%;padding:.6rem .7rem;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;font-size:.9rem;box-sizing:border-box}
    .del-warn{margin:0 0 1rem;font-size:.85rem;color:#b91c1c;line-height:1.45}
    .del-hint{display:block;margin:0 0 .35rem;font-size:.8rem;font-weight:600;color:var(--muted)}
    .btn.danger{background:#b91c1c;border-color:#b91c1c;color:#fff}
    .btn.danger:disabled{opacity:.45;cursor:not-allowed}
    .mc-acts{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1rem}`;
}

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
      <td class="dr-acts"><button class="link-btn dr-frename" data-id="${f.id}" data-name="${esc(f.name)}">${T.rename}</button><button class="link-btn danger dr-fdel" data-id="${f.id}" data-name="${esc(f.name)}">${T.del}</button></td></tr>`).join('');

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
    <div class="dr-toolbar"><nav class="dr-crumb">${breadcrumb}</nav><span class="dr-tools"><a class="btn ghost" href="/drive/trash">${T.trash_link}</a><button class="btn ghost" type="button" id="dr-newfolder">＋ ${T.new_folder}</button></span></div>
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

    <div class="mc-overlay" id="del-modal" hidden><div class="mc-box">
      <h3 id="del-title"></h3>
      <p id="del-warn" class="del-warn"></p>
      <label class="del-hint" for="del-input">${T.del_type_hint}</label>
      <input id="del-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="DELETE">
      <div class="mc-acts"><button class="btn ghost" type="button" id="del-cancel">${T.cancel}</button><button class="btn danger" type="button" id="del-go" disabled>${T.del}</button></div>
    </div></div>

    <script>
      var MAX = ${DRIVE_MAX_FILE};
      var CUR = ${curId == null ? 'null' : curId};
      var S = ${JSON.stringify({ uploading: T.uploading, err: T.err, errSize: T.err_size, copied: T.copied, copy: T.copy_link, delConfirm: T.del_confirm, folderName: T.folder_name_prompt, renamePrompt: T.rename_prompt, folderDel: T.folder_del_confirm, folderDelFull: T.folder_del_full, folderDelTitle: T.folder_del_title, delTypeHint: T.del_type_hint, notEmpty: T.folder_not_empty, moveTitle: T.move_title, copyTitle: T.copy_title })};
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
      document.querySelectorAll('.dr-fdel').forEach(function(b){ b.addEventListener('click', async function(){ b.disabled=true; var p=await fetch('/api/drive/folder/'+b.dataset.id,{method:'DELETE'}).then(function(x){return x.json();}).catch(function(){return{};}); b.disabled=false; if(!p.needsConfirm){ alert(p.error||S.err); return; } if(p.files+p.folders>0){ openDel(b.dataset.id, b.dataset.name||'', p.files, p.folders); return; } if(!confirm(S.folderDel))return; var r=await fetch('/api/drive/folder/'+b.dataset.id+'?confirm=1',{method:'DELETE'}).then(function(x){return x.json();}).catch(function(){return{};}); if(r.success){location.reload();return;} alert(r.error||S.err); }); });
      // type-DELETE confirm modal (for non-empty folders)
      var delModal=document.getElementById('del-modal'), delTitle=document.getElementById('del-title'), delWarn=document.getElementById('del-warn'), delInput=document.getElementById('del-input'), delGo=document.getElementById('del-go');
      var delId=null;
      function delMatch(){ return delInput.value.trim().toUpperCase()==='DELETE'; }
      function closeDel(){ delModal.hidden=true; delInput.value=''; delGo.disabled=true; delId=null; }
      function openDel(id, name, files, folders){ delId=id; delTitle.textContent=S.folderDelTitle.replace('{name}', name); delWarn.textContent=S.folderDelFull.replace('{files}',files).replace('{folders}',folders); delInput.value=''; delGo.disabled=true; delModal.hidden=false; delInput.focus(); }
      delInput.addEventListener('input', function(){ delGo.disabled=!delMatch(); });
      delInput.addEventListener('keydown', function(e){ if(e.key==='Enter'&&delMatch()) delGo.click(); });
      document.getElementById('del-cancel').addEventListener('click', closeDel);
      delModal.addEventListener('click', function(e){ if(e.target===delModal) closeDel(); });
      delGo.addEventListener('click', async function(){ if(!delMatch())return; delGo.disabled=true; var r=await fetch('/api/drive/folder/'+delId+'?confirm=1',{method:'DELETE'}).then(function(x){return x.json();}).catch(function(){return{};}); if(r.success){location.reload();return;} alert(r.error||S.err); closeDel(); });
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
  <style>${baseCss()}${driveCss()}
  </style></head><body>${siteHeader('/dashboard', {})}<main><div class="drwrap">${inner}</div></main>${siteFooter({ lang })}</body></html>`);
}

/** POST /api/drive/upload?name=&folder= — raw file body → R2 + ledger. */
export async function handleDriveUpload(ctx) {
  const { env, request, url } = ctx;
  const T = pick((ctx && ctx.lang) || 'en');
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);

  const name = (url.searchParams.get('name') || 'file').slice(0, 255);
  if (DENIED.has(extOf(name))) return json({ success: false, error: T.err_type }, 415);
  const mime = mimeOf(name);
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
  await env.STORAGE.put(r2_key, buf, { httpMetadata: { contentType: mime } });
  await addDriveFile(env.DB, email, { token, name, r2_key, size, content_type: mime, folder_id: folderId });
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
  if (!f) return json({ success: false, error: 'Not found' }, 404);
  await softDeleteFile(env.DB, email, id, new Date().toISOString());
  audit(ctx, 'drive.file.delete', { resourceType: 'file', resourceId: id, resourceName: f.name, metadata: { trashed: true } });
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

/**
 * DELETE /api/drive/folder/:id — delete a folder.
 * Without ?confirm=1 this is a dry probe: returns { needsConfirm, files, folders }
 * (recursive counts) so the client can show an acknowledgment dialog. With
 * ?confirm=1 it cascade-deletes the folder, all subfolders, and all files inside
 * (R2 objects + rows).
 */
export async function handleFolderDelete(ctx) {
  const { env, params, url } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  const folder = await getFolder(env.DB, email, id);
  if (!folder) return json({ success: false, error: 'Not found' }, 404);

  const { folderIds, files } = await collectFolderTree(env.DB, email, id);
  const subfolders = folderIds.length - 1;
  const fileCount = files.length;

  if (url.searchParams.get('confirm') !== '1') {
    return json({ success: false, needsConfirm: true, files: fileCount, folders: subfolders, name: folder.name }, 409);
  }

  // Soft-delete: move the whole subtree to Trash (keep R2 objects so Restore works).
  await softDeleteTree(env.DB, email, folderIds, files.map((f) => f.id), new Date().toISOString());
  audit(ctx, 'drive.folder.delete', {
    resourceType: 'folder', resourceId: id, resourceName: folder.name,
    metadata: { files: fileCount, folders: subfolders, trashed: true },
  });
  return json({ success: true });
}

/** GET /drive/trash — the Trash bin (restore / delete forever). */
export async function handleTrash(ctx) {
  const { env } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/drive/trash', 302);

  const roots = await listTrashRoots(env.DB, email);
  const stats = await getTrashStats(env.DB, email);
  // Per-folder contained-item counts (trash is small; a few queries is fine).
  const folderRows = [];
  for (const f of roots.folders) {
    const { folderIds, files } = await collectFolderTree(env.DB, email, f.id);
    const items = (folderIds.length - 1) + files.length;
    folderRows.push(`<tr><td>📁 ${esc(f.name)} <span class="muted">· ${T.items.replace('{n}', items)}</span></td>`
      + `<td class="muted">${esc((f.deleted_at || '').slice(0, 10))}</td>`
      + `<td class="dr-acts"><button class="link-btn tr-frestore" data-id="${f.id}">${T.restore}</button>`
      + `<button class="link-btn danger tr-fpurge" data-id="${f.id}" data-name="${esc(f.name)}">${T.del_forever}</button></td></tr>`);
  }
  const fileRows = roots.files.map((f) => `<tr><td>${esc(f.name)}</td>`
    + `<td class="muted">${esc((f.deleted_at || '').slice(0, 10))}</td>`
    + `<td class="dr-acts"><button class="link-btn tr-restore" data-id="${f.id}">${T.restore}</button>`
    + `<button class="link-btn danger tr-purge" data-id="${f.id}" data-name="${esc(f.name)}">${T.del_forever}</button></td></tr>`).join('');

  const hasItems = roots.folders.length || roots.files.length;
  const inner = `
    <div class="dr-head"><h1>🗑 ${T.trash_title}</h1><a class="btn ghost" href="/drive">← ${T.title}</a></div>
    <p class="sub">${T.trash_sub}</p>
    ${hasItems ? `<div class="dr-toolbar"><span class="muted">${T.trash_size.replace('{size}', fmtBytes(stats.used))}</span><button class="btn danger" type="button" id="tr-empty">${T.empty_trash}</button></div>` : ''}
    ${hasItems
      ? `<div class="dr-twrap"><table class="dr-table"><thead><tr><th>${T.th_file}</th><th>${T.th_deleted}</th><th></th></tr></thead><tbody>${folderRows.join('')}${fileRows}</tbody></table></div>`
      : `<div class="dr-empty">${T.trash_none}</div>`}
    <script>
      var S = ${JSON.stringify({ err: T.err, restoring: T.restoring, purgeConfirm: T.del_forever_confirm, emptyConfirm: T.empty_trash_confirm })};
      async function call(url, method){ var r=await fetch(url,{method:method}).then(function(x){return x.json();}).catch(function(){return{};}); if(r.success){location.reload();return;} alert(r.error||S.err); }
      document.querySelectorAll('.tr-restore').forEach(function(b){ b.addEventListener('click', function(){ b.disabled=true; call('/api/drive/'+b.dataset.id+'/restore','POST'); }); });
      document.querySelectorAll('.tr-frestore').forEach(function(b){ b.addEventListener('click', function(){ b.disabled=true; call('/api/drive/folder/'+b.dataset.id+'/restore','POST'); }); });
      document.querySelectorAll('.tr-purge').forEach(function(b){ b.addEventListener('click', function(){ if(!confirm(S.purgeConfirm.replace('{name}', b.dataset.name||'')))return; b.disabled=true; call('/api/drive/'+b.dataset.id+'/purge','DELETE'); }); });
      document.querySelectorAll('.tr-fpurge').forEach(function(b){ b.addEventListener('click', function(){ if(!confirm(S.purgeConfirm.replace('{name}', b.dataset.name||'')))return; b.disabled=true; call('/api/drive/folder/'+b.dataset.id+'/purge','DELETE'); }); });
      var emptyBtn=document.getElementById('tr-empty');
      if(emptyBtn) emptyBtn.addEventListener('click', function(){ if(!confirm(S.emptyConfirm))return; emptyBtn.disabled=true; call('/api/drive/trash/empty','POST'); });
    </script>`;
  return htmlResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${T.trash_title} · ${T.title}</title>${headTags({ title: T.trash_title })}<style>${baseCss()}${driveCss()}</style></head><body>${siteHeader('/dashboard', {})}<main><div class="drwrap">${inner}</div></main>${siteFooter({ lang })}</body></html>`);
}

/** POST /api/drive/:id/restore — restore a trashed file. */
export async function handleFileRestore(ctx) {
  const { env, params } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  const name = await restoreFile(env.DB, email, id);
  if (name == null) return json({ success: false, error: 'Not found' }, 404);
  audit(ctx, 'drive.file.restore', { resourceType: 'file', resourceId: id, resourceName: name });
  return json({ success: true });
}

/** DELETE /api/drive/:id/purge — permanently delete a trashed file (R2 + row). */
export async function handleFilePurge(ctx) {
  const { env, params } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  const f = await getDeletedFile(env.DB, email, id);
  if (!f) return json({ success: false, error: 'Not found' }, 404);
  if (f.r2_key) await env.STORAGE.delete(f.r2_key).catch(() => {});
  await deleteDriveFile(env.DB, email, id);
  audit(ctx, 'drive.file.purge', { resourceType: 'file', resourceId: id, resourceName: f.name });
  return json({ success: true });
}

/** POST /api/drive/folder/:id/restore — restore a trashed folder + its subtree. */
export async function handleFolderRestore(ctx) {
  const { env, params } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  const folder = await getDeletedFolder(env.DB, email, id);
  if (!folder) return json({ success: false, error: 'Not found' }, 404);
  const { folderIds, files } = await collectFolderTree(env.DB, email, id);
  await restoreTree(env.DB, email, folderIds, files.map((f) => f.id));
  audit(ctx, 'drive.folder.restore', { resourceType: 'folder', resourceId: id, resourceName: folder.name, metadata: { files: files.length, folders: folderIds.length - 1 } });
  return json({ success: true });
}

/** DELETE /api/drive/folder/:id/purge — permanently delete a trashed folder + subtree. */
export async function handleFolderPurge(ctx) {
  const { env, params } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  const folder = await getDeletedFolder(env.DB, email, id);
  if (!folder) return json({ success: false, error: 'Not found' }, 404);
  const { folderIds, files } = await collectFolderTree(env.DB, email, id);
  const keys = files.map((f) => f.r2_key).filter(Boolean);
  for (let i = 0; i < keys.length; i += 1000) {
    try { await env.STORAGE.delete(keys.slice(i, i + 1000)); } catch (e) { /* best-effort */ }
  }
  await purgeFolderTree(env.DB, email, folderIds, files.map((f) => f.id));
  audit(ctx, 'drive.folder.purge', { resourceType: 'folder', resourceId: id, resourceName: folder.name, metadata: { files: files.length, folders: folderIds.length - 1 } });
  return json({ success: true });
}

/** POST /api/drive/trash/empty — purge everything in the trash. */
export async function handleEmptyTrash(ctx) {
  const { env } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const { files, folderIds } = await listAllDeleted(env.DB, email);
  const keys = files.map((f) => f.r2_key).filter(Boolean);
  for (let i = 0; i < keys.length; i += 1000) {
    try { await env.STORAGE.delete(keys.slice(i, i + 1000)); } catch (e) { /* best-effort */ }
  }
  await purgeFolderTree(env.DB, email, folderIds, files.map((f) => f.id));
  audit(ctx, 'drive.trash.empty', { resourceType: 'drive', resourceId: 0, resourceName: 'Trash', metadata: { files: files.length, folders: folderIds.length } });
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
  const ext = extOf(f.name);
  const headers = {
    'Content-Type': f.content_type || mimeOf(f.name),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
  if (ext === 'svg') {
    // Usable as an <img> source, but neutralize any embedded scripts if the
    // file URL is opened as a top-level document.
    headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'";
  } else if (!INLINE.has(ext)) {
    headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(f.name)}"`;
  }
  return new Response(obj.body, { headers });
}
