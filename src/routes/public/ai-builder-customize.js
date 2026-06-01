// GET /ai-builder/customize/:project_id
// Section customization interface

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getSectionsByAIProjectId, getSectionsByRegularProjectId } from '../../db/ai-sections.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { generateColorPicker } from '../../components/color-picker.js';
import { generateTemplatePicker } from '../../components/template-picker.js';
import { generateFontPicker } from '../../components/font-picker.js';
import { getAvailableVariants } from '../../templates/ai-builder/registry.js';

/**
 * Handle customization interface
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderCustomize(ctx) {
  const { env, params } = ctx;

  try {
    const { project_id } = params;

    // Try to load from ai_projects first, then regular projects
    let project = await getAIProjectByProjectId(env.DB, project_id);
    let sections, config, isAIBuilder = true;

    if (project) {
      // AI Builder project
      sections = await getSectionsByAIProjectId(env.DB, project.id, false);
      config = await getWebsiteConfigByAIProjectId(env.DB, project.id);
    } else {
      // Regular refactoring project
      const regularProject = await getProjectByPreviewId(env.DB, project_id);

      if (!regularProject || !regularProject.use_templates) {
        return new Response('Project not found or does not use templates', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Convert regular project to AI project format for rendering
      project = {
        project_id: regularProject.preview_id,
        project_name: regularProject.website_url,
        id: regularProject.id,
      };

      sections = await getSectionsByRegularProjectId(env.DB, regularProject.id, false);
      config = await getWebsiteConfigByRegularProjectId(env.DB, regularProject.id);
      isAIBuilder = false;
    }

    if (!config) {
      return new Response('Configuration not found', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

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
      padding: 0.7rem 0.85rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 0.6rem;
      cursor: pointer;
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

    .section-item.active {
      border-color: #7c3aed;
      background: #f5f3ff;
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.18);
    }

    /* Per-section actions are revealed only for the selected (.active) tile,
       so the list isn't a wall of repeated buttons. */
    .section-actions {
      display: none;
    }

    .section-item.active .section-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 0.75rem;
    }

    .ai-edit-btn {
      flex: 0 0 auto;
      padding: 0.5rem 0.9rem;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #7c3aed, #6366f1);
      color: white;
      font-weight: 700;
      font-size: 0.875rem;
      cursor: pointer;
      transition: filter 0.2s;
    }

    .ai-edit-btn:hover { filter: brightness(1.08); }

    .section-actions .template-variant-select {
      flex: 1;
      min-width: 0;
      padding: 0.45rem 0.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.85rem;
      background: white;
      cursor: pointer;
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
        ${generateTemplatePicker(config.style_theme)}

        ${generateColorPicker(config, project.project_id)}

        ${generateFontPicker(config, project.project_id)}

        <h2 style="margin-bottom: 0.5rem;">Sections</h2>
        <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1.5rem;">
          Click a section to select it, then <strong>✨ Edit</strong> — or drag to reorder.
        </p>
        <div id="sections-list">
          ${sections
            .map(
              (section, index) => `
            <div
              class="section-item ${!section.is_visible ? 'section-hidden' : ''}"
              data-section-id="${section.id}"
              draggable="true"
              onclick="focusSection(${section.id})"
              ondragstart="handleDragStart(event)"
              ondragover="handleDragOver(event)"
              ondragenter="handleDragEnter(event)"
              ondragleave="handleDragLeave(event)"
              ondrop="handleDrop(event)"
              ondragend="handleDragEnd(event)"
            >
              <div class="section-header">
                <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                <span class="section-type">${section.section_type}</span>
                <button
                  class="visibility-toggle ${section.is_visible ? 'visible' : 'hidden'}"
                  data-section-id="${section.id}"
                  data-visible="${section.is_visible ? '1' : '0'}"
                  onclick="toggleVisibility(event)"
                  title="${section.is_visible ? 'Hide section' : 'Show section'}"
                >
                  ${section.is_visible ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <div class="section-actions">
                <button class="ai-edit-btn" onclick="editSection(${section.id})" title="Edit this section with AI">
                  ✨ Edit
                </button>
                <select
                  class="template-variant-select"
                  data-section-id="${section.id}"
                  onchange="switchTemplate(event)"
                  onclick="event.stopPropagation()"
                  title="Layout / template variant"
                >
                  ${getAvailableVariants(section.section_type)
                    .map(
                      (variant) => `
                    <option value="${variant}" ${section.html_template === variant ? 'selected' : ''}>
                      ${variant.replace('-', ' ')}
                    </option>
                  `
                    )
                    .join('')}
                </select>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="preview-frame">
        <iframe src="/ai-preview/${project.project_id}?embed=1" id="preview-iframe"></iframe>
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

    async function toggleVisibility(event) {
      event.stopPropagation(); // Prevent triggering editSection

      const button = event.target;
      const sectionId = button.dataset.sectionId;
      const currentlyVisible = button.dataset.visible === '1';
      const newVisibility = !currentlyVisible;
      const sectionItem = button.closest('.section-item');

      // Optimistic UI update
      button.dataset.visible = newVisibility ? '1' : '0';
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
        button.dataset.visible = currentlyVisible ? '1' : '0';
        button.textContent = currentlyVisible ? '👁️' : '👁️‍🗨️';
        button.title = currentlyVisible ? 'Hide section' : 'Show section';
        button.classList.toggle('hidden', !currentlyVisible);
        sectionItem.classList.toggle('section-hidden', currentlyVisible);

        alert('Failed to toggle visibility: ' + error.message);
      }
    }

    // Highlight the section in the left list and scroll the preview to it.
    function focusSection(sectionId) {
      window.selectedSectionId = sectionId;
      // Highlight the clicked item in the left list (reveals its actions via CSS).
      document.querySelectorAll('.section-item').forEach((el) => {
        el.classList.toggle('active', String(el.dataset.sectionId) === String(sectionId));
      });
      scrollPreviewToSection(sectionId, 0);
    }

    // Outline the selected section inside the preview iframe (clearing the prior
    // one). Same-origin; safe to no-op if the iframe isn't ready.
    function markPreviewRing(sectionId) {
      const iframe = document.getElementById('preview-iframe');
      try {
        const win = iframe && iframe.contentWindow;
        const doc = win && win.document;
        if (!doc) return;
        if (win.__ringedEl) {
          win.__ringedEl.style.outline = '';
          win.__ringedEl.style.outlineOffset = '';
        }
        const target = doc.getElementById('ai-sec-' + sectionId);
        if (target) {
          target.style.outline = '3px solid #7c3aed';
          target.style.outlineOffset = '-3px';
          win.__ringedEl = target;
        }
      } catch (e) { /* ignore */ }
    }

    // Scroll the preview iframe to a section. Uses the iframe window's own
    // scrollTo (cross-frame element.scrollIntoView is unreliable), and retries
    // briefly in case the iframe is still (re)loading.
    function scrollPreviewToSection(sectionId, attempt) {
      const iframe = document.getElementById('preview-iframe');
      try {
        const win = iframe && iframe.contentWindow;
        const doc = win && win.document;
        const target = doc && doc.getElementById('ai-sec-' + sectionId);
        if (target && doc.body) {
          const offset = win.pageYOffset || doc.documentElement.scrollTop || doc.body.scrollTop || 0;
          const top = target.getBoundingClientRect().top + offset - 60;
          win.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          markPreviewRing(sectionId);
          return;
        }
      } catch (e) { /* not ready / cross-origin — fall through to retry */ }
      if ((attempt || 0) < 12) {
        setTimeout(() => scrollPreviewToSection(sectionId, (attempt || 0) + 1), 150);
      }
    }

    // On each preview (re)load, re-apply the selection: ring the selected section
    // (or auto-select the first one on initial load) without forcing a scroll.
    (function initPreviewSelection() {
      const iframe = document.getElementById('preview-iframe');
      if (!iframe) return;
      const apply = () => {
        const first = document.querySelector('.section-item');
        const sel = window.selectedSectionId || (first && first.dataset.sectionId);
        if (!sel) return;
        window.selectedSectionId = sel;
        document.querySelectorAll('.section-item').forEach((el) => {
          el.classList.toggle('active', String(el.dataset.sectionId) === String(sel));
        });
        markPreviewRing(sel);
      };
      iframe.addEventListener('load', apply);
      // Cover the case where the iframe already finished loading.
      setTimeout(apply, 600);
    })();

    async function editSection(sectionId) {
      // Focus/scroll the preview to this section (visible thanks to the left-docked modal).
      focusSection(sectionId);
      try {
        // Fetch modal HTML from API
        const response = await fetch(\`/api/ai-builder/\${projectId}/sections/\${sectionId}/editor\`);

        if (!response.ok) {
          throw new Error('Failed to load editor');
        }

        const html = await response.text();

        // Remove any previous editor instance.
        const prev = document.getElementById('section-editor-host');
        if (prev) prev.remove();

        // Inject into a single host element (so close removes styles+scripts too).
        const host = document.createElement('div');
        host.id = 'section-editor-host';
        host.innerHTML = html;
        document.body.appendChild(host);

        // Scripts set via innerHTML do NOT execute — re-create them so the modal's
        // handlers (saveSectionChanges, aiEditSend, showNotification, globals) run.
        host.querySelectorAll('script').forEach((old) => {
          const s = document.createElement('script');
          s.textContent = old.textContent;
          host.appendChild(s);
          old.remove();
        });
      } catch (error) {
        alert('Failed to load editor: ' + error.message);
      }
    }

    async function switchTemplate(event) {
      event.stopPropagation();

      const select = event.target;
      const sectionId = select.dataset.sectionId;
      const newVariant = select.value;

      // Store previous value for rollback
      const previousValue = select.dataset.previousValue || select.value;
      select.dataset.previousValue = newVariant;

      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/sections/\${sectionId}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html_template: newVariant })
        });

        const data = await response.json();

        if (data.success) {
          // Reload preview iframe
          const previewIframe = document.getElementById('preview-iframe');
          if (previewIframe) {
            previewIframe.contentWindow.location.reload();
          }

          showNotification('Template updated', 'success');
        } else {
          throw new Error(data.error || 'Failed to switch template');
        }
      } catch (error) {
        // Revert to previous value on error
        select.value = previousValue;
        select.dataset.previousValue = previousValue;
        alert('Failed to switch template: ' + error.message);
      }
    }

    // Apply a whole-site theme: re-skins every section + fonts at once,
    // preserving content and colors. Reload the page so the section dropdowns
    // re-render with the new selected variants and the preview reflects them.
    async function applyTemplate(themeKey) {
      const card = document.querySelector(\`.template-card[data-theme="\${themeKey}"]\`);
      if (card) card.classList.add('applying');

      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/template\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: themeKey })
        });
        const data = await response.json();

        if (data.success) {
          showNotification('Template applied! Refreshing...', 'success');
          setTimeout(() => location.reload(), 400);
        } else {
          throw new Error(data.error || 'Failed to apply template');
        }
      } catch (error) {
        if (card) card.classList.remove('applying');
        alert('Failed to apply template: ' + error.message);
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
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Always serve the latest editor UI (no stale browser/edge cache).
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error displaying customize page:', error);

    return new Response('Error loading customization page', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
