// GET /ai-builder/blog/:project_id — the owner's blog manager: AI-draft a post
// from a few sentences, edit, publish/unpublish, delete, and generate the
// social pack (X/Instagram/LinkedIn variants + share intents — no OAuth, no
// platform APIs; the customer clicks a prefilled share link).

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { getPostsByProject } from '../../db/blog-posts.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(ts, lang) {
  if (!ts) return '';
  try {
    return new Date(ts * 1000).toLocaleDateString(lang, { dateStyle: 'medium' });
  } catch {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }
}

export async function handleBlogManager(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const publicId = params.project_id;

  // Resolve the project (ai-first) for name + live subdomain (social links).
  const aiProject = await getAIProjectByProjectId(env.DB, publicId);
  let name, projectKey, subdomain, deployed;
  if (aiProject) {
    name = aiProject.project_name || 'Your Website';
    projectKey = { aiProjectId: aiProject.id };
    subdomain = aiProject.subdomain || '';
    deployed = aiProject.status === 'deployed';
  } else {
    const rp = await getProjectByPreviewId(env.DB, publicId);
    if (!rp) return new Response('Project not found', { status: 404 });
    try {
      const p = JSON.parse(rp.company_profile_json || '{}');
      name = (p && p.name) || rp.website_url || 'Your Website';
    } catch { name = rp.website_url || 'Your Website'; }
    projectKey = { projectId: rp.id };
    subdomain = rp.subdomain || '';
    deployed = rp.status === 'deployed';
  }

  const posts = await getPostsByProject(env.DB, projectKey);
  const sitesBase = env.SITES_BASE || 'caddisfly.app';
  const liveBase = subdomain ? `https://${subdomain}.${sitesBase}` : '';

  const postCard = (p) => {
    const isPub = p.status === 'published';
    return `
    <div class="post" data-id="${p.id}" data-slug="${esc(p.slug)}">
      <div class="post-top">
        <div class="post-main">
          <div class="post-title">${esc(p.title)} <span class="pill ${isPub ? 'ok' : ''}">${isPub ? tr('blogm.st_published') : tr('blogm.st_draft')}</span></div>
          <div class="post-meta">${isPub && p.published_at ? `${tr('blogm.published_on')} ${fmtDate(p.published_at, lang)}` : `${tr('blogm.updated_on')} ${fmtDate(p.updated_at || p.created_at, lang)}`}</div>
        </div>
        <div class="post-actions">
          <a class="btn ghost" href="/ai-preview/${esc(publicId)}/blog/${esc(p.slug)}" target="_blank" rel="noopener">${tr('blogm.preview')}</a>
          <button class="btn ghost" onclick="toggleEdit(${p.id})">${tr('blogm.edit')}</button>
          <button class="btn ghost" onclick="togglePublish(${p.id}, ${isPub ? 'false' : 'true'})">${isPub ? tr('blogm.unpublish') : tr('blogm.publish')}</button>
          <button class="btn ghost" onclick="loadSocial(${p.id}, this)">${tr('blogm.social')}</button>
          <button class="link-btn danger" onclick="delPost(${p.id})">${tr('blogm.delete')}</button>
        </div>
      </div>
      <div class="post-edit" id="edit-${p.id}" style="display:none">
        <label>${tr('blogm.title_label')}</label>
        <input class="f-title" value="${esc(p.title)}" maxlength="200">
        <label>${tr('blogm.excerpt_label')}</label>
        <input class="f-excerpt" value="${esc(p.excerpt || '')}" maxlength="300">
        <label>${tr('blogm.cover_label')}</label>
        <input class="f-cover" value="${esc(p.cover_image || '')}" placeholder="${tr('blogm.cover_ph')}" maxlength="500">
        <label>${tr('blogm.content_label')} <span class="hint">${tr('blogm.content_hint')}</span></label>
        <textarea class="f-content" rows="14">${esc(p.content || '')}</textarea>
        <div class="seo-row">
          <div><label>${tr('blogm.seo_title_label')}</label><input class="f-seo-title" value="${esc(p.seo_title || '')}" maxlength="120"></div>
          <div><label>${tr('blogm.seo_desc_label')}</label><input class="f-seo-desc" value="${esc(p.seo_description || '')}" maxlength="200"></div>
        </div>
        <div class="edit-actions">
          <button class="btn" onclick="savePost(${p.id}, this)">${tr('blogm.save')}</button>
          <button class="btn ghost" onclick="toggleEdit(${p.id})">${tr('blogm.cancel')}</button>
        </div>
      </div>
      <div class="post-social" id="social-${p.id}" style="display:none"></div>
    </div>`;
  };

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('blogm.meta_title', { name: esc(name) }), description: 'Manage your site blog.', origin: url.origin })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    .awrap{max-width:860px;margin:0 auto;padding:2.5rem 1.5rem 4rem}
    .ahead{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1.4rem}
    .ahead h1{font-size:clamp(1.6rem,3.5vw,2.2rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .ahead .sub{color:var(--muted);font-size:.92rem}
    .ahead .acts{display:flex;gap:.5rem;flex-wrap:wrap}
    .panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem 1.6rem;margin-bottom:1.2rem}
    .panel h2{font-size:1.05rem;color:var(--ink);margin-bottom:.6rem}
    .muted{color:var(--muted);font-size:.88rem}
    label{display:block;font-size:.8rem;font-weight:700;color:var(--ink);margin:.8rem 0 .3rem;text-transform:uppercase;letter-spacing:.03em}
    label .hint{font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted)}
    input,textarea{width:100%;box-sizing:border-box;padding:.7rem .9rem;border:1.5px solid var(--line);border-radius:11px;font-family:inherit;font-size:.95rem}
    input:focus,textarea:focus{outline:none;border-color:var(--p1)}
    textarea{resize:vertical;line-height:1.55}
    .btn{display:inline-flex;align-items:center;gap:.3rem;background:var(--grad);color:#fff;border:none;border-radius:10px;padding:.5rem .9rem;font-size:.85rem;font-weight:700;cursor:pointer;text-decoration:none}
    .btn.ghost{background:#fff;color:var(--p2);border:1px solid var(--line)}
    .btn.ghost:hover{border-color:var(--p1)}
    .btn:disabled{opacity:.6;cursor:default}
    .link-btn{background:none;border:none;color:var(--p2);cursor:pointer;font-size:.85rem;font-weight:600;padding:0 .3rem}
    .link-btn.danger{color:#b91c1c}
    .pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:.1rem .6rem;font-size:.72rem;font-weight:700;color:var(--p2);vertical-align:middle}
    .pill.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
    .post{padding:1rem 0;border-bottom:1px solid var(--line)}
    .post:last-child{border-bottom:none}
    .post-top{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}
    .post-title{font-weight:800;color:var(--ink)}
    .post-meta{color:var(--muted);font-size:.82rem;margin-top:.2rem}
    .post-actions{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}
    .post-edit{background:var(--soft,#f8f9fc);border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem 1.2rem;margin-top:.9rem}
    .seo-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
    .edit-actions{display:flex;gap:.6rem;margin-top:1rem}
    .post-social{background:var(--soft,#f8f9fc);border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem;margin-top:.9rem}
    .soc{margin-bottom:1rem}
    .soc h4{font-size:.85rem;color:var(--ink);margin-bottom:.35rem}
    .soc pre{white-space:pre-wrap;background:#fff;border:1px solid var(--line);border-radius:9px;padding:.7rem .9rem;font-family:inherit;font-size:.9rem;color:var(--body);margin-bottom:.4rem}
    .soc .soc-acts{display:flex;gap:.5rem;flex-wrap:wrap}
    .brief-actions{display:flex;gap:.6rem;align-items:center;margin-top:.8rem;flex-wrap:wrap}
    .republish{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:.7rem 1rem;font-size:.88rem;margin-bottom:1.2rem;display:none}
    @media (max-width:640px){.seo-row{grid-template-columns:1fr}}
  </style>
</head>
<body>
  ${siteHeader('', { lang })}
  <main><div class="awrap">
    <div class="ahead">
      <div>
        <h1>📝 ${esc(name)}</h1>
        <div class="sub">${tr('blogm.title_sub')}</div>
      </div>
      <div class="acts">
        <a class="btn ghost" href="/ai-builder/customize/${esc(publicId)}">${tr('blogm.customize')}</a>
        <a class="btn" href="/ai-preview/${esc(publicId)}/blog" target="_blank" rel="noopener">${tr('blogm.view_blog')}</a>
      </div>
    </div>

    <div class="republish" id="republish">${tr('blogm.republish_note')} <a href="/ai-builder/customize/${esc(publicId)}">${tr('blogm.republish_link')}</a></div>

    <div class="panel">
      <h2>${tr('blogm.new_post')}</h2>
      <p class="muted">${tr('blogm.brief_intro')}</p>
      <label>${tr('blogm.brief_label')}</label>
      <textarea id="brief" rows="3" placeholder="${tr('blogm.brief_ph')}"></textarea>
      <div class="brief-actions">
        <button class="btn" id="draft-btn" onclick="draftAI(this)">${tr('blogm.draft_ai')}</button>
        <span class="muted">${tr('blogm.credits_note')}</span>
      </div>
    </div>

    <div class="panel">
      <h2>${tr('blogm.posts_heading')} (${posts.length})</h2>
      ${posts.length ? posts.map(postCard).join('') : `<p class="muted">${tr('blogm.no_posts')}</p>`}
    </div>
  </div></main>
  ${siteFooter({ lang })}
  <script>
    var PID = ${JSON.stringify(publicId)};
    var LIVE_BASE = ${JSON.stringify(liveBase)};
    var DEPLOYED = ${deployed ? 'true' : 'false'};
    async function api(method, path, body) {
      const r = await fetch('/api/ai-builder/' + PID + '/blog' + path, {
        method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error((d && d.error) || 'Request failed');
      return d;
    }
    async function draftAI(btn) {
      const brief = document.getElementById('brief').value.trim();
      if (brief.length < 10) { alert(${JSON.stringify(tr('blogm.brief_short'))}); return; }
      btn.disabled = true; btn.textContent = ${JSON.stringify(tr('blogm.drafting'))};
      try { await api('POST', '/ai-draft', { brief }); location.reload(); }
      catch (e) { alert(e.message); btn.disabled = false; btn.textContent = ${JSON.stringify(tr('blogm.draft_ai'))}; }
    }
    function toggleEdit(id) {
      const el = document.getElementById('edit-' + id);
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
    async function savePost(id, btn) {
      const w = document.getElementById('edit-' + id);
      btn.disabled = true; btn.textContent = ${JSON.stringify(tr('blogm.saving'))};
      try {
        await api('PUT', '/' + id, {
          title: w.querySelector('.f-title').value,
          excerpt: w.querySelector('.f-excerpt').value,
          cover_image: w.querySelector('.f-cover').value,
          content: w.querySelector('.f-content').value,
          seo_title: w.querySelector('.f-seo-title').value,
          seo_description: w.querySelector('.f-seo-desc').value,
        });
        location.reload();
      } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = ${JSON.stringify(tr('blogm.save'))}; }
    }
    async function togglePublish(id, publish) {
      try {
        await api('POST', '/' + id + '/publish', { publish });
        if (DEPLOYED) { sessionStorage.setItem('cf_republish', '1'); }
        location.reload();
      } catch (e) { alert(e.message); }
    }
    async function delPost(id) {
      if (!confirm(${JSON.stringify(tr('blogm.delete_confirm'))})) return;
      try { await api('DELETE', '/' + id); location.reload(); } catch (e) { alert(e.message); }
    }
    var T_COPY = ${JSON.stringify(tr('blogm.copy'))}, T_COPIED = ${JSON.stringify(tr('blogm.copied'))}, T_SHARE = ${JSON.stringify(tr('blogm.share'))};
    async function loadSocial(id, btn) {
      const box = document.getElementById('social-' + id);
      if (box.style.display === 'block') { box.style.display = 'none'; return; }
      btn.disabled = true;
      try {
        const post = document.querySelector('.post[data-id="' + id + '"]');
        const liveUrl = LIVE_BASE ? LIVE_BASE + '/blog/' + post.dataset.slug : '';
        const d = await api('POST', '/' + id + '/social', { url: liveUrl });
        const s = d.social || {};
        const enc = encodeURIComponent;
        const items = [
          { label: ${JSON.stringify(tr('blogm.social_x'))}, text: s.x, share: 'https://x.com/intent/post?text=' + enc(s.x || '') },
          { label: ${JSON.stringify(tr('blogm.social_ig'))}, text: s.instagram, share: null, note: ${JSON.stringify(tr('blogm.ig_note'))} },
          { label: ${JSON.stringify(tr('blogm.social_li'))}, text: s.linkedin, share: liveUrl ? 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(liveUrl) : null },
        ];
        box.innerHTML = '';
        // DOM-built with textContent — AI text is data, never markup.
        items.forEach(function (it) {
          if (!it.text) return;
          var wrap = document.createElement('div'); wrap.className = 'soc';
          var h = document.createElement('h4'); h.textContent = it.label; wrap.appendChild(h);
          var pre = document.createElement('pre'); pre.textContent = it.text; wrap.appendChild(pre);
          var acts = document.createElement('div'); acts.className = 'soc-acts';
          var cp = document.createElement('button'); cp.className = 'btn ghost'; cp.textContent = T_COPY;
          cp.onclick = function () {
            navigator.clipboard.writeText(it.text).then(function () {
              cp.textContent = T_COPIED; setTimeout(function () { cp.textContent = T_COPY; }, 1500);
            });
          };
          acts.appendChild(cp);
          if (it.share) {
            var a = document.createElement('a'); a.className = 'btn ghost'; a.target = '_blank'; a.rel = 'noopener';
            a.href = it.share; a.textContent = T_SHARE; acts.appendChild(a);
          }
          if (it.note) { var n = document.createElement('span'); n.className = 'muted'; n.textContent = it.note; acts.appendChild(n); }
          wrap.appendChild(acts);
          box.appendChild(wrap);
        });
        box.style.display = 'block';
      } catch (e) { alert(e.message); }
      btn.disabled = false;
    }
    if (sessionStorage.getItem('cf_republish') === '1') {
      document.getElementById('republish').style.display = 'block';
    }
  </script>
</body>
</html>`;

  return htmlResponse(html);
}
