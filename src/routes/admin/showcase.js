// /admin/showcase — curate the public /showcase showroom. Gated by
// [authMiddleware, adminMiddleware]. Add deployed sites, toggle featured/enabled,
// set order, remove. Self-contained admin page (noindex), like /admin/tickets.

import { htmlResponse } from '../../utils/response.js';
import { getAIProjectsByStatus, getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getAllProjects, getProjectByPreviewId } from '../../db/projects.js';
import { listShowcase, getShowcaseByPublicId, createShowcase, updateShowcase, deleteShowcase } from '../../db/showcase.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function refactorName(p) {
  try { const j = JSON.parse(p.company_profile_json || '{}'); if (j && j.name) return j.name; } catch { /* ignore */ }
  return p.website_url || p.original_url || 'Untitled site';
}

export async function handleAdminShowcase(ctx) {
  const { env } = ctx;
  const entries = await listShowcase(env.DB, {});
  const have = new Set(entries.map((e) => e.project_public_id));

  const [aiDeployed, refRes] = await Promise.all([
    getAIProjectsByStatus(env.DB, 'deployed'),
    getAllProjects(env.DB, { status: 'deployed', limit: 200 }),
  ]);
  const candidates = [
    ...(aiDeployed || []).map((p) => ({ pid: p.project_id, name: p.project_name || 'Untitled', subdomain: p.subdomain || '' })),
    ...(((refRes && refRes.projects) || [])).map((p) => ({ pid: p.preview_id, name: refactorName(p), subdomain: p.subdomain || '' })),
  ].filter((c) => c.subdomain && !have.has(c.pid));

  const rows = entries.length
    ? entries.map((e) => `
      <tr data-id="${e.id}">
        <td><input class="f-order" type="number" value="${e.sort_order}" style="width:64px"></td>
        <td class="title"><input class="f-title" value="${esc(e.title)}"></td>
        <td><input class="f-cat" value="${esc(e.category)}" placeholder="category" style="width:120px"></td>
        <td><code>${esc(e.subdomain)}</code></td>
        <td style="text-align:center"><input class="f-featured" type="checkbox" ${e.featured ? 'checked' : ''}></td>
        <td style="text-align:center"><input class="f-enabled" type="checkbox" ${e.enabled ? 'checked' : ''}></td>
        <td class="acts">
          <button onclick="saveRow(this)">Save</button>
          <button class="danger" onclick="delRow(this)">Remove</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="muted">No showcase entries yet — add a deployed site below.</td></tr>`;

  const options = candidates.length
    ? candidates.map((c) => `<option value="${esc(c.pid)}" data-name="${esc(c.name)}">${esc(c.name)} — ${esc(c.subdomain)}</option>`).join('')
    : '<option value="">(no deployed sites available)</option>';

  const inner = `
    <div class="thead"><h2>📣 Showcase</h2><a class="back" href="/admin">← Admin</a></div>
    <p class="muted">Curate the public <a href="/showcase" target="_blank">/showcase</a> page. Featured entries rotate in the top carousel; order sorts the grid (lowest first).</p>

    <table>
      <thead><tr><th>Order</th><th>Title</th><th>Category</th><th>Site</th><th>Featured</th><th>Live</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="card">
      <h3 style="margin-bottom:.8rem">Add a deployed site</h3>
      <label>Site</label>
      <select id="a-pid" onchange="prefill()">${options}</select>
      <div class="grid2">
        <div><label>Title</label><input id="a-title" placeholder="Shown on the card"></div>
        <div><label>Category</label><input id="a-cat" placeholder="e.g. Restaurant, Auto, Services"></div>
      </div>
      <label>Blurb (optional)</label>
      <textarea id="a-blurb" rows="2" placeholder="One line about the site"></textarea>
      <label class="chk"><input id="a-featured" type="checkbox"> Feature in the top carousel</label>
      <button class="primary" onclick="addEntry(this)">Add to showcase</button>
      <p class="err" id="a-err"></p>
    </div>

    <script>
      function prefill(){ var s=document.getElementById('a-pid'); var o=s.options[s.selectedIndex]; var t=document.getElementById('a-title'); if(o && !t.value) t.value=o.getAttribute('data-name')||''; }
      prefill();
      async function api(method, path, body){
        var r = await fetch(path, { method:method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined });
        var d = await r.json().catch(function(){return {};});
        if(!r.ok || !d.success) throw new Error((d&&d.error)||'Request failed');
        return d;
      }
      async function addEntry(btn){
        var err=document.getElementById('a-err'); err.textContent='';
        var pid=document.getElementById('a-pid').value;
        if(!pid){ err.textContent='Pick a site.'; return; }
        btn.disabled=true;
        try{
          await api('POST','/api/admin/showcase',{ project_id:pid, title:document.getElementById('a-title').value.trim(), category:document.getElementById('a-cat').value.trim(), blurb:document.getElementById('a-blurb').value.trim(), featured:document.getElementById('a-featured').checked });
          location.reload();
        }catch(e){ err.textContent=e.message; btn.disabled=false; }
      }
      async function saveRow(btn){
        var tr=btn.closest('tr'); btn.disabled=true; var was=btn.textContent; btn.textContent='Saving…';
        try{
          await api('POST','/api/admin/showcase/'+tr.dataset.id,{ title:tr.querySelector('.f-title').value.trim(), category:tr.querySelector('.f-cat').value.trim(), sort_order:parseInt(tr.querySelector('.f-order').value,10)||0, featured:tr.querySelector('.f-featured').checked?1:0, enabled:tr.querySelector('.f-enabled').checked?1:0 });
          btn.textContent='Saved ✓'; setTimeout(function(){btn.textContent=was;btn.disabled=false;},1200);
        }catch(e){ alert(e.message); btn.textContent=was; btn.disabled=false; }
      }
      async function delRow(btn){
        if(!confirm('Remove this from the showcase?')) return;
        var tr=btn.closest('tr');
        try{ await api('DELETE','/api/admin/showcase/'+tr.dataset.id); tr.remove(); }catch(e){ alert(e.message); }
      }
    </script>`;
  return htmlResponse(page(inner));
}

/** POST /api/admin/showcase — add a deployed site. */
export async function handleAdminShowcaseAdd(ctx) {
  const { env, request } = ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const pid = (body.project_id || '').toString().trim();
    if (!pid) return json({ success: false, error: 'Pick a site.' }, 400);
    if (await getShowcaseByPublicId(env.DB, pid)) return json({ success: false, error: 'That site is already in the showcase.' }, 400);

    let kind = 'ai', subdomain = '', name = '';
    const ai = await getAIProjectByProjectId(env.DB, pid);
    if (ai) { subdomain = ai.subdomain || ''; name = ai.project_name || 'Untitled'; }
    else {
      const rp = await getProjectByPreviewId(env.DB, pid);
      if (!rp) return json({ success: false, error: 'Site not found.' }, 404);
      kind = 'refactor'; subdomain = rp.subdomain || ''; name = refactorName(rp);
    }
    if (!subdomain) return json({ success: false, error: 'That site is not published yet (no live address).' }, 400);

    const entry = await createShowcase(env.DB, {
      project_public_id: pid, kind, subdomain,
      title: (body.title || name || 'Untitled').toString().trim().slice(0, 120),
      category: (body.category || '').toString().trim().slice(0, 60),
      blurb: (body.blurb || '').toString().trim().slice(0, 240),
      featured: !!body.featured,
      sort_order: 0,
    });
    return json({ success: true, entry });
  } catch (e) {
    console.error('showcase add error:', e);
    return json({ success: false, error: 'Could not add the site.' }, 500);
  }
}

