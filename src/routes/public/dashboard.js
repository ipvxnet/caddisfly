// GET /dashboard — the signed-in customer's hub: all their websites + team
// management. Magic-link auth (billingAuth sets ctx.billingEmail). Not signed
// in → redirect to /billing sign-in.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectsByEmail } from '../../db/ai-projects.js';
import { getAllProjects } from '../../db/projects.js';
import { getTeamMembers, getTeamsForMember } from '../../db/teams.js';
import { getCreditState, teamLimit } from '../../utils/credits.js';

const SITES_BASE = 'caddisfly.app';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function profileName(project) {
  try {
    const p = JSON.parse(project.company_profile_json || '{}');
    if (p && p.name) return p.name;
  } catch {
    /* ignore */
  }
  return project.website_url || project.original_url || 'Untitled site';
}

// Normalize an ai_project or refactor project into one site row.
function normalizeAI(p) {
  return {
    id: p.project_id,
    name: p.project_name || 'Untitled site',
    status: p.status || 'draft',
    subdomain: p.subdomain || '',
    deployed: p.status === 'deployed',
  };
}
function normalizeRefactor(p) {
  return {
    id: p.preview_id,
    name: profileName(p),
    status: p.status || 'preview_ready',
    subdomain: p.subdomain || '',
    deployed: p.status === 'deployed',
  };
}

function statusPill(s) {
  const ok = s === 'deployed';
  return `<span class="pill ${ok ? 'ok' : ''}">${ok ? 'Live' : esc(s)}</span>`;
}

function siteCard(site) {
  const live = site.subdomain ? `https://${site.subdomain}.${SITES_BASE}` : '';
  return `
    <div class="site">
      <div class="site-main">
        <div class="site-name">${esc(site.name)} ${statusPill(site.status)}</div>
        ${live ? `<a class="site-url" href="${live}" target="_blank" rel="noopener">${esc(site.subdomain)}.${SITES_BASE}</a>` : '<span class="site-url muted">Not published yet</span>'}
      </div>
      <div class="site-actions">
        <a class="btn ghost" href="/ai-builder/customize/${esc(site.id)}">Customize</a>
        <a class="btn ghost" href="/ai-builder/analytics/${esc(site.id)}">Analytics</a>
        ${live ? `<a class="btn ghost" href="${live}" target="_blank" rel="noopener">Open ↗</a>` : ''}
      </div>
    </div>`;
}

// A single member row. `owner` is the team's owner email (passed to actions so
// an admin can manage a team they don't own). `canManage` toggles the controls.
function memberRow(m, owner, canManage, viewer) {
  const isSelf = m.member_email === viewer;
  const actions = canManage
    ? `${m.role === 'admin'
          ? `<button class="link-btn" onclick="setRole('${esc(owner)}','${esc(m.member_email)}','member')">Make member</button>`
          : `<button class="link-btn" onclick="setRole('${esc(owner)}','${esc(m.member_email)}','admin')">Make admin</button>`}
       <button class="link-btn danger" onclick="removeMember('${esc(owner)}','${esc(m.member_email)}')">${isSelf ? 'Leave' : 'Remove'}</button>`
    : '';
  return `
    <div class="member">
      <div class="m-main">
        <span class="m-email">${esc(m.member_email)}</span>
        <span class="pill ${m.role === 'admin' ? 'ok' : ''}">${esc(m.role)}</span>
        ${m.status === 'invited' ? '<span class="pill warn">invited</span>' : ''}
        ${isSelf ? '<span class="pill">you</span>' : ''}
      </div>
      <div class="m-actions">${actions}</div>
    </div>`;
}

