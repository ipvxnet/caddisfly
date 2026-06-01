// AI Edit Panel — chat UI injected at the top of the section editor modal.
// Flow: user types a request -> propose (AI returns summary + patch + actions)
// -> user clicks Apply -> apply persists + reloads the preview iframe.
// Also offers "use my own" image/video (upload or paste URL).
// Relies on globals from section-editor-modal.js: window.currentProjectId,
// window.currentSectionId, showNotification().

import { imageTargetsFor } from '../utils/ai-edit.js';

/**
 * @param {object} section - Section row (section_type, content_json)
 * @param {string} projectId
 * @returns {string} HTML (panel + scoped styles + script)
 */
export function generateAIEditPanel(section, projectId) {
  const sectionType = section.section_type;
  const imageTargets = imageTargetsFor(sectionType);
  const canImage = imageTargets.length > 0;
  const isHero = sectionType === 'hero';
  // The field a "use my own image" upload/URL writes to.
  const imageField = imageTargets.includes('background_image') ? 'background_image' : (imageTargets[0] || 'image_url');

  return `
<div class="ai-edit-panel">
  <div class="ai-edit-head">
    <span class="ai-edit-title">✨ AI Edit</span>
    <span class="ai-edit-sub">Tell the AI what to change — it'll confirm before applying.</span>
  </div>

  <div id="ai-edit-log" class="ai-edit-log"></div>

  <div class="ai-edit-input-row">
    <input type="text" id="ai-edit-input" class="ai-edit-input"
      placeholder="e.g. ${aiPlaceholder(sectionType, canImage)}"
      onkeydown="if(event.key==='Enter'){event.preventDefault();aiEditSend();}">
    <button type="button" class="ai-edit-send" id="ai-edit-send-btn" onclick="aiEditSend()">Send</button>
  </div>

  <details class="ai-edit-own">
    <summary>📎 Use my own image${isHero ? ' / video' : ''} (upload or URL)</summary>
    <div class="ai-edit-own-body">
      <label class="ai-edit-own-label">Upload a file</label>
      <input type="file" id="ai-edit-file" accept="image/*${isHero ? ',video/mp4,video/webm' : ''}" onchange="aiEditUpload(this)">
      <label class="ai-edit-own-label">…or paste a URL</label>
      <div class="ai-edit-url-row">
        <input type="text" id="ai-edit-url" class="ai-edit-input" placeholder="https://…">
        <button type="button" class="ai-edit-send" onclick="aiEditApplyUrl()">Use</button>
      </div>
      <div id="ai-edit-own-status" class="ai-edit-own-status"></div>
    </div>
  </details>
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
.ai-edit-own-status { font-size:0.78rem; color:#7c3aed; min-height:1em; }
.ai-edit-typing { font-size:0.8rem; color:#7c3aed; }
</style>

<script>
window.aiEditHistory = [];
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
  typing.textContent = 'Thinking…';
  log.appendChild(typing);
  log.scrollTop = log.scrollHeight;

  try {
    const res = await fetch(\`/api/ai-builder/\${window.currentProjectId}/sections/\${window.currentSectionId}/ai-edit\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: window.aiEditHistory })
    });
    const data = await res.json();
    typing.remove();

    if (!data.success) throw new Error(data.error || 'Failed');

    aiEditAddMsg('ai', data.assistant_message || data.summary || 'Here is my proposal.');
    window.aiEditHistory.push({ role: 'assistant', content: data.assistant_message || data.summary || '' });

    if (data.has_change) {
      aiEditRenderProposal(data);
    } else {
      aiEditAddMsg('ai', "I couldn't find anything to change for that. Try rephrasing?");
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
    ? '<div class="actions-note">🖼️ Will generate ' + data.actions.length + ' image(s).</div>' : '';
  box.innerHTML =
    '<div class="summary">' + (data.summary || 'Proposed changes') + '</div>' +
    (changed.length ? '<pre>' + escapeForHtml(JSON.stringify(data.patch, null, 2)) + '</pre>' : '') +
    actionsNote +
    '<div class="ai-edit-proposal-buttons">' +
      '<button type="button" class="ai-edit-apply" onclick=\\'aiEditApply(this)\\'>Apply</button>' +
      '<button type="button" class="ai-edit-discard" onclick="this.closest(\\'.ai-edit-proposal\\').remove()">Discard</button>' +
    '</div>';
  box._proposal = { patch: data.patch || {}, actions: data.actions || [] };
  log.appendChild(box);
  log.scrollTop = log.scrollHeight;
}

async function aiEditApply(btn) {
  const box = btn.closest('.ai-edit-proposal');
  const proposal = box._proposal || { patch: {}, actions: [] };
  btn.disabled = true;
  btn.textContent = proposal.actions.length ? 'Generating…' : 'Applying…';
  try {
    await aiEditPostApply({ patch: proposal.patch, actions: proposal.actions });
    btn.textContent = '✓ Applied';
    aiEditAddMsg('ai', 'Done — preview updated.');
  } catch (error) {
    btn.disabled = false;
    btn.textContent = 'Apply';
    aiEditAddMsg('ai', '⚠️ ' + error.message);
  }
}

async function aiEditPostApply(payload) {
  const res = await fetch(\`/api/ai-builder/\${window.currentProjectId}/sections/\${window.currentSectionId}/ai-edit/apply\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to apply');
  const iframe = document.getElementById('preview-iframe');
  if (iframe) iframe.contentWindow.location.reload();
  if (typeof showNotification === 'function') showNotification('Section updated!', 'success');
  return data;
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
  status.textContent = 'Uploading…';
  const fd = new FormData();
  fd.append('file', file);
  fd.append('asset_type', 'section');
  try {
    const up = await fetch(\`/api/ai-builder/\${window.currentProjectId}/upload\`, { method: 'POST', body: fd });
    const updata = await up.json();
    if (!updata.success) throw new Error(updata.error || 'Upload failed');
    const isVideo = (file.type || '').startsWith('video');
    await aiEditPostApply(aiEditMediaPayload(updata.url, isVideo));
    status.textContent = '✓ Applied your ' + (isVideo ? 'video' : 'image') + '.';
  } catch (error) {
    status.textContent = '⚠️ ' + error.message;
  }
}

async function aiEditApplyUrl() {
  const url = (document.getElementById('ai-edit-url').value || '').trim();
  const status = document.getElementById('ai-edit-own-status');
  if (!/^https?:\\/\\//i.test(url)) { status.textContent = 'Enter a valid http(s) URL.'; return; }
  status.textContent = 'Applying…';
  try {
    const isVideo = /\\.(mp4|webm)(\\?|$)/i.test(url);
    await aiEditPostApply(aiEditMediaPayload(url, isVideo && window.aiEditIsHero));
    status.textContent = '✓ Applied.';
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
function aiPlaceholder(sectionType, canImage) {
  const map = {
    hero: 'Make the headline punchier' + (canImage ? ' · generate a new background image' : ''),
    about: 'Rewrite the story to be warmer',
    services: 'Add a service for emergency repairs',
    features: 'Make the feature descriptions shorter',
    testimonials: 'Fix the typo in the first quote',
    contact: 'Change the button to "Book Now"',
    gallery: canImage ? 'Generate a new photo of the storefront' : 'Update the gallery heading',
    footer: 'Update the tagline',
  };
  return (map[sectionType] || 'Describe what to change').replace(/'/g, '');
}
