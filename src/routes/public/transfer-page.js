// Owner-facing "transfer this website" page. Shows the auto-detected requirements
// the recipient must meet, takes a recipient email + "keep Builder access" toggle,
// and posts to the initiate API. Owner + Pro/Agency only. See api/transfer.js.
// i18n: local TP dict (en/es/pt), resolved by ctx.lang (pattern: quotes-manager QT).

import { htmlResponse, redirect } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { resolveStoreProject } from '../api/ai-builder/store.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { computeSiteRequirements, getPendingTransferForSite } from '../../db/site-transfer.js';
import { reqLabels } from '../api/transfer.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TP = {
  en: {
    meta_title: 'Transfer website — Caddisfly',
    title: 'Transfer "{name}"', back: '← Back to editor',
    intro: "Hand this website to another person's account. Once they accept, <strong>they own it</strong> — it's billed and gated entirely by their plan (plugins, AI credits, limits — nothing carries over from your account).",
    req_intro: "The recipient's account will need:",
    no_reqs: 'No special requirements — any account can receive this site.',
    need_plan: 'Transferring a website requires a <strong>Pro</strong> or <strong>Agency</strong> plan.',
    upgrade: 'Upgrade',
    pending: 'A transfer to {email} is pending (expires {date}).',
    cancel_btn: 'Cancel this transfer',
    recipient: 'Recipient email',
    keep: "Keep <strong>Builder access</strong> after transfer (you can still edit &amp; publish; this site counts toward your plan's site limit)",
    send_btn: 'Send transfer invite', sending: 'Sending…',
    could_not_cancel: 'Could not cancel.',
    invite_sent: 'Invite emailed to {email}. They have 7 days to accept.',
    invite_created: 'Invite created for {email}. They have 7 days to accept.',
    share_link: 'Share this link:',
    could_not_start: 'Could not start the transfer.', net_err: 'Network error. Try again.',
  },
  es: {
    meta_title: 'Transferir sitio web — Caddisfly',
    title: 'Transferir "{name}"', back: '← Volver al editor',
    intro: 'Entrega este sitio web a otra cuenta. Una vez que la acepten, <strong>pasa a ser suya</strong> — se factura y gestiona completamente según su plan (plugins, créditos de IA, límites — nada se traslada de tu cuenta).',
    req_intro: 'La cuenta del destinatario necesitará:',
    no_reqs: 'No se requiere nada especial — cualquier cuenta puede recibir este sitio.',
    need_plan: 'Para transferir un sitio web se requiere un plan <strong>Pro</strong> o <strong>Agency</strong>.',
    upgrade: 'Mejorar plan',
    pending: 'Una transferencia a {email} está pendiente (caduca el {date}).',
    cancel_btn: 'Cancelar esta transferencia',
    recipient: 'Correo del destinatario',
    keep: 'Mantener el <strong>acceso del creador</strong> después de la transferencia (tú aún puedes editar y publicar; este sitio cuenta para el límite de sitios de tu plan)',
    send_btn: 'Enviar invitación de transferencia', sending: 'Enviando…',
    could_not_cancel: 'No se pudo cancelar.',
    invite_sent: 'Invitación enviada a {email}. Tienen 7 días para aceptar.',
    invite_created: 'Invitación creada para {email}. Tienen 7 días para aceptar.',
    share_link: 'Comparte este enlace:',
    could_not_start: 'No se pudo iniciar la transferencia.', net_err: 'Error de red. Inténtalo de nuevo.',
  },
  pt: {
    meta_title: 'Transferir site — Caddisfly',
    title: 'Transferir "{name}"', back: '← Voltar ao editor',
    intro: 'Entregue este site para outra conta. Assim que aceitarem, <strong>ele passa a ser deles</strong> — é cobrado e gerenciado totalmente de acordo com o plano deles (plugins, créditos de IA, limites — nada é transferido da sua conta).',
    req_intro: 'A conta do destinatário precisará de:',
    no_reqs: 'Nenhuma exigência especial — qualquer conta pode receber este site.',
    need_plan: 'Para transferir um site é necessário um plano <strong>Pro</strong> ou <strong>Agency</strong>.',
    upgrade: 'Fazer upgrade',
    pending: 'Uma transferência para {email} está pendente (expira em {date}).',
    cancel_btn: 'Cancelar esta transferência',
    recipient: 'E-mail do destinatário',
    keep: 'Manter o <strong>acesso do criador</strong> após a transferência (você ainda pode editar e publicar; este site conta para o limite de sites do seu plano)',
    send_btn: 'Enviar convite de transferência', sending: 'Enviando…',
    could_not_cancel: 'Não foi possível cancelar.',
    invite_sent: 'Convite enviado para {email}. Eles têm 7 dias para aceitar.',
    invite_created: 'Convite criado para {email}. Eles têm 7 dias para aceitar.',
    share_link: 'Compartilhe este link:',
    could_not_start: 'Não foi possível iniciar a transferência.', net_err: 'Erro de rede. Tente novamente.',
  },
};

