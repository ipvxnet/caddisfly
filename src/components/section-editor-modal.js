// Section Editor Modal Component
// Generates an HTML modal for editing section content

import { generateAIEditPanel } from './ai-edit-panel.js';
import { renderLinkField, linkPickerAssets } from './link-picker.js';
import { translator } from '../i18n/index.js';
import { TESTIMONIAL_DEFAULTS } from '../templates/ai-builder/testimonials/cards.js';
import { TEAM_IMAGES } from '../templates/ai-builder/about/team.js';
import { TIMELINE_YEARS } from '../templates/ai-builder/about/timeline.js';
import { defaultItems, uiText } from '../templates/ai-builder/section-defaults.js';

/**
 * Generate section editor modal HTML
 * @param {object} section - Section data
 * @param {string} projectId - Project ID
 * @param {string} lang - Viewer's UI language (labels/buttons)
 * @param {string} siteLang - The SITE's language (drives placeholder content so
 *   the editor matches what the page renders — e.g. PT defaults, not EN)
 * @returns {string} Modal HTML
 */
export function generateSectionEditorModal(section, projectId, lang = 'en', linkData = null, siteLang = null, catCategories = null, hasMembers = false) {
  const tr = translator(lang);
  const contentLang = siteLang || lang;
  const content = JSON.parse(section.content_json || '{}');
  const lpData = linkData || { pages: [], sections: [], phone: '', email: '' };

  return `
<div id="section-editor-modal" class="modal-overlay" onclick="closeModalOnOutsideClick(event)">
  <div class="modal-content" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h2>${tr('sed.edit_section')}</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>

    <div class="modal-body">
      ${generateAIEditPanel(section, projectId, lang)}
      <script>window.linkPickerData = ${JSON.stringify(lpData)};</script>
      ${linkPickerAssets(lang)}

      <details class="manual-edit" open>
        <summary>${tr('sed.edit_manual')}</summary>
        <form id="section-edit-form" data-section-id="${section.id}" onsubmit="saveSectionChanges(event)">
          ${generateFormFields(section.section_type, content, tr, projectId, contentLang, catCategories, section.html_template)}

          ${['header', 'footer', 'hero'].includes(section.section_type) ? '' : `
          <div class="form-group">
            <label for="sed-appearance">${tr('sed.appearance')}</label>
            <select id="sed-appearance" name="_appearance">
              <option value=""${!content._appearance || content._appearance === 'auto' ? ' selected' : ''}>${tr('sed.appearance_auto')}</option>
              <option value="light"${content._appearance === 'light' ? ' selected' : ''}>${tr('sed.appearance_light')}</option>
              <option value="dark"${content._appearance === 'dark' ? ' selected' : ''}>${tr('sed.appearance_dark')}</option>
            </select>
            <small>${tr('sed.appearance_hint')}</small>
          </div>`}

          ${hasMembers && !['header', 'footer'].includes(section.section_type) ? `
          <div class="form-group">
            <label class="sed-check"><input type="checkbox" name="_members_only" value="1"${content._members_only ? ' checked' : ''}> 🔒 ${tr('sed.members_only')}</label>
            <small>${tr('sed.members_only_hint')}</small>
          </div>` : ''}

          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">${tr('sed.cancel')}</button>
            <button type="submit" class="btn-primary" id="save-btn">${tr('sed.save')}</button>
          </div>
        </form>
      </details>
    </div>
  </div>
</div>

<style>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* Light backdrop + left-docked panel so the preview on the right stays visible
     and you can watch the edited section while you work. */
  background: rgba(15, 23, 42, 0.18);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 10000;
  animation: fadeIn 0.2s ease-out;
  padding: 1rem;
  overflow-y: auto;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 460px;
  width: 100%;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  animation: slideUp 0.3s ease-out;
  margin: 0;
}

@media (min-width: 769px) {
  .modal-content { margin-left: 0.5rem; }
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 1.5rem;
  color: #1a202c;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f7fafc;
  color: #4a5568;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #e2e8f0;
  color: #1a202c;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group textarea {
  min-height: 100px;
  resize: vertical;
}

/* Inline checkbox row (e.g. "Members only") — the generic .form-group input rule
   above would otherwise blow the checkbox up to a full-width bordered box with the
   label wrapping underneath. Lay it out as a normal checkbox + inline label. */
.sed-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}
.sed-check input[type="checkbox"] {
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
  padding: 0;
  margin: 0;
  border-width: 1.5px;
  border-radius: 5px;
  box-shadow: none;
  cursor: pointer;
}

.form-group small {
  display: block;
  color: #718096;
  margin-top: 0.25rem;
  font-size: 0.875rem;
}

.image-upload-area {
  border: 2px dashed #cbd5e0;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  background: #f7fafc;
  cursor: pointer;
  transition: all 0.2s;
}

.image-upload-area:hover {
  border-color: #667eea;
  background: #eef2ff;
}

.image-upload-area.uploading {
  opacity: 0.6;
  pointer-events: none;
}

.image-preview {
  margin-top: 1rem;
  max-width: 100%;
  border-radius: 8px;
  max-height: 200px;
  object-fit: cover;
}

.upload-progress {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #667eea;
}

.gallery-manager {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.25rem 0 0.75rem;
}
.gallery-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}
.gallery-row.drag-over {
  border-color: #7c3aed;
  background: #faf5ff;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15) inset;
}
.gallery-drag {
  flex: 0 0 auto;
  cursor: grab;
  color: #a0aec0;
  font-size: 1rem;
  user-select: none;
  padding: 0 0.1rem;
}
.gallery-drag:active { cursor: grabbing; }
.gallery-thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 6px;
  background: #f1f5f9;
  flex: 0 0 auto;
}
.gallery-alt {
  flex: 1;
  min-width: 0;
  padding: 0.4rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.8rem;
}
.gallery-row-actions {
  display: flex;
  gap: 0.25rem;
  flex: 0 0 auto;
}
.gallery-row-actions button {
  padding: 0.35rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
}
.gallery-row-actions button:hover:not(:disabled) { border-color: #7c3aed; background: #faf5ff; }
.gallery-row-actions button:disabled { opacity: 0.35; cursor: default; }
.gallery-row-actions .gallery-del { color: #b91c1c; border-color: #fecaca; }
.gallery-row-actions .gallery-del:hover { background: #fef2f2; border-color: #f87171; }
.gallery-add-btn {
  padding: 0.5rem 0.9rem;
  border: 1px dashed #7c3aed;
  border-radius: 8px;
  background: #faf5ff;
  color: #7c3aed;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.gallery-add-btn:hover { background: #f3e8ff; }

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
  margin-top: 1.5rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #4a5568;
  border: 2px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #f7fafc;
  border-color: #cbd5e0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Pricing plans editor */
.plan-card { border: 1.5px solid #e2e8f0; border-radius: 12px; padding: .9rem; margin-bottom: .8rem; background: #fafbff; }
.plan-card input, .plan-card textarea, .plan-card select { width: 100%; padding: .5rem .6rem; border: 1.5px solid #e2e8f0; border-radius: 8px; font: inherit; font-size: .88rem; }
.plan-card textarea { margin-top: .5rem; resize: vertical; }
.plan-row { display: flex; gap: .5rem; }
.plan-row .plan-price, .plan-row .plan-period { max-width: 32%; }
.plan-foot { justify-content: space-between; align-items: center; margin-top: .5rem; }
.plan-foot label { display: flex; align-items: center; gap: .35rem; font-size: .85rem; color: #4a5568; }
.plan-foot label input { width: auto; }
.plan-remove { background: none; border: none; color: #b91c1c; font-size: .85rem; font-weight: 600; cursor: pointer; }
.plan-sub { margin-top: .6rem; padding-top: .6rem; border-top: 1px dashed #e2e8f0; }
.plan-sub-label { display: block; font-size: .8rem; font-weight: 700; color: #4a5568; margin-bottom: .3rem; }
.plan-sub-note { font-size: .82rem; color: #718096; margin: 0; }
.plan-sub-new { display: flex; gap: .45rem; margin-top: .5rem; flex-wrap: wrap; }
.plan-sub-new input, .plan-sub-new select { flex: 1; min-width: 110px; }
.plan-sub-new button { flex: none; }

.manual-edit > summary {
  cursor: pointer;
  font-weight: 600;
  color: #4a5568;
  padding: 0.5rem 0;
  font-size: 0.9rem;
}

.manual-edit[open] > summary {
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .modal-content {
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-overlay {
    padding: 0;
  }
}
</style>

<script>
window.currentSectionId = ${section.id};
window.currentProjectId = '${projectId}';

function closeModal() {
  const modal = document.getElementById('section-editor-modal');
  // editSection wraps everything in a host element; remove the whole host so the
  // injected styles/scripts go with it.
  const host = document.getElementById('section-editor-host');
  if (modal) modal.style.animation = 'fadeOut 0.2s ease-out';
  setTimeout(() => {
    const el = host || modal;
    if (el) el.remove();
  }, 200);
}

function closeModalOnOutsideClick(event) {
  if (event.target.classList.contains('modal-overlay')) {
    closeModal();
  }
}

async function saveSectionChanges(event) {
  event.preventDefault();

  const form = event.target;
  // The save target comes from the FORM itself, never the window globals — a
  // stale window.currentSectionId once saved one section's form onto ANOTHER
  // section's row (prod hero wiped with navbar fields, 2026-06-11).
  const sectionId = form.dataset.sectionId;
  if (!sectionId) { alert('Editor out of sync — please reopen this section.'); return; }
  const formData = new FormData(form);
  const saveBtn = document.getElementById('save-btn');

  // Build content object from form data
  const content = {};
  for (let [key, value] of formData.entries()) {
    if (key.endsWith('[]')) {
      // Handle arrays (like services, testimonials)
      const arrayKey = key.replace('[]', '');
      if (!content[arrayKey]) content[arrayKey] = [];
      content[arrayKey].push(value);
    } else {
      content[key] = value;
    }
  }

  // Array sections (gallery images, pricing plans, footer links, services,
  // testimonials) travel as a hidden <key>_json blob — expand each into content[key].
  Object.keys(content).filter((k) => k.endsWith('_json')).forEach((k) => {
    const base = k.slice(0, -5);
    try { content[base] = JSON.parse(content[k]) || []; } catch (e) { content[base] = []; }
    delete content[k];
  });

  // Checkboxes are absent from FormData when unchecked — send the boolean
  // explicitly so unchecking actually CLEARS the flag (merge keeps the old value
  // otherwise). Only when the control is present (entitled owners).
  const moCheck = form.querySelector('input[name="_members_only"]');
  if (moCheck) content._members_only = moCheck.checked;

  // Contact optional form-fields: serialize the catalog checkboxes explicitly
  // into [{key,required}] (FormData omits unchecked boxes, so an uncheck must
  // actively clear; these controls carry no name attr to avoid stray keys).
  const ffEnables = form.querySelectorAll('input[data-ff-enable]');
  if (ffEnables.length) {
    const fields = [];
    ffEnables.forEach((cb) => {
      if (!cb.checked) return;
      const key = cb.getAttribute('data-ff-enable');
      const reqCb = form.querySelector('input[data-ff-required="' + key + '"]');
      fields.push({ key, required: !!(reqCb && reqCb.checked) });
    });
    content.form_fields = fields;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = ${JSON.stringify(tr('sed.saving'))};

  try {
    const response = await fetch(\`/api/ai-builder/\${window.currentProjectId}/sections/\${sectionId}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    const data = await response.json();

    if (data.success) {
      // Reload preview iframe if it exists
      const previewIframe = document.getElementById('preview-iframe');
      if (previewIframe) {
        previewIframe.contentWindow.location.reload();
      }

      closeModal();

      // Show success message
      showNotification(${JSON.stringify(tr('sed.updated'))}, 'success');
    } else {
      throw new Error(data.error || ${JSON.stringify(tr('sed.save_failed'))});
    }
  } catch (error) {
    alert(${JSON.stringify(tr('sed.save_failed_p'))} + error.message);
    saveBtn.disabled = false;
    saveBtn.textContent = ${JSON.stringify(tr('sed.save'))};
  }
}

async function uploadImage(input, fieldName) {
  const file = input.files[0];
  if (!file) return;

  const uploadArea = input.closest('.image-upload-area');
  uploadArea.classList.add('uploading');

  const progressDiv = uploadArea.querySelector('.upload-progress');
  if (progressDiv) progressDiv.textContent = ${JSON.stringify(tr('sed.uploading'))};

  const formData = new FormData();
  formData.append('file', file);
  formData.append('asset_type', fieldName);

  try {
    const response = await fetch(\`/api/ai-builder/\${window.currentProjectId}/upload\`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      // Update hidden input with URL
      const urlInput = document.getElementById(fieldName);
      if (urlInput) urlInput.value = data.url;

      // Show preview
      const preview = uploadArea.querySelector('.image-preview');
      if (preview) {
        preview.src = data.url;
        preview.style.display = 'block';
      }

      if (progressDiv) progressDiv.textContent = ${JSON.stringify(tr('sed.upload_complete'))};
    } else {
      throw new Error(data.error || ${JSON.stringify(tr('sed.upload_failed'))});
    }
  } catch (error) {
    alert(${JSON.stringify(tr('sed.upload_failed_p'))} + error.message);
  } finally {
    uploadArea.classList.remove('uploading');
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = \`
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: \${type === 'success' ? '#48bb78' : '#667eea'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10001;
    animation: slideInRight 0.3s ease-out;
  \`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ---- Gallery photo manager (reorder / replace / remove / add) ----
// The hidden #gallery-images-json input is the single source of truth; it is
// kept in sync on every change and picked up by saveSectionChanges.
function galleryRead() {
  const el = document.getElementById('gallery-images-json');
  if (!el) return [];
  try { return JSON.parse(el.value || '[]') || []; } catch (e) { return []; }
}
function galleryWrite(imgs) {
  const el = document.getElementById('gallery-images-json');
  if (el) el.value = JSON.stringify(imgs);
}
function galleryEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function galleryRender() {
  const wrap = document.getElementById('gallery-manager');
  if (!wrap) return;
  const imgs = galleryRead();
  if (!imgs.length) {
    wrap.innerHTML = '<p style="color:#718096;font-size:.85rem;margin:.25rem 0">' + ${JSON.stringify(tr('sed.no_photos'))} + '</p>';
    return;
  }
  wrap.innerHTML = imgs.map(function (img, i) {
    return '<div class="gallery-row" data-gi="' + i + '" ondragover="galleryDragOver(event)" ondragleave="galleryDragLeave(event)" ondrop="galleryDrop(event,' + i + ')">'
      + '<span class="gallery-drag" draggable="true" title="' + ${JSON.stringify(tr('sed.g_drag'))} + '" ondragstart="galleryDragStart(event,' + i + ')" ondragend="galleryDragEnd(event)">⋮⋮</span>'
      + '<img class="gallery-thumb" src="' + galleryEsc(img.url || '') + '" alt="">'
      + '<input class="gallery-alt" type="text" placeholder="' + ${JSON.stringify(tr('sed.g_alt_ph'))} + '" value="' + galleryEsc(img.alt || '') + '" oninput="gallerySetAlt(' + i + ', this.value)">'
      + '<div class="gallery-row-actions">'
      + '<button type="button" title="' + ${JSON.stringify(tr('sed.g_replace_t'))} + '" onclick="galleryReplace(' + i + ')">' + ${JSON.stringify(tr('sed.g_replace'))} + '</button>'
      + '<button type="button" title="' + ${JSON.stringify(tr('sed.img_url'))} + '" onclick="galleryUrl(' + i + ')">🔗</button>'
      + '<button type="button" title="' + ${JSON.stringify(tr('sed.img_photo'))} + '" onclick="galleryStock(' + i + ', this)">📷</button>'
      + '<button type="button" title="' + ${JSON.stringify(tr('sed.img_ai'))} + '" onclick="galleryAI(' + i + ', this)">✨</button>'
      + '<button type="button" class="gallery-del" title="' + ${JSON.stringify(tr('sed.g_remove_t'))} + '" onclick="galleryRemove(' + i + ')">🗑</button>'
      + '</div></div>';
  }).join('');
}
function gallerySetAlt(i, val) { const imgs = galleryRead(); if (imgs[i]) { imgs[i].alt = val; galleryWrite(imgs); } }
function galleryRemove(i) { const imgs = galleryRead(); imgs.splice(i, 1); galleryWrite(imgs); galleryRender(); }
// Grounding query for a photo: its alt text, else the section heading.
function galleryQuery(i) {
  const imgs = galleryRead();
  const alt = (imgs[i] && imgs[i].alt) || '';
  const h = (document.getElementById('heading') || {}).value || '';
  return alt || h || 'business';
}
function galleryUrl(i) {
  const u = prompt(${JSON.stringify(tr('sed.img_url_prompt'))});
  if (u && u.trim()) { const imgs = galleryRead(); if (imgs[i]) { imgs[i].url = u.trim(); galleryWrite(imgs); galleryRender(); } }
}
async function galleryStock(i, btn) {
  if (btn) btn.disabled = true;
  try {
    const r = await fetch('/api/ai-builder/' + window.currentProjectId + '/stock-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: galleryQuery(i) }) });
    const d = await r.json();
    if (d.success) { const imgs = galleryRead(); if (imgs[i]) { imgs[i].url = d.url; if (!imgs[i].alt && d.alt) imgs[i].alt = d.alt; } galleryWrite(imgs); }
    else alert(d.error || ${JSON.stringify(tr('sed.img_fail'))});
  } catch (e) { alert(${JSON.stringify(tr('sed.img_fail'))}); }
  finally { galleryRender(); }
}
async function galleryAI(i, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    const r = await fetch('/api/ai-builder/' + window.currentProjectId + '/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: galleryQuery(i) }) });
    const d = await r.json();
    if (d.success) { const imgs = galleryRead(); if (imgs[i]) imgs[i].url = d.url; galleryWrite(imgs); }
    else alert(d.error || ${JSON.stringify(tr('sed.img_fail'))});
  } catch (e) { alert(${JSON.stringify(tr('sed.img_fail'))}); }
  finally { galleryRender(); }
}
async function gallerySwapAll() {
  const n = galleryRead().length;
  for (let i = 0; i < n; i++) {
    try {
      const r = await fetch('/api/ai-builder/' + window.currentProjectId + '/stock-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: galleryQuery(i), skip: i % 6 }) });
      const d = await r.json();
      if (d.success) { const cur = galleryRead(); if (cur[i]) { cur[i].url = d.url; if (!cur[i].alt && d.alt) cur[i].alt = d.alt; } galleryWrite(cur); }
    } catch (e) { /* skip */ }
  }
  galleryRender();
}

// Drag-to-reorder gallery photos.
window.__galleryDragIndex = -1;
function galleryDragStart(e, i) {
  window.__galleryDragIndex = i;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', String(i)); } catch (_) {}
}
function galleryDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const row = e.currentTarget;
  if (row && row.classList) row.classList.add('drag-over');
}
function galleryDragLeave(e) {
  const row = e.currentTarget;
  if (row && row.classList) row.classList.remove('drag-over');
}
function galleryDrop(e, target) {
  e.preventDefault();
  const from = window.__galleryDragIndex;
  window.__galleryDragIndex = -1;
  if (from < 0 || from === target) { galleryRender(); return; }
  const imgs = galleryRead();
  if (from >= imgs.length) { galleryRender(); return; }
  const moved = imgs.splice(from, 1)[0];
  imgs.splice(target, 0, moved);
  galleryWrite(imgs);
  galleryRender();
}
function galleryDragEnd() {
  window.__galleryDragIndex = -1;
  document.querySelectorAll('.gallery-row.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
}
window.__galleryReplaceIndex = -1;
function galleryReplace(i) { window.__galleryReplaceIndex = i; document.getElementById('gallery-replace-input').click(); }
async function galleryUploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('asset_type', 'gallery');
  const res = await fetch(\`/api/ai-builder/\${window.currentProjectId}/upload\`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || ${JSON.stringify(tr('sed.upload_failed'))});
  return data.url;
}
async function galleryAddImage(input) {
  const file = input.files[0]; if (!file) return; input.value = '';
  try { const url = await galleryUploadFile(file); const imgs = galleryRead(); imgs.push({ url: url, alt: '', caption: '' }); galleryWrite(imgs); galleryRender(); }
  catch (e) { alert(${JSON.stringify(tr('sed.upload_failed_p'))} + e.message); }
}
async function galleryReplaceUpload(input) {
  const file = input.files[0]; if (!file) return; input.value = '';
  const i = window.__galleryReplaceIndex; if (i < 0) return;
  try { const url = await galleryUploadFile(file); const imgs = galleryRead(); if (imgs[i]) imgs[i].url = url; galleryWrite(imgs); galleryRender(); }
  catch (e) { alert(${JSON.stringify(tr('sed.upload_failed_p'))} + e.message); }
}
// Add a Drive image to the gallery (uses the shared picker; appends to the list).
function galleryAddFromDrive() {
  if (!window.__drivePicker) return;
  window.__drivePicker(function (url) { const imgs = galleryRead(); imgs.push({ url: url, alt: '', caption: '' }); galleryWrite(imgs); galleryRender(); });
}

// Initialise the gallery manager if this section has one (runs on inject).
galleryRender();

// ---- Pricing plans editor (plans_json hidden field; runs on inject) -------
const PLANS_T = ${JSON.stringify({
  name: tr('sed.plan_name'),
  price_text: tr('sed.plan_price_text'),
  period: tr('sed.plan_period'),
  features: tr('sed.plan_features'),
  features_hint: tr('sed.plan_features_hint'),
  highlighted: tr('sed.plan_highlighted'),
  remove: tr('sed.plan_remove'),
  sub_label: tr('sed.sub_label'),
  sub_loading: tr('sed.sub_loading'),
  sub_none: tr('sed.sub_none'),
  sub_new: tr('sed.sub_new'),
  sub_connect_first: tr('sed.sub_connect_first'),
  sub_open_store: tr('sed.sub_open_store'),
  sub_name_ph: tr('sed.sub_name_ph'),
  sub_amount_ph: tr('sed.sub_amount_ph'),
  per_month: tr('sed.per_month'),
  per_year: tr('sed.per_year'),
  sub_create: tr('sed.sub_create'),
  sub_creating: tr('sed.sub_creating'),
  sub_err: tr('sed.sub_err'),
})};
function escH(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function plansRead() { const el = document.getElementById('plans_json'); try { return JSON.parse(el.value) || []; } catch (e) { return []; } }
function plansWrite(p) { document.getElementById('plans_json').value = JSON.stringify(p); }
function planField(i, key, value) { const p = plansRead(); if (!p[i]) return; p[i][key] = value; plansWrite(p); }
function planFeatures(i, text) { const p = plansRead(); if (!p[i]) return; p[i].features = text.split('\\n').map(function (s) { return s.trim(); }).filter(Boolean); plansWrite(p); }
function planHighlight(i, on) { const p = plansRead(); p.forEach(function (pl, j) { pl.highlighted = on ? j === i : (j === i ? false : pl.highlighted); }); plansWrite(p); plansRender(); }
function addPlan() { const p = plansRead(); p.push({ name: 'New plan', price: '$0', period: PLANS_T.per_month, features: [], highlighted: false }); plansWrite(p); plansRender(); }
function removePlan(i) { const p = plansRead(); p.splice(i, 1); plansWrite(p); plansRender(); }
function subMoney(amount, currency) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format((amount || 0) / 100); }
  catch (e) { return ((amount || 0) / 100).toFixed(2) + ' ' + (currency || 'usd').toUpperCase(); }
}
window.__subPrices = undefined; // undefined = loading, object = loaded
async function plansLoadPrices() {
  try {
    const r = await fetch('/api/ai-builder/' + window.currentProjectId + '/store/prices');
    const d = await r.json().catch(function () { return {}; });
    window.__subPrices = d && d.success ? d : { connected: false, prices: [] };
  } catch (e) { window.__subPrices = { connected: false, prices: [] }; }
  plansRender();
}
function planSubBlock(plan, i) {
  const sp = window.__subPrices;
  if (sp === undefined) return '<p class="plan-sub-note">' + PLANS_T.sub_loading + '</p>';
  if (!sp.connected) {
    return '<p class="plan-sub-note">' + PLANS_T.sub_connect_first +
      ' <a href="/ai-builder/store/' + window.currentProjectId + '" target="_blank" rel="noopener">' + PLANS_T.sub_open_store + '</a></p>';
  }
  const cur = plan.stripe_price_id || '';
  const known = sp.prices.some(function (p) { return p.id === cur; });
  let opts = '<option value="">' + PLANS_T.sub_none + '</option>';
  sp.prices.forEach(function (p) {
    opts += '<option value="' + escH(p.id) + '"' + (p.id === cur ? ' selected' : '') + '>' +
      escH(p.product_name) + ' — ' + subMoney(p.amount, p.currency) + ' / ' + escH(p.interval) + '</option>';
  });
  if (cur && !known) opts += '<option value="' + escH(cur) + '" selected>' + escH(cur) + '</option>';
  opts += '<option value="__new">' + PLANS_T.sub_new + '</option>';
  return '<label class="plan-sub-label">' + PLANS_T.sub_label + '</label>' +
    '<select onchange="planAttach(' + i + ', this)">' + opts + '</select>' +
    '<div class="plan-sub-new" id="plan-sub-new-' + i + '" hidden>' +
      '<input type="text" id="sub-name-' + i + '" placeholder="' + escH(PLANS_T.sub_name_ph) + '" value="' + escH(plan.name || '') + '">' +
      '<input type="number" id="sub-amount-' + i + '" min="0.5" step="0.01" placeholder="' + escH(PLANS_T.sub_amount_ph) + '">' +
      '<select id="sub-interval-' + i + '"><option value="month">' + PLANS_T.per_month + '</option><option value="year">' + PLANS_T.per_year + '</option></select>' +
      '<button type="button" class="btn-secondary" onclick="planCreatePrice(' + i + ', this)">' + PLANS_T.sub_create + '</button>' +
    '</div>';
}
function planAttachPrice(i, priceObj) {
  const p = plansRead(); if (!p[i]) return;
  p[i].stripe_price_id = priceObj ? priceObj.id : '';
  if (priceObj) {
    // Sync the card's display text to the real billed amount (still editable).
    p[i].price = subMoney(priceObj.amount, priceObj.currency);
    p[i].period = priceObj.interval === 'year' ? PLANS_T.per_year : PLANS_T.per_month;
  }
  plansWrite(p); plansRender();
}
function planAttach(i, sel) {
  const v = sel.value;
  if (v === '__new') { const row = document.getElementById('plan-sub-new-' + i); if (row) row.hidden = false; return; }
  if (!v) { planAttachPrice(i, null); return; }
  const sp = window.__subPrices || { prices: [] };
  planAttachPrice(i, sp.prices.find(function (p) { return p.id === v; }) || { id: v });
}
async function planCreatePrice(i, btn) {
  const name = (document.getElementById('sub-name-' + i).value || '').trim();
  const amount = Math.round(parseFloat(document.getElementById('sub-amount-' + i).value) * 100);
  const interval = document.getElementById('sub-interval-' + i).value;
  if (!name || !Number.isFinite(amount) || amount <= 0) { alert(PLANS_T.sub_err); return; }
  btn.disabled = true; btn.textContent = PLANS_T.sub_creating;
  try {
    const r = await fetch('/api/ai-builder/' + window.currentProjectId + '/store/prices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, amount_cents: amount, interval: interval }),
    });
    const d = await r.json().catch(function () { return {}; });
    if (!r.ok || !d.success) throw new Error((d && d.error) || PLANS_T.sub_err);
    if (window.__subPrices && window.__subPrices.prices) window.__subPrices.prices.push(d.price);
    planAttachPrice(i, d.price);
  } catch (e) { alert(e.message || PLANS_T.sub_err); btn.disabled = false; btn.textContent = PLANS_T.sub_create; }
}
function plansRender() {
  const box = document.getElementById('plans-editor');
  if (!box) return;
  const plans = plansRead();
  box.innerHTML = plans.map(function (plan, i) {
    return '<div class="plan-card">' +
      '<div class="plan-row">' +
        '<input type="text" value="' + escH(plan.name || '') + '" placeholder="' + PLANS_T.name + '" oninput="planField(' + i + ', \\'name\\', this.value)">' +
        '<input type="text" class="plan-price" value="' + escH(plan.price || '') + '" placeholder="' + PLANS_T.price_text + '" oninput="planField(' + i + ', \\'price\\', this.value)">' +
        '<input type="text" class="plan-period" value="' + escH(plan.period || '') + '" placeholder="' + PLANS_T.period + '" oninput="planField(' + i + ', \\'period\\', this.value)">' +
      '</div>' +
      '<textarea rows="3" placeholder="' + PLANS_T.features_hint + '" oninput="planFeatures(' + i + ', this.value)">' + escH((plan.features || []).join('\\n')) + '</textarea>' +
      '<div class="plan-row plan-foot">' +
        '<label><input type="checkbox"' + (plan.highlighted ? ' checked' : '') + ' onchange="planHighlight(' + i + ', this.checked)"> ' + PLANS_T.highlighted + '</label>' +
        '<button type="button" class="plan-remove" onclick="removePlan(' + i + ')">' + PLANS_T.remove + '</button>' +
      '</div>' +
      '<div class="plan-sub">' + planSubBlock(plan, i) + '</div>' +
    '</div>';
  }).join('');
}
// Initialise the plans editor if this section has one (runs on inject).
if (document.getElementById('plans-editor')) { plansRender(); plansLoadPrices(); }

// ---- Insert from Drive: a picker available on EVERY image field -------------
// Exposes window.__drivePicker(applyFn): opens the overlay, and on thumbnail
// click calls applyFn(url). Single-image upload areas (hero/about) get a button
// injected here; repeatable-item images + the gallery call __drivePicker from
// their own server-rendered buttons (repImgDrive / galleryAddFromDrive).
(function(){
  var DP = ${JSON.stringify({ btn: tr('sed.from_drive'), title: tr('sed.drive_title'), empty: tr('sed.drive_empty'), loading: tr('sed.drive_loading'), err: tr('sed.drive_err') })};
  var overlay = null, applyFn = null;
  function ensureOverlay(){
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;z-index:10002;padding:1rem';
    overlay.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:680px;width:100%;max-height:80vh;overflow:auto;padding:1.2rem"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem"><strong>' + DP.title + '</strong><button type="button" class="dp-x" style="border:none;background:none;font-size:1.2rem;cursor:pointer">✕</button></div><div class="dp-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem"></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.style.display = 'none'; });
    overlay.querySelector('.dp-x').addEventListener('click', function(){ overlay.style.display = 'none'; });
    return overlay;
  }
  window.__drivePicker = async function(apply){
    applyFn = apply; var o = ensureOverlay(); var grid = o.querySelector('.dp-grid');
    grid.innerHTML = '<p style="color:#718096">' + DP.loading + '</p>'; o.style.display = 'flex';
    try {
      var res = await fetch('/api/drive/images'); var d = await res.json(); var imgs = (d && d.images) || [];
      if (!imgs.length) { grid.innerHTML = '<p style="color:#718096">' + DP.empty + '</p>'; return; }
      grid.innerHTML = '';
      imgs.forEach(function(im){
        var b = document.createElement('button'); b.type = 'button'; b.title = im.name;
        b.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:0;cursor:pointer;background:#fff;overflow:hidden;aspect-ratio:1';
        var img = document.createElement('img'); img.src = im.url; img.loading = 'lazy'; img.style.cssText = 'width:100%;height:100%;object-fit:cover'; b.appendChild(img);
        b.addEventListener('click', function(){ if (applyFn) applyFn(im.url); o.style.display = 'none'; });
        grid.appendChild(b);
      });
    } catch (e) { grid.innerHTML = '<p style="color:#b91c1c">' + DP.err + '</p>'; }
  };
  // Single-image upload areas (hero/about/etc.): inject a "From Drive" button.
  var modal = document.getElementById('section-editor-modal');
  if (modal) modal.querySelectorAll('.image-upload-area').forEach(function(area){
    var fg = area.closest('.form-group') || area.parentElement;
    var field = fg && fg.querySelector('input[type=hidden]');
    var prev = area.querySelector('.image-preview');
    if (!field) return;
    var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = DP.btn;
    btn.style.cssText = 'margin-top:.5rem;background:none;border:1px solid #cbd5e0;border-radius:8px;padding:.35rem .7rem;font-size:.82rem;font-weight:600;color:#4a5568;cursor:pointer';
    btn.addEventListener('click', function(e){ e.stopPropagation(); window.__drivePicker(function(url){ field.value = url; if (prev) { prev.src = url; prev.style.display = 'block'; } }); });
    area.parentNode.insertBefore(btn, area.nextSibling);
  });
})();
</script>
  `;
}

