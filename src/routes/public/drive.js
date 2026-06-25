// Drive — account-level file storage. Upload site assets to R2, see usage vs the
// plan quota, copy public links to use in sites. Files served from /drive/f/:token
// (unguessable). Owner-scoped via billingAuth (ctx.billingEmail). See db/drive.js.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getDriveUsage, listDriveFiles, addDriveFile, deleteDriveFile, getDriveFileByToken } from '../../db/drive.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { DRIVE_LIMITS, DRIVE_MAX_FILE } from '../../utils/credits.js';
import { generateToken } from '../../utils/crypto.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

// Allowed upload types: ext → { mime, inline }. Anything not here is rejected
// (blocks active content: html/js/svg/etc.). Inline types serve in-browser;
// others download as an attachment.
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
    usage: '{used} of {total} used', upload_btn: 'Upload files', uploading: 'Uploading…', drop_hint: 'Drag files here, or click to choose',
    empty: 'No files yet — upload your first asset above.', th_file: 'File', th_size: 'Size', th_added: 'Added',
    copy: 'Copy link', copied: 'Copied ✓', del: 'Delete', del_confirm: 'Delete this file? Links to it will stop working.',
    err: 'Something went wrong.', err_size: 'File too large — the limit is 50 MB.', err_type: "That file type isn't allowed.", err_quota: 'Not enough space. Delete some files or upgrade your plan.',
  },
  es: {
    meta_title: 'Drive — Caddisfly', title: 'Drive', back: '← Dashboard',
    sub: 'Sube imágenes, PDF y archivos para usarlos en tus sitios. Almacenados en tu propio espacio — no es necesario compartirlos a través de Google Drive.',
    usage: '{used} de {total} utilizado', upload_btn: 'Subir archivos', uploading: 'Subiendo…', drop_hint: 'Arrastra archivos aquí o haz clic para elegir',
    empty: 'No hay archivos aún — sube tu primer activo arriba.', th_file: 'Archivo', th_size: 'Tamaño', th_added: 'Añadido',
    copy: 'Copiar enlace', copied: 'Copiado ✓', del: 'Eliminar', del_confirm: '¿Eliminar este archivo? Los enlaces a él dejarán de funcionar.',
    err: 'Algo salió mal.', err_size: 'Archivo demasiado grande — el límite es 50 MB.', err_type: 'Ese tipo de archivo no está permitido.', err_quota: 'No hay suficiente espacio. Elimina algunos archivos o actualiza tu plan.',
  },
  pt: {
    meta_title: 'Drive — Caddisfly', title: 'Drive', back: '← Dashboard',
    sub: 'Faça o upload de imagens, PDFs e arquivos para usar em seus sites. Armazenados no seu próprio espaço — não é necessário compartilhar via Google Drive.',
    usage: '{used} de {total} usado', upload_btn: 'Carregar arquivos', uploading: 'Carregando…', drop_hint: 'Arraste arquivos aqui ou clique para escolher',
    empty: 'Nenhum arquivo ainda — carregue seu primeiro ativo acima.', th_file: 'Arquivo', th_size: 'Tamanho', th_added: 'Adicionado',
    copy: 'Copiar link', copied: 'Copiado ✓', del: 'Excluir', del_confirm: 'Excluir este arquivo? Os links para ele deixarão de funcionar.',
    err: 'Algo deu errado.', err_size: 'Arquivo muito grande — o limite é 50 MB.', err_type: 'Esse tipo de arquivo não é permitido.', err_quota: 'Espaço insuficiente. Exclua alguns arquivos ou atualize seu plano.',
  },
};
const pick = (lang) => DRV[lang] || DRV.en;

