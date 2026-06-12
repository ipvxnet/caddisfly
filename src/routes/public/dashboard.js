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
import { isAllowedAdmin } from '../../middleware/auth.js';
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
    lastModified: Math.max(p.updated_at || 0, p.sections_updated_at || 0, p.created_at || 0),
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
    lastModified: Math.max(p.sections_updated_at || 0, p.activated_at || 0, p.created_at || 0),
  };
}
const projectKeyFor = (site) => (site.kind === 'ai' ? { aiProjectId: site.dbId } : { projectId: site.dbId });

function statusPill(s, tr) {
  const ok = s === 'deployed';
  return `<span class="pill ${ok ? 'ok' : ''}">${ok ? tr('dash.live') : esc(s)}</span>`;
}

function siteCard(site, domainsBlock = '', tr, unread = 0, hostSuffix = '') {
  const live = site.subdomain ? `https://${site.subdomain}${hostSuffix}.${SITES_BASE}` : '';
  // Live home-page thumbnail via the same embed preview the editor uses. Projects
  // still generating have no page to show yet, so render a placeholder instead.
  const previewable = site.status !== 'conversation' && site.status !== 'content_generation';
  const thumb = previewable
    ? `<iframe class="thumb-frame" src="/ai-preview/${esc(site.id)}?embed=1" loading="lazy" scrolling="no" tabindex="-1" title="${esc(site.name)}"></iframe>`
    : `<div class="thumb-ph">${tr('dash.thumb_building')}</div>`;
  return `
    <div class="site-card">
      <div class="site-thumb">
        ${thumb}
        <a class="thumb-link" href="/ai-builder/customize/${esc(site.id)}" aria-label="${esc(site.name)}"></a>
      </div>
      <div class="site-card-body">
        <div class="site-name">${esc(site.name)} ${statusPill(site.status, tr)}</div>
        ${live ? `<a class="site-url" href="${live}" target="_blank" rel="noopener">${esc(site.subdomain)}${hostSuffix}.${SITES_BASE}</a>` : `<span class="site-url muted">${tr('dash.not_published')}</span>`}
        <div class="site-actions">
          <a class="btn ghost" href="/ai-builder/customize/${esc(site.id)}">${tr('dash.customize')}</a>
          <a class="btn ghost" href="/ai-builder/analytics/${esc(site.id)}">${tr('dash.analytics')}</a>
          <a class="btn ghost" href="/ai-builder/forms/${esc(site.id)}">${tr('dash.inbox')}${unread ? ` <span class="pill warn">${unread}</span>` : ''}</a>
          <a class="btn ghost" href="/ai-builder/blog/${esc(site.id)}">${tr('dash.blog')}</a>
          <a class="btn ghost" href="/ai-builder/store/${esc(site.id)}">${tr('dash.store')}</a>
          <a class="btn ghost" href="/ai-builder/bookings/${esc(site.id)}">${tr('dash.bookings')}</a>
          ${live ? `<a class="btn ghost" href="${live}" target="_blank" rel="noopener">${tr('dash.open')}</a>` : ''}
          ${live ? `<a class="btn ghost" href="/api/ai-builder/${esc(site.id)}/export" title="${tr('dash.export_title')}">${tr('dash.export')}</a>` : ''}
          ${live ? `<button class="btn ghost" data-id="${esc(site.id)}" data-name="${esc(site.subdomain || site.name)}" onclick="openQr(this)">${tr('dash.qr')}</button>` : ''}
          <button class="btn ghost danger" data-id="${esc(site.id)}" data-name="${esc(site.name)}" onclick="openOffboard(this)">${tr('dash.delete_site')}</button>
        </div>
        ${domainsBlock}
      </div>
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
  const isAdmin = isAllowedAdmin(env, email);

  // Own sites.
  const [aiRows, refactorRes] = await Promise.all([
    getAIProjectsByEmail(env.DB, email),
    getAllProjects(env.DB, { customerEmail: email, limit: 200 }),
  ]);
  const ownSites = [
    ...(aiRows || []).map(normalizeAI),
    ...((refactorRes && refactorRes.projects) || []).map(normalizeRefactor),
  ].sort((a, b) => b.lastModified - a.lastModified); // most-recently-worked-on first

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
      const sites = [...(ai || []).map(normalizeAI), ...((refp && refp.projects) || []).map(normalizeRefactor)]
        .sort((a, b) => b.lastModified - a.lastModified);
      sharedHtml += `<div class="panel"><h2>${tr('dash.shared_by', { owner: esc(ref.owner) })}</h2>
        ${sites.length ? `<div class="site-grid">${sites.map((s) => siteCard(s, '', tr, 0, env.SITES_PREVIEW_SUFFIX || '')).join('')}</div>` : `<p class="muted">${tr('dash.no_sites_yet')}</p>`}</div>`;
    }
  }

  const inner = `
    <div class="dhead">
      <h1>${tr('dash.title')}</h1>
      <div>
        ${isAdmin ? `<a class="btn admin" href="/admin">⚙ ${tr('dash.admin')}</a>` : ''}
        <a class="btn ghost" href="/domains">${tr('dash.buy_domain')}</a>
        <a class="btn ghost" href="/billing">${tr('dash.plan_billing')}</a>
        <a class="btn ghost" href="/billing/logout" style="color:#b91c1c">${tr('dash.sign_out')} →</a>
      </div>
    </div>
    <p class="sub">${tr('dash.signed_in_as')} <strong>${esc(email)}</strong> · <a class="muted-link" href="/activity">${tr('dash.activity')}</a> · <a class="muted-link" href="/support">${tr('dash.support')}</a> · <a class="muted-link" href="/help">${tr('dash.help')}</a></p>

    ${ownSites.some((s) => s.subdomain) ? `
    <div class="note-banner" id="republish-note" hidden>
      <span>📣 ${tr('dash.republish_note')}</span>
      <button class="note-x" aria-label="${tr('dash.dismiss')}">✕</button>
    </div>
    <script>(function(){var k='cf-republish-2026-06';var el=document.getElementById('republish-note');
      if(el&&!localStorage.getItem(k)){el.hidden=false;el.querySelector('.note-x').onclick=function(){localStorage.setItem(k,'1');el.hidden=true;};}})();</script>` : ''}

    <div class="panel">
      ${ownSites.length
        ? `<div class="site-grid">${ownCardsHtml}</div>`
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
    .bwrap{max-width:1120px;margin:0 auto;padding:3rem 1.5rem}
    .dhead{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .dhead h1{font-size:clamp(1.8rem,4vw,2.4rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .sub{color:var(--body);margin:.3rem 0 2rem}
    .note-banner{display:flex;justify-content:space-between;align-items:flex-start;gap:.8rem;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;border-radius:12px;padding:.75rem 1rem;font-size:.9rem;margin-bottom:1.2rem;line-height:1.5}
    .note-banner[hidden]{display:none}
    .note-x{background:none;border:none;color:#3730a3;cursor:pointer;font-size:.95rem;padding:0 .2rem;flex-shrink:0}
    .panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem 1.6rem;margin-bottom:1.2rem}
    .panel-head{display:flex;justify-content:space-between;align-items:center}
    .panel h2{font-size:1.1rem;color:var(--ink);margin-bottom:.4rem}
    .muted{color:var(--muted)}
    .muted-link{color:var(--muted);font-size:.88rem}
    .pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.1rem .6rem;font-size:.74rem;font-weight:700;color:var(--p2);vertical-align:middle}
    .pill.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
    .pill.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
    .site-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.1rem}
    .site-card{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;display:flex;flex-direction:column;transition:box-shadow .15s,border-color .15s}
    .site-card:hover{box-shadow:0 8px 24px rgba(118,75,162,.12);border-color:var(--p1)}
    .site-thumb{position:relative;height:172px;overflow:hidden;background:var(--soft,#f8f9fc);border-bottom:1px solid var(--line)}
    /* iframe rendered at ~3.33x then scaled down → a crisp desktop thumbnail that scales with the card */
    .site-thumb .thumb-frame{position:absolute;top:0;left:0;width:333.33%;height:333.33%;border:0;transform:scale(.3);transform-origin:0 0;pointer-events:none;background:#fff}
    .site-thumb .thumb-link{position:absolute;inset:0;z-index:2;display:block}
    .site-thumb .thumb-ph{display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:.85rem}
    .site-card-body{padding:.95rem 1.05rem;display:flex;flex-direction:column;gap:.5rem}
    .site-name{font-weight:800;color:var(--ink)}
    .site-url{font-size:.85rem;color:var(--p2);text-decoration:none}
    .site-url:hover{text-decoration:underline}
    .site-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-top:.15rem}
    .site-actions .btn{width:100%;justify-content:center;padding:.48rem .35rem;font-size:.8rem;white-space:nowrap}
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
    .btn.admin{background:#111827;color:#fff;border:1px solid #111827}
    .btn.admin:hover{background:#0b0f1a}
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
    @media (max-width:560px){.member{align-items:flex-start}}
    .btn.ghost.danger{color:#b91c1c;border-color:#fed7d7}
    .btn.ghost.danger:hover{background:#fef2f2}
    #offb-modal,#qr-modal{position:fixed;inset:0;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;padding:1rem;z-index:60}
    #offb-modal.open,#qr-modal.open{display:flex}
    .qr-card{max-width:420px;text-align:center}
    .qr-card h2{font-size:1.25rem;color:var(--ink);margin:0 0 .3rem}
    .qr-card p{color:var(--body);line-height:1.5;margin:.4rem 0 1rem}
    .qr-box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:1rem;display:inline-block;line-height:0}
    .qr-box img{width:240px;height:240px;display:block}
    .qr-acts{display:flex;justify-content:center;gap:.6rem;margin-top:1.2rem;flex-wrap:wrap}
    .offb-card{background:#fff;border-radius:16px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:1.8rem}
    .offb-card h2{font-size:1.25rem;color:var(--ink);margin:0 0 .3rem}
    .offb-step{color:var(--muted);font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.6rem}
    .offb-card p{color:var(--body);line-height:1.6;margin:.5rem 0}
    .offb-warn{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:.7rem .9rem;color:#991b1b;font-size:.9rem}
    .offb-dom{font-size:.86rem;color:#4a5568;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:.4rem .7rem;margin:.3rem 0}
    .offb-confirm{width:100%;padding:.6rem .8rem;border:1.5px solid var(--line);border-radius:9px;font:inherit;margin:.6rem 0;letter-spacing:.05em}
    .offb-check{display:flex;align-items:flex-start;gap:.5rem;font-size:.86rem;color:#4a5568;margin:.6rem 0}
    .offb-check input{margin-top:.2rem}
    .offb-acts{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1.2rem;flex-wrap:wrap}
    .offb-acts .ghost{background:none;border:1.5px solid var(--line);border-radius:10px;padding:.6rem 1.1rem;font-weight:700;cursor:pointer;color:#4a5568}
    .offb-acts .go{background:var(--grad);color:#fff;border:none;border-radius:10px;padding:.6rem 1.3rem;font-weight:800;cursor:pointer}
    .offb-acts .go.danger{background:#dc2626}
    .offb-acts .go:disabled{opacity:.5;cursor:default}
    .offb-err{color:#b91c1c;font-size:.85rem;min-height:1.1em;margin:.4rem 0 0}
    .offb-why{background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:.8rem .9rem;margin:.8rem 0}
    .offb-why-h{font-weight:700;color:var(--ink);margin:0 0 .5rem}
    .offb-radio{display:flex;align-items:center;gap:.5rem;font-size:.9rem;color:#4a5568;padding:.22rem 0;cursor:pointer}
    .offb-why textarea{margin-top:.5rem}
  </style>
</head>
<body>
  ${siteHeader('/dashboard', headerOpts)}
  <main><div class="bwrap">${inner}</div></main>
  <div id="offb-modal" onclick="if(event.target===this)offbClose()"><div class="offb-card" id="offb-card"></div></div>
  <div id="qr-modal" onclick="if(event.target===this)qrClose()"><div class="offb-card qr-card" id="qr-card"></div></div>
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

    // ---- Offboarding Wizard ----
    const OFFB_T = ${JSON.stringify({
      title: tr('offb.title'),
      step_unpub: tr('offb.step_unpub'), step_dns: tr('offb.step_dns'), step_delete: tr('offb.step_delete'),
      unpub_h: tr('offb.unpub_h'), unpub_p: tr('offb.unpub_p'), unpub_btn: tr('offb.unpub_btn'), unpub_busy: tr('offb.unpub_busy'),
      dns_h: tr('offb.dns_h'), dns_p: tr('offb.dns_p'), dns_btn: tr('offb.dns_btn'), dns_busy: tr('offb.dns_busy'),
      del_h: tr('offb.del_h'), del_warn: tr('offb.del_warn'), del_type: tr('offb.del_type'),
      del_cleanup: tr('offb.del_cleanup'), del_btn: tr('offb.del_btn'), del_busy: tr('offb.del_busy'),
      cancel: tr('offb.cancel'), err: tr('offb.err'), loading: tr('offb.loading'),
      done_h: tr('offb.done_h'), done_p: tr('offb.done_p'), close: tr('offb.close'),
      dns_persist: tr('offb.dns_persist'),
      why_h: tr('offb.why_h'), why_expensive: tr('offb.why_expensive'), why_features: tr('offb.why_features'),
      why_experiment: tr('offb.why_experiment'), why_other: tr('offb.why_other'), why_feedback_ph: tr('offb.why_feedback_ph'),
    })};
    let OFFB = { id: '', name: '' };
    function offbClose(){ document.getElementById('offb-modal').classList.remove('open'); }
    function offbEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
    async function openOffboard(btn){
      OFFB = { id: btn.dataset.id, name: btn.dataset.name || '' };
      const card = document.getElementById('offb-card');
      card.innerHTML = '<p>'+OFFB_T.loading+'</p>';
      document.getElementById('offb-modal').classList.add('open');
      await offbLoad();
    }
    async function offbLoad(){
      try {
        const r = await fetch('/api/ai-builder/'+encodeURIComponent(OFFB.id)+'/offboard');
        const d = await r.json();
        if(!r.ok || !d.success) throw new Error((d&&d.error)||OFFB_T.err);
        offbRender(d);
      } catch(e){ document.getElementById('offb-card').innerHTML = '<p class="offb-err">'+offbEsc(e.message)+'</p><div class="offb-acts"><button class="ghost" onclick="offbClose()">'+OFFB_T.close+'</button></div>'; }
    }
    function offbHeader(step){ return '<div class="offb-step">'+step+'</div><h2>'+OFFB_T.title+': '+offbEsc(OFFB.name)+'</h2>'; }
    function offbRender(d){
      const card = document.getElementById('offb-card');
      if (d.published) {
        card.innerHTML = offbHeader(OFFB_T.step_unpub)
          + '<h2 style="font-size:1.05rem">'+OFFB_T.unpub_h+'</h2><p>'+OFFB_T.unpub_p+'</p><p class="offb-err" id="offb-err"></p>'
          + '<div class="offb-acts"><button class="ghost" onclick="offbClose()">'+OFFB_T.cancel+'</button>'
          + '<button class="go" id="offb-go" onclick="offbUnpublish(this)">'+OFFB_T.unpub_btn+'</button></div>';
        return;
      }
      if (d.domains && d.domains.length) {
        card.innerHTML = offbHeader(OFFB_T.step_dns)
          + '<h2 style="font-size:1.05rem">'+OFFB_T.dns_h+'</h2><p>'+OFFB_T.dns_p+'</p>'
          + d.domains.map(function(x){ return '<div class="offb-dom">'+offbEsc(x.hostname)+'</div>'; }).join('')
          + '<p class="offb-err" id="offb-err"></p>'
          + '<div class="offb-acts"><button class="ghost" onclick="offbClose()">'+OFFB_T.cancel+'</button>'
          + '<button class="go" id="offb-go" onclick="offbDisconnect(this)" data-doms=\\''+JSON.stringify(d.domains.map(function(x){return x.id;}))+'\\'>'+OFFB_T.dns_btn+'</button></div>';
        return;
      }
      // Final delete step.
      var cleanup = d.has_bought_dns
        ? '<p>'+OFFB_T.dns_persist+'</p><label class="offb-check"><input type="checkbox" id="offb-cleanup"> <span>'+OFFB_T.del_cleanup+'</span></label>'
        : '';
      var why = '<div class="offb-why"><p class="offb-why-h">'+OFFB_T.why_h+'</p>'
        + ['expensive','features','experiment','other'].map(function(k){
            return '<label class="offb-radio"><input type="radio" name="offbwhy" value="'+k+'" onchange="offbWhy()"> '+OFFB_T['why_'+k]+'</label>'; }).join('')
        + '<textarea id="offb-feedback" class="offb-confirm" hidden rows="2" placeholder="'+OFFB_T.why_feedback_ph+'"></textarea></div>';
      card.innerHTML = offbHeader(OFFB_T.step_delete)
        + '<h2 style="font-size:1.05rem">'+OFFB_T.del_h+'</h2>'
        + '<p class="offb-warn">'+OFFB_T.del_warn+'</p>'
        + why
        + '<p>'+OFFB_T.del_type+'</p>'
        + '<input class="offb-confirm" id="offb-confirm" placeholder="DELETE" oninput="offbCheck()" autocomplete="off">'
        + cleanup
        + '<p class="offb-err" id="offb-err"></p>'
        + '<div class="offb-acts"><button class="ghost" onclick="offbClose()">'+OFFB_T.cancel+'</button>'
        + '<button class="go danger" id="offb-go" disabled onclick="offbDelete(this)">'+OFFB_T.del_btn+'</button></div>';
    }
    function offbCheck(){
      var v = (document.getElementById('offb-confirm').value||'').trim().toUpperCase();
      document.getElementById('offb-go').disabled = v !== 'DELETE';
    }
    function offbWhy(){
      var sel = document.querySelector('input[name=offbwhy]:checked');
      var fb = document.getElementById('offb-feedback');
      if (fb) fb.hidden = !(sel && sel.value === 'other');
    }
    function offbErr(m){ var e=document.getElementById('offb-err'); if(e) e.textContent = m; }
    async function offbUnpublish(btn){
      btn.disabled = true; btn.textContent = OFFB_T.unpub_busy;
      try { var r = await fetch('/api/ai-builder/'+encodeURIComponent(OFFB.id)+'/unpublish',{method:'POST'}); var d = await r.json();
        if(!r.ok||!d.success) throw new Error((d&&d.error)||OFFB_T.err); await offbLoad(); }
      catch(e){ offbErr(e.message); btn.disabled=false; btn.textContent=OFFB_T.unpub_btn; }
    }
    async function offbDisconnect(btn){
      var ids = []; try { ids = JSON.parse(btn.dataset.doms); } catch(_){}
      btn.disabled = true; btn.textContent = OFFB_T.dns_busy;
      try {
        for (var i=0;i<ids.length;i++){
          var r = await fetch('/api/ai-builder/'+encodeURIComponent(OFFB.id)+'/domains/'+ids[i],{method:'DELETE'});
          var d = await r.json().catch(function(){return {};});
          if(!r.ok||!d.success) throw new Error((d&&d.error)||OFFB_T.err);
        }
        await offbLoad();
      } catch(e){ offbErr(e.message); btn.disabled=false; btn.textContent=OFFB_T.dns_btn; }
    }
    async function offbDelete(btn){
      var cleanupEl = document.getElementById('offb-cleanup');
      var whyEl = document.querySelector('input[name=offbwhy]:checked');
      var fbEl = document.getElementById('offb-feedback');
      btn.disabled = true; btn.textContent = OFFB_T.del_busy;
      try {
        var r = await fetch('/api/ai-builder/'+encodeURIComponent(OFFB.id)+'/delete',{
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            confirm: document.getElementById('offb-confirm').value.trim(),
            cleanup_dns: !!(cleanupEl && cleanupEl.checked),
            reason: whyEl ? whyEl.value : '',
            feedback: fbEl ? (fbEl.value||'').trim() : ''
          })
        });
        var d = await r.json();
        if(!r.ok||!d.success) throw new Error((d&&d.error)||OFFB_T.err);
        document.getElementById('offb-card').innerHTML = '<h2>'+OFFB_T.done_h+'</h2><p>'+OFFB_T.done_p+'</p><div class="offb-acts"><button class="go" onclick="location.reload()">'+OFFB_T.close+'</button></div>';
      } catch(e){ offbErr(e.message); btn.disabled=false; btn.textContent=OFFB_T.del_btn; }
    }

    // ---- QR code ----
    const QR_T = ${JSON.stringify({
      title: tr('dash.qr_title'), sub: tr('dash.qr_sub'),
      png: tr('dash.qr_png'), svg: tr('dash.qr_svg'), close: tr('dash.qr_close'), err: tr('dash.qr_err'),
    })};
    let QR = { id: '', name: '' };
    function qrClose(){ document.getElementById('qr-modal').classList.remove('open'); }
    function openQr(btn){
      QR = { id: btn.dataset.id, name: (btn.dataset.name || 'site').replace(/[^a-z0-9.-]/gi,'-') };
      const src = '/api/ai-builder/'+encodeURIComponent(QR.id)+'/qr';
      document.getElementById('qr-card').innerHTML =
        '<h2>'+QR_T.title+'</h2><p>'+QR_T.sub+'</p>'
        + '<div class="qr-box"><img id="qr-img" alt="QR code" src="'+src+'" onerror="qrErr()"></div>'
        + '<div class="qr-acts">'
        + '<button class="btn" onclick="qrDownloadPng()">'+QR_T.png+'</button>'
        + '<a class="btn ghost" href="'+src+'?download=svg" download>'+QR_T.svg+'</a>'
        + '<button class="btn ghost" onclick="qrClose()">'+QR_T.close+'</button>'
        + '</div>';
      document.getElementById('qr-modal').classList.add('open');
    }
    function qrErr(){ document.getElementById('qr-card').innerHTML = '<h2>'+QR_T.title+'</h2><p class="offb-err">'+QR_T.err+'</p><div class="qr-acts"><button class="btn ghost" onclick="qrClose()">'+QR_T.close+'</button></div>'; }
    function qrDownloadPng(){
      const img = document.getElementById('qr-img');
      if (!img || !img.complete || !img.naturalWidth) return;
      const S = 1024, c = document.createElement('canvas'); c.width = S; c.height = S;
      const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0,0,S,S); x.drawImage(img,0,0,S,S);
      c.toBlob(function(b){
        if(!b) return;
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = QR.name+'-qr.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
      }, 'image/png');
    }
  </script>
</body>
</html>`;
}