/**
 * Generate form fields based on section type
 */
// Catalogue section: heading/subheading + a category FILTER. One catalogue
// section shows one category (empty = all items), so multiple sections on
// different pages can each show a different category.
function generateCatalogueFields(content, tr, catCategories) {
  const cats = Array.isArray(catCategories) ? catCategories.slice() : [];
  const sel = content.category || '';
  // Preserve a manually-set category even if it currently has no products.
  if (sel && !cats.includes(sel)) cats.unshift(sel);
  const options = [`<option value="">${escapeHtml(tr('sed.cat_all'))}</option>`]
    .concat(cats.map((c) => `<option value="${escapeHtml(c)}"${c === sel ? ' selected' : ''}>${escapeHtml(c)}</option>`))
    .join('');
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || '')}" placeholder="${escapeHtml(tr('sed.ph_optional'))}">
    </div>
    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" placeholder="${escapeHtml(tr('sed.ph_optional'))}">
    </div>
    <div class="form-group">
      <label for="category">${tr('sed.cat_filter')}</label>
      <select id="category" name="category">${options}</select>
      <small>${tr('sed.cat_filter_hint')}</small>
    </div>
  `;
}

function generateFormFields(sectionType, content, tr, projectId = '', contentLang = 'en', catCategories = null, variant = 'default') {
  switch (sectionType) {
    case 'hero':
      return generateHeroFields(content, tr);
    case 'about':
      return generateAboutFields(content, tr, variant, contentLang);
    case 'catalogue':
      return generateCatalogueFields(content, tr, catCategories);
    case 'services':
      return generateServicesFields(content, tr);
    case 'testimonials':
      return generateTestimonialsFields(content, tr, contentLang);
    case 'contact':
      return generateContactFields(content, tr);
    case 'gallery':
      return generateGalleryFields(content, tr);
    case 'footer':
      return generateFooterFields(content, tr);
    case 'header':
      return generateHeaderFields(content, tr);
    case 'cta':
      return generateCtaFields(content, tr);
    case 'pricing':
      return generatePricingFields(content, tr);
    case 'products':
      return generateProductsFields(content, tr, projectId);
    case 'booking':
      return generateBookingFields(content, tr, projectId);
    case 'instagram_feed':
      return generateInstagramFeedFields(content, tr);
    case 'members':
      return generateMembersFields(content, tr);
    default:
      return `<p>${tr('sed.not_supported')}</p>`;
  }
}

/**
 * 🛍 Featured products: text + how-many; the products themselves come from the
 * Store page (live injection at render — nothing to manage here).
 */
function generateProductsFields(content, tr, projectId) {
  const count = [3, 6, 9].includes(parseInt(content.count, 10)) ? parseInt(content.count, 10) : 3;
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || '')}" placeholder="${tr('sed.feat_heading_ph')}">
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}">
    </div>

    <div class="form-group">
      <label for="count">${tr('sed.feat_count')}</label>
      <select id="count" name="count">
        ${[3, 6, 9].map((n) => `<option value="${n}"${n === count ? ' selected' : ''}>${n}</option>`).join('')}
      </select>
    </div>

    <div class="form-group">
      <label for="cta_text">${tr('sed.button_text')}</label>
      <input type="text" id="cta_text" name="cta_text" value="${escapeHtml(content.cta_text || '')}" placeholder="${tr('sed.feat_cta_ph')}">
    </div>

    <p style="color: #718096; font-size: .85rem;">${tr('sed.feat_hint')}
      <a href="/ai-builder/store/${escapeHtml(projectId)}" target="_blank" rel="noopener">${tr('sed.feat_store_link')}</a>
    </p>
  `;
}

