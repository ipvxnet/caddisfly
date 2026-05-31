// GET /ai-builder/customize/:project_id
// Section customization interface

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getSectionsByProjectId } from '../../db/ai-sections.js';
import { getWebsiteConfigByProjectId } from '../../db/ai-config.js';
import { generateColorPicker } from '../../components/color-picker.js';

/**
 * Handle customization interface
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderCustomize(ctx) {
  const { env, params } = ctx;

  try {
    const { project_id } = params;

    // Get project
    const project = await getAIProjectByProjectId(env.DB, project_id);

    if (!project) {
      return new Response('Project not found', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Get sections and config
    const sections = await getSectionsByProjectId(env.DB, project.id, false);
    const config = await getWebsiteConfigByProjectId(env.DB, project.id);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Customize ${project.project_name || 'Your Website'} - Caddisfly</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f7fafc;
      min-height: 100vh;
    }

    .header {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header h1 {
      font-size: 1.5rem;
      color: #1a202c;
    }

    .header-actions {
      display: flex;
      gap: 1rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      font-size: 1rem;
      transition: all 0.2s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: white;
      color: #667eea;
      border: 2px solid #667eea;
    }

    .btn-secondary:hover {
      background: #eef2ff;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .split-view {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 2rem;
      align-items: start;
    }

    .sections-panel {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      position: sticky;
      top: 80px;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
    }

    .sections-panel h2 {
      font-size: 1.25rem;
      margin-bottom: 1.5rem;
      color: #1a202c;
    }

    .section-item {
      padding: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 1rem;
      cursor: move;
      transition: all 0.2s;
      user-select: none;
    }

    .section-item:hover {
      border-color: #667eea;
      background: #f7fafc;
    }

    .section-item.section-hidden {
      opacity: 0.6;
      border-style: dashed;
    }

    .section-item.dragging {
      opacity: 0.5;
      transform: scale(0.95);
      cursor: grabbing;
    }

    .section-item.drag-over {
      border-color: #667eea;
      border-style: dashed;
      background: #eef2ff;
      transform: translateY(-4px);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      gap: 0.5rem;
    }

    .drag-handle {
      color: #cbd5e0;
      cursor: grab;
      font-size: 1rem;
      line-height: 1;
      padding: 0 0.25rem;
      user-select: none;
    }

    .drag-handle:hover {
      color: #667eea;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .section-type {
      font-weight: 600;
      color: #1a202c;
      text-transform: capitalize;
      flex: 1;
      cursor: pointer;
    }

    .visibility-toggle {
      background: transparent;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0.25rem;
      transition: all 0.2s;
      border-radius: 4px;
      line-height: 1;
    }

    .visibility-toggle:hover {
      background: #f7fafc;
      transform: scale(1.1);
    }

    .visibility-toggle.hidden {
      opacity: 0.5;
    }

    .preview-frame {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .preview-frame iframe {
      width: 100%;
      height: calc(100vh - 150px);
      border: none;
    }

    @media (max-width: 1024px) {
      .split-view {
        grid-template-columns: 1fr;
      }

      .sections-panel {
        position: static;
        max-height: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${project.project_name || 'Your Website'}</h1>
    <div class="header-actions">
      <a href="/ai-preview/${project.project_id}" class="btn btn-secondary" target="_blank">View Full Preview</a>
      <button class="btn btn-primary" onclick="deployWebsite()">Deploy Website</button>
    </div>
  </div>

  <div class="container">
    <div class="split-view">
      <div class="sections-panel">
        ${generateColorPicker(config, project.project_id)}

        <h2 style="margin-bottom: 0.5rem;">Sections</h2>
        <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1.5rem;">
          Click on a section to edit its content
        </p>
        <div id="sections-list">
          ${sections
            .map(
              (section, index) => `
            <div
              class="section-item ${!section.is_visible ? 'section-hidden' : ''}"
              data-section-id="${section.id}"
              draggable="true"
              ondragstart="handleDragStart(event)"
              ondragover="handleDragOver(event)"
              ondragenter="handleDragEnter(event)"
              ondragleave="handleDragLeave(event)"
              ondrop="handleDrop(event)"
              ondragend="handleDragEnd(event)"
            >
              <div class="section-header">
                <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                <span class="section-type" onclick="editSection(${section.id})" style="cursor: pointer;">${section.section_type}</span>
                <button
                  class="visibility-toggle ${section.is_visible ? 'visible' : 'hidden'}"
                  onclick="toggleVisibility(event, ${section.id}, ${section.is_visible})"
                  title="${section.is_visible ? 'Hide section' : 'Show section'}"
                >
                  ${section.is_visible ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <div style="font-size: 0.875rem; color: #718096;">Order: ${section.section_order + 1}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="preview-frame">
        <iframe src="/ai-preview/${project.project_id}" id="preview-iframe"></iframe>
      </div>
    </div>
  </div>

  <script>
    const projectId = '${project.project_id}';
    let draggedElement = null;

    function handleDragStart(e) {
      draggedElement = e.target;
      e.target.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', e.target.innerHTML);
    }

    function handleDragOver(e) {
      if (e.preventDefault) {
        e.preventDefault();
      }
      e.dataTransfer.dropEffect = 'move';
      return false;
    }

    function handleDragEnter(e) {
      if (e.target.classList.contains('section-item') && e.target !== draggedElement) {
        e.target.classList.add('drag-over');
      }
    }

    function handleDragLeave(e) {
      if (e.target.classList.contains('section-item')) {
        e.target.classList.remove('drag-over');
      }
    }

    function handleDrop(e) {
      if (e.stopPropagation) {
        e.stopPropagation();
      }

      e.target.classList.remove('drag-over');

      if (draggedElement !== e.target && e.target.classList.contains('section-item')) {
        const container = document.getElementById('sections-list');
        const allItems = Array.from(container.children);
        const draggedIndex = allItems.indexOf(draggedElement);
        const targetIndex = allItems.indexOf(e.target);

        if (draggedIndex < targetIndex) {
          container.insertBefore(draggedElement, e.target.nextSibling);
        } else {
          container.insertBefore(draggedElement, e.target);
        }

        // Update section order in database
        updateSectionOrder();
      }

      return false;
    }

    function handleDragEnd(e) {
      e.target.classList.remove('dragging');

      // Remove drag-over class from all items
      document.querySelectorAll('.section-item').forEach(item => {
        item.classList.remove('drag-over');
      });

      draggedElement = null;
    }

    async function updateSectionOrder() {
      const container = document.getElementById('sections-list');
      const items = Array.from(container.children);
      const sectionIds = items.map(item => item.dataset.sectionId);

      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/sections/reorder\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section_ids: sectionIds })
        });

        const data = await response.json();

        if (data.success) {
          // Update order numbers in UI
          items.forEach((item, index) => {
            const orderText = item.querySelector('div:last-child');
            if (orderText) {
              orderText.textContent = \`Order: \${index + 1}\`;
            }
          });

          // Reload preview
          const previewIframe = document.getElementById('preview-iframe');
          if (previewIframe) {
            previewIframe.contentWindow.location.reload();
          }

          showNotification('Section order updated', 'success');
        } else {
          throw new Error(data.error || 'Failed to update order');
        }
      } catch (error) {
        alert('Failed to update section order: ' + error.message);
        // Reload page to restore correct order
        location.reload();
      }
    }

    async function toggleVisibility(event, sectionId, currentlyVisible) {
      event.stopPropagation(); // Prevent triggering editSection

      const newVisibility = !currentlyVisible;
      const button = event.target;
      const sectionItem = button.closest('.section-item');

      // Optimistic UI update
      button.textContent = newVisibility ? '👁️' : '👁️‍🗨️';
      button.title = newVisibility ? 'Hide section' : 'Show section';
      button.classList.toggle('hidden', !newVisibility);
      sectionItem.classList.toggle('section-hidden', !newVisibility);

      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/sections/\${sectionId}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_visible: newVisibility })
        });

        const data = await response.json();

        if (data.success) {
          // Reload preview iframe
          const previewIframe = document.getElementById('preview-iframe');
          if (previewIframe) {
            previewIframe.contentWindow.location.reload();
          }

          // Show notification
          showNotification(
            newVisibility ? 'Section shown' : 'Section hidden',
            'success'
          );
        } else {
          throw new Error(data.error || 'Failed to toggle visibility');
        }
      } catch (error) {
        // Revert UI on error
        button.textContent = currentlyVisible ? '👁️' : '👁️‍🗨️';
        button.title = currentlyVisible ? 'Hide section' : 'Show section';
        button.classList.toggle('hidden', !currentlyVisible);
        sectionItem.classList.toggle('section-hidden', currentlyVisible);

        alert('Failed to toggle visibility: ' + error.message);
      }
    }

    async function editSection(sectionId) {
      try {
        // Fetch modal HTML from API
        const response = await fetch(\`/api/ai-builder/\${projectId}/sections/\${sectionId}/editor\`);

        if (!response.ok) {
          throw new Error('Failed to load editor');
        }

        const html = await response.text();

        // Inject modal into page
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = html;
        document.body.appendChild(modalContainer.firstChild);
      } catch (error) {
        alert('Failed to load editor: ' + error.message);
      }
    }


    async function deployWebsite() {
      if (!confirm('Deploy your website now? This will make it publicly accessible.')) {
        return;
      }

      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/deploy\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
          alert('Website deployed successfully! Opening in new tab...');
          window.open(data.deployed_url, '_blank');
        } else {
          throw new Error(data.error || 'Deployment failed');
        }
      } catch (error) {
        alert('Deployment failed: ' + error.message);
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
      }, 2000);
    }
  </script>
</body>
</html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error displaying customize page:', error);

    return new Response('Error loading customization page', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