/** GET /drive — the Drive page. */
export async function handleDrive(ctx) {
  const { env, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/drive', 302);

  const tier = await getUserTier(env.DB, email);
  const limit = DRIVE_LIMITS[tier] != null ? DRIVE_LIMITS[tier] : DRIVE_LIMITS.free_trial;
  const { used } = await getDriveUsage(env.DB, email);
  const files = await listDriveFiles(env.DB, email);
  const pctRaw = limit > 0 ? (used / limit) * 100 : 0;
  const pct = Math.min(100, Math.round(pctRaw));
  const barCls = pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok';

  const rows = files.map((f) => `<tr>
      <td><a href="/drive/f/${esc(f.token)}" target="_blank" rel="noopener" title="${esc(f.name)}">${esc(f.name)}</a></td>
      <td class="muted">${fmtBytes(f.size)}</td>
      <td class="muted">${esc((f.created_at ? new Date(f.created_at * 1000).toISOString().slice(0, 10) : ''))}</td>
      <td class="dr-acts">
        <button class="link-btn dr-copy" data-url="${esc(url.origin)}/drive/f/${esc(f.token)}">${T.copy}</button>
        <button class="link-btn danger dr-del" data-id="${f.id}">${T.del}</button>
      </td></tr>`).join('');

  const inner = `
    <div class="dr-head"><h1>🗂 ${T.title}</h1><a class="btn ghost" href="/dashboard">${T.back}</a></div>
    <p class="sub">${T.sub}</p>
    <div class="dr-usage">
      <div class="dr-bar"><div class="dr-fill ${barCls}" style="width:${pct}%"></div></div>
      <div class="dr-ulabel">${T.usage.replace('{used}', fmtBytes(used)).replace('{total}', fmtBytes(limit))} · ${pct}%</div>
    </div>
    <div class="dr-drop" id="dr-drop">
      <input type="file" id="dr-input" multiple hidden>
      <p>${T.drop_hint}</p>
      <button class="btn" type="button" id="dr-pick">${T.upload_btn}</button>
      <span id="dr-msg" class="muted"></span>
    </div>
    ${files.length
      ? `<div class="dr-twrap"><table class="dr-table"><thead><tr><th>${T.th_file}</th><th>${T.th_size}</th><th>${T.th_added}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="dr-empty">${T.empty}</div>`}
    <script>
      var MAX = ${DRIVE_MAX_FILE};
      var S = ${JSON.stringify({ uploading: T.uploading, err: T.err, errSize: T.err_size, errType: T.err_type, errQuota: T.err_quota, copy: T.copy, copied: T.copied, delConfirm: T.del_confirm })};
      var input = document.getElementById('dr-input'), drop = document.getElementById('dr-drop'), msg = document.getElementById('dr-msg');
      document.getElementById('dr-pick').addEventListener('click', function(){ input.click(); });
      input.addEventListener('change', function(){ uploadAll(input.files); });
      ['dragover','dragenter'].forEach(function(e){ drop.addEventListener(e, function(ev){ ev.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave','drop'].forEach(function(e){ drop.addEventListener(e, function(ev){ ev.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function(ev){ if(ev.dataTransfer && ev.dataTransfer.files) uploadAll(ev.dataTransfer.files); });
      async function uploadAll(list){
        var files = Array.prototype.slice.call(list || []);
        if(!files.length) return;
        for(var i=0;i<files.length;i++){
          var f = files[i];
          if(f.size > MAX){ msg.textContent = S.errSize; continue; }
          msg.textContent = S.uploading + ' (' + (i+1) + '/' + files.length + ')';
          try{
            var res = await fetch('/api/drive/upload?name=' + encodeURIComponent(f.name), { method:'POST', headers:{ 'Content-Type': f.type || 'application/octet-stream' }, body: f });
            var d = await res.json();
            if(!res.ok || !d.success){ msg.textContent = (d && d.error) || S.err; return; }
          }catch(e){ msg.textContent = S.err; return; }
        }
        location.reload();
      }
      document.querySelectorAll('.dr-copy').forEach(function(b){ b.addEventListener('click', function(){
        navigator.clipboard.writeText(b.dataset.url).then(function(){ var t=b.textContent; b.textContent=S.copied; setTimeout(function(){ b.textContent=t; },1400); });
      }); });
      document.querySelectorAll('.dr-del').forEach(function(b){ b.addEventListener('click', async function(){
        if(!confirm(S.delConfirm)) return; b.disabled=true;
        try{ var res=await fetch('/api/drive/'+b.dataset.id,{method:'DELETE'}); var d=await res.json(); if(res.ok&&d.success){ location.reload(); return; } alert((d&&d.error)||S.err); b.disabled=false; }
        catch(e){ alert(S.err); b.disabled=false; }
      }); });
    </script>`;

  return htmlResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: 'Your file storage.', origin: url.origin, path: '/drive' })}<meta name="robots" content="noindex">
  <style>${baseCss()}
    main{min-height:60vh}.drwrap{max-width:880px;margin:0 auto;padding:2.4rem 1.5rem}
    .dr-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .dr-head h1{font-size:clamp(1.5rem,3.5vw,2rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);margin:.3rem 0 1.2rem}.muted{color:var(--muted)}
    .dr-usage{margin-bottom:1.2rem}
    .dr-bar{height:10px;background:#eef2f7;border-radius:999px;overflow:hidden}
    .dr-fill{height:100%;border-radius:999px;transition:width .3s}.dr-fill.ok{background:#10b981}.dr-fill.warn{background:#f59e0b}.dr-fill.bad{background:#ef4444}
    .dr-ulabel{font-size:.82rem;color:var(--muted);margin-top:.4rem}
    .dr-drop{border:2px dashed var(--line);border-radius:14px;padding:1.6rem;text-align:center;margin-bottom:1.4rem;background:#fafbfc}
    .dr-drop.over{border-color:var(--p1);background:#eef2ff}.dr-drop p{color:var(--muted);margin:0 0 .7rem}
    .dr-twrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
    .dr-table{width:100%;border-collapse:collapse;font-size:.9rem}
    .dr-table th{text-align:left;padding:.6rem .8rem;color:var(--muted);font-size:.72rem;text-transform:uppercase;border-bottom:1px solid var(--line)}
    .dr-table td{padding:.55rem .8rem;border-bottom:1px solid var(--line);vertical-align:middle}
    .dr-table tr:last-child td{border-bottom:none}.dr-table a{color:var(--p2);text-decoration:none;font-weight:600}
    .dr-acts{white-space:nowrap;text-align:right}
    .link-btn{background:none;border:none;color:var(--p2);cursor:pointer;font-size:.82rem;font-weight:600;padding:0 .35rem}.link-btn.danger{color:#b91c1c}
    .dr-empty{text-align:center;color:var(--muted);border:2px dashed var(--line);border-radius:14px;padding:2.5rem 1.5rem}
  </style></head><body>${siteHeader('/dashboard', {})}<main><div class="drwrap">${inner}</div></main>${siteFooter({ lang })}</body></html>`);
}

/** POST /api/drive/upload?name=<filename> — raw file body → R2 + ledger. */
export async function handleDriveUpload(ctx) {
  const { env, request, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const T = pick(lang);
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);

  const name = (url.searchParams.get('name') || 'file').slice(0, 255);
  const ext = extOf(name);
  const type = TYPES[ext];
  if (!type) return json({ success: false, error: T.err_type }, 415);

  // Early size reject via Content-Length, then buffer (≤50 MB) for the exact size.
  const claimed = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (Number.isFinite(claimed) && claimed > DRIVE_MAX_FILE) return json({ success: false, error: T.err_size }, 413);
  const buf = await request.arrayBuffer();
  const size = buf.byteLength;
  if (size > DRIVE_MAX_FILE) return json({ success: false, error: T.err_size }, 413);
  if (size === 0) return json({ success: false, error: T.err }, 400);

  const tier = await getUserTier(env.DB, email);
  const limit = DRIVE_LIMITS[tier] != null ? DRIVE_LIMITS[tier] : DRIVE_LIMITS.free_trial;
  const { used } = await getDriveUsage(env.DB, email);
  if (used + size > limit) return json({ success: false, error: T.err_quota }, 413);

  const token = generateToken(16);
  const r2_key = `drive/${token}`;
  await env.STORAGE.put(r2_key, buf, { httpMetadata: { contentType: type.mime } });
  await addDriveFile(env.DB, email, { token, name, r2_key, size, content_type: type.mime });
  return json({ success: true, token, url: `${url.origin}/drive/f/${token}`, size });
}

/** DELETE /api/drive/:id — remove a file (owner-scoped). */
export async function handleDriveDelete(ctx) {
  const { env, params } = ctx;
  const email = ctx.billingEmail;
  if (!email) return json({ success: false, error: 'Please sign in.' }, 401);
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ success: false, error: 'Invalid id' }, 400);
  const key = await deleteDriveFile(env.DB, email, id);
  if (!key) return json({ success: false, error: 'Not found' }, 404);
  await env.STORAGE.delete(key).catch(() => {});
  return json({ success: true });
}

/** GET /drive/f/:token — serve a file publicly (token is the unguessable auth). */
export async function handleDriveFile(ctx) {
  const { env, params } = ctx;
  const f = await getDriveFileByToken(env.DB, params.token);
  if (!f) return new Response('Not found', { status: 404 });
  const obj = await env.STORAGE.get(f.r2_key);
  if (!obj) return new Response('Not found', { status: 404 });
  const ext = extOf(f.name);
  const inline = TYPES[ext] ? TYPES[ext].inline : false;
  const headers = {
    'Content-Type': f.content_type || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
  if (!inline) headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(f.name)}"`;
  return new Response(obj.body, { headers });
}
