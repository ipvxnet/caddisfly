// /admin/leads — Caddisfly's outbound-sales CRM. Lists prospect businesses
// (from the lead-gen script via the ingest endpoint), with a 5-stage pipeline,
// filters, manual add, and per-lead status/notes/promo. The ingest endpoint is
// token-authorized (LEADS_INGEST_TOKEN) so a script can plug data back in.

import { htmlResponse } from '../../utils/response.js';
import { renderAdminNav, ADMIN_NAV_CSS } from './nav.js';
import {
  bulkInsertLeads, listLeads, leadStats, leadFacets, updateLead, deleteLead, addManualLead, LEAD_STATUSES,
  leadsNeedingEmail, setLeadEmails,
} from '../../db/leads.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
const STATUS_LABEL = { new: 'New', contacted: 'Contacted', interested: 'Interested', won: 'Won', lost: 'Lost' };

// ---- token auth (script ingest) -------------------------------------------
function ingestTokenOk(ctx) {
  const tok = (ctx.request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const expected = (ctx.env && ctx.env.LEADS_INGEST_TOKEN) || '';
  return !!expected && tok.length > 20 && tok === expected;
}

/** POST /api/admin/leads/ingest — { leads:[{business,website,phone,email,address,area,vertical,place_id,rating,has_site}] } */
export async function handleLeadsIngest(ctx) {
  if (!ingestTokenOk(ctx)) return json({ success: false, error: 'Unauthorized' }, 401);
  const body = await ctx.request.json().catch(() => ({}));
  const leads = Array.isArray(body.leads) ? body.leads : (Array.isArray(body) ? body : []);
  if (!leads.length) return json({ success: false, error: 'No leads provided' }, 400);
  const r = await bulkInsertLeads(ctx.env.DB, leads);
  return json({ success: true, ...r });
}

/** GET /api/admin/leads/need-email?limit=N — token-auth work-list for the
 *  enrich (2nd-pass) email scrape: leads with a website but no email yet. */
export async function handleLeadsNeedEmail(ctx) {
  if (!ingestTokenOk(ctx)) return json({ success: false, error: 'Unauthorized' }, 401);
  const limit = parseInt(ctx.url.searchParams.get('limit'), 10) || 500;
  const leads = await leadsNeedingEmail(ctx.env.DB, limit);
  return json({ success: true, leads });
}

/** POST /api/admin/leads/enrich — token-auth; { updates:[{id,email}] }. Fills
 *  emails the enrich pass scraped (only where still empty). */
export async function handleLeadsEnrich(ctx) {
  if (!ingestTokenOk(ctx)) return json({ success: false, error: 'Unauthorized' }, 401);
  const body = await ctx.request.json().catch(() => ({}));
  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (!updates.length) return json({ success: false, error: 'No updates provided' }, 400);
  const updated = await setLeadEmails(ctx.env.DB, updates);
  return json({ success: true, updated, received: updates.length });
}

// ---- admin UI (session + admin gated in index.js) -------------------------
export async function handleAdminLeads(ctx) {
  const { env, url } = ctx;
  const q = url.searchParams;
  const filt = {
    status: q.get('status') || '',
    vertical: q.get('vertical') || '',
    area: q.get('area') || '',
    has_site: q.get('has_site') === '0' ? 0 : q.get('has_site') === '1' ? 1 : undefined,
    q: q.get('q') || '',
    limit: 800,
  };
  const [leads, stats, facets] = await Promise.all([listLeads(env.DB, filt), leadStats(env.DB), leadFacets(env.DB)]);
  const nav = await renderAdminNav(ctx, '/admin/leads');

  const pill = (k, label) => `<a class="lstat${filt.status === k ? ' on' : ''}" href="?status=${k}">${label}<b>${stats['s_' + k] || 0}</b></a>`;
  const opt = (v, sel, label) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(label || v || 'All')}</option>`;

  const rows = leads.map((l) => {
    const statusOpts = LEAD_STATUSES.map((s) => `<option value="${s}"${l.status === s ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`).join('');
    const site = l.website
      ? `<a href="${esc(l.website)}" target="_blank" rel="noopener" class="l-link">site ↗</a>`
      : `<span class="l-nosite">no site ★</span>`;
    return `<tr data-id="${l.id}">
      <td><div class="l-biz">${esc(l.business)}${l.rating ? ` <span class="l-rate">★${l.rating}</span>` : ''}</div>
          <div class="l-addr">${esc(l.address || '')}</div></td>
      <td>${site}</td>
      <td>${l.phone ? `<a href="tel:${esc(l.phone)}" class="l-link">${esc(l.phone)}</a>` : '—'}</td>
      <td>${l.email ? `<a href="mailto:${esc(l.email)}" class="l-link">${esc(l.email)}</a>` : '—'}</td>
      <td class="l-meta">${esc(l.vertical || '')}<br><span class="l-addr">${esc(l.area || '')}</span></td>
      <td><select class="l-status">${statusOpts}</select></td>
      <td><input class="l-promo" value="${esc(l.promo_code)}" placeholder="code" size="9"></td>
      <td><input class="l-notes" value="${esc(l.notes)}" placeholder="notes…"></td>
      <td><button class="lbtn" onclick="save(this)">Save</button> <button class="lbtn del" onclick="del(this)">✕</button></td>
    </tr>`;
  }).join('');

  const inner = `
  <div class="lwrap">
    <div class="lhead">
      <h1>📇 Leads <span class="muted">— outbound CRM</span></h1>
      <button class="lbtn primary" onclick="toggleAdd()">＋ Add lead</button>
    </div>
    <div class="lstats">
      <span class="lstat${!filt.status ? ' on' : ''}"><a href="?" style="all:unset;cursor:pointer">All<b>${stats.total || 0}</b></a></span>
      ${pill('new', 'New')}${pill('contacted', 'Contacted')}${pill('interested', 'Interested')}${pill('won', 'Won')}${pill('lost', 'Lost')}
      <span class="lstat ghost">No site<b>${stats.no_site || 0}</b></span>
      <span class="lstat ghost">Has email<b>${stats.with_email || 0}</b></span>
    </div>

    <form class="lfilters" method="get">
      <input name="q" value="${esc(filt.q)}" placeholder="Search business / site / email / phone…">
      <select name="vertical">${opt('', filt.vertical, 'All verticals')}${facets.verticals.map((v) => opt(v, filt.vertical)).join('')}</select>
      <select name="area">${opt('', filt.area, 'All areas')}${facets.areas.map((a) => opt(a, filt.area)).join('')}</select>
      <select name="has_site">${opt('', filt.has_site == null ? '' : String(filt.has_site), 'Site: any')}<option value="0"${filt.has_site === 0 ? ' selected' : ''}>No site only ★</option><option value="1"${filt.has_site === 1 ? ' selected' : ''}>Has a site</option></select>
      <button class="lbtn" type="submit">Filter</button>
    </form>

    <form class="laddform" id="laddform">
      <input id="a-biz" placeholder="Business (required)"><input id="a-web" placeholder="Website"><input id="a-phone" placeholder="Phone">
      <input id="a-email" placeholder="Email"><input id="a-area" placeholder="Area"><input id="a-vert" placeholder="Vertical">
      <button class="lbtn primary" type="button" onclick="addLead(this)">Add</button>
    </form>

    ${leads.length ? `<div class="ltablewrap"><table class="ltable">
      <thead><tr><th>Business</th><th>Site</th><th>Phone</th><th>Email</th><th>Vertical / area</th><th>Status</th><th>Promo</th><th>Notes</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : `<div class="lempty">No leads yet — run the lead-gen script or add one above.</div>`}
    <div id="lmsg"></div>
  </div>
  <script>
    async function api(method, path, body){
      var r = await fetch('/api/admin/leads' + path, { method:method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined });
      var d = await r.json().catch(function(){return {};});
      if(!r.ok || d.success===false) throw new Error((d&&d.error)||'Failed');
      return d;
    }
    function toggleAdd(){ var f=document.getElementById('laddform'); f.style.display = f.style.display==='flex'?'none':'flex'; if(f.style.display==='flex') document.getElementById('a-biz').focus(); }
    async function save(btn){
      var tr=btn.closest('tr'); var id=tr.getAttribute('data-id');
      btn.disabled=true; var t=btn.textContent; btn.textContent='…';
      try { await api('PUT','/'+id,{ status:tr.querySelector('.l-status').value, promo_code:tr.querySelector('.l-promo').value, notes:tr.querySelector('.l-notes').value }); btn.textContent='✓'; }
      catch(e){ btn.textContent='err'; alert(e.message); }
      setTimeout(function(){ btn.disabled=false; btn.textContent=t; }, 1200);
    }
    async function del(btn){
      if(!confirm('Delete this lead?')) return;
      var tr=btn.closest('tr');
      try { await api('DELETE','/'+tr.getAttribute('data-id')); tr.remove(); } catch(e){ alert(e.message); }
    }
    async function addLead(btn){
      var biz=document.getElementById('a-biz').value.trim(); if(!biz){ document.getElementById('a-biz').focus(); return; }
      btn.disabled=true;
      try { await api('POST','',{ business:biz, website:document.getElementById('a-web').value.trim(), phone:document.getElementById('a-phone').value.trim(), email:document.getElementById('a-email').value.trim(), area:document.getElementById('a-area').value.trim(), vertical:document.getElementById('a-vert').value.trim() }); location.reload(); }
      catch(e){ alert(e.message); btn.disabled=false; }
    }
  </script>`;

  return htmlResponse(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leads · Admin · Caddisfly</title><meta name="robots" content="noindex"><style>
  ${ADMIN_NAV_CSS}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#2d3748}
  .lwrap{max-width:1240px;margin:0 auto;padding:1.6rem 1.4rem}
  .lhead{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
  .lhead h1{font-size:1.4rem;font-weight:800;margin:0}.muted{color:#a0aec0;font-weight:500;font-size:.9rem}
  .lstats{display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0}
  .lstat{display:inline-flex;align-items:center;gap:.4rem;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.4rem .7rem;font-size:.82rem;font-weight:700;color:#4a5568;text-decoration:none}
  .lstat b{background:#eef2ff;color:#3730a3;border-radius:6px;padding:0 .4rem}.lstat.on{border-color:#7c3aed;color:#5a3da8}.lstat.ghost{color:#94a3b8}.lstat a{text-decoration:none;color:inherit}
  .lfilters,.laddform{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
  .laddform{display:none}
  .lfilters input,.lfilters select,.laddform input,.l-status,.l-promo,.l-notes{padding:.45rem .55rem;border:1.5px solid #e2e8f0;border-radius:9px;font-family:inherit;font-size:.85rem;background:#fff}
  .lfilters input{min-width:240px;flex:1}
  .lbtn{padding:.45rem .7rem;border:1.5px solid #e2e8f0;border-radius:9px;background:#fff;font-weight:700;font-size:.82rem;cursor:pointer;color:#4a5568}
  .lbtn.primary{background:#5a3da8;color:#fff;border-color:#5a3da8}.lbtn.del{color:#b91c1c;padding:.45rem .55rem}
  .ltablewrap{overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px}
  .ltable{width:100%;border-collapse:collapse;font-size:.84rem}
  .ltable th{text-align:left;padding:.6rem .7rem;color:#94a3b8;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e2e8f0}
  .ltable td{padding:.55rem .7rem;border-bottom:1px solid #edf2f7;vertical-align:top}
  .l-biz{font-weight:700;color:#1a202c}.l-addr{color:#a0aec0;font-size:.76rem;max-width:220px}.l-rate{color:#d69e2e;font-weight:700}
  .l-link{color:#5a3da8;text-decoration:none;font-weight:600}.l-nosite{color:#15803d;font-weight:800;font-size:.78rem;background:#dcfce7;border-radius:6px;padding:.1rem .4rem;white-space:nowrap}
  .l-notes{width:100%;min-width:150px}.l-meta{color:#4a5568;font-size:.8rem}
  .lempty{text-align:center;color:#94a3b8;border:2px dashed #e2e8f0;border-radius:14px;padding:3rem 1.5rem;background:#fff}
  </style></head><body>${nav}${inner}</body></html>`);
}

/** PUT /api/admin/leads/:id — status/notes/promo */
export async function handleLeadUpdate(ctx) {
  const id = parseInt(ctx.params.id, 10);
  const body = await ctx.request.json().catch(() => ({}));
  const updated = await updateLead(ctx.env.DB, id, { status: body.status, notes: body.notes, promo_code: body.promo_code, email: body.email });
  if (!updated) return json({ success: false, error: 'No change' }, 400);
  return json({ success: true });
}

/** DELETE /api/admin/leads/:id */
export async function handleLeadDelete(ctx) {
  await deleteLead(ctx.env.DB, parseInt(ctx.params.id, 10));
  return json({ success: true });
}

/** POST /api/admin/leads — add one by hand */
export async function handleLeadAdd(ctx) {
  const body = await ctx.request.json().catch(() => ({}));
  try {
    const lead = await addManualLead(ctx.env.DB, body);
    return json({ success: true, lead }, 201);
  } catch (e) {
    if (e.message === 'business_required') return json({ success: false, error: 'Business name is required' }, 400);
    throw e;
  }
}