/** GET /ai-builder/:project_id/transfer */
export async function handleTransferPage(ctx) {
  const { env, params, url } = ctx;
  const origin = url.origin;
  const lang = (ctx && ctx.lang) || 'en';
  const T = TP[lang] || TP.en;
  if (ctx.projectRole !== 'owner') return redirect(`/ai-builder/customize/${params.project_id}`, 303);
  const r = await resolveStoreProject(env, params.project_id);
  if (!r) return redirect('/dashboard', 303);
  const tier = await getUserTier(env.DB, ctx.billingEmail);
  const eligible = ['pro', 'agency'].includes(tier);
  const reqs = await computeSiteRequirements(env.DB, r.projectKey);
  const labels = reqLabels(reqs, lang);
  const pending = await getPendingTransferForSite(env.DB, r.projectKey);

  const reqList = labels.length
    ? `<p class="lbl">${T.req_intro}</p><ul class="req">${labels.map((l) => `<li>✓ ${esc(l)}</li>`).join('')}</ul>`
    : `<p class="muted">${T.no_reqs}</p>`;

  const pendHtml = pending
    ? T.pending.replace('{date}', new Date(pending.expires_at * 1000).toISOString().slice(0, 10)).replace('{email}', `<strong>${esc(pending.to_email)}</strong>`)
    : '';

  const body = !eligible
    ? `<div class="notice warn">${T.need_plan} <a href="/billing">${T.upgrade}</a></div>`
    : pending
      ? `<div class="notice ok">${pendHtml}</div>
         <button class="btn btn-ghost" type="button" id="cancelBtn">${T.cancel_btn}</button>`
      : `${reqList}
         <form id="tform" style="margin-top:1.2rem">
           <label class="fld"><span>${T.recipient}</span><input id="toEmail" type="email" required placeholder="new-owner@example.com"></label>
           <label class="chk"><input id="keepBuilder" type="checkbox"> ${T.keep}</label>
           <button class="btn btn-primary btn-full" type="submit">${T.send_btn}</button>
         </form>
         <div id="msg"></div>`;

  const inner = `
    <div class="thead"><h1>${T.title.replace('{name}', esc(r.businessName))}</h1>
      <a class="btn btn-ghost" href="/ai-builder/customize/${esc(params.project_id)}">${T.back}</a></div>
    <p class="sub">${T.intro}</p>
    ${body}
    <script>
      (function(){
        var pid = ${JSON.stringify(params.project_id)};
        var S = ${JSON.stringify({ sending: T.sending, cancel: T.could_not_cancel, sent: T.invite_sent, created: T.invite_created, share: T.share_link, start: T.could_not_start, net: T.net_err })};
        var cancel = document.getElementById('cancelBtn');
        if (cancel) cancel.addEventListener('click', async function(){
          cancel.disabled = true;
          try { var r = await fetch('/api/ai-builder/'+pid+'/transfer/cancel', { method:'POST' }); var d = await r.json();
            if (d && d.success) location.reload(); else alert(S.cancel); }
          catch(e){ alert(S.cancel); cancel.disabled = false; }
        });
        var form = document.getElementById('tform');
        if (form) form.addEventListener('submit', async function(e){
          e.preventDefault();
          var to = document.getElementById('toEmail').value.trim();
          var keep = document.getElementById('keepBuilder').checked;
          var msg = document.getElementById('msg');
          var btn = form.querySelector('button[type=submit]'); btn.disabled = true; var t = btn.textContent; btn.textContent = S.sending;
          try {
            var res = await fetch('/api/ai-builder/'+pid+'/transfer', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to_email: to, keep_builder: keep }) });
            var d = await res.json();
            if (d && d.success) {
              var line = (d.sent ? S.sent : S.created).replace('{email}', to);
              msg.innerHTML = '<div class="notice ok">'+line+(d.sent ? '' : '<br>'+S.share+' <a href="'+d.accept_url+'">'+d.accept_url+'</a>')+'</div>';
              form.style.display = 'none';
            } else { msg.innerHTML = '<div class="notice err">'+((d && d.error) || S.start)+'</div>'; btn.disabled = false; btn.textContent = t; }
          } catch(err){ msg.innerHTML = '<div class="notice err">'+S.net+'</div>'; btn.disabled = false; btn.textContent = t; }
        });
      })();
    </script>`;

  return htmlResponse(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: T.meta_title, description: '', origin, path: '/transfer' })}<meta name="robots" content="noindex">
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
  </style></head><body>${siteHeader('/dashboard', {})}<main><div class="twrap">${inner}</div></main>${siteFooter({ lang })}</body></html>`);
}
