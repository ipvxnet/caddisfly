// GET /ai-builder/forms/:project_id — contact-form inbox for a site's owner.
// Submissions come from the published site's contact form (see
// routes/api/forms.js). Viewing the inbox marks everything read; messages that
// were unread when the page loaded keep a "new" pill for this render.

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { getSubmissionsBySite, markAllRead } from '../../db/form-submissions.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(ts, lang) {
  try {
    return new Date(ts * 1000).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export async function handleFormsInbox(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const publicId = params.project_id;

  const aiProject = await getAIProjectByProjectId(env.DB, publicId);
  let name, deployedUrl, ownerEmail, config;
  if (aiProject) {
    name = aiProject.project_name || 'Your Website';
    deployedUrl = aiProject.deployed_url || `/site/${publicId}`;
    ownerEmail = aiProject.customer_email || '';
    config = await getWebsiteConfigByAIProjectId(env.DB, aiProject.id);
  } else {
    const rp = await getProjectByPreviewId(env.DB, publicId);
    if (!rp) return new Response('Project not found', { status: 404 });
    name = rp.website_url || 'Your Website';
    deployedUrl = `/site/${publicId}`;
    ownerEmail = rp.customer_email || '';
    config = await getWebsiteConfigByRegularProjectId(env.DB, rp.id);
  }
  const notifyEmail = (config && config.notify_email) || '';

  const subs = await getSubmissionsBySite(env.DB, publicId);
  const unread = subs.filter((s) => !s.is_read).length;
  if (unread) await markAllRead(env.DB, publicId); // pills below reflect pre-visit state

  const rows = subs.length
    ? subs
        .map(
          (s) => `
      <div class="msg" data-id="${s.id}">
        <div class="msg-head">
          <div class="msg-who">
            <strong>${esc(s.name)}</strong>
            <a class="msg-email" href="mailto:${esc(s.email)}">${esc(s.email)}</a>
            ${s.is_read ? '' : `<span class="pill new">${tr('finbox.new')}</span>`}
          </div>
          <div class="msg-meta">
            ${s.page_path && s.page_path !== '/' ? `<span class="msg-page">${esc(s.page_path)}</span> · ` : ''}${fmtDate(s.created_at, lang)}
            ${s.email_status === 'sent' ? `<span class="pill mail ok" title="${tr('finbox.mail_sent_title')}">✉ ✓</span>` : ''}
            ${s.email_status === 'failed' ? `<span class="pill mail bad" title="${tr('finbox.mail_failed_title')}">✉ ✗</span>` : ''}
            ${s.email_status === 'skipped' ? `<span class="pill mail skip" title="${tr('finbox.mail_skipped_title')}">✉ —</span>` : ''}
          </div>
        </div>
        <p class="msg-body">${esc(s.message)}</p>
        <div class="msg-actions">
          <a class="btn btn-ghost sm" href="mailto:${esc(s.email)}?subject=${encodeURIComponent('Re: ' + name)}">${tr('finbox.reply')}</a>
          <button class="link-btn danger" onclick="delMsg(this, ${s.id})">${tr('finbox.delete')}</button>
        </div>
      </div>`
        )
        .join('')
    : `<p class="empty">${tr('finbox.empty')}</p>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('finbox.meta_title', { name: esc(name) }), description: 'Messages from your published site.', origin: url.origin })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    .awrap{max-width:760px;margin:0 auto;padding:2.5rem 1.5rem 4rem}
    .ahead{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}
    .ahead h1{font-size:clamp(1.6rem,3.5vw,2.2rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .ahead .sub{color:var(--muted);font-size:.92rem}
    .ahead .acts{display:flex;gap:.5rem;flex-wrap:wrap}
    .count{color:var(--muted);font-size:.9rem;font-weight:700;margin-bottom:1rem}
    .msg{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.2rem 1.4rem;margin-bottom:1rem}
    .msg-head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap}
    .msg-who{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
    .msg-who strong{color:var(--ink)}
    .msg-email{color:var(--p2);font-size:.9rem;text-decoration:none}
    .msg-email:hover{text-decoration:underline}
    .msg-meta{color:var(--muted);font-size:.82rem}
    .msg-page{font-weight:700}
    .msg-body{color:var(--body);margin:.7rem 0;white-space:pre-wrap;line-height:1.55}
    .msg-actions{display:flex;align-items:center;gap:.8rem}
    .btn.sm,.btn-ghost.sm{padding:.35rem .7rem;font-size:.82rem}
    .pill{display:inline-block;border-radius:999px;padding:.1rem .6rem;font-size:.72rem;font-weight:700;vertical-align:middle}
    .pill.new{background:#eef2ff;border:1px solid #c7d2fe;color:#4338ca}
    .link-btn{background:none;border:none;color:var(--p2);cursor:pointer;font-size:.85rem;font-weight:600;padding:0}
    .link-btn.danger{color:#b91c1c}
    .empty{color:var(--muted);padding:2.5rem 0;text-align:center}
    .notify-box{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1rem 1.4rem;margin-bottom:1.4rem}
    .notify-row{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
    .notify-row label{font-size:.9rem;color:var(--ink)}
    .notify-row input{flex:1;min-width:220px;padding:.5rem .7rem;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:.9rem}
    .notify-hint{color:var(--muted);font-size:.82rem;margin:.55rem 0 0}
    .notify-hint.ok{color:#2f855a;font-weight:600}
    .notify-hint.bad{color:#b91c1c;font-weight:600}
    .pill.mail{font-size:.7rem;margin-left:.4rem}
    .pill.mail.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d}
    .pill.mail.bad{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}
    .pill.mail.skip{background:#f8fafc;border:1px solid #e2e8f0;color:#64748b}
  </style>
</head>
<body>
  ${siteHeader('', { lang })}
  <main><div class="awrap">
    <div class="ahead">
      <div>
        <h1>${esc(name)}</h1>
        <div class="sub">${tr('finbox.sub')}</div>
      </div>
      <div class="acts">
        <a class="btn btn-ghost" href="/ai-builder/customize/${esc(publicId)}">${tr('finbox.customize')}</a>
        <a class="btn btn-ghost" href="/ai-builder/analytics/${esc(publicId)}">${tr('finbox.analytics')}</a>
        <a class="btn btn-primary" href="${esc(deployedUrl)}" target="_blank" rel="noopener">${tr('finbox.view_site')}</a>
      </div>
    </div>
    <div class="notify-box">
      <div class="notify-row">
        <label for="notify-email"><strong>✉ ${tr('finbox.notify_label')}</strong></label>
        <input type="email" id="notify-email" value="${esc(notifyEmail)}" placeholder="${esc(ownerEmail)}">
        <button class="btn btn-ghost sm" id="notify-save" onclick="saveNotify(this)">${tr('finbox.notify_save')}</button>
        <button class="btn btn-ghost sm" id="test-btn" onclick="sendTest(this)">${tr('finbox.test_btn')}</button>
      </div>
      <p class="notify-hint" id="notify-status">${tr('finbox.notify_hint')}</p>
    </div>
    ${subs.length ? `<p class="count">${tr('finbox.total', { n: subs.length })}${unread ? ` · ${tr('finbox.unread', { n: unread })}` : ''}</p>` : ''}
    ${rows}
  </div></main>
  ${siteFooter({ lang })}
  <script>
    const NOTIFY_T = ${JSON.stringify({
      hint: tr('finbox.notify_hint'),
      saved: tr('finbox.notify_saved'),
      sending: tr('finbox.test_sending'),
      test_btn: tr('finbox.test_btn'),
      test_ok: tr('finbox.test_ok'),
      test_fail: tr('finbox.test_fail'),
      err: tr('finbox.err'),
    })};
    function notifyStatus(msg, cls) {
      const el = document.getElementById('notify-status');
      el.textContent = msg; el.className = 'notify-hint' + (cls ? ' ' + cls : '');
    }
    async function saveNotify(btn) {
      btn.disabled = true;
      try {
        const r = await fetch('/api/ai-builder/${esc(publicId)}/forms/settings', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notify_email: document.getElementById('notify-email').value.trim() }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) throw new Error((d && d.error) || NOTIFY_T.err);
        notifyStatus(NOTIFY_T.saved, 'ok');
        setTimeout(() => notifyStatus(NOTIFY_T.hint, ''), 3500);
      } catch (e) { notifyStatus(e.message || NOTIFY_T.err, 'bad'); }
      finally { btn.disabled = false; }
    }
    async function sendTest(btn) {
      btn.disabled = true; btn.textContent = NOTIFY_T.sending;
      try {
        const r = await fetch('/api/ai-builder/${esc(publicId)}/forms/test', { method: 'POST' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) throw new Error((d && d.error) || NOTIFY_T.err);
        notifyStatus(d.sent ? NOTIFY_T.test_ok.replace('{to}', d.to) : NOTIFY_T.test_fail, d.sent ? 'ok' : 'bad');
      } catch (e) { notifyStatus(e.message || NOTIFY_T.err, 'bad'); }
      finally { btn.disabled = false; btn.textContent = NOTIFY_T.test_btn; }
    }
    async function delMsg(btn, id) {
      if (!confirm(${JSON.stringify(tr('finbox.delete_confirm'))})) return;
      btn.disabled = true;
      try {
        const r = await fetch('/api/ai-builder/${esc(publicId)}/forms/' + id, { method: 'DELETE' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) throw new Error((d && d.error) || 'Request failed');
        const row = btn.closest('.msg');
        if (row) row.remove();
      } catch (e) { alert(e.message); btn.disabled = false; }
    }
  </script>
</body>
</html>`;

  return htmlResponse(html);
}