// A full team panel: the owner (implicit admin) + members, the owner's seat
// limit, and management controls when the viewer is owner/admin of that team.
async function renderTeamPanel(env, viewer, owner, viewerRole) {
  const isOwn = owner === viewer;
  const canManage = viewerRole === 'owner' || viewerRole === 'admin';
  const members = await getTeamMembers(env.DB, owner);
  const { tier } = await getCreditState(env.DB, owner);
  const limit = teamLimit(tier);
  const seats = 1 + members.length;
  const limitTxt = limit === Infinity ? '∞' : limit;

  const ownerRow = `
    <div class="member">
      <div class="m-main">
        <span class="m-email">${esc(owner)}</span>
        <span class="pill ok">owner</span>
        ${isOwn ? '<span class="pill">you</span>' : ''}
      </div>
      <div class="m-actions"></div>
    </div>`;
  const rows = ownerRow + members.map((m) => memberRow(m, owner, canManage, viewer)).join('');

  let invite = '';
  if (canManage) {
    if (limit <= 1) {
      invite = `<p class="muted" style="margin-top:1rem">Team members are a paid feature.${isOwn ? ' <a href="/billing">Upgrade</a>' : ''} (Starter 5 · Pro 15 · Agency 50).</p>`;
    } else if (seats < limit) {
      invite = `<div class="invite">
          <input type="email" class="invite-email" placeholder="teammate@example.com">
          <button class="btn" data-owner="${esc(owner)}" onclick="invite(this)">Invite</button>
        </div>`;
    } else {
      invite = `<p class="muted" style="margin-top:.6rem">All seats are in use.${isOwn ? ' <a href="/billing">Upgrade</a> for more.' : ''}</p>`;
    }
  }

  const heading = isOwn ? 'Your team' : `Team · owned by ${esc(owner)}`;
  const youAre = isOwn ? 'owner' : esc(viewerRole);
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>${heading}</h2>
        <span class="seats">${seats} / ${limitTxt} seats</span>
      </div>
      <p class="muted">You're ${youAre === 'owner' ? 'the <strong>owner</strong> (admin)' : `${youAre === 'admin' ? 'an <strong>admin</strong>' : 'a <strong>member</strong>'}`} of this team.</p>
      <div class="members">${rows}</div>
      ${invite}
    </div>`;
}

export async function handleDashboard(ctx) {
  const { env, url } = ctx;
  const origin = url.origin;
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/dashboard');

  // Own sites.
  const [aiRows, refactorRes] = await Promise.all([
    getAIProjectsByEmail(env.DB, email),
    getAllProjects(env.DB, { customerEmail: email, limit: 200 }),
  ]);
  const ownSites = [
    ...(aiRows || []).map(normalizeAI),
    ...((refactorRes && refactorRes.projects) || []).map(normalizeRefactor),
  ];

  const creditState = await getCreditState(env.DB, email);

  // Teams the viewer can access: their OWN account (owner) + any team they've
  // joined (active membership of someone else's account).
  const joined = await getTeamsForMember(env.DB, email);
  const teamRefs = [{ owner: email, role: 'owner' }, ...joined.map((t) => ({ owner: t.owner_email, role: t.role }))];

  // One panel per team, and (for joined teams) a "shared websites" panel.
  let teamsHtml = '';
  let sharedHtml = '';
  for (const ref of teamRefs) {
    teamsHtml += await renderTeamPanel(env, email, ref.owner, ref.role);
    if (ref.owner !== email) {
      const [ai, refp] = await Promise.all([
        getAIProjectsByEmail(env.DB, ref.owner),
        getAllProjects(env.DB, { customerEmail: ref.owner, limit: 200 }),
      ]);
      const sites = [...(ai || []).map(normalizeAI), ...((refp && refp.projects) || []).map(normalizeRefactor)];
      sharedHtml += `<div class="panel"><h2>Websites shared by ${esc(ref.owner)}</h2>
        ${sites.length ? sites.map(siteCard).join('') : '<p class="muted">No websites yet.</p>'}</div>`;
    }
  }

  const inner = `
    <div class="dhead">
      <h1>Your websites</h1>
      <a class="btn ghost" href="/billing">Plan &amp; billing →</a>
    </div>
    <p class="sub">Signed in as <strong>${esc(email)}</strong> · <a class="muted-link" href="/billing/logout">Sign out</a></p>

    <div class="panel">
      ${ownSites.length
        ? ownSites.map(siteCard).join('')
        : '<p class="muted">You have no websites yet. <a href="/ai-builder">Build one →</a></p>'}
    </div>

    ${sharedHtml}
    ${teamsHtml}
  `;

  return htmlResponse(pageShell(origin, inner, { credits: creditState.totalRemaining }));
}

function pageShell(origin, inner, headerOpts = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Dashboard — Caddisfly', description: 'Your Caddisfly websites and team.', origin })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    main{min-height:60vh}
    .bwrap{max-width:860px;margin:0 auto;padding:3rem 1.5rem}
    .dhead{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .dhead h1{font-size:clamp(1.8rem,4vw,2.4rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .sub{color:var(--body);margin:.3rem 0 2rem}
    .panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem 1.6rem;margin-bottom:1.2rem}
    .panel-head{display:flex;justify-content:space-between;align-items:center}
    .panel h2{font-size:1.1rem;color:var(--ink);margin-bottom:.4rem}
    .muted{color:var(--muted)}
    .muted-link{color:var(--muted);font-size:.88rem}
    .pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.1rem .6rem;font-size:.74rem;font-weight:700;color:var(--p2);vertical-align:middle}
    .pill.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
    .pill.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
    .site{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.85rem 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
    .site:last-child{border-bottom:none}
    .site-name{font-weight:800;color:var(--ink);margin-bottom:.15rem}
    .site-url{font-size:.85rem;color:var(--p2);text-decoration:none}
    .site-url:hover{text-decoration:underline}
    .site-actions{display:flex;gap:.4rem;flex-wrap:wrap}
    .btn{display:inline-flex;align-items:center;gap:.3rem;background:var(--grad);color:#fff;border:none;border-radius:10px;padding:.5rem .9rem;font-size:.85rem;font-weight:700;cursor:pointer;text-decoration:none}
    .btn.ghost{background:#fff;color:var(--p2);border:1px solid var(--line)}
    .btn.ghost:hover{border-color:var(--p1)}
    .seats{font-size:.85rem;font-weight:700;color:var(--muted)}
    .member{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.6rem 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
    .member:last-child{border-bottom:none}
    .m-email{font-weight:700;color:var(--ink);margin-right:.4rem}
    .link-btn{background:none;border:none;color:var(--p2);cursor:pointer;font-size:.85rem;font-weight:600;padding:0 .3rem}
    .link-btn.danger{color:#b91c1c}
    .invite{display:flex;gap:.5rem;margin-top:1rem}
    .invite input{flex:1;padding:.7rem .9rem;border:1.5px solid var(--line);border-radius:11px;font-family:inherit;font-size:.95rem}
    .invite input:focus{outline:none;border-color:var(--p1)}
    @media (max-width:560px){.site,.member{align-items:flex-start}}
  </style>
</head>
<body>
  ${siteHeader('/dashboard', headerOpts)}
  <main><div class="bwrap">${inner}</div></main>
  ${siteFooter()}
  <script>
    async function postTeam(path, body) {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error((d && d.error) || 'Request failed');
      return d;
    }
    async function invite(btn) {
      const owner = btn.dataset.owner;
      const input = btn.closest('.invite').querySelector('.invite-email');
      const email = (input.value || '').trim();
      if (!email) return;
      btn.disabled = true; btn.textContent = 'Inviting…';
      try { await postTeam('/api/team/invite', { owner, email }); location.reload(); }
      catch (e) { alert(e.message); btn.disabled = false; btn.textContent = 'Invite'; }
    }
    async function setRole(owner, email, role) {
      try { await postTeam('/api/team/role', { owner, email, role }); location.reload(); }
      catch (e) { alert(e.message); }
    }
    async function removeMember(owner, email) {
      if (!confirm('Remove ' + email + ' from the team?')) return;
      try { await postTeam('/api/team/remove', { owner, email }); location.reload(); }
      catch (e) { alert(e.message); }
    }
  </script>
</body>
</html>`;
}