/**
 * 📅 Bookings: text only; the services, hours, and slots come from the Booking
 * manager (live injection at render — nothing to manage here).
 */
function generateBookingFields(content, tr, projectId) {
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || '')}" placeholder="${tr('sed.bkg_heading_ph')}">
    </div>

    <div class="form-group">
      <label for="description">${tr('sed.description')}</label>
      <input type="text" id="description" name="description" value="${escapeHtml(content.description || '')}">
    </div>

    <p style="color: #718096; font-size: .85rem;">${tr('sed.bkg_hint')}
      <a href="/ai-builder/bookings/${escapeHtml(projectId)}" target="_blank" rel="noopener">${tr('sed.bkg_manager_link')}</a>
    </p>
  `;
}

/**
 * 📷 Instagram Feed: heading/subheading + the merchant's Behold.so feed ID and
 * how many posts to show. Posts are fetched live in the browser at view time
 * (nothing stored here). The feed ID comes from a free behold.so account.
 */
function generateInstagramFeedFields(content, tr) {
  const count = [4, 6, 8, 12].includes(parseInt(content.count, 10)) ? parseInt(content.count, 10) : 6;
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || '')}" placeholder="${tr('sed.igf_heading_ph')}">
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}">
    </div>

    <div class="form-group">
      <label for="feed_id">${tr('sed.igf_feed_id')}</label>
      <input type="text" id="feed_id" name="feed_id" value="${escapeHtml(content.feed_id || '')}" placeholder="e.g. aB3xY9…">
      <small style="display:block;color:#718096;margin-top:.35rem">${tr('sed.igf_feed_hint')}
        <a href="https://behold.so" target="_blank" rel="noopener">behold.so ↗</a></small>
    </div>

    <div class="form-group">
      <label for="count">${tr('sed.igf_count')}</label>
      <select id="count" name="count">
        ${[4, 6, 8, 12].map((n) => `<option value="${n}"${n === count ? ' selected' : ''}>${n}</option>`).join('')}
      </select>
    </div>
  `;
}

