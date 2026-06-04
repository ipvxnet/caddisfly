// Color Picker Component
// Allows users to customize website colors with live preview

/**
 * Generate color picker UI
 * @param {object} config - Current website config
 * @param {string} projectId - Project ID
 * @returns {string} Color picker HTML
 */
export function generateColorPicker(config, projectId) {
  const presetPalettes = [
    { name: 'Modern Purple', primary: '#667eea', secondary: '#764ba2', accent: '#f093fb' },
    { name: 'Ocean Blue', primary: '#2196F3', secondary: '#0D47A1', accent: '#64B5F6' },
    { name: 'Sunset Orange', primary: '#FF6B6B', secondary: '#FF8E53', accent: '#FFB26B' },
    { name: 'Forest Green', primary: '#48BB78', secondary: '#2F855A', accent: '#68D391' },
    { name: 'Royal Navy', primary: '#1e3a8a', secondary: '#1e40af', accent: '#3b82f6' },
    { name: 'Cherry Red', primary: '#DC2626', secondary: '#991B1B', accent: '#F87171' },
    { name: 'Slate Gray', primary: '#475569', secondary: '#334155', accent: '#64748b' },
    { name: 'Teal Mint', primary: '#14B8A6', secondary: '#0D9488', accent: '#5EEAD4' },
  ];

  return `
<div class="color-picker-panel">
  <h3 class="picker-title">🎨 Website Colors</h3>

  <div class="color-inputs">
    <div class="color-input-group">
      <label for="primary-color">Primary Color</label>
      <div class="color-input-wrapper">
        <input type="color" id="primary-color" value="${config.primary_color}" onchange="updateColor('primary', this.value)">
        <input type="text" id="primary-color-text" value="${config.primary_color}" onchange="updateColorFromText('primary', this.value)" placeholder="#667eea">
      </div>
    </div>

    <div class="color-input-group">
      <label for="secondary-color">Secondary Color</label>
      <div class="color-input-wrapper">
        <input type="color" id="secondary-color" value="${config.secondary_color}" onchange="updateColor('secondary', this.value)">
        <input type="text" id="secondary-color-text" value="${config.secondary_color}" onchange="updateColorFromText('secondary', this.value)" placeholder="#764ba2">
      </div>
    </div>
  </div>

  <div class="color-preview">
    <div class="preview-gradient" id="preview-gradient" style="background: linear-gradient(135deg, ${config.primary_color} 0%, ${config.secondary_color} 100%);"></div>
    <p class="preview-label">Preview Gradient</p>
  </div>

  <div class="preset-palettes">
    <h4 class="presets-title">Preset Palettes</h4>
    <div class="palette-grid">
      ${presetPalettes
        .map(
          (palette) => `
        <button class="palette-button" onclick="applyPalette('${palette.primary}', '${palette.secondary}')" title="${palette.name}">
          <div class="palette-colors">
            <div class="palette-color" style="background: ${palette.primary};"></div>
            <div class="palette-color" style="background: ${palette.secondary};"></div>
          </div>
          <span class="palette-name">${palette.name}</span>
        </button>
      `
        )
        .join('')}
    </div>
  </div>

  <div class="picker-actions">
    <button class="btn-secondary" onclick="resetColors()">Reset to Default</button>
    <button class="btn-primary" onclick="saveColors()" id="save-colors-btn">Apply Colors</button>
  </div>
</div>

<style>
.color-picker-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

.picker-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1.5rem;
}

.color-inputs {
  display: grid;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.color-input-group label {
  display: block;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.color-input-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.color-input-wrapper input[type="color"] {
  width: 60px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid #e2e8f0;
  cursor: pointer;
  padding: 4px;
}

.color-input-wrapper input[type="text"] {
  flex: 1;
  padding: 0.625rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: 'Monaco', 'Courier New', monospace;
  text-transform: uppercase;
}

.color-input-wrapper input[type="text"]:focus {
  outline: none;
  border-color: #667eea;
}

.color-preview {
  margin-bottom: 1.5rem;
}

.preview-gradient {
  height: 80px;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
}

.preview-label {
  font-size: 0.875rem;
  color: #718096;
  text-align: center;
}

.presets-title {
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 1rem;
}

.palette-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.palette-button {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.palette-button:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.palette-colors {
  display: flex;
  gap: 4px;
  margin-bottom: 0.5rem;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
}

.palette-color {
  flex: 1;
}

.palette-name {
  font-size: 0.75rem;
  color: #4a5568;
  display: block;
}

.picker-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .palette-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

<script>
window.currentColors = {
  primary: '${config.primary_color}',
  secondary: '${config.secondary_color}'
};
window.colorPickerProjectId = '${projectId}';

function updateColor(type, value) {
  window.currentColors[type] = value;

  // Update text input
  document.getElementById(\`\${type}-color-text\`).value = value;

  // Update preview
  updatePreview();
}

function updateColorFromText(type, value) {
  // Validate hex color
  if (!/^#[0-9A-F]{6}$/i.test(value)) {
    return;
  }

  window.currentColors[type] = value;

  // Update color picker
  document.getElementById(\`\${type}-color\`).value = value;

  // Update preview
  updatePreview();
}

function updatePreview() {
  const gradient = document.getElementById('preview-gradient');
  gradient.style.background = \`linear-gradient(135deg, \${window.currentColors.primary} 0%, \${window.currentColors.secondary} 100%)\`;
}

function applyPalette(primary, secondary) {
  window.currentColors.primary = primary;
  window.currentColors.secondary = secondary;

  // Update all inputs
  document.getElementById('primary-color').value = primary;
  document.getElementById('primary-color-text').value = primary;
  document.getElementById('secondary-color').value = secondary;
  document.getElementById('secondary-color-text').value = secondary;

  // Update preview
  updatePreview();
}

function resetColors() {
  applyPalette('#667eea', '#764ba2');
}

async function saveColors() {
  const btn = document.getElementById('save-colors-btn');
  btn.disabled = true;
  btn.textContent = 'Applying...';

  try {
    const response = await fetch(\`/api/ai-builder/\${window.colorPickerProjectId}/config/colors\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primary_color: window.currentColors.primary,
        secondary_color: window.currentColors.secondary
      })
    });

    const data = await response.json();

    if (data.success) {
      // Reload preview iframe
      const previewIframe = document.getElementById('preview-iframe');
      if (previewIframe) {
        previewIframe.contentWindow.location.reload();
      }

      // Show success notification
      showNotification('Colors updated! Preview refreshing...', 'success');

      btn.textContent = 'Apply Colors';
      btn.disabled = false;
    } else {
      throw new Error(data.error || 'Failed to save colors');
    }
  } catch (error) {
    alert('Failed to save colors: ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Apply Colors';
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
