// Owner-facing "transfer this website" page. Shows the auto-detected requirements
// the recipient must meet, takes a recipient email + "keep Builder access" toggle,
// and posts to the initiate API. Owner + Pro/Agency only. See api/transfer.js.

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject } from '../api/ai-builder/store.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { computeSiteRequirements, getPendingTransferForSite } from '../../db/site-transfer.js';
import { reqLabels } from '../api/transfer.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** GET /ai-builder/:project_id/transfer */
export async function handleTransferPage(ctx) {
  const { env, params, url } = ctx;
  const origin = url.origin;
  if (ctx.projectRole !== 'owner') return redirect(`/ai-builder/customize/${params.project_id}`, 303);
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const tier = await getUserTier(env.DB, ctx.billingEmail);
  const eligible = ['pro', 'agency'].includes(tier);
  const reqs = await computeSiteRequirements(env.DB, r.projectKey);
  const labels = reqLabels(reqs);
  const pending = await getPendingTransferForSite(env.DB, r.projectKey);

  const reqList = labels.length
    ? `<p class="lbl">The recipient's account will need:</p><ul class="req">${labels.map((l) => `<li>✓ ${esc(l)}</li>`).join('')}</ul>`
    : `<p class="muted">No special requirements — any account can receive this site.</p>`;

  const body = !eligible
    ? `<div class="notice warn">Transferring a website requires a <strong>Pro</strong> or <strong>Agency</strong> plan. <a href="/billing">Upgrade</a> to enable it.</div>`
    : pending
      ? `<div class="notice ok">A transfer to <strong>${esc(pending.to_email)}</strong> is pending (expires ${new Date(pending.expires_at * 1000).toISOString().slice(0, 10)}).</div>
         <button class="btn btn-ghost" type="button" id="cancelBtn">Cancel this transfer</button>`
      : `${reqList}
         <form id="tform" style="margin-top:1.2rem">
           <label class="fld"><span>Recipient email</span><input id="toEmail" type="email" required placeholder="new-owner@example.com"></label>
           <label class="chk"><input id="keepBuilder" type="checkbox"> Keep <strong>Builder access</strong> after transfer (you can still edit &amp; publish; this site counts toward your plan's site limit)</label>
           <button class="btn btn-primary btn-full" type="submit">Send transfer invite</button>
         </form>
         <div id="msg"></div>`;

  const inner = `
    <div class="thead"><h1>Transfer "${esc(r.businessName)}"</h1>
      <a class="btn btn-ghost" href="/ai-builder/customize/${esc(params.project_id)}">← Back to editor</a></div>
    <p class="sub">Hand this website to another person's account. Once they accept, <strong>they own it</strong> — it's billed and gated entirely by their plan (plugins, AI credits, limits — nothing carries over from your account).</p>
    ${body}
    <script>
      (function(){
        var pid = ${JSON.stringify(params.project_id)};
        var cancel = document.getElementById('cancelBtn');
        if (cancel) cancel.addEventListener('click', async function(){
          cancel.disabled = true;
          try { var r = await fetch('/api/ai-builder/'+pid+'/transfer/cancel', { method:'POST' }); var d = await r.json();
            if (d && d.success) location.reload(); else alert('Could not cancel.'); }
          catch(e){ alert('Could not cancel.'); cancel.disabled = false; }
        });
        var form = document.getElementById('tform');
        if (form) form.addEventListener('submit', async function(e){
          e.preventDefault();
          var to = document.getElementById('toEmail').value.trim();
          var keep = document.getElementById('keepBuilder').checked;
          var msg = document.getElementById('msg');
          var btn = form.querySelector('button[type=submit]'); btn.disabled = true; var t = btn.textContent; btn.textContent = 'Sending…';
          try {
            var res = await fetch('/api/ai-builder/'+pid+'/transfer', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to_email: to, keep_builder: keep }) });
            var d = await res.json();
            if (d && d.success) {
              msg.innerHTML = '<div class="notice ok">Invite '+(d.sent ? 'emailed to' : 'created for')+' '+to+'. They have 7 days to accept.'+(d.sent ? '' : '<br>Share this link: <a href="'+d.accept_url+'">'+d.accept_url+'</a>')+'</div>';
              form.style.display = 'none';
            } else { msg.innerHTML = '<div class="notice err">'+((d && d.error) || 'Could not start the transfer.')+'</div>'; btn.disabled = false; btn.textContent = t; }
          } catch(err){ msg.innerHTML = '<div class="notice err">Network error. Try again.</div>'; btn.disabled = false; btn.textContent = t; }
        });
      })();
    </script>`;

  return htmlResponse(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: 'Transfer website — Caddisfly', description: '', origin, path: '/transfer' })}<meta name="robots" content="noindex">
  <style>${baseCss()}
    main{min-height:60vh}.twrap{max-width:600px;margin:0 auto;padding:2.5rem 1.5rem}
    .thead{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
    .thead h1{font-size:clamp(1.4rem,3.5vw,1.9rem);font-weight:900;color:var(--ink)}
    .sub{color:var(--body);line-height:1.6;margin:.4rem 0 1.4rem}
    .lbl{font-weight:700;color:var(--ink);margin:.2rem 0 .4rem}
    .req{list-style:none;padding:0;margin:0 0 .4rem}.req li{padding:.3rem 0;color:#15803d;font-weight:600}
    .fld{display:flex;flex-direction:column;gap:.3rem;margin-bottom:1rem}.fld span{font-weight:700;font-size:.9rem;color:var(--ink)}
    .fld input{padding:.6rem .7rem;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;font-size:.95rem}
    .chk{display:flex;gap:.6rem;align-items:flex-start;font-size:.88rem;color:var(--body);margin-bottom:1.2rem;line-height:1.5}.chk input{margin-top:.2rem}
    .btn-full{width:100%;justify-content:center}
    .notice{border-radius:12px;padding:.9rem 1.1rem;margin:.8rem 0;font-size:.92rem}
    .notice.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
    .notice.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e}
    .notice.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    .muted{color:var(--muted)}
  </style></head><body>${siteHeader('/dashboard', {})}<main><div class="twrap">${inner}</div></main>${siteFooter({ lang: 'en' })}</body></html>`);
}
