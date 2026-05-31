// Section Editor Modal Component
// Generates an HTML modal for editing section content

/**
 * Generate section editor modal HTML
 * @param {object} section - Section data
 * @param {string} projectId - Project ID
 * @returns {string} Modal HTML
 */
export function generateSectionEditorModal(section, projectId) {
  const content = JSON.parse(section.content_json || '{}');

  return `
<div id="section-editor-modal" class="modal-overlay" onclick="closeModalOnOutsideClick(event)">
  <div class="modal-content" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h2>Edit ${capitalizeFirstLetter(section.section_type)} Section</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>

    <div class="modal-body">
      <form id="section-edit-form" onsubmit="saveSectionChanges(event)">
        ${generateFormFields(section.section_type, content)}

        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn-primary" id="save-btn">Save Changes</button>
        </div>
      </form>
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
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease-out;
  padding: 1rem;
  overflow-y: auto;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
  margin: auto;
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
  modal.style.animation = 'fadeOut 0.2s ease-out';
  setTimeout(() => modal.remove(), 200);
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

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

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
      showNotification('Section updated successfully!', 'success');
    } else {
      throw new Error(data.error || 'Failed to save changes');
    }
  } catch (error) {
    alert('Failed to save: ' + error.message);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
}

async function uploadImage(input, fieldName) {
  const file = input.files[0];
  if (!file) return;

  const uploadArea = input.closest('.image-upload-area');
  uploadArea.classList.add('uploading');

  const progressDiv = uploadArea.querySelector('.upload-progress');
  if (progressDiv) progressDiv.textContent = 'Uploading...';

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

      if (progressDiv) progressDiv.textContent = 'Upload complete!';
    } else {
      throw new Error(data.error || 'Upload failed');
    }
  } catch (error) {
    alert('Upload failed: ' + error.message);
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
</script>
  `;
}

/**
 * Generate form fields based on section type
 */
function generateFormFields(sectionType, content) {
  switch (sectionType) {
    case 'hero':
      return generateHeroFields(content);
    case 'about':
      return generateAboutFields(content);
    case 'services':
      return generateServicesFields(content);
    case 'testimonials':
      return generateTestimonialsFields(content);
    case 'contact':
      return generateContactFields(content);
    case 'gallery':
      return generateGalleryFields(content);
    case 'footer':
      return generateFooterFields(content);
    default:
      return '<p>Section type not supported for editing yet.</p>';
  }
}

function generateHeroFields(content) {
  return `
    <div class="form-group">
      <label for="heading">Heading</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || '')}" required>
      <small>Main headline (max 60 characters)</small>
    </div>

    <div class="form-group">
      <label for="subheading">Subheading</label>
      <textarea id="subheading" name="subheading" required>${escapeHtml(content.subheading || '')}</textarea>
      <small>Supporting text (max 120 characters)</small>
    </div>

    <div class="form-group">
      <label for="cta_text">Button Text</label>
      <input type="text" id="cta_text" name="cta_text" value="${escapeHtml(content.cta_text || 'Get Started')}" required>
    </div>

    <div class="form-group">
      <label for="cta_link">Button Link</label>
      <input type="text" id="cta_link" name="cta_link" value="${escapeHtml(content.cta_link || '#contact')}">
    </div>

    <div class="form-group">
      <label>Background Image</label>
      <input type="hidden" id="image_url" name="image_url" value="${escapeHtml(content.image_url || '')}">
      <div class="image-upload-area" onclick="document.getElementById('hero-image-input').click()">
        <p>📸 Click to upload image</p>
        <p style="font-size: 0.875rem; color: #718096;">JPG, PNG, WebP (max 5MB)</p>
        <img src="${content.image_url || ''}" class="image-preview" style="display: ${content.image_url ? 'block' : 'none'}">
        <div class="upload-progress"></div>
      </div>
      <input type="file" id="hero-image-input" accept="image/*" style="display: none" onchange="uploadImage(this, 'image_url')">
    </div>
  `;
}

function generateAboutFields(content) {
  return `
    <div class="form-group">
      <label for="heading">Section Heading</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || 'About Us')}" required>
    </div>

    <div class="form-group">
      <label for="subheading">Subheading</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" required>
    </div>

    <div class="form-group">
      <label for="story">Your Story</label>
      <textarea id="story" name="story" rows="5" required>${escapeHtml(content.story || '')}</textarea>
      <small>Tell your story (2-3 sentences)</small>
    </div>

    <div class="form-group">
      <label>Image</label>
      <input type="hidden" id="image_url" name="image_url" value="${escapeHtml(content.image_url || '')}">
      <div class="image-upload-area" onclick="document.getElementById('about-image-input').click()">
        <p>📸 Click to upload image</p>
        <img src="${content.image_url || ''}" class="image-preview" style="display: ${content.image_url ? 'block' : 'none'}">
        <div class="upload-progress"></div>
      </div>
      <input type="file" id="about-image-input" accept="image/*" style="display: none" onchange="uploadImage(this, 'image_url')">
    </div>
  `;
}

function generateServicesFields(content) {
  const services = content.services || [];

  return `
    <div class="form-group">
      <label for="heading">Section Heading</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || 'Our Services')}" required>
    </div>

    <div class="form-group">
      <label for="subheading">Subheading</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" required>
    </div>

    <p style="font-weight: 600; margin: 1.5rem 0 1rem;">Services (editing coming soon)</p>
    <p style="color: #718096; font-size: 0.875rem;">
      Currently showing ${services.length} services. Full editing interface coming in next update.
    </p>
  `;
}

function generateTestimonialsFields(content) {
  return `
    <div class="form-group">
      <label for="heading">Section Heading</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || 'Testimonials')}" required>
    </div>

    <div class="form-group">
      <label for="subheading">Subheading</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" required>
    </div>

    <p style="color: #718096; font-size: 0.875rem; margin-top: 1rem;">
      Individual testimonial editing coming soon.
    </p>
  `;
}

function generateContactFields(content) {
  return `
    <div class="form-group">
      <label for="heading">Section Heading</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || 'Get In Touch')}" required>
    </div>

    <div class="form-group">
      <label for="subheading">Subheading</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" required>
    </div>

    <div class="form-group">
      <label for="button_text">Submit Button Text</label>
      <input type="text" id="button_text" name="button_text" value="${escapeHtml(content.button_text || 'Send Message')}" required>
    </div>
  `;
}

function generateGalleryFields(content) {
  return `
    <div class="form-group">
      <label for="heading">Section Heading</label>
      <input type="text" id="heading" name="heading" value="${escapeHtml(content.heading || 'Gallery')}" required>
    </div>

    <div class="form-group">
      <label for="subheading">Subheading</label>
      <input type="text" id="subheading" name="subheading" value="${escapeHtml(content.subheading || '')}" required>
    </div>

    <p style="color: #718096; font-size: 0.875rem; margin-top: 1rem;">
      Gallery image management coming soon.
    </p>
  `;
}

function generateFooterFields(content) {
  return `
    <div class="form-group">
      <label for="business_name">Business Name</label>
      <input type="text" id="business_name" name="business_name" value="${escapeHtml(content.business_name || '')}" required>
    </div>

    <div class="form-group">
      <label for="tagline">Tagline</label>
      <input type="text" id="tagline" name="tagline" value="${escapeHtml(content.tagline || '')}" required>
    </div>

    <div class="form-group">
      <label for="copyright">Copyright Text</label>
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
