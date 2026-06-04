// Section Editor Modal Component
// Generates an HTML modal for editing section content

import { generateAIEditPanel } from './ai-edit-panel.js';
import { translator } from '../i18n/index.js';

/**
 * Generate section editor modal HTML
 * @param {object} section - Section data
 * @param {string} projectId - Project ID
 * @param {string} lang - UI language
 * @returns {string} Modal HTML
 */
export function generateSectionEditorModal(section, projectId, lang = 'en') {
  const tr = translator(lang);
  const content = JSON.parse(section.content_json || '{}');

  return `
<div id="section-editor-modal" class="modal-overlay" onclick="closeModalOnOutsideClick(event)">
  <div class="modal-content" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h2>${tr('sed.edit_section')}</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>

    <div class="modal-body">
      ${generateAIEditPanel(section, projectId, lang)}

      <details class="manual-edit">
        <summary>${tr('sed.edit_manual')}</summary>
        <form id="section-edit-form" onsubmit="saveSectionChanges(event)">
          ${generateFormFields(section.section_type, content, tr)}

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

  // Gallery images travel as a JSON blob in a hidden field (array of objects);
  // expand it into content.images.
  if (content.images_json !== undefined) {
    try { content.images = JSON.parse(content.images_json) || []; } catch (e) { content.images = []; }
    delete content.images_json;
  }

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
</script>
  `;
}

/**
 * Generate form fields based on section type
 */
function generateFormFields(sectionType, content, tr) {
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
    default:
      return `<p>${tr('sed.not_supported')}</p>`;
  }
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
      <label for="cta_link">${tr('sed.button_link')}</label>
      <input type="text" id="cta_link" name="cta_link" value="${escapeHtml(content.cta_link || '#contact')}">
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

function generateServicesFields(content, tr) {
  const services = content.services || [];

  return `
    <div class="form-group">
      <label for="heading">${tr('sed.section_heading')}</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || tr('sed.ph_our_services'))}" required>
    </div>

    <div class="form-group">
      <label for="subheading">${tr('sed.subheading')}</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" required>
    </div>

    <p style="font-weight: 600; margin: 1.5rem 0 1rem;">${tr('sed.services_soon')}</p>
    <p style="color: #718096; font-size: 0.875rem;">
      ${tr('sed.services_count', { n: services.length })}
    </p>
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
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" required>
    </div>

    <p style="color: #718096; font-size: 0.875rem; margin-top: 1rem;">
      ${tr('sed.testimonials_soon')}
    </p>
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