/**
 * 👤 Member sign-in: heading/subheading only. The widget itself (login form /
 * account state) is self-contained and talks to the member API at render time.
 * Manage the member list from the dashboard Members manager.
 */
function generateMembersFields(content, tr) {
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || '')}" placeholder="${tr('sed.mbr_heading_ph')}">
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}">
    </div>

    <p style="color: #718096; font-size: .85rem;">${tr('sed.mbr_hint')}</p>
  `;
}

/**
 * Pricing section: heading/description + a per-plan editor (name, price text,
 * features, highlight) where each plan can attach a RECURRING Stripe price
 * from the merchant's connected account (or create one) — that turns the
 * card's CTA into a live Subscribe button on the published site. Plans travel
 * as a JSON blob in a hidden field (gallery images pattern).
 */
function generatePricingFields(content, tr) {
  const plans = Array.isArray(content.plans) ? content.plans : [];
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || 'Pricing')}" required>
    </div>

    <div class="form-group">
      <label for="description">${tr('sed.subheading')}</label>
      <input type="text" id="description" name="description" value="${escapeHtml(content.description || '')}">
    </div>

    <input type="hidden" id="plans_json" name="plans_json" value="${escapeHtml(JSON.stringify(plans))}">
    <div class="form-group">
      <label>${tr('sed.plans')}</label>
      <small>${tr('sed.plans_hint')}</small>
      <div id="plans-editor"></div>
      <button type="button" class="btn-secondary" onclick="addPlan()">${tr('sed.add_plan')}</button>
    </div>
  `;
}