/** POST /api/admin/showcase/:id — update fields. */
export async function handleAdminShowcaseUpdate(ctx) {
  const { env, request, params } = ctx;
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json().catch(() => ({}));
    const updates = {};
    if (body.title != null) updates.title = body.title.toString().trim().slice(0, 120) || 'Untitled';
    if (body.category != null) updates.category = body.category.toString().trim().slice(0, 60);
    if (body.blurb != null) updates.blurb = body.blurb.toString().trim().slice(0, 240);
    if (body.featured != null) updates.featured = body.featured ? 1 : 0;
    if (body.enabled != null) updates.enabled = body.enabled ? 1 : 0;
    if (body.sort_order != null) updates.sort_order = parseInt(body.sort_order, 10) || 0;
    const entry = await updateShowcase(env.DB, id, updates);
    if (!entry) return json({ success: false, error: 'Not found' }, 404);
    return json({ success: true, entry });
  } catch (e) {
    console.error('showcase update error:', e);
    return json({ success: false, error: 'Could not save.' }, 500);
  }
}

/** DELETE /api/admin/showcase/:id — remove. */
export async function handleAdminShowcaseDelete(ctx) {
  const { env, params } = ctx;
  const ok = await deleteShowcase(env.DB, parseInt(params.id, 10));
  return ok ? json({ success: true }) : json({ success: false, error: 'Not found' }, 404);
}

function page(inner) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex"><title>Showcase · Caddisfly Admin</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#1a202c}
  .wrap{max-width:1040px;margin:0 auto;padding:2rem 1.5rem}
  .thead{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.6rem;flex-wrap:wrap}
  h2{font-size:1.3rem}h3{font-size:1.05rem}
  a,.back{color:#5a3da8;text-decoration:none}
  .muted{color:#a0aec0}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-size:.86rem;margin:1rem 0}
  th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #edf2f7;vertical-align:middle}
  th{color:#718096;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em}
  td code{font-size:.8rem;color:#4a5568}
  input,select,textarea{font:inherit;padding:.45rem .6rem;border:1px solid #cbd5e0;border-radius:8px;background:#fff}
  td input[type=text],td .f-title,td .f-cat{width:100%}
  .acts button{font:inherit;font-weight:700;padding:.4rem .7rem;border-radius:8px;border:1px solid #cbd5e0;background:#fff;cursor:pointer;margin-right:.3rem}
  .acts button.danger{color:#b91c1c;border-color:#fecaca}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.2rem;margin-top:1rem}
  .card label{display:block;font-weight:700;margin:.7rem 0 .3rem}
  .card .chk{display:flex;align-items:center;gap:.5rem;font-weight:600}
  .card select,.card input[type=text],.card input:not([type]),.card textarea{width:100%;box-sizing:border-box}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  .card button.primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;font-weight:800;padding:.6rem 1.1rem;border-radius:9px;cursor:pointer;margin-top:1rem}
  .err{color:#b91c1c;font-size:.85rem;margin-top:.5rem;min-height:1em}
  @media (max-width:640px){.grid2{grid-template-columns:1fr}}
</style></head>
<body><div class="wrap">${inner}</div></body></html>`;
}
