// GET /ai-builder/customize/:project_id
// Section customization interface

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getSiteSections, getBodySectionsForPage, getHomeBodySections } from '../../db/ai-sections.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { ensurePagesForProject, getPagesByProject, getPageBySlug, getHomePage } from '../../db/ai-pages.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { generateColorPicker } from '../../components/color-picker.js';
import { generateTemplatePicker } from '../../components/template-picker.js';
import { generateFontPicker } from '../../components/font-picker.js';
import { getAvailableVariants } from '../../templates/ai-builder/registry.js';
import { ADDABLE_SECTIONS } from '../api/ai-builder/section-create.js';
import { renderDomainsPanel, DOMAINS_CSS, DOMAINS_JS } from '../../components/domains-panel.js';
import { getCreditState } from '../../utils/credits.js';
import { getDomainsByProject } from '../../db/custom-domains.js';
import { isSaaSConfigured } from '../../utils/cloudflare-saas.js';

/**
 * Handle customization interface
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderCustomize(ctx) {
  const { env, params, query } = ctx;

  try {
    const { project_id } = params;

    // Try to load from ai_projects first, then regular projects
    let project = await getAIProjectByProjectId(env.DB, project_id);
    let config, projectKey, isAIBuilder = true, customerEmail;

    let currentSubdomain;
    let siteSubtitle = '';
    if (project) {
      config = await getWebsiteConfigByAIProjectId(env.DB, project.id);
      projectKey = { aiProjectId: project.id };
      customerEmail = project.customer_email;
      currentSubdomain = project.subdomain;
    } else {
      // Regular refactoring project
      const regularProject = await getProjectByPreviewId(env.DB, project_id);

      if (!regularProject || !regularProject.use_templates) {
        return new Response('Project not found or does not use templates', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Title = the real business name (from the stored profile); show the
      // original site URL as a subtitle. Fall back to the URL if no name.
      let businessName = regularProject.website_url;
      try {
        const profile = JSON.parse(regularProject.company_profile_json || '{}');
        if (profile && profile.name) businessName = profile.name;
      } catch {
        // keep URL fallback
      }
      siteSubtitle = regularProject.website_url || '';

      // Convert regular project to AI project format for rendering
      project = {
        project_id: regularProject.preview_id,
        project_name: businessName,
        id: regularProject.id,
      };

      config = await getWebsiteConfigByRegularProjectId(env.DB, regularProject.id);
      projectKey = { projectId: regularProject.id };
      isAIBuilder = false;
      customerEmail = regularProject.customer_email;
      currentSubdomain = regularProject.subdomain;
    }

    if (!config) {
      return new Response('Configuration not found', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Live AI-credit balance for the header pill (total = monthly remaining + purchased).
    const creditState = await getCreditState(env.DB, customerEmail);

    // Custom-domain panel data.
    const domains = await getDomainsByProject(env.DB, projectKey);
    const saasOn = isSaaSConfigured(env);
    const sitesBase = env.SITES_BASE || 'caddisfly.app';
    const domainsPanelBlock = `
      <details class="design-group" id="domains-group"${domains.length ? ' open' : ''}>
        <summary>🌐 Custom domain</summary>
        <div class="design-group-body">
          ${renderDomainsPanel({ projectId: project.project_id, domains, subdomain: currentSubdomain, saasOn, sitesBase })}
        </div>
      </details>`;

    // Multi-page: ensure pages exist, resolve the page being edited (?page=slug,
    // else home), and split sections into site-wide (header/footer) + this page's.
    await ensurePagesForProject(env.DB, projectKey);
    const pages = await getPagesByProject(env.DB, projectKey);
    const requestedSlug = query && query.page;
    let currentPage = requestedSlug ? await getPageBySlug(env.DB, projectKey, requestedSlug) : null;
    if (!currentPage) currentPage = await getHomePage(env.DB, projectKey);
    const currentSlug = currentPage ? currentPage.slug : 'home';

    const siteSections = await getSiteSections(env.DB, projectKey, false);
    const sections = currentPage && currentPage.is_home
      ? await getHomeBodySections(env.DB, projectKey, currentPage.id, false)
      : await getBodySectionsForPage(env.DB, currentPage ? currentPage.id : -1, false);

    const esc = (s) =>
      String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Layout variants per addable section type (for the add-time layout picker).
    const sectionVariants = Object.fromEntries(ADDABLE_SECTIONS.map((s) => [s.type, getAvailableVariants(s.type)]));

    // One section tile. siteWide tiles (header/footer) omit the "move to page" select.
    const renderTile = (section, siteWide = false) => `
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
                >${section.is_visible ? '👁️' : '👁️‍🗨️'}</button>
              </div>
              <div class="section-actions">
                <button class="ai-edit-btn" onclick="editSection(${section.id})" title="Edit this section with AI">✨ Edit</button>
                <select class="template-variant-select" data-section-id="${section.id}" onchange="switchTemplate(event)" onclick="event.stopPropagation()" title="Layout / template variant">
                  ${getAvailableVariants(section.section_type)
                    .map((variant) => `<option value="${variant}" ${section.html_template === variant ? 'selected' : ''}>${variant.replace('-', ' ')}</option>`)
                    .join('')}
                </select>
                ${siteWide ? '' : `<select class="move-page-select" onchange="moveSectionToPage(${section.id}, this.value)" onclick="event.stopPropagation()" title="Move to another page">
                  ${pages.map((p) => `<option value="${p.id}" ${section.page_id === p.id ? 'selected' : ''}>→ ${esc(p.nav_label || p.slug)}</option>`).join('')}
                </select>
                <button class="del-section-btn" onclick="removeSection(event, ${section.id})" title="Delete this section">🗑</button>`}
              </div>
            </div>`;

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
      margin: 0;
    }
    .header .site-subtitle {
      font-size: 0.8125rem;
      color: #718096;
      margin: 2px 0 0;
    }
    .header .site-subtitle a { color: inherit; text-decoration: none; }
    .header .site-subtitle a:hover { text-decoration: underline; }

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

    .design-group {
      margin-top: 1.75rem;
      border-top: 1px solid #e2e8f0;
      padding-top: 1rem;
    }
    .design-group > summary {
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 700;
      color: #4a5568;
      padding: 0.4rem 0;
      list-style: none;
    }
    .design-group > summary::-webkit-details-marker { display: none; }
    .design-group > summary::before { content: '▸ '; color: #a0aec0; }
    .design-group[open] > summary::before { content: '▾ '; }
    .design-group-body { padding-top: 1rem; }
    ${DOMAINS_CSS}

    .page-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.5rem;
    }
    .page-tab {
      border: 1px solid #e2e8f0;
      background: #fff;
      border-radius: 8px;
      padding: 0.4rem 0.7rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #4a5568;
      cursor: pointer;
      transition: all 0.15s;
    }
    .page-tab:hover { border-color: #7c3aed; }
    .page-tab.active {
      background: #7c3aed;
      border-color: #7c3aed;
      color: #fff;
    }
    .page-tab-add { color: #7c3aed; border-style: dashed; }
    .page-toolbar {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 1.25rem;
      min-height: 1.4rem;
    }
    .link-btn {
      background: none;
      border: none;
      color: #7c3aed;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }
    .link-btn.danger { color: #b91c1c; }
    .group-title {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #4a5568;
      margin: 1.25rem 0 0.6rem;
    }
    .muted { color: #a0aec0; font-size: 0.8rem; font-weight: 400; text-transform: none; letter-spacing: 0; }
    .move-page-select {
      flex: 1;
      min-width: 0;
      padding: 0.45rem 0.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.8rem;
      background: #fff;
      cursor: pointer;
    }

    .del-section-btn {
      flex: 0 0 auto;
      padding: 0.45rem 0.55rem;
      border: 1px solid #fecaca;
      border-radius: 6px;
      background: #fff;
      color: #b91c1c;
      font-size: 0.85rem;
      cursor: pointer;
      line-height: 1;
    }
    .del-section-btn:hover { background: #fef2f2; border-color: #f87171; }

    .add-section-wrap { margin-top: 0.75rem; }
    .add-section-btn {
      width: 100%;
      padding: 0.6rem;
      border: 1px dashed #7c3aed;
      border-radius: 8px;
      background: #faf5ff;
      color: #7c3aed;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
    }
    .add-section-btn:hover { background: #f3e8ff; }
    .add-section-menu {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.5rem;
    }
    .add-section-menu[hidden] { display: none; }
    .add-section-option {
      padding: 0.45rem 0.7rem;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      background: #fff;
      font-size: 0.8rem;
      cursor: pointer;
      text-transform: capitalize;
    }
    .add-section-option:hover { border-color: #7c3aed; background: #faf5ff; }
    .add-variant-menu {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.5rem;
    }
    .add-variant-menu[hidden] { display: none; }
    .variant-head {
      flex-basis: 100%;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: #4a5568;
      margin-bottom: 0.2rem;
    }
    .variant-back {
      border: none;
      background: none;
      color: #7c3aed;
      cursor: pointer;
      font-size: 0.8rem;
      padding: 0;
    }

    #deploy-success { position: fixed; inset: 0; z-index: 10050; display: flex; align-items: center; justify-content: center; }
    #deploy-success .ds-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.55); }
    #deploy-success .ds-card {
      position: relative;
      background: #fff;
      border-radius: 16px;
      padding: 2rem 2.25rem;
      max-width: 460px;
      width: calc(100% - 2rem);
      text-align: center;
      box-shadow: 0 24px 60px rgba(0,0,0,0.3);
    }
    #deploy-success .ds-emoji { font-size: 2.5rem; }
    #deploy-success h2 { margin: 0.5rem 0 0.25rem; color: #1a202c; }
    #deploy-success .ds-sub { color: #718096; font-size: 0.9rem; margin: 0 0 1rem; }
    #deploy-success .ds-url {
      display: block;
      word-break: break-all;
      font-weight: 600;
      color: #7c3aed;
      background: #faf5ff;
      border: 1px solid #e9d8fd;
      border-radius: 8px;
      padding: 0.7rem 0.9rem;
      text-decoration: none;
      margin-bottom: 1.25rem;
    }
    #deploy-success .ds-url:hover { text-decoration: underline; }
    #deploy-success .ds-actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }

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
    .credit-chip{display:inline-flex;align-items:center;gap:.3rem;background:#f3f0ff;border:1px solid #e0d8ff;border-radius:999px;padding:.45rem .8rem;font-weight:800;color:#6b46c1;text-decoration:none;font-size:.9rem}
    .credit-chip:hover{background:#ebe5ff}
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">
      <h1>${project.project_name || 'Your Website'}</h1>
      ${siteSubtitle ? `<p class="site-subtitle"><a href="${siteSubtitle}" target="_blank" rel="noopener">${siteSubtitle}</a></p>` : ''}
    </div>
    <div class="header-actions">
      <a href="/billing" class="credit-chip" title="Caddi Credits — ${creditState.monthlyRemaining.toLocaleString()} monthly + ${creditState.purchased.toLocaleString()} purchased. Click to buy more.">✨ <strong>${creditState.totalRemaining.toLocaleString()}</strong></a>
      <a href="/dashboard" class="btn btn-secondary" title="Your websites &amp; team">🏠 Dashboard</a>
      <a href="/ai-builder/analytics/${project.project_id}" class="btn btn-secondary" title="Traffic analytics for your published site">📊 Analytics</a>
      <a href="/ai-preview/${project.project_id}" class="btn btn-secondary" target="_blank">View Full Preview</a>
      <button class="btn btn-primary" onclick="deployWebsite()">Deploy Website</button>
    </div>
  </div>

  <div class="container">
    <div class="split-view">
      <div class="sections-panel">
        <h2 style="margin-bottom: 0.5rem;">Pages</h2>
        <div class="page-tabs">
          ${pages
            .map((p) => `<button class="page-tab ${p.slug === currentSlug ? 'active' : ''}" onclick="switchPage('${p.slug}')">${p.is_home ? '🏠 ' : ''}${esc(p.nav_label || p.slug)}</button>`)
            .join('')}
          <button class="page-tab page-tab-add" onclick="addPage()" title="Add a page">+ Page</button>
        </div>
        <div class="page-toolbar">
          ${currentPage && !currentPage.is_home
            ? `<button class="link-btn" onclick="renamePage(${currentPage.id}, '${esc(currentPage.nav_label || '').replace(/'/g, "\\'")}')">Rename</button>
               <button class="link-btn danger" onclick="deletePage(${currentPage.id})">Delete page</button>`
            : `<span class="muted">Home page</span>`}
        </div>

        ${siteSections.length
          ? `<h3 class="group-title">Site-wide <span class="muted">· shown on every page</span></h3>
             <div class="sections-list">${siteSections.map((s) => renderTile(s, true)).join('')}</div>`
          : ''}

        <h3 class="group-title">${esc((currentPage && currentPage.nav_label) || 'Home')} sections</h3>
        <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1rem;">
          Click a section to select it, then <strong>✨ Edit</strong> — drag to reorder, or move it to another page.
        </p>
        <div id="sections-list">
          ${sections.map((s) => renderTile(s)).join('') || '<p class="muted">No sections on this page yet.</p>'}
        </div>

        <div class="add-section-wrap">
          <button class="add-section-btn" onclick="toggleAddSection()" title="Add a new section to this page">+ Add section</button>
          <div class="add-section-menu" id="add-section-menu" hidden>
            ${ADDABLE_SECTIONS.map((s) => `<button class="add-section-option" onclick="pickSectionType('${s.type}')">${s.emoji} ${esc(s.label)}</button>`).join('')}
          </div>
          <div class="add-variant-menu" id="add-variant-menu" hidden></div>
        </div>

        <details class="design-group">
          <summary>🎨 Design — theme, colors &amp; fonts</summary>
          <div class="design-group-body">
            ${generateTemplatePicker(config.style_theme)}
            ${generateColorPicker(config, project.project_id)}
            ${generateFontPicker(config, project.project_id)}
          </div>
        </details>
        ${domainsPanelBlock}
      </div>

      <div class="preview-frame">
        <iframe src="/ai-preview/${project.project_id}/${currentSlug}?embed=1" id="preview-iframe"></iframe>
      </div>
    </div>
  </div>

  <script>
    const projectId = '${project.project_id}';
    const currentPageSlug = '${currentSlug}';
    let draggedElement = null;

    // ---- Pages (multi-page) ----
    function gotoPage(slug) {
      const u = new URL(location.href);
      u.searchParams.set('page', slug);
      location.href = u.toString();
    }
    function switchPage(slug) { gotoPage(slug); }

    async function addPage() {
      const label = prompt('New page name?', 'New Page');
      if (!label) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/pages\`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nav_label: label })
        });
        const d = await r.json();
        if (d.success) gotoPage(d.page.slug); else alert(d.error || 'Failed to add page');
      } catch (e) { alert('Failed to add page: ' + e.message); }
    }

    // ---- Add / remove sections ----
    const sectionVariants = ${JSON.stringify(sectionVariants)};
    const addableLabels = ${JSON.stringify(Object.fromEntries(ADDABLE_SECTIONS.map((s) => [s.type, s.label])))};

    function toggleAddSection() {
      const m = document.getElementById('add-section-menu');
      const v = document.getElementById('add-variant-menu');
      if (v) v.hidden = true;
      if (m) m.hidden = !m.hidden;
    }

    // Step 1: pick a type. Single-variant types add immediately; multi-variant
    // types open a layout chooser first.
    function pickSectionType(type) {
      const variants = sectionVariants[type] || [];
      if (variants.length <= 1) { doAddSection(type, variants[0] || 'default'); return; }
      const v = document.getElementById('add-variant-menu');
      const label = addableLabels[type] || type;
      v.innerHTML =
        '<div class="variant-head"><button class="variant-back" onclick="backToTypes()">← Back</button>'
        + '<span>Choose a ' + label + ' layout</span></div>'
        + variants.map(function (vr) {
            return '<button class="add-section-option" onclick="doAddSection(\\'' + type + '\\',\\'' + vr + '\\')">'
              + vr.replace(/-/g, ' ') + '</button>';
          }).join('');
      document.getElementById('add-section-menu').hidden = true;
      v.hidden = false;
    }

    function backToTypes() {
      document.getElementById('add-variant-menu').hidden = true;
      document.getElementById('add-section-menu').hidden = false;
    }

    async function doAddSection(type, variant) {
      document.getElementById('add-section-menu').hidden = true;
      document.getElementById('add-variant-menu').hidden = true;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/sections\`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section_type: type, variant: variant, page_slug: currentPageSlug })
        });
        const d = await r.json();
        if (d.success) location.reload(); else alert(d.error || 'Failed to add section');
      } catch (e) { alert('Failed to add section: ' + e.message); }
    }

    async function removeSection(event, id) {
      event.stopPropagation();
      if (!confirm('Delete this section? You can add it again later.')) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/sections/\${id}\`, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) location.reload(); else alert(d.error || 'Failed to delete section');
      } catch (e) { alert('Failed to delete section: ' + e.message); }
    }

    async function renamePage(id, current) {
      const label = prompt('Rename page', current || '');
      if (!label) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/pages/\${id}\`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nav_label: label })
        });
        const d = await r.json();
        if (d.success) location.reload(); else alert(d.error || 'Failed to rename');
      } catch (e) { alert('Failed to rename: ' + e.message); }
    }

    async function deletePage(id) {
      if (!confirm('Delete this page? Its sections move to Home.')) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/pages/\${id}\`, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) gotoPage('home'); else alert(d.error || 'Failed to delete');
      } catch (e) { alert('Failed to delete: ' + e.message); }
    }

    async function moveSectionToPage(sectionId, pageId) {
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/sections/\${sectionId}\`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page_id: parseInt(pageId) })
        });
        const d = await r.json();
        if (d.success) gotoPage(currentPageSlug); else alert(d.error || 'Failed to move section');
      } catch (e) { alert('Failed to move section: ' + e.message); }
    }

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
          // Order is conveyed by tile position now (no per-tile "Order: N" label).
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

    // ---- Custom domains (shared component) ----
    ${DOMAINS_JS}

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
          showDeploySuccess(data.deployed_url || data.subdomain_url || data.site_url);
        } else {
          throw new Error(data.error || 'Deployment failed');
        }
      } catch (error) {
        alert('Deployment failed: ' + error.message);
      }
    }

    // Success modal with a clickable link (no popup — browsers block window.open).
    function showDeploySuccess(url) {
      const safe = String(url || '');
      closeDeploySuccess();
      const wrap = document.createElement('div');
      wrap.id = 'deploy-success';
      wrap.innerHTML =
        '<div class="ds-backdrop" onclick="closeDeploySuccess()"></div>'
        + '<div class="ds-card" role="dialog" aria-modal="true">'
        + '<div class="ds-emoji">🎉</div>'
        + '<h2>Your site is live!</h2>'
        + '<p class="ds-sub">It\\'s published and publicly accessible at:</p>'
        + '<a class="ds-url" href="' + safe + '" target="_blank" rel="noopener">' + safe + '</a>'
        + '<div class="ds-actions">'
        + '<a class="btn btn-primary" href="' + safe + '" target="_blank" rel="noopener">Open site ↗</a>'
        + '<button type="button" class="btn btn-secondary" onclick="copyDeployUrl(\\'' + safe + '\\')">Copy link</button>'
        + '<button type="button" class="btn btn-secondary" onclick="closeDeploySuccess()">Close</button>'
        + '</div></div>';
      document.body.appendChild(wrap);
    }
    function closeDeploySuccess() {
      const el = document.getElementById('deploy-success');
      if (el) el.remove();
    }
    function copyDeployUrl(u) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(u).then(function () { showNotification('Link copied!', 'success'); }).catch(function () {});
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