function generateHeroFields(content, tr) {
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || '')}" required>
      <small>${tr('sed.hl_hint')}</small>
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <textarea id="subheading" name="subheading" required>${escapeHtml(content.subheading || '')}</textarea>
      <small>${tr('sed.sub_hint')}</small>
    </div>

    <div class="form-group">
      <label for="hero-tags-input">${tr('sed.f_tags')}</label>
      <input type="hidden" name="tags_json" id="hero-tags-json" value="${escapeHtml(JSON.stringify(Array.isArray(content.tags) ? content.tags : []))}">
      <input type="text" id="hero-tags-input" value="${escapeHtml((Array.isArray(content.tags) ? content.tags : []).join(', '))}" placeholder="${escapeHtml(tr('sed.tags_ph'))}" oninput="var j=document.getElementById('hero-tags-json'); if (j) j.value = JSON.stringify(this.value.split(',').map(function(s){return s.trim();}).filter(Boolean));">
      <small>${tr('sed.tags_hint')}</small>
    </div>

    <div class="form-group">
      <label for="cta_text">${tr('sed.button_text')}</label>
      <input type="text" id="cta_text" name="cta_text" value="${escapeHtml(content.cta_text || tr('sed.ph_get_started'))}" required>
    </div>

    <div class="form-group">
      <label>${tr('sed.button_link')}</label>
      ${renderLinkField({ name: 'cta_link', value: content.cta_link || '#contact', newTab: !!content.cta_link_new_tab })}
    </div>

    <div class="form-group">
      <label>${tr('sed.bg_image')}</label>
      <input type="hidden" id="image_url" name="image_url" value="${escapeHtml(content.image_url || '')}">
      <div class="image-upload-area" onclick="document.getElementById('hero-image-input').click()">
        <p>${tr('sed.click_upload')}</p>
        <p style="font-size: 0.875rem; color: #718096;">${tr('sed.img_formats')}</p>
        <img src="${content.image_url || ''}" class="image-preview" style="display: ${content.image_url ? 'block' : 'none'}">
        <div class="upload-progress"></div>
      </div>
      <input type="file" id="hero-image-input" accept="image/*" style="display: none" onchange="uploadImage(this, 'image_url')">
    </div>
  `;
}

// About is the one section whose VARIANTS have different content shapes
// (text-image vs team vs timeline vs founder-quote), so its editor must be
// variant-aware — otherwise switching to e.g. "team" showed text-image fields
// and no way to edit team members or their photos.
function generateAboutFields(content, tr, variant = 'default', contentLang = 'en') {
  switch (variant) {
    case 'team': return generateAboutTeamFields(content, tr, contentLang);
    case 'timeline': return generateAboutTimelineFields(content, tr, contentLang);
    case 'founder-quote': return generateAboutFounderFields(content, tr);
    default: return generateAboutTextImageFields(content, tr);
  }
}

function aboutImgLabels(tr) {
  return { upload: tr('sed.img_upload'), drive: tr('sed.img_drive'), url: tr('sed.img_url'), photo: tr('sed.img_photo'), ai: tr('sed.img_ai'), remove: tr('sed.img_remove') };
}

function generateAboutTextImageFields(content, tr) {
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || tr('sed.ph_about_us'))}" required>
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}">
    </div>

    <div class="form-group">
      <label for="story">${tr('sed.your_story')}</label>
      <textarea id="story" name="story" rows="5">${escapeHtml(content.story || '')}</textarea>
      <small>${tr('sed.story_hint')}</small>
    </div>

    <div class="form-group">
      <label>${tr('sed.image')}</label>
      <input type="hidden" id="image_url" name="image_url" value="${escapeHtml(content.image_url || '')}">
      <div class="image-upload-area" onclick="document.getElementById('about-image-input').click()">
        <p>${tr('sed.click_upload')}</p>
        <img src="${content.image_url || ''}" class="image-preview" style="display: ${content.image_url ? 'block' : 'none'}">
        <div class="upload-progress"></div>
      </div>
      <input type="file" id="about-image-input" accept="image/*" style="display: none" onchange="uploadImage(this, 'image_url')">
    </div>
  `;
}

function generateAboutTeamFields(content, tr, contentLang) {
  const members = (Array.isArray(content.team_members) && content.team_members.length)
    ? content.team_members
    : defaultItems(contentLang, 'about-team').map((m, i) => ({ ...m, image: TEAM_IMAGES[i % TEAM_IMAGES.length] }));
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || uiText(contentLang, 'meet_team'))}" required>
    </div>
    <div class="form-group">
      <label for="description">${tr('sed.description')}</label>
      <input type="text" id="description" name="description" value="${escapeHtml(content.description || '')}" placeholder="${escapeHtml(tr('sed.ph_optional'))}">
    </div>
    <div class="form-group">
      <label>${tr('sed.team_members')}</label>
      ${buildRepeater({
        jsonKey: 'team_members', items: members,
        addLabel: tr('sed.add_member'), removeLabel: tr('sed.remove'), itemLabel: tr('sed.item_member'),
        fields: [
          { key: 'name', label: tr('sed.f_name'), ph: 'Jane Doe' },
          { key: 'role', label: tr('sed.f_role'), ph: tr('sed.f_role') },
          { key: 'bio', label: tr('sed.f_bio'), kind: 'textarea', ph: tr('sed.ph_optional') },
          { key: 'image', label: tr('sed.f_image'), kind: 'image', img: aboutImgLabels(tr) },
        ],
      })}
    </div>
  `;
}

function generateAboutTimelineFields(content, tr, contentLang) {
  const milestones = (Array.isArray(content.milestones) && content.milestones.length)
    ? content.milestones
    : defaultItems(contentLang, 'about-timeline').map((m, i) => ({ year: TIMELINE_YEARS[i % TIMELINE_YEARS.length], ...m }));
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || uiText(contentLang, 'our_journey'))}" required>
    </div>
    <div class="form-group">
      <label for="description">${tr('sed.description')}</label>
      <input type="text" id="description" name="description" value="${escapeHtml(content.description || '')}" placeholder="${escapeHtml(tr('sed.ph_optional'))}">
    </div>
    <div class="form-group">
      <label>${tr('sed.milestones')}</label>
      ${buildRepeater({
        jsonKey: 'milestones', items: milestones,
        addLabel: tr('sed.add_milestone'), removeLabel: tr('sed.remove'), itemLabel: tr('sed.item_milestone'),
        fields: [
          { key: 'year', label: tr('sed.f_year'), kind: 'short', ph: '2024' },
          { key: 'title', label: tr('sed.f_title'), ph: tr('sed.f_title') },
          { key: 'description', label: tr('sed.f_description'), kind: 'textarea', ph: tr('sed.ph_optional') },
        ],
      })}
    </div>
  `;
}

