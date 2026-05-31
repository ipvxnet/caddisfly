// GET /ai-builder/customize/:project_id
// Section customization interface

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getSectionsByProjectId } from '../../db/ai-sections.js';
import { getWebsiteConfigByProjectId } from '../../db/ai-config.js';

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
      cursor: pointer;
      transition: all 0.2s;
    }

    .section-item:hover {
      border-color: #667eea;
      background: #f7fafc;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .section-type {
      font-weight: 600;
      color: #1a202c;
      text-transform: capitalize;
    }

    .section-toggle {
      font-size: 0.875rem;
      color: #718096;
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
        <h2>Sections</h2>
        <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1.5rem;">
          Click on a section to edit its content
        </p>
        ${sections
          .map(
            (section, index) => `
          <div class="section-item" onclick="editSection(${section.id})">
            <div class="section-header">
              <span class="section-type">${section.section_type}</span>
              <span class="section-toggle">${section.is_visible ? '👁️ Visible' : '👁️‍🗨️ Hidden'}</span>
            </div>
            <div style="font-size: 0.875rem; color: #718096;">Order: ${section.section_order + 1}</div>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="preview-frame">
        <iframe src="/ai-preview/${project.project_id}" id="preview-iframe"></iframe>
      </div>
    </div>
  </div>

  <script>
    const projectId = '${project.project_id}';

    function editSection(sectionId) {
      alert('Section editing coming soon! For now, you can deploy your website as-is.');
      // TODO: Open modal with section content editor
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
