// GET /dashboard — the signed-in customer's hub: all their websites + team
// management. Magic-link auth (billingAuth sets ctx.billingEmail). Not signed
// in → redirect to /billing sign-in.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectsByEmail } from '../../db/ai-projects.js';
import { getAllProjects } from '../../db/projects.js';
import { getTeamMembers, getTeamsForMember } from '../../db/teams.js';
import { getCreditState, teamLimit } from '../../utils/credits.js';
import { getDomainsByProject } from '../../db/custom-domains.js';
import { countUnread } from '../../db/form-submissions.js';
import { isSaaSConfigured } from '../../utils/cloudflare-saas.js';
import { renderDomainsPanel, DOMAINS_CSS, domainsJs } from '../../components/domains-panel.js';
import { translator } from '../../i18n/index.js';

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

// Normalize an ai_project or refactor project into one site row. dbId + kind
// let us load custom domains (projectKey is {aiProjectId} XOR {projectId}).
function normalizeAI(p) {
  return {
    id: p.project_id,
    dbId: p.id,
    kind: 'ai',
    name: p.project_name || 'Untitled site',
    status: p.status || 'draft',
    subdomain: p.subdomain || '',
    deployed: p.status === 'deployed',
  };
}
function normalizeRefactor(p) {
  return {
    id: p.preview_id,
    dbId: p.id,
    kind: 'refactor',
    name: profileName(p),
    status: p.status || 'preview_ready',
    subdomain: p.subdomain || '',
    deployed: p.status === 'deployed',
  };
}
const projectKeyFor = (site) => (site.kind === 'ai' ? { aiProjectId: site.dbId } : { projectId: site.dbId });

function statusPill(s, tr) {
  const ok = s === 'deployed';
  return `<span class="pill ${ok ? 'ok' : ''}">${ok ? tr('dash.live') : esc(s)}</span>`;
}

function siteCard(site, domainsBlock = '', tr, unread = 0, hostSuffix = '') {
  const live = site.subdomain ? `https://${site.subdomain}${hostSuffix}.${SITES_BASE}` : '';
  return `
    <div class="site">
      <div class="site-top">
        <div class="site-main">
          <div class="site-name">${esc(site.name)} ${statusPill(site.status, tr)}</div>
          ${live ? `<a class="site-url" href="${live}" target="_blank" rel="noopener">${esc(site.subdomain)}${hostSuffix}.${SITES_BASE}</a>` : `<span class="site-url muted">${tr('dash.not_published')}</span>`}
        </div>
        <div class="site-actions">
          <a class="btn ghost" href="/ai-builder/customize/${esc(site.id)}">${tr('dash.customize')}</a>
          <a class="btn ghost" href="/ai-builder/analytics/${esc(site.id)}">${tr('dash.analytics')}</a>
          <a class="btn ghost" href="/ai-builder/forms/${esc(site.id)}">${tr('dash.inbox')}${unread ? ` <span class="pill warn">${unread}</span>` : ''}</a>
          <a class="btn ghost" href="/ai-builder/blog/${esc(site.id)}">${tr('dash.blog')}</a>
          ${live ? `<a class="btn ghost" href="${live}" target="_blank" rel="noopener">${tr('dash.open')}</a>` : ''}
          ${live ? `<a class="btn ghost" href="/api/ai-builder/${esc(site.id)}/export" title="${tr('dash.export_title')}">${tr('dash.export')}</a>` : ''}
        </div>
      </div>
      ${domainsBlock}
    </div>`;
}

// A single member row. `owner` is the team's owner email (passed to actions so
// an admin can manage a team they don't own). `canManage` toggles the controls.
const ROLES = ['member', 'publisher', 'admin'];

