// Section Editor Modal Component
// Generates an HTML modal for editing section content

import { generateAIEditPanel } from './ai-edit-panel.js';
import { renderLinkField, linkPickerAssets } from './link-picker.js';
import { translator } from '../i18n/index.js';

/**
 * Generate section editor modal HTML
 * @param {object} section - Section data
 * @param {string} projectId - Project ID
 * @param {string} lang - UI language
 * @returns {string} Modal HTML
 */
export function generateSectionEditorModal(section, projectId, lang = 'en', linkData = null) {
  const tr = translator(lang);
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

      <details class="manual-edit">
        <summary>${tr('sed.edit_manual')}</summary>
        <form id="section-edit-form" onsubmit="saveSectionChanges(event)">
          ${generateFormFields(section.section_type, content, tr, projectId)}

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

  saveBtn.disabled = true;
  saveBtn.textContent = ${JSON.stringify(tr('sed.saving'))};

  try {
    const response = await fetch(\`/api/ai-builder/\${window.currentProjectId}/sections/\${window.currentSectionId}\`, {
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
      + '<button type="button" class="gallery-del" title="' + ${JSON.stringify(tr('sed.g_remove_t'))} + '" onclick="galleryRemove(' + i + ')">🗑</button>'
      + '</div></div>';
  }).join('');
}
function gallerySetAlt(i, val) { const imgs = galleryRead(); if (imgs[i]) { imgs[i].alt = val; galleryWrite(imgs); } }
function galleryRemove(i) { const imgs = galleryRead(); imgs.splice(i, 1); galleryWrite(imgs); galleryRender(); }

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
</script>
  `;
}

/**
 * Generate form fields based on section type
 */
function generateFormFields(sectionType, content, tr, projectId = '') {
  switch (sectionType) {
    case 'hero':
      return generateHeroFields(content, tr);
    case 'about':
      return generateAboutFields(content, tr);
    case 'services':
      return generateServicesFields(content, tr);
    case 'testimonials':
      return generateTestimonialsFields(content, tr);
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

function generateAboutFields(content, tr) {
  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || tr('sed.ph_about_us'))}" required>
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" required>
    </div>

    <div class="form-group">
      <label for="story">${tr('sed.your_story')}</label>
      <textarea id="story" name="story" rows="5" required>${escapeHtml(content.story || '')}</textarea>
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

// Generic list-item repeater (services, testimonials): rows of fields backed by
// a hidden <key>_json blob that the save handler expands into content[key].
// fields: [{ key, kind?: 'short'|'textarea', num?: bool, ph?: string }]
function buildRepeater({ jsonKey, items, fields, addLabel, removeLabel }) {
  const cell = (f, it) => {
    const v = it && it[f.key] != null ? String(it[f.key]) : '';
    const num = f.num ? ' data-num="1"' : '';
    return f.kind === 'textarea'
      ? `<textarea class="rep-input" data-k="${f.key}"${num} rows="2" placeholder="${escapeHtml(f.ph || '')}">${escapeHtml(v)}</textarea>`
      : `<input type="text" class="rep-input${f.kind === 'short' ? ' rep-short' : ''}" data-k="${f.key}"${num} placeholder="${escapeHtml(f.ph || '')}" value="${escapeHtml(v)}">`;
  };
  const row = (it) => `<div class="rep-row">${fields.map((f) => cell(f, it)).join('')}<button type="button" class="rep-remove" title="${escapeHtml(removeLabel)}" onclick="var p=this.closest('.rep');this.closest('.rep-row').remove();p.__sync&&p.__sync()">&times;</button></div>`;
  const list = Array.isArray(items) ? items : [];
  return `
    <input type="hidden" id="${jsonKey}_json" name="${jsonKey}_json" value="${escapeHtml(JSON.stringify(list))}">
    <div class="rep" id="rep-${jsonKey}">
      <div class="rep-rows">${list.map(row).join('')}</div>
      <template class="rep-tpl">${row({})}</template>
      <button type="button" class="btn-secondary rep-add">${escapeHtml(addLabel)}</button>
    </div>
    <style>
      .rep-row{display:flex;gap:.4rem;align-items:flex-start;margin-bottom:.5rem;padding:.55rem;background:#f8fafc;border-radius:8px}
      .rep-input{flex:1;padding:.5rem .6rem;border:2px solid #e2e8f0;border-radius:8px;font:inherit;font-size:.88rem}
      .rep-input.rep-short{flex:0 0 60px;text-align:center}
      .rep-remove{border:none;background:none;color:#a0aec0;font-size:1.3rem;cursor:pointer;line-height:1;padding:.1rem .3rem;align-self:center}
    </style>
    <script>
      (function(){
        var rep = document.getElementById('rep-${jsonKey}');
        if (!rep || rep.__ready) return; rep.__ready = true;
        var hidden = document.getElementById('${jsonKey}_json');
        var rows = rep.querySelector('.rep-rows');
        var tpl = rep.querySelector('.rep-tpl');
        function sync(){
          var arr = [];
          rows.querySelectorAll('.rep-row').forEach(function(r){
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
          rows.appendChild(tpl.content.firstElementChild.cloneNode(true)); sync();
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
      ${buildRepeater({
        jsonKey: 'services', items: content.services, addLabel: tr('sed.add_service'), removeLabel: tr('sed.remove'),
        fields: [
          { key: 'icon', kind: 'short', ph: '🚀' },
          { key: 'title', ph: tr('sed.svc_title_ph') },
          { key: 'description', kind: 'textarea', ph: tr('sed.svc_desc_ph') },
        ],
      })}
    </div>
  `;
}

function generateTestimonialsFields(content, tr) {
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
        jsonKey: 'testimonials', items: content.testimonials, addLabel: tr('sed.add_testimonial'), removeLabel: tr('sed.remove'),
        fields: [
          { key: 'name', ph: tr('sed.tst_name_ph') },
          { key: 'role', ph: tr('sed.tst_role_ph') },
          { key: 'text', kind: 'textarea', ph: tr('sed.tst_text_ph') },
          { key: 'rating', kind: 'short', num: true, ph: '5' },
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
      <label for="button_text">${tr('sed.submit_button')}</label>
      <input type="text" id="button_text" name="button_text" value="${escapeHtml(content.button_text || tr('sed.ph_send_message'))}" required>
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