function generateAboutFounderFields(content, tr) {
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || tr('sed.ph_about_us'))}" required>
    </div>
    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}">
    </div>
    <div class="form-group">
      <label for="story">${tr('sed.your_story')}</label>
      <textarea id="story" name="story" rows="5">${escapeHtml(content.story || '')}</textarea>
      <small>${tr('sed.story_hint')}</small>
    </div>
    <div class="form-group">
      <label>${tr('sed.image')}</label>
      <input type="hidden" id="image_url" name="image_url" value="${escapeHtml(content.image_url || '')}">
      <div class="image-upload-area" onclick="document.getElementById('about-image-input').click()">
        <p>${tr('sed.click_upload')}</p>
        <img src="${content.image_url || ''}" class="image-preview" style="display: ${content.image_url ? 'block' : 'none'}">
        <div class="upload-progress"></div>
      </div>
      <input type="file" id="about-image-input" accept="image/*" style="display: none" onchange="uploadImage(this, 'image_url')">
    </div>
    <div class="form-group">
      <label for="founder_name">${tr('sed.founder_name')}</label>
      <input type="text" id="founder_name" name="founder_name" value="${escapeHtml(content.founder_name || '')}" placeholder="Jane Doe">
    </div>
    <div class="form-group">
      <label for="founder_role">${tr('sed.founder_role')}</label>
      <input type="text" id="founder_role" name="founder_role" value="${escapeHtml(content.founder_role || '')}" placeholder="${escapeHtml(tr('sed.ph_optional'))}">
    </div>
  `;
}

// Generic list-item repeater (services, testimonials): each item is a LABELED
// CARD ("Testimonial 1", with Name/Role/Quote/… fields) so per-item editing is
// obvious. Backed by a hidden <key>_json blob the save handler expands into
// content[key]. fields: [{ key, label, kind?: 'short'|'textarea', num?, ph? }]
function buildRepeater({ jsonKey, items, fields, addLabel, removeLabel, itemLabel, imgT = {} }) {
  const field = (f, it) => {
    // Read the field's key, falling back to an alias key (`alt`) so items stored
    // under an alternate schema still populate — e.g. testimonials from Google
    // reviews use {author, quote} while the editor uses name/text.
    let raw = it ? it[f.key] : undefined;
    if ((raw == null || raw === '') && f.alt && it && it[f.alt] != null) raw = it[f.alt];
    const v = raw != null ? String(raw) : '';
    const num = f.num ? ' data-num="1"' : '';
    if (f.kind === 'image') {
      const l = f.img || {};
      return `<div class="rep-field rep-imgfield">
        <label>${escapeHtml(f.label || f.key)}</label>
        <input type="hidden" class="rep-input rep-img-val" data-k="${f.key}" value="${escapeHtml(v)}">
        <div class="rep-img-row">
          <img class="rep-img-thumb" src="${escapeHtml(v)}" alt=""${v ? '' : ' style="display:none"'}>
          <div class="rep-img-btns">
            <button type="button" onclick="repImgUpload(this)">⬆ ${escapeHtml(l.upload || 'Upload')}</button>
            <button type="button" onclick="repImgDrive(this)">🗂 ${escapeHtml(l.drive || 'Drive')}</button>
            <button type="button" onclick="repImgUrl(this)">🔗 ${escapeHtml(l.url || 'URL')}</button>
            <button type="button" onclick="repImgStock(this)">🖼 ${escapeHtml(l.photo || 'Photo')}</button>
            <button type="button" onclick="repImgAI(this)">✨ ${escapeHtml(l.ai || 'AI')}</button>
            <button type="button" class="rep-img-x" onclick="repImgClear(this)" title="${escapeHtml(l.remove || 'Remove')}">🗑</button>
          </div>
          <input type="file" accept="image/*" class="rep-img-file" style="display:none" onchange="repImgFile(this)">
          <div class="rep-img-status"></div>
        </div>
      </div>`;
    }
    if (f.kind === 'video') {
      const l = f.vid || {};
      return `<div class="rep-field rep-vidfield">
        <label>${escapeHtml(f.label || f.key)}</label>
        <input type="text" class="rep-input rep-vid-val" data-k="${f.key}" placeholder="${escapeHtml(f.ph || 'YouTube, Vimeo or Loom link')}" value="${escapeHtml(v)}">
        <div class="rep-vid-row">
          <button type="button" onclick="repVidUpload(this)">⬆ ${escapeHtml(l.upload || 'Upload')}</button>
          <span class="rep-vid-status"></span>
        </div>
        <input type="file" accept="video/mp4,video/webm" class="rep-vid-file" style="display:none" onchange="repVidFile(this)">
      </div>`;
    }
    const input = f.kind === 'textarea'
      ? `<textarea class="rep-input" data-k="${f.key}"${num} rows="2" placeholder="${escapeHtml(f.ph || '')}">${escapeHtml(v)}</textarea>`
      : `<input type="text" class="rep-input${f.kind === 'short' ? ' rep-short' : ''}" data-k="${f.key}"${num} placeholder="${escapeHtml(f.ph || '')}" value="${escapeHtml(v)}">`;
    return `<div class="rep-field"><label>${escapeHtml(f.label || f.key)}</label>${input}</div>`;
  };
  const item = (it) => `<div class="rep-item">
        <div class="rep-item-head"><span class="rep-item-title">${escapeHtml(itemLabel || 'Item')}</span>
          <button type="button" class="rep-remove" onclick="var p=this.closest('.rep');this.closest('.rep-item').remove();p.__sync&&p.__sync()">✕ ${escapeHtml(removeLabel)}</button></div>
        ${fields.map((f) => field(f, it)).join('')}
      </div>`;
  const list = Array.isArray(items) ? items : [];
  return `
    <input type="hidden" id="${jsonKey}_json" name="${jsonKey}_json" value="${escapeHtml(JSON.stringify(list))}">
    <div class="rep" id="rep-${jsonKey}">
      <div class="rep-items">${list.map(item).join('')}</div>
      <template class="rep-tpl">${item({})}</template>
      <button type="button" class="btn-secondary rep-add">${escapeHtml(addLabel)}</button>
    </div>
    <style>
      #rep-${jsonKey} .rep-items{counter-reset:repn}
      #rep-${jsonKey} .rep-item{border:1px solid #e2e8f0;border-radius:10px;padding:.85rem;margin-bottom:.7rem;background:#fff}
      #rep-${jsonKey} .rep-item-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:.55rem}
      #rep-${jsonKey} .rep-item-title{font-weight:700;font-size:.8rem;color:#4a5568}
      #rep-${jsonKey} .rep-item-title::after{counter-increment:repn;content:' ' counter(repn)}
      #rep-${jsonKey} .rep-remove{border:none;background:none;color:#e53e3e;font-size:.78rem;font-weight:700;cursor:pointer;padding:.1rem .3rem}
      #rep-${jsonKey} .rep-field{margin-bottom:.5rem}
      #rep-${jsonKey} .rep-field:last-child{margin-bottom:0}
      #rep-${jsonKey} .rep-field label{display:block;font-size:.72rem;font-weight:600;color:#718096;margin-bottom:.2rem}
      #rep-${jsonKey} .rep-input{width:100%;padding:.5rem .6rem;border:2px solid #e2e8f0;border-radius:8px;font:inherit;font-size:.88rem}
      #rep-${jsonKey} .rep-input.rep-short{width:80px;text-align:center}
      #rep-${jsonKey} .rep-img-row{display:flex;flex-direction:column;gap:.4rem}
      #rep-${jsonKey} .rep-img-thumb{width:160px;height:90px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}
      #rep-${jsonKey} .rep-img-btns{display:flex;flex-wrap:wrap;gap:.3rem}
      #rep-${jsonKey} .rep-img-btns button{font:inherit;font-size:.72rem;padding:.3rem .5rem;border:1px solid #e2e8f0;border-radius:7px;background:#fff;cursor:pointer}
      #rep-${jsonKey} .rep-img-btns button:hover{border-color:#7c3aed;background:#faf5ff}
      #rep-${jsonKey} .rep-img-btns .rep-img-x{color:#b91c1c}
      #rep-${jsonKey} .rep-img-status{font-size:.72rem;color:#718096;min-height:1em}
      #rep-${jsonKey} .rep-vid-row{display:flex;align-items:center;gap:.5rem;margin-top:.35rem}
      #rep-${jsonKey} .rep-vid-row button{font:inherit;font-size:.72rem;padding:.3rem .5rem;border:1px solid #e2e8f0;border-radius:7px;background:#fff;cursor:pointer}
      #rep-${jsonKey} .rep-vid-row button:hover{border-color:#7c3aed;background:#faf5ff}
      #rep-${jsonKey} .rep-vid-status{font-size:.72rem;color:#718096}
    </style>
    <script>
      window.REP_IMG_T = ${JSON.stringify(imgT)};
      function repItemOf(b){ return b.closest('.rep-item'); }
      function repImgApply(item, url){
        var val = item.querySelector('.rep-img-val'); var th = item.querySelector('.rep-img-thumb');
        if (val) val.value = url || '';
        if (th){ if (url){ th.src = url; th.style.display=''; } else { th.removeAttribute('src'); th.style.display='none'; } }
        var rep = item.closest('.rep'); if (rep && rep.__sync) rep.__sync();
      }
      function repImgClear(b){ repImgApply(repItemOf(b), ''); }
      function repImgUrl(b){ var u = prompt(REP_IMG_T.urlPrompt || 'Image URL'); if (u && u.trim()) repImgApply(repItemOf(b), u.trim()); }
      function repImgDrive(b){ var item = repItemOf(b); if (window.__drivePicker) window.__drivePicker(function(url){ repImgApply(item, url); }); }
      function repImgUpload(b){ var i = repItemOf(b).querySelector('.rep-img-file'); if (i) i.click(); }
      function repImgTitle(item){ var t = item.querySelector('[data-k="title"]'); return (t && t.value.trim()) || ''; }
      function repImgStatus(item, msg){ var s = item.querySelector('.rep-img-status'); if (s) s.textContent = msg || ''; }
      async function repImgFile(input){
        var item = input.closest('.rep-item'); var f = input.files[0]; if (!f) return; input.value = '';
        repImgStatus(item, REP_IMG_T.uploading || 'Uploading…');
        try { var fd = new FormData(); fd.append('file', f); fd.append('asset_type', 'service');
          var r = await fetch('/api/ai-builder/' + window.currentProjectId + '/upload', { method:'POST', body: fd });
          var d = await r.json(); if (d.success){ repImgApply(item, d.url); repImgStatus(item, ''); } else repImgStatus(item, d.error || REP_IMG_T.fail || 'Failed');
        } catch (e){ repImgStatus(item, REP_IMG_T.fail || 'Failed'); }
      }
      async function repImgStock(b){
        var item = repItemOf(b); repImgStatus(item, REP_IMG_T.finding || 'Finding a photo…');
        try { var r = await fetch('/api/ai-builder/' + window.currentProjectId + '/stock-photo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ query: repImgTitle(item) || 'business' }) });
          var d = await r.json(); if (d.success){ repImgApply(item, d.url); repImgStatus(item, ''); } else repImgStatus(item, d.error || REP_IMG_T.fail || 'Failed');
        } catch (e){ repImgStatus(item, REP_IMG_T.fail || 'Failed'); }
      }
      async function repImgAI(b){
        var item = repItemOf(b); repImgStatus(item, REP_IMG_T.generating || 'Generating…'); b.disabled = true;
        try { var r = await fetch('/api/ai-builder/' + window.currentProjectId + '/generate-image', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt: repImgTitle(item) || 'business' }) });
          var d = await r.json(); if (d.success){ repImgApply(item, d.url); repImgStatus(item, ''); } else repImgStatus(item, d.error || REP_IMG_T.fail || 'Failed');
        } catch (e){ repImgStatus(item, REP_IMG_T.fail || 'Failed'); } finally { b.disabled = false; }
      }
      function repVidUpload(b){ var i = repItemOf(b).querySelector('.rep-vid-file'); if (i) i.click(); }
      async function repVidFile(input){
        var item = input.closest('.rep-item'); var f = input.files[0]; if (!f) return; input.value = '';
        var st = item.querySelector('.rep-vid-status'); var val = item.querySelector('.rep-vid-val');
        if (st) st.textContent = REP_IMG_T.uploading || 'Uploading…';
        try { var fd = new FormData(); fd.append('file', f); fd.append('asset_type', 'video');
          var r = await fetch('/api/ai-builder/' + window.currentProjectId + '/upload', { method:'POST', body: fd });
          var d = await r.json();
          if (d.success){ if (val) val.value = d.url; if (st) st.textContent = ''; var rep = item.closest('.rep'); if (rep && rep.__sync) rep.__sync(); }
          else if (st) st.textContent = d.error || REP_IMG_T.fail || 'Failed';
        } catch (e){ if (st) st.textContent = REP_IMG_T.fail || 'Failed'; }
      }
      async function repImgSwapAll(jsonKey){
        var rep = document.getElementById('rep-' + jsonKey); if (!rep) return;
        var items = rep.querySelectorAll('.rep-item');
        for (var i = 0; i < items.length; i++){ var item = items[i]; repImgStatus(item, REP_IMG_T.finding || 'Finding…');
          try { var r = await fetch('/api/ai-builder/' + window.currentProjectId + '/stock-photo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ query: repImgTitle(item) || 'business', skip: i % 6 }) });
            var d = await r.json(); if (d.success) repImgApply(item, d.url); repImgStatus(item, ''); } catch (e){ repImgStatus(item, ''); }
        }
      }
      (function(){
        var rep = document.getElementById('rep-${jsonKey}');
        if (!rep || rep.__ready) return; rep.__ready = true;
        var hidden = document.getElementById('${jsonKey}_json');
        var items = rep.querySelector('.rep-items');
        var tpl = rep.querySelector('.rep-tpl');
        function sync(){
          var arr = [];
          items.querySelectorAll('.rep-item').forEach(function(r){
            var o = {}, any = false;
            r.querySelectorAll('.rep-input').forEach(function(inp){
              var v = inp.value.trim();
              o[inp.dataset.k] = inp.dataset.num ? (parseInt(v, 10) || 0) : v;
              if (v) any = true;
            });
            if (any) arr.push(o);
          });
          hidden.value = JSON.stringify(arr);
        }
        rep.__sync = sync;
        rep.addEventListener('input', sync);
        rep.querySelector('.rep-add').addEventListener('click', function(){
          items.appendChild(tpl.content.firstElementChild.cloneNode(true)); sync();
        });
        sync();
      })();
    </script>
  `;
}

function generateServicesFields(content, tr) {
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || tr('sed.ph_our_services'))}" required>
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}">
    </div>

    <div class="form-group">
      <label>${tr('sed.services')}</label>
      <button type="button" class="btn-secondary" style="margin-bottom:.6rem" onclick="repImgSwapAll('services')">🖼 ${tr('sed.swap_all')}</button>
      ${buildRepeater({
        jsonKey: 'services', items: (Array.isArray(content.services) && content.services.length) ? content.services : [
          { icon: '🚀', title: `${tr('sed.seed_service')} 1`, description: `${tr('sed.seed_service_desc')} 1` },
          { icon: '💡', title: `${tr('sed.seed_service')} 2`, description: `${tr('sed.seed_service_desc')} 2` },
          { icon: '⭐', title: `${tr('sed.seed_service')} 3`, description: `${tr('sed.seed_service_desc')} 3` },
        ], addLabel: tr('sed.add_service'), removeLabel: tr('sed.remove'), itemLabel: tr('sed.item_service'),
        imgT: {
          urlPrompt: tr('sed.img_url_prompt'), uploading: tr('sed.uploading'),
          finding: tr('sed.img_finding'), generating: tr('sed.img_generating'), fail: tr('sed.img_fail'),
        },
        fields: [
          { key: 'icon', label: tr('sed.f_icon'), kind: 'short', ph: '🚀' },
          { key: 'title', label: tr('sed.f_title'), ph: tr('sed.svc_title_ph') },
          { key: 'description', label: tr('sed.f_description'), kind: 'textarea', ph: tr('sed.svc_desc_ph') },
          { key: 'image_url', label: tr('sed.f_image'), kind: 'image',
            img: { upload: tr('sed.img_upload'), drive: tr('sed.img_drive'), url: tr('sed.img_url'), photo: tr('sed.img_photo'), ai: tr('sed.img_ai'), remove: tr('sed.img_remove') } },
        ],
      })}
    </div>
  `;
}

