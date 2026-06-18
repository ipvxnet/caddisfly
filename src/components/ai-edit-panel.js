// AI Edit Panel — chat UI injected at the top of the section editor modal.
// Flow: user types a request -> propose (AI returns summary + patch + actions)
// -> user clicks Apply -> apply persists + reloads the preview iframe.
// Also offers "use my own" image/video (upload or paste URL).
// Relies on globals from section-editor-modal.js: window.currentProjectId,
// window.currentSectionId, showNotification().

import { imageTargetsFor } from '../utils/ai-edit.js';
import { translator } from '../i18n/index.js';

/**
 * @param {object} section - Section row (section_type, content_json)
 * @param {string} projectId
 * @param {string} lang - UI language
 * @returns {string} HTML (panel + scoped styles + script)
 */
export function generateAIEditPanel(section, projectId, lang = 'en') {
  const tr = translator(lang);
  const sectionType = section.section_type;
  const imageTargets = imageTargetsFor(sectionType);
  const canImage = imageTargets.length > 0;
  const isHero = sectionType === 'hero';
  // The field a "use my own image" upload/URL writes to.
  const imageField = imageTargets.includes('background_image') ? 'background_image' : (imageTargets[0] || 'image_url');
  // Single-image sections (hero/about) can clear their image; gallery (images[]) can't via this button.
  const canRemove = imageTargets.includes('background_image') || imageTargets.includes('image_url');

  return `
<div class="ai-edit-panel" data-section-id="${section.id}">
  <div class="ai-edit-head">
    <span class="ai-edit-title">${tr('aip.title')}</span>
    <span class="ai-edit-sub">${tr('aip.sub')}</span>
  </div>

  <div id="ai-edit-log" class="ai-edit-log"></div>

  <div class="ai-edit-input-row">
    <input type="text" id="ai-edit-input" class="ai-edit-input"
      placeholder="${aiPlaceholder(sectionType, canImage, tr)}"
      onkeydown="if(event.key==='Enter'){event.preventDefault();aiEditSend();}">
    <button type="button" class="ai-edit-send" id="ai-edit-send-btn" onclick="aiEditSend()">${tr('aip.send')}</button>
  </div>

  ${canImage ? `<details class="ai-edit-own">
    <summary>${isHero ? tr('aip.own_summary_video') : tr('aip.own_summary')}</summary>
    <div class="ai-edit-own-body">
      ${isHero ? `<div class="ai-edit-genvid">
        <input type="text" id="ai-edit-genvid-prompt" class="ai-edit-input" maxlength="200" placeholder="${tr('aip.gen_video_ph')}">
        <button type="button" class="ai-edit-genvid-btn" id="ai-edit-genvid-btn" onclick="aiEditGenVideo()">${tr('aip.gen_video')}</button>
        <p class="ai-edit-genvid-note">${tr('aip.gen_video_note')}</p>
      </div>` : ''}
      <label class="ai-edit-own-label">${tr('aip.upload_file')}</label>
      <input type="file" id="ai-edit-file" accept="image/*${isHero ? ',video/mp4,video/webm' : ''}" onchange="aiEditUpload(this)">
      <label class="ai-edit-own-label">${tr('aip.or_paste_url')}</label>
      <div class="ai-edit-url-row">
        <input type="text" id="ai-edit-url" class="ai-edit-input" placeholder="https://…">
        <button type="button" class="ai-edit-send" onclick="aiEditApplyUrl()">${tr('aip.use')}</button>
      </div>
      ${canRemove ? `<button type="button" class="ai-edit-remove" onclick="aiEditRemoveMedia()">${isHero ? tr('aip.remove_media_video') : tr('aip.remove_media')}</button>` : ''}
      <div id="ai-edit-own-status" class="ai-edit-own-status"></div>
    </div>
  </details>` : ''}
</div>

<style>
.ai-edit-panel { background: linear-gradient(135deg,#f5f3ff,#eef2ff); border:1px solid #ddd6fe; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; }
.ai-edit-head { display:flex; flex-direction:column; gap:0.15rem; margin-bottom:0.75rem; }
.ai-edit-title { font-weight:700; color:#5b21b6; font-size:1.05rem; }
.ai-edit-sub { font-size:0.78rem; color:#6b7280; }
.ai-edit-log { display:flex; flex-direction:column; gap:0.6rem; max-height:280px; overflow-y:auto; margin-bottom:0.75rem; }
.ai-edit-log:empty { display:none; }
.ai-edit-msg { padding:0.6rem 0.8rem; border-radius:10px; font-size:0.875rem; line-height:1.4; }
.ai-edit-msg.user { background:#ede9fe; color:#4c1d95; align-self:flex-end; max-width:85%; }
.ai-edit-msg.ai { background:#fff; border:1px solid #e5e7eb; color:#1f2937; max-width:95%; }
.ai-edit-proposal { background:#fff; border:1px solid #c4b5fd; border-radius:10px; padding:0.7rem 0.8rem; }
.ai-edit-proposal .summary { font-weight:600; color:#1f2937; margin-bottom:0.4rem; font-size:0.875rem; }
.ai-edit-proposal pre { background:#f9fafb; border-radius:6px; padding:0.5rem; font-size:0.72rem; max-height:140px; overflow:auto; white-space:pre-wrap; color:#374151; }
.ai-edit-proposal .actions-note { font-size:0.78rem; color:#7c3aed; margin-top:0.35rem; }
.ai-edit-proposal-buttons { display:flex; gap:0.5rem; margin-top:0.6rem; }
.ai-edit-apply { background:#7c3aed; color:#fff; border:none; padding:0.5rem 1rem; border-radius:8px; font-weight:600; cursor:pointer; font-size:0.85rem; }
.ai-edit-apply:disabled { opacity:0.6; cursor:default; }
.ai-edit-discard { background:#fff; color:#6b7280; border:1px solid #e5e7eb; padding:0.5rem 0.9rem; border-radius:8px; cursor:pointer; font-size:0.85rem; }
.ai-edit-input-row { display:flex; gap:0.5rem; }
.ai-edit-input { flex:1; padding:0.65rem 0.8rem; border:2px solid #ddd6fe; border-radius:8px; font-size:0.9rem; font-family:inherit; }
.ai-edit-input:focus { outline:none; border-color:#7c3aed; }
.ai-edit-send { background:#7c3aed; color:#fff; border:none; padding:0 1.1rem; border-radius:8px; font-weight:600; cursor:pointer; }
.ai-edit-send:disabled { opacity:0.6; cursor:default; }
.ai-edit-own { margin-top:0.85rem; font-size:0.85rem; }
.ai-edit-own summary { cursor:pointer; color:#5b21b6; font-weight:600; }
.ai-edit-own-body { padding-top:0.6rem; display:flex; flex-direction:column; gap:0.35rem; }
.ai-edit-own-label { font-size:0.75rem; color:#6b7280; font-weight:600; margin-top:0.3rem; }
.ai-edit-url-row { display:flex; gap:0.5rem; }
.ai-edit-remove { margin-top:0.6rem; background:#fff; color:#b91c1c; border:1px solid #fecaca; padding:0.5rem 0.8rem; border-radius:8px; cursor:pointer; font-size:0.82rem; font-weight:600; }
.ai-edit-remove:hover { background:#fef2f2; }
.ai-edit-own-status { font-size:0.78rem; color:#7c3aed; min-height:1em; }
.ai-edit-genvid { margin:0 0 0.7rem; padding-bottom:0.7rem; border-bottom:1px solid #ede9fe; }
.ai-edit-genvid #ai-edit-genvid-prompt { margin-bottom:0.45rem; }
.ai-edit-genvid-btn { width:100%; padding:0.6rem; border:none; border-radius:8px; background:linear-gradient(135deg,#7c3aed,#a855f7); color:#fff; font-weight:700; font-size:0.85rem; cursor:pointer; }
.ai-edit-genvid-btn:disabled { opacity:0.9; cursor:default; }
.ai-edit-genvid-btn.busy { animation:aiGvPulse 1.1s ease-in-out infinite; }
@keyframes aiGvPulse { 0%,100%{ opacity:0.95 } 50%{ opacity:0.6 } }
.ai-edit-own-status.working { color:#7c3aed; font-weight:700; }
.ai-edit-genvid-note { font-size:0.72rem; color:#9ca3af; margin:0.35rem 0 0; }
.ai-edit-typing { font-size:0.8rem; color:#7c3aed; }
</style>

<script>
window.aiEditHistory = [];

// Section id from the LIVE panel DOM — never the window global, which can go
// stale when modal scripts fail to re-execute (caused cross-section writes:
// a video applied to the navbar 2026-06-09, a hero wiped 2026-06-11).
function aiEditSectionId() {
  var p = document.querySelector('.ai-edit-panel[data-section-id]');
  return (p && p.dataset.sectionId) || window.currentSectionId;
}
window.aiEditSectionType = '${sectionType}';
window.aiEditImageField = '${imageField}';
window.aiEditIsHero = ${isHero ? 'true' : 'false'};

function aiEditAddMsg(role, text) {
  const log = document.getElementById('ai-edit-log');
  const div = document.createElement('div');
  div.className = 'ai-edit-msg ' + (role === 'user' ? 'user' : 'ai');
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

async function aiEditSend() {
  const input = document.getElementById('ai-edit-input');
  const btn = document.getElementById('ai-edit-send-btn');
  const message = input.value.trim();
  if (!message) return;

  aiEditAddMsg('user', message);
  window.aiEditHistory.push({ role: 'user', content: message });
  input.value = '';
  btn.disabled = true;

  const log = document.getElementById('ai-edit-log');
  const typing = document.createElement('div');
  typing.className = 'ai-edit-msg ai ai-edit-typing';
  typing.textContent = ${JSON.stringify(tr('aip.thinking'))};
  log.appendChild(typing);
  log.scrollTop = log.scrollHeight;

  try {
    const res = await fetch(\`/api/ai-builder/\${window.currentProjectId}/sections/\${aiEditSectionId()}/ai-edit\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: window.aiEditHistory })
    });
    const data = await res.json();
    typing.remove();

    if (!data.success) throw new Error(data.error || ${JSON.stringify(tr('aip.failed'))});

    aiEditAddMsg('ai', data.assistant_message || data.summary || ${JSON.stringify(tr('aip.my_proposal'))});
    window.aiEditHistory.push({ role: 'assistant', content: data.assistant_message || data.summary || '' });

    if (data.has_change) {
      aiEditRenderProposal(data);
    } else {
      aiEditAddMsg('ai', ${JSON.stringify(tr('aip.nothing'))});
    }
  } catch (error) {
    typing.remove();
    aiEditAddMsg('ai', '⚠️ ' + error.message);
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

function aiEditRenderProposal(data) {
  const log = document.getElementById('ai-edit-log');
  const box = document.createElement('div');
  box.className = 'ai-edit-msg ai ai-edit-proposal';
  const changed = Object.keys(data.patch || {});
  const actionsNote = (data.actions || []).length
    ? '<div class="actions-note">' + ${JSON.stringify(tr('aip.will_generate', { n: '%N%' }))}.replace('%N%', data.actions.length) + '</div>' : '';
  box.innerHTML =
    '<div class="summary">' + (data.summary || ${JSON.stringify(tr('aip.proposed'))}) + '</div>' +
    (changed.length ? '<pre>' + escapeForHtml(JSON.stringify(data.patch, null, 2)) + '</pre>' : '') +
    actionsNote +
    '<div class="ai-edit-proposal-buttons">' +
      '<button type="button" class="ai-edit-apply" onclick=\\'aiEditApply(this)\\'>' + ${JSON.stringify(tr('aip.apply'))} + '</button>' +
      '<button type="button" class="ai-edit-discard" onclick="this.closest(\\'.ai-edit-proposal\\').remove()">' + ${JSON.stringify(tr('aip.discard'))} + '</button>' +
    '</div>';
  box._proposal = { patch: data.patch || {}, actions: data.actions || [] };
  log.appendChild(box);
  log.scrollTop = log.scrollHeight;
}

async function aiEditApply(btn) {
  const box = btn.closest('.ai-edit-proposal');
  const proposal = box._proposal || { patch: {}, actions: [] };
  btn.disabled = true;
  btn.textContent = proposal.actions.length ? ${JSON.stringify(tr('aip.generating'))} : ${JSON.stringify(tr('aip.applying'))};
  try {
    await aiEditPostApply({ patch: proposal.patch, actions: proposal.actions });
    btn.textContent = ${JSON.stringify(tr('aip.applied'))};
    aiEditAddMsg('ai', ${JSON.stringify(tr('aip.done'))});
  } catch (error) {
    btn.disabled = false;
    btn.textContent = ${JSON.stringify(tr('aip.apply'))};
    aiEditAddMsg('ai', '⚠️ ' + error.message);
  }
}

async function aiEditPostApply(payload) {
  const res = await fetch(\`/api/ai-builder/\${window.currentProjectId}/sections/\${aiEditSectionId()}/ai-edit/apply\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || ${JSON.stringify(tr('aip.failed_apply'))});
  const iframe = document.getElementById('preview-iframe');
  if (iframe) {
    const sid = aiEditSectionId();
    // After reload, scroll the preview back to the section we just edited.
    iframe.addEventListener('load', function once() {
      iframe.removeEventListener('load', once);
      if (typeof scrollPreviewToSection === 'function') scrollPreviewToSection(sid, 0);
    });
    iframe.contentWindow.location.reload();
  }
  if (typeof showNotification === 'function') showNotification(${JSON.stringify(tr('aip.section_updated'))}, 'success');
  return data;
}

// ---- AI background video (hero) ----
async function aiEditGenVideo() {
  var btn = document.getElementById('ai-edit-genvid-btn');
  var status = document.getElementById('ai-edit-own-status');
  if (btn && btn.disabled) return; // already generating — ignore double-click
  // Immediate, unmistakable feedback (no blocking confirm — it can be suppressed).
  if (btn) { btn.disabled = true; btn.classList.add('busy'); btn.textContent = ${JSON.stringify(tr('aip.gen_video_busy'))}; }
  if (status) { status.classList.add('working'); status.textContent = ${JSON.stringify(tr('aip.gen_video_wait'))}; }
  if (typeof showNotification === 'function') showNotification(${JSON.stringify(tr('aip.gen_video_wait'))}, 'info');
  var brief = ((document.getElementById('ai-edit-genvid-prompt') || {}).value || '').trim();
  try {
    const res = await fetch(\`/api/ai-builder/\${window.currentProjectId}/hero-video/generate\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: brief, section_id: aiEditSectionId() })
    });
    const data = await res.json().catch(function(){ return {}; });
    if (!res.ok || !data.success) {
      // Paid-plan / out-of-credits → show the upgrade popup (clear CTA, not a dead-end).
      if (data.billing_url && typeof showUpgradePrompt === 'function') {
        if (status) status.textContent = '';
        showUpgradePrompt(data.upgrade_message || data.error || ${JSON.stringify(tr('aip.gen_video_fail'))}, data.billing_url);
        return;
      }
      var msg = data.error || data.upgrade_message || ${JSON.stringify(tr('aip.gen_video_fail'))};
      if (status) status.textContent = msg;
      if (typeof showNotification === 'function') showNotification(msg, 'error');
      return;
    }
    const iframe = document.getElementById('preview-iframe');
    if (iframe) iframe.contentWindow.location.reload();
    if (typeof showNotification === 'function') showNotification(${JSON.stringify(tr('aip.gen_video_done'))}, 'success');
    if (status) status.textContent = '';
  } catch (e) {
    if (status) status.textContent = ${JSON.stringify(tr('aip.gen_video_fail'))};
    if (typeof showNotification === 'function') showNotification(${JSON.stringify(tr('aip.gen_video_fail'))}, 'error');
  } finally {
    if (status) status.classList.remove('working');
    if (btn) { btn.disabled = false; btn.classList.remove('busy'); btn.textContent = ${JSON.stringify(tr('aip.gen_video'))}; }
  }
}

// ---- "Use my own" media ----
function aiEditMediaPayload(url, isVideo) {
  if (isVideo) return { patch: { video_url: url }, set_variant: 'video' };
  return { patch: { [window.aiEditImageField]: url } };
}

async function aiEditUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('ai-edit-own-status');
  status.textContent = ${JSON.stringify(tr('aip.uploading'))};
  const fd = new FormData();
  fd.append('file', file);
  fd.append('asset_type', 'section');
  try {
    const up = await fetch(\`/api/ai-builder/\${window.currentProjectId}/upload\`, { method: 'POST', body: fd });
    const updata = await up.json();
    if (!updata.success) throw new Error(updata.error || ${JSON.stringify(tr('aip.upload_failed'))});
    const isVideo = (file.type || '').startsWith('video');
    await aiEditPostApply(aiEditMediaPayload(updata.url, isVideo));
    status.textContent = ${JSON.stringify(tr('aip.applied_your', { media: '%M%' }))}.replace('%M%', isVideo ? ${JSON.stringify(tr('aip.video'))} : ${JSON.stringify(tr('aip.image'))});
  } catch (error) {
    status.textContent = '⚠️ ' + error.message;
  }
}

async function aiEditRemoveMedia() {
  const status = document.getElementById('ai-edit-own-status');
  status.textContent = ${JSON.stringify(tr('aip.removing'))};
  try {
    // Clear every field that could hold this section's image/video, regardless
    // of which variant is active (background_image vs image_url).
    await aiEditPostApply({ patch: { background_image: '', image_url: '', video_url: '' } });
    const fileInput = document.getElementById('ai-edit-file');
    if (fileInput) fileInput.value = '';
    const urlInput = document.getElementById('ai-edit-url');
    if (urlInput) urlInput.value = '';
    status.textContent = ${JSON.stringify(tr('aip.removed'))};
  } catch (error) {
    status.textContent = '⚠️ ' + error.message;
  }
}

async function aiEditApplyUrl() {
  const url = (document.getElementById('ai-edit-url').value || '').trim();
  const status = document.getElementById('ai-edit-own-status');
  if (!/^https?:\\/\\//i.test(url)) { status.textContent = ${JSON.stringify(tr('aip.invalid_url'))}; return; }
  status.textContent = ${JSON.stringify(tr('aip.applying'))};
  try {
    const isVideo = /\\.(mp4|webm)(\\?|$)/i.test(url);
    await aiEditPostApply(aiEditMediaPayload(url, isVideo && window.aiEditIsHero));
    status.textContent = ${JSON.stringify(tr('aip.applied_dot'))};
  } catch (error) {
    status.textContent = '⚠️ ' + error.message;
  }
}

function escapeForHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
</script>
  `;
}

/** A helpful per-type placeholder for the chat input. */
function aiPlaceholder(sectionType, canImage, tr) {
  const map = {
    hero: tr('aip.ph_hero') + (canImage ? ' · ' + tr('aip.ph_hero_img') : ''),
    about: tr('aip.ph_about'),
    services: tr('aip.ph_services'),
    features: tr('aip.ph_features'),
    testimonials: tr('aip.ph_testimonials'),
    contact: tr('aip.ph_contact'),
    gallery: canImage ? tr('aip.ph_gallery_img') : tr('aip.ph_gallery'),
    footer: tr('aip.ph_footer'),
  };
  return (map[sectionType] || tr('aip.ph_default')).replace(/"/g, '&quot;');
}
