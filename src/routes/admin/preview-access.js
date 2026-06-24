// /admin/preview-access — manage the PREVIEW publish allowlist (full emails or
// domains). Gates publishing on the preview worker only. Admin-gated. Plain
// server-rendered forms (no inline JS). See db/preview-allowlist.js.

import { htmlResponse, redirect } from '../../utils/response.js';
import { renderAdminNav, ADMIN_NAV_CSS } from './nav.js';
import { listPreviewAllowlist, addPreviewAllowlistEntry, removePreviewAllowlistEntry } from '../../db/preview-allowlist.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** GET + POST /admin/preview-access */
export async function handlePreviewAccess(ctx) {
  const { env, request } = ctx;
  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    if (form) {
      const action = form.get('action');
      if (action === 'add') { try { await addPreviewAllowlistEntry(env.DB, form.get('entry')); } catch { /* ignore bad entry */ } }
      else if (action === 'remove') { await removePreviewAllowlistEntry(env.DB, Number(form.get('id'))); }
    }
    return redirect('/admin/preview-access', 303);
  }

  const nav = await renderAdminNav(ctx, '/admin/preview-access');
  const entries = await listPreviewAllowlist(env.DB);
  const isPreview = env.ENVIRONMENT === 'preview';

  const rows = entries.length
    ? entries.map((e) => `<tr>
        <td><code>${esc(e.entry)}</code>${e.entry.startsWith('@') || !e.entry.includes('@') ? ' <span class="tag">domain</span>' : ''}</td>
        <td class="r"><form method="POST" style="display:inline"><input type="hidden" name="action" value="remove"><input type="hidden" name="id" value="${e.id}">
          <button class="pbtn del" type="submit">Remove</button></form></td></tr>`).join('')
    : `<tr><td colspan="2" class="muted">No entries — nobody can publish on preview.</td></tr>`;

  const inner = `
  <div class="pwrap">
    <div class="phead"><h1>🔒 Preview access</h1></div>
    <div class="pnotice ${isPreview ? 'on' : 'off'}">
      ${isPreview
        ? 'You are on the <strong>PREVIEW</strong> environment — only these emails/domains can publish sites here.'
        : 'This is <strong>PRODUCTION</strong> — this allowlist does nothing here. It only gates publishing on the preview worker.'}
    </div>
    <p class="muted">An entry is a full email (<code>you@example.com</code>) or a domain (<code>@live.com</code> = anyone on that domain).</p>
    <form method="POST" class="paddform">
      <input type="hidden" name="action" value="add">
      <input name="entry" type="text" placeholder="email@example.com  or  @domain.com" required>
      <button class="pbtn primary" type="submit">Add</button>
    </form>
    <table class="ptable"><thead><tr><th>Allowed email / domain</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;

  return htmlResponse(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview access · Admin · Caddisfly</title><meta name="robots" content="noindex"><style>
  ${ADMIN_NAV_CSS}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#2d3748}
  .pwrap{max-width:760px;margin:0 auto;padding:1.6rem 1.4rem}
  .phead h1{font-size:1.4rem;font-weight:800;margin:0 0 1rem}
  .pnotice{border-radius:12px;padding:.8rem 1rem;font-size:.9rem;margin-bottom:1rem}
  .pnotice.on{background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3}
  .pnotice.off{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}
  .muted{color:#94a3b8;font-size:.85rem;margin:.4rem 0 1rem}.muted code,td code{background:#eef2ff;color:#3730a3;padding:.05rem .35rem;border-radius:5px;font-size:.85em}
  .paddform{display:flex;gap:.5rem;margin-bottom:1.2rem}
  .paddform input{flex:1;padding:.55rem .7rem;border:1.5px solid #e2e8f0;border-radius:9px;font-family:inherit;font-size:.9rem}
  .pbtn{padding:.55rem .9rem;border:1.5px solid #e2e8f0;border-radius:9px;background:#fff;font-weight:700;font-size:.85rem;cursor:pointer;color:#4a5568}
  .pbtn.primary{background:#5a3da8;color:#fff;border-color:#5a3da8}.pbtn.del{color:#b91c1c}
  .ptable{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
  .ptable th{text-align:left;padding:.6rem .8rem;color:#94a3b8;font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e2e8f0}
  .ptable td{padding:.6rem .8rem;border-bottom:1px solid #edf2f7}.ptable tr:last-child td{border-bottom:none}.ptable .r{text-align:right}
  .tag{background:#f1f5f9;color:#64748b;border-radius:6px;padding:.05rem .4rem;font-size:.72rem;font-weight:700}
  </style></head><body>${nav}${inner}</body></html>`);
}