function generateTestimonialsFields(content, tr, contentLang = 'en') {
  // Seed an empty section with the SAME localized defaults the template renders
  // (site language), so the editor matches the preview instead of showing
  // English "John Doe" placeholders on a non-English site.
  const seed = (TESTIMONIAL_DEFAULTS[contentLang] || TESTIMONIAL_DEFAULTS.en).items;
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || tr('sed.ph_testimonials'))}" required>
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}">
    </div>

    <div class="form-group">
      <label>${tr('sed.testimonials')}</label>
      ${buildRepeater({
        jsonKey: 'testimonials', items: (Array.isArray(content.testimonials) && content.testimonials.length) ? content.testimonials : seed, addLabel: tr('sed.add_testimonial'), removeLabel: tr('sed.remove'), itemLabel: tr('sed.item_testimonial'),
        fields: [
          { key: 'name', alt: 'author', label: tr('sed.f_name'), ph: tr('sed.tst_name_ph') },
          { key: 'role', label: tr('sed.f_role'), ph: tr('sed.tst_role_ph') },
          { key: 'avatar', label: tr('sed.f_image'), kind: 'image', img: { upload: tr('sed.img_upload'), drive: tr('sed.img_drive'), url: tr('sed.img_url'), photo: tr('sed.img_photo'), ai: tr('sed.img_ai'), remove: tr('sed.img_remove') } },
          { key: 'text', alt: 'quote', label: tr('sed.f_quote'), kind: 'textarea', ph: tr('sed.tst_text_ph') },
          { key: 'rating', label: tr('sed.f_rating'), kind: 'short', num: true, ph: '5' },
          { key: 'video_url', label: tr('sed.f_video') || 'Video (optional)', kind: 'video', ph: tr('sed.video_ph') || 'YouTube, Vimeo or Loom link', vid: { upload: tr('sed.img_upload') || 'Upload' } },
        ],
      })}
    </div>
  `;
}

function generateContactFields(content, tr) {
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || tr('sed.ph_get_in_touch'))}" required>
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" required>
    </div>

    <div class="form-group">
      <label for="phone">${tr('sed.phone')}</label>
      <input type="text" id="phone" name="phone" value="${escapeHtml(content.phone || '')}" placeholder="+1 555 123 4567">
    </div>

    <div class="form-group">
      <label for="email">${tr('sed.email')}</label>
      <input type="text" id="email" name="email" value="${escapeHtml(content.email || '')}" placeholder="hello@business.com">
    </div>

    <div class="form-group">
      <label for="address">${tr('sed.address')}</label>
      <textarea id="address" name="address" rows="2">${escapeHtml(content.address || '')}</textarea>
      <small>${tr('sed.contact_details_hint')}</small>
    </div>

    <div class="form-group">
      <label for="button_text">${tr('sed.submit_button')}</label>
      <input type="text" id="button_text" name="button_text" value="${escapeHtml(content.button_text || tr('sed.ph_send_message'))}" required>
    </div>

    ${generateContactFormFields(content, tr)}
  `;
}