function memberRow(m, owner, canManage, viewer, tr) {
  const isSelf = m.member_email === viewer;
  const roleCtl = canManage
    ? `<select class="role-select" onchange="setRole('${esc(owner)}','${esc(m.member_email)}', this.value)">
         ${ROLES.map((r) => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${tr('dash.role_' + r)}</option>`).join('')}
       </select>`
    : `<span class="pill ${m.role === 'admin' ? 'ok' : ''}">${tr('dash.role_' + m.role)}</span>`;
  return `
    <div class="member">
      <div class="m-main">
        <span class="m-email">${esc(m.member_email)}</span>
        ${roleCtl}
        ${m.status === 'invited' ? `<span class="pill warn">${tr('dash.invited')}</span>` : ''}
        ${isSelf ? `<span class="pill">${tr('dash.you')}</span>` : ''}
      </div>
      <div class="m-actions">
        ${canManage ? `<button class="link-btn danger" onclick="removeMember('${esc(owner)}','${esc(m.member_email)}')">${isSelf ? tr('dash.leave') : tr('dash.remove')}</button>` : ''}
      </div>
    </div>`;
}

// A full team panel: the owner (implicit admin) + members, the owner's seat
// limit, and management controls when the viewer is owner/admin of that team.
async function renderTeamPanel(env, viewer, owner, viewerRole, tr) {
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
        <span class="pill ok">${tr('dash.role_owner')}</span>
        ${isOwn ? `<span class="pill">${tr('dash.you')}</span>` : ''}
      </div>
      <div class="m-actions"></div>
    </div>`;
  const rows = ownerRow + members.map((m) => memberRow(m, owner, canManage, viewer, tr)).join('');

  let invite = '';
  if (canManage) {
    if (limit <= 1) {
      invite = `<p class="muted" style="margin-top:1rem">${tr('dash.paid_feature')}${isOwn ? ` <a href="/billing">${tr('dash.upgrade')}</a>` : ''} ${tr('dash.seat_caps')}</p>`;
    } else if (seats < limit) {
      invite = `<div class="invite">
          <input type="email" class="invite-email" placeholder="${tr('dash.invite_ph')}">
          <select class="invite-role" title="Role">${ROLES.map((r) => `<option value="${r}">${tr('dash.role_' + r)}</option>`).join('')}</select>
          <button class="btn" data-owner="${esc(owner)}" onclick="invite(this)">${tr('dash.invite_btn')}</button>
        </div>`;
    } else {
      invite = `<p class="muted" style="margin-top:.6rem">${tr('dash.seats_full')}${isOwn ? ` <a href="/billing">${tr('dash.upgrade')}</a> ${tr('dash.upgrade_more')}` : ''}</p>`;
    }
  }

  const heading = isOwn ? tr('dash.your_team') : tr('dash.team_owned_by', { owner: esc(owner) });
  const youAre = isOwn ? 'owner' : viewerRole;
  const whoLine = youAre === 'owner' ? tr('dash.you_are_owner') : youAre === 'admin' ? tr('dash.you_are_admin') : tr('dash.you_are_member');
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>${heading}</h2>
        <span class="seats">${tr('dash.seats', { seats, limit: limitTxt })}</span>
      </div>
      <p class="muted">${whoLine}</p>
      <div class="members">${rows}</div>
      ${invite}
      ${canManage ? `<p class="muted role-legend">${tr('dash.roles_legend')}</p>` : ''}
    </div>`;
}

export async function handleDashboard(ctx) {
  const { env, url } = ctx;
  const origin = url.origin;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
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

  // Each own site gets a collapsible custom-domain manager (published sites
  // only — a domain needs a subdomain to point at).
  const saasOn = isSaaSConfigured(env);
  const sitesBase = env.SITES_BASE || SITES_BASE;
  const ownCards = await Promise.all(
    ownSites.map(async (s) => {
      let block = '';
      if (s.subdomain) {
        const ds = await getDomainsByProject(env.DB, projectKeyFor(s));
        const badge = ds.length ? ` <span class="pill ${ds.some((d) => d.status === 'active') ? 'ok' : 'warn'}">${ds.length}</span>` : '';
        block = `<details class="site-domains"><summary>🌐 ${tr('dash.custom_domain')}${badge}</summary>
          ${renderDomainsPanel({ projectId: s.id, domains: ds, subdomain: s.subdomain, saasOn, sitesBase, lang })}</details>`;
      }
      const unread = await countUnread(env.DB, s.id);
      return siteCard(s, block, tr, unread, env.SITES_PREVIEW_SUFFIX || '');
    })
  );
  const ownCardsHtml = ownCards.join('');

  const creditState = await getCreditState(env.DB, email);

  // Teams the viewer can access: their OWN account (owner) + any team they've
  // joined (active membership of someone else's account).
  const joined = await getTeamsForMember(env.DB, email);
  const teamRefs = [{ owner: email, role: 'owner' }, ...joined.map((t) => ({ owner: t.owner_email, role: t.role }))];

  // One panel per team, and (for joined teams) a "shared websites" panel.
  let teamsHtml = '';
  let sharedHtml = '';
  for (const ref of teamRefs) {
    teamsHtml += await renderTeamPanel(env, email, ref.owner, ref.role, tr);
    if (ref.owner !== email) {
      const [ai, refp] = await Promise.all([
        getAIProjectsByEmail(env.DB, ref.owner),
        getAllProjects(env.DB, { customerEmail: ref.owner, limit: 200 }),
      ]);
      const sites = [...(ai || []).map(normalizeAI), ...((refp && refp.projects) || []).map(normalizeRefactor)];
      sharedHtml += `<div class="panel"><h2>${tr('dash.shared_by', { owner: esc(ref.owner) })}</h2>
        ${sites.length ? sites.map((s) => siteCard(s, '', tr, 0, env.SITES_PREVIEW_SUFFIX || '')).join('') : `<p class="muted">${tr('dash.no_sites_yet')}</p>`}</div>`;
    }
  }

  const inner = `
    <div class="dhead">
      <h1>${tr('dash.title')}</h1>
      <a class="btn ghost" href="/billing">${tr('dash.plan_billing')}</a>
    </div>
    <p class="sub">${tr('dash.signed_in_as')} <strong>${esc(email)}</strong> · <a class="muted-link" href="/support">${tr('dash.support')}</a> · <a class="muted-link" href="/help">${tr('dash.help')}</a> · <a class="muted-link" href="/billing/logout">${tr('dash.sign_out')}</a></p>

    <div class="panel">
      ${ownSites.length
        ? ownCardsHtml
        : `<p class="muted">${tr('dash.no_sites')} <a href="/ai-builder">${tr('dash.build_one')}</a></p>`}
    </div>

    ${sharedHtml}
    ${teamsHtml}
  `;

  return htmlResponse(pageShell(origin, inner, { credits: creditState.totalRemaining, lang }, tr));
}

function pageShell(origin, inner, headerOpts = {}, tr = (k) => k) {
  const lang = headerOpts.lang || 'en';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('dash.meta_title'), description: 'Your Caddisfly websites and team.', origin, path: '/dashboard' })}
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
    .site{padding:.85rem 0;border-bottom:1px solid var(--line)}
    .site:last-child{border-bottom:none}
    .site-top{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .site-name{font-weight:800;color:var(--ink);margin-bottom:.15rem}
    .site-url{font-size:.85rem;color:var(--p2);text-decoration:none}
    .site-url:hover{text-decoration:underline}
    .site-actions{display:flex;gap:.4rem;flex-wrap:wrap}
    .site-domains{margin-top:.7rem;background:var(--soft,#f8f9fc);border:1px solid var(--line);border-radius:10px;padding:.6rem .8rem}
    .site-domains > summary{cursor:pointer;font-size:.85rem;font-weight:700;color:var(--p2);list-style:none}
    .site-domains > summary::-webkit-details-marker{display:none}
    .site-domains > summary::before{content:'▸ ';color:#a0aec0}
    .site-domains[open] > summary::before{content:'▾ '}
    .site-domains[open] > summary{margin-bottom:.6rem}
    ${DOMAINS_CSS}
    .btn{display:inline-flex;align-items:center;gap:.3rem;background:var(--grad);color:#fff;border:none;border-radius:10px;padding:.5rem .9rem;font-size:.85rem;font-weight:700;cursor:pointer;text-decoration:none}
    .btn.ghost{background:#fff;color:var(--p2);border:1px solid var(--line)}
    .btn.ghost:hover{border-color:var(--p1)}
    .seats{font-size:.85rem;font-weight:700;color:var(--muted)}
    .member{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.6rem 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
    .member:last-child{border-bottom:none}
    .m-email{font-weight:700;color:var(--ink);margin-right:.4rem}
    .link-btn{background:none;border:none;color:var(--p2);cursor:pointer;font-size:.85rem;font-weight:600;padding:0 .3rem}
    .link-btn.danger{color:#b91c1c}
    .invite{display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap}
    .invite input{flex:1;min-width:160px;padding:.7rem .9rem;border:1.5px solid var(--line);border-radius:11px;font-family:inherit;font-size:.95rem}
    .invite input:focus{outline:none;border-color:var(--p1)}
    .invite-role,.role-select{padding:.5rem .6rem;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;font-size:.85rem;background:#fff;text-transform:capitalize;cursor:pointer}
    .role-legend{font-size:.78rem;margin-top:.7rem}
    @media (max-width:560px){.site-top,.member{align-items:flex-start}}
  </style>
</head>
<body>
  ${siteHeader('/dashboard', headerOpts)}
  <main><div class="bwrap">${inner}</div></main>
  ${siteFooter({ lang })}
  <script>
    async function postTeam(path, body) {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error((d && d.error) || 'Request failed');
      return d;
    }
    async function invite(btn) {
      const owner = btn.dataset.owner;
      const wrap = btn.closest('.invite');
      const input = wrap.querySelector('.invite-email');
      const roleSel = wrap.querySelector('.invite-role');
      const email = (input.value || '').trim();
      const role = roleSel ? roleSel.value : 'member';
      if (!email) return;
      btn.disabled = true; btn.textContent = ${JSON.stringify(tr('dash.inviting'))};
      try { await postTeam('/api/team/invite', { owner, email, role }); location.reload(); }
      catch (e) { alert(e.message); btn.disabled = false; btn.textContent = ${JSON.stringify(tr('dash.invite_btn'))}; }
    }
    async function setRole(owner, email, role) {
      try { await postTeam('/api/team/role', { owner, email, role }); location.reload(); }
      catch (e) { alert(e.message); }
    }
    async function removeMember(owner, email) {
      if (!confirm(${JSON.stringify(tr('dash.remove_confirm', { email: '%E%' }))}.replace('%E%', email))) return;
      try { await postTeam('/api/team/remove', { owner, email }); location.reload(); }
      catch (e) { alert(e.message); }
    }
    ${domainsJs(lang)}
  </script>
</body>
</html>`;
}