// The optional fields a visitor can fill in (Phone, Company, …). The owner ticks
// which show + whether each is required; serialized to content.form_fields in
// saveSectionChanges (checkboxes are absent from FormData when unchecked).
function generateContactFormFields(content, tr) {
  const catalog = ['phone', 'company', 'subject', 'address', 'preferred_contact'];
  const enabled = new Map(
    (Array.isArray(content.form_fields) ? content.form_fields : [])
      .map((f) => [f && f.key, !!(f && f.required)])
      .filter(([k]) => k)
  );
  const rows = catalog
    .map((key) => {
      const on = enabled.has(key);
      const req = enabled.get(key);
      return `
      <div class="ff-row" style="display:flex;align-items:center;gap:.75rem;padding:.3rem 0;">
        <label style="display:flex;align-items:center;gap:.5rem;flex:1;margin:0;text-transform:none;font-weight:500;cursor:pointer;">
          <input type="checkbox" data-ff-enable="${key}"${on ? ' checked' : ''}
            onchange="this.closest('.ff-row').querySelector('[data-ff-required]').disabled=!this.checked">
          ${escapeHtml(tr('formw.field_' + key))}
        </label>
        <label style="display:flex;align-items:center;gap:.35rem;margin:0;text-transform:none;font-weight:500;font-size:.82rem;color:#64748b;cursor:pointer;">
          <input type="checkbox" data-ff-required="${key}"${req ? ' checked' : ''}${on ? '' : ' disabled'}>
          ${escapeHtml(tr('sed.ff_required'))}
        </label>
      </div>`;
    })
    .join('');
  return `
    <div class="form-group">
      <label>${escapeHtml(tr('sed.form_fields'))}</label>
      <small style="display:block;margin:-.25rem 0 .5rem;">${escapeHtml(tr('sed.form_fields_hint'))}</small>
      ${rows}
    </div>
  `;
}

function generateGalleryFields(content, tr) {
  const images = Array.isArray(content.images) ? content.images : [];
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || tr('sed.ph_gallery'))}" required>
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}">
    </div>

    <div class="form-group">
      <label>${tr('sed.photos')} <span style="color:#718096;font-weight:400;font-size:.8rem">${tr('sed.photos_hint')}</span></label>
      <input type="hidden" id="gallery-images-json" name="images_json" value="${escapeHtml(JSON.stringify(images))}">
      <div id="gallery-manager" class="gallery-manager"></div>
      <button type="button" class="gallery-add-btn" onclick="document.getElementById('gallery-add-input').click()">${tr('sed.add_photo')}</button>
      <button type="button" class="gallery-add-btn" onclick="galleryAddFromDrive()">${tr('sed.from_drive')}</button>
      <button type="button" class="gallery-add-btn" onclick="gallerySwapAll()">🖼 ${tr('sed.swap_all')}</button>
      <input type="file" id="gallery-add-input" accept="image/*" style="display:none" onchange="galleryAddImage(this)">
      <input type="file" id="gallery-replace-input" accept="image/*" style="display:none" onchange="galleryReplaceUpload(this)">
    </div>
  `;
}

function generateFooterFields(content, tr) {
  return `
    <div class="form-group">
      <label for="business_name">${tr('sed.business_name')}</label>
      <input type="text" id="business_name" name="business_name" value="${escapeHtml(content.business_name || '')}" required>
    </div>

    <div class="form-group">
      <label for="tagline">${tr('sed.tagline')}</label>
      <input type="text" id="tagline" name="tagline" value="${escapeHtml(content.tagline || '')}" required>
    </div>

    <div class="form-group">
      <label for="copyright">${tr('sed.copyright')}</label>
      <input type="text" id="copyright" name="copyright" value="${escapeHtml(content.copyright || '')}" required>
    </div>

    ${(() => {
      const links = Array.isArray(content.links) ? content.links : [];
      const row = (lnk = {}) => `
      <div class="footer-link-row">
        <input type="text" class="fl-label" placeholder="${tr('sed.link_label')}" value="${escapeHtml(lnk.label || '')}">
        ${renderLinkField({ value: lnk.url || '', newTab: !!lnk.new_tab })}
        <button type="button" class="fl-remove" onclick="removeFooterLink(this)" title="${tr('sed.link_remove')}">&times;</button>
      </div>`;
      return `
    <input type="hidden" id="links_json" name="links_json" value="${escapeHtml(JSON.stringify(links))}">
    <div class="form-group">
      <label>${tr('sed.footer_links')}</label>
      <small style="display:block;color:#718096;margin-bottom:.4rem">${tr('sed.footer_links_hint')}</small>
      <div id="footer-links">${links.map(row).join('')}</div>
      <template id="footer-link-tpl">${row({})}</template>
      <button type="button" class="btn-secondary" onclick="addFooterLink()">${tr('sed.add_link')}</button>
    </div>
    <style>
      .footer-link-row{display:flex;gap:.5rem;align-items:flex-start;margin-bottom:.6rem;padding:.6rem;background:#f8fafc;border-radius:8px}
      .footer-link-row .fl-label{flex:0 0 30%;padding:.6rem .7rem;border:2px solid #e2e8f0;border-radius:8px;font-size:.9rem}
      .footer-link-row .lp{flex:1}
      .footer-link-row .fl-remove{border:none;background:none;color:#a0aec0;font-size:1.3rem;cursor:pointer;line-height:1;padding:.2rem .4rem}
    </style>
    <script>
      (function(){
        var wrap = document.getElementById('footer-links');
        if (!wrap || wrap.__flReady) return; wrap.__flReady = true;
        function sync(){
          var arr = [];
          wrap.querySelectorAll('.footer-link-row').forEach(function(r){
            var label = (r.querySelector('.fl-label')||{}).value || '';
            var url = (r.querySelector('.lp-value')||{}).value || '';
            var cb = r.querySelector('.lp-newtab-cb');
            label = label.trim(); url = url.trim();
            if (label || url) arr.push({ label: label, url: url, new_tab: cb && cb.checked ? 1 : 0 });
          });
          var h = document.getElementById('links_json'); if (h) h.value = JSON.stringify(arr);
        }
        wrap.addEventListener('input', sync);
        wrap.addEventListener('lp-change', sync);
        window.addFooterLink = function(){
          var tpl = document.getElementById('footer-link-tpl');
          var node = tpl.content.firstElementChild.cloneNode(true);
          wrap.appendChild(node);
          if (window.initLinkPickers) window.initLinkPickers(node);
          sync();
        };
        window.removeFooterLink = function(btn){ var r = btn.closest('.footer-link-row'); if (r){ r.remove(); sync(); } };
        sync();
      })();
    </script>
  `;
    })()}
  `;
}

// Header / navbar: brand name, phone, and the CTA link (shown on single-page
// sites; multi-page navs use the page links instead). Logo lives in Design.
function generateHeaderFields(content, tr) {
  return `
    <div class="form-group">
      <label for="business_name">${tr('sed.business_name')}</label>
      <input type="text" id="business_name" name="business_name" value="${escapeHtml(content.business_name || '')}">
    </div>

    <div class="form-group">
      <label for="phone">${tr('sed.phone')}</label>
      <input type="text" id="phone" name="phone" value="${escapeHtml(content.phone || '')}" placeholder="(555) 123-4567">
    </div>

    <div class="form-group">
      <label>${tr('sed.button_link')}</label>
      ${renderLinkField({ name: 'cta_link', value: content.cta_link || '#contact', newTab: !!content.cta_link_new_tab })}
    </div>
  `;
}

// CTA banner: heading, description, button text, and the button link.
function generateCtaFields(content, tr) {
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || '')}" required>
    </div>

    <div class="form-group">
      <label for="description">${tr('sed.description')}</label>
      <input type="text" id="description" name="description" value="${escapeHtml(content.description || '')}">
    </div>

    <div class="form-group">
      <label for="cta_text">${tr('sed.button_text')}</label>
      <input type="text" id="cta_text" name="cta_text" value="${escapeHtml(content.cta_text || '')}">
    </div>

    <div class="form-group">
      <label>${tr('sed.button_link')}</label>
      ${renderLinkField({ name: 'cta_url', value: content.cta_url || '#contact', newTab: !!content.cta_url_new_tab })}
    </div>
  `;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}
