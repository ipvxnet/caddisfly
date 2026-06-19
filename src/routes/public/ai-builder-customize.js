// GET /ai-builder/customize/:project_id
// Section customization interface

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getSiteSections, getBodySectionsForPage, getHomeBodySections, rehomeOrphanedSections } from '../../db/ai-sections.js';
import { getWebsiteConfigByAIProjectId, getWebsiteConfigByRegularProjectId } from '../../db/ai-config.js';
import { ensurePagesForProject, getPagesByProject, getPageBySlug, getHomePage } from '../../db/ai-pages.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { generateColorPicker } from '../../components/color-picker.js';
import { generateTemplatePicker } from '../../components/template-picker.js';
import { selectTemplate } from '../../utils/site-themes.js';
import { inferIndustry } from '../../utils/industry-style.js';
import { generateFontPicker } from '../../components/font-picker.js';
import { getAvailableVariants } from '../../templates/ai-builder/registry.js';
import { ADDABLE_SECTIONS } from '../api/ai-builder/section-create.js';
import { renderDomainsPanel, DOMAINS_CSS, domainsJs } from '../../components/domains-panel.js';
import { canDeploy, canManageDomains, canRequestDeploy } from '../../middleware/project-access.js';
import { getCreditState, CREDIT_COSTS } from '../../utils/credits.js';
import { getDomainsByProject } from '../../db/custom-domains.js';
import { isSaaSConfigured } from '../../utils/cloudflare-saas.js';
import { translator } from '../../i18n/index.js';
import { parseHolidaySettings, HOLIDAY_SKINS, HOLIDAY_KEYS } from '../../utils/holiday-themes.js';

/**
 * Handle customization interface
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderCustomize(ctx) {
  const { env, params, query } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);

  // Role-aware UI: hide actions this viewer can't perform (publish/domains).
  // projectAccess sets ctx.projectRole ('draft' = signed-out builder, edit-only).
  const role = ctx.projectRole || 'draft';
  // Drafters see Publish too, but the click routes through email verification.
  const showDeploy = canRequestDeploy(role);
  const showDomains = canManageDomains(role);

  try {
    const { project_id } = params;

    // Try to load from ai_projects first, then regular projects
    let project = await getAIProjectByProjectId(env.DB, project_id);
    let config, projectKey, isAIBuilder = true, customerEmail;
    let industrySignal = ''; // name + description/services → recommended template

    let currentSubdomain;
    let siteSubtitle = '';
    if (project) {
      config = await getWebsiteConfigByAIProjectId(env.DB, project.id);
      projectKey = { aiProjectId: project.id };
      customerEmail = project.customer_email;
      currentSubdomain = project.subdomain;
      let detail = {};
      try { detail = JSON.parse(project.detailed_profile_json || '{}'); } catch {}
      industrySignal = [project.project_name, detail.business_name, detail.services, detail.history, detail.demographics].filter(Boolean).join(' ');
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
      let cp = {};
      try {
        cp = JSON.parse(regularProject.company_profile_json || '{}');
        // verify flow stores the profile at top level; search/build nests it.
        const name = cp.name || (cp.profile && cp.profile.name);
        if (name) businessName = name;
      } catch {
        // keep URL fallback
      }
      const prof = cp.profile || cp;
      industrySignal = [businessName, prof.category, prof.description].filter(Boolean).join(' ');
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
    const holidaySettings = parseHolidaySettings(config);
  const sitesBase = env.SITES_BASE || 'caddisfly.app';
    const domainsPanelBlock = `
      <details class="design-group" id="domains-group"${domains.length ? ' open' : ''}>
        <summary>🌐 Custom domain</summary>
        <div class="design-group-body">
          ${renderDomainsPanel({ projectId: project.project_id, domains, subdomain: currentSubdomain, saasOn, sitesBase, lang })}
        </div>
      </details>`;

    // Multi-page: ensure pages exist, resolve the page being edited (?page=slug,
    // else home), and split sections into site-wide (header/footer) + this page's.
    await ensurePagesForProject(env.DB, projectKey);
    const pages = await getPagesByProject(env.DB, projectKey);
    const requestedSlug = query && query.page;
    let currentPage = requestedSlug ? await getPageBySlug(env.DB, projectKey, requestedSlug) : null;
    // A menu group is not an editable page — never treat it as the current page.
    if (currentPage && currentPage.is_group) currentPage = null;
    if (!currentPage) currentPage = await getHomePage(env.DB, projectKey);
    const currentSlug = currentPage ? currentPage.slug : 'home';

    // Self-heal: rescue any sections stranded on a menu group (or deleted page)
    // back to the home page so they reappear in the editor and render again.
    const homePage = pages.find((p) => p.is_home) || pages.find((p) => !p.is_group);
    if (homePage) await rehomeOrphanedSections(env.DB, projectKey, homePage.id).catch(() => 0);

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
                <span class="drag-handle" title="${tr('cust.drag_reorder')}">⋮⋮</span>
                <span class="section-type">${section.section_type}</span>
                <button
                  class="visibility-toggle ${section.is_visible ? 'visible' : 'hidden'}"
                  data-section-id="${section.id}"
                  data-visible="${section.is_visible ? '1' : '0'}"
                  onclick="toggleVisibility(event)"
                  title="${section.is_visible ? tr('cust.hide_section') : tr('cust.show_section')}"
                >${section.is_visible ? '👁️' : '👁️‍🗨️'}</button>
              </div>
              <div class="section-actions">
                <button class="ai-edit-btn" onclick="editSection(${section.id})" title="${tr('cust.edit_title')}">${tr('cust.edit')}</button>
                <select class="template-variant-select" data-section-id="${section.id}" onchange="switchTemplate(event)" onclick="event.stopPropagation()" title="${tr('cust.layout_title')}">
                  ${getAvailableVariants(section.section_type)
                    .map((variant) => `<option value="${variant}" ${section.html_template === variant ? 'selected' : ''}>${variant.replace('-', ' ')}</option>`)
                    .join('')}
                </select>
                ${siteWide ? '' : `<select class="move-page-select" onchange="moveSectionToPage(${section.id}, this.value)" onclick="event.stopPropagation()" title="${tr('cust.move_title')}">
                  ${pages.filter((p) => !p.is_group).map((p) => `<option value="${p.id}" ${section.page_id === p.id ? 'selected' : ''}>→ ${esc(p.nav_label || p.slug)}</option>`).join('')}
                </select>
                <button class="del-section-btn" onclick="removeSection(event, ${section.id})" title="${tr('cust.delete_section_title')}">🗑</button>`}
              </div>
            </div>`;

    const html = `
<!DOCTYPE html>
<html lang="${lang}">
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

    .field-flash { animation: fieldFlash 1.7s ease-out; border-radius: 8px; }
    @keyframes fieldFlash { 0%, 40% { box-shadow: 0 0 0 3px rgba(124,58,237,0.55); background: rgba(124,58,237,0.06); } 100% { box-shadow: 0 0 0 3px rgba(124,58,237,0); background: transparent; } }
    .builder-tabs { display: flex; gap: 0.4rem; margin-bottom: 1rem; border-bottom: 2px solid #edf0f5; }
    .builder-tab { flex: 1; padding: 0.6rem 0.4rem; border: none; background: none; font-size: 0.92rem; font-weight: 700; color: #718096; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .builder-tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }
    .builder-tab:hover { color: #2d3748; }
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
    .snap-save { display: flex; gap: .5rem; align-items: center; margin-bottom: .8rem; }
    .snap-save input { flex: 1; }
    .snap-row { display: flex; align-items: baseline; gap: .6rem; padding: .45rem 0; border-bottom: 1px solid #edf2f7; flex-wrap: wrap; }
    .snap-row:last-child { border-bottom: none; }
    .snap-name { font-weight: 700; color: #2d3748; font-size: .88rem; }
    .snap-meta { color: #a0aec0; font-size: .78rem; flex: 1; }
    .snap-acts { display: flex; gap: .7rem; }
    .snap-auto { display: flex; align-items: center; gap: .45rem; font-size: .82rem; color: #4a5568; margin: 0 0 .7rem; cursor: pointer; }
    .design-group[open] > summary::before { content: '▾ '; }
    .design-group-body { padding-top: 1rem; }
    .seo-hint { font-size: .8rem; color: #718096; margin-bottom: .9rem; line-height: 1.5; }
    .seo-label { display: block; font-size: .8rem; font-weight: 700; color: #4a5568; margin: .7rem 0 .3rem; }
    .seo-sub { font-weight: 500; color: #a0aec0; }
    .seo-count { float: right; font-weight: 500; color: #a0aec0; }
    .seo-input { width: 100%; box-sizing: border-box; padding: .5rem .6rem; border: 1px solid #cbd5e0; border-radius: 8px; font: inherit; font-size: .85rem; }
    textarea.seo-input { resize: vertical; }
    .serp-preview { margin: 1rem 0 .6rem; padding: .7rem .8rem; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; }
    .serp-url { color: #1a7f37; font-size: .76rem; word-break: break-all; }
    .serp-title { color: #1a0dab; font-size: 1rem; font-weight: 500; margin: .15rem 0; line-height: 1.3; }
    .serp-desc { color: #4d5156; font-size: .82rem; line-height: 1.45; }
    .seo-saved { color: #03894a; font-size: .82rem; font-weight: 700; margin-left: .6rem; }
    .pub-badge { display: inline-flex; align-items: center; gap: .35rem; font-size: .78rem; font-weight: 700; padding: .3rem .65rem; border-radius: 999px; white-space: nowrap; }
    .pub-badge::before { content: '●'; font-size: .7em; }
    .pub-badge.pub { background: #e6f7ef; color: #03894a; }
    .pub-badge.draft { background: #edf0f5; color: #64748b; }

    /* Logo panel */
    #logo-current { display: flex; align-items: center; gap: .8rem; margin-bottom: .4rem; }
    #logo-current img { height: 48px; width: 48px; object-fit: contain; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 4px; }
    #logo-options { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; margin-top: .6rem; }
    #logo-options > p { grid-column: 1 / -1; margin: 0; }
    .logo-option { display: flex; align-items: center; gap: .55rem; padding: .55rem .6rem; background: #fff;
      border: 2px solid #e2e8f0; border-radius: 10px; cursor: pointer; font: inherit; }
    .logo-option:hover { border-color: #a3b3f5; }
    .logo-option.selected { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,.18); }
    .logo-option img { height: 40px; width: 40px; object-fit: contain; flex: none; }
    .logo-option-name { font-weight: 700; font-size: .85rem; color: #1a202c; text-align: left; overflow: hidden; text-overflow: ellipsis; }
    .logo-upload { display: block; margin-top: .7rem; font-size: .85rem; color: #4a5568; }
    .logo-upload input { display: block; margin-top: .3rem; font-size: .8rem; }
    .logo-disclaimer { font-size: .75rem; color: #a0aec0; margin-top: .7rem; }
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
    .menu-org {
      display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; align-items: center;
      margin: -0.5rem 0 1.25rem; padding: 0.6rem 0.8rem;
      background: #faf9ff; border: 1px solid #ece9fb; border-radius: 10px;
      font-size: 0.85rem; color: #4a5568;
    }
    .menu-org-row { display: inline-flex; align-items: center; gap: 0.4rem; }
    .menu-org select { font-size: 0.85rem; padding: 0.25rem 0.4rem; border: 1px solid #d6d3e8; border-radius: 6px; background: #fff; }
    .page-tab-ai { color: #7c3aed; border-style: dashed; font-weight: 600; }
    .menu-tree { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.25rem; }
    .menu-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; border: 1px solid #ece9fb; border-radius: 9px; background: #faf9ff; }
    .menu-row-child { margin-left: 1.6rem; background: #fff; }
    .menu-row-home { opacity: 0.85; }
    .menu-row-name { font-weight: 600; color: #1a202c; font-size: 0.92rem; flex: 1; }
    .menu-row-child .menu-row-name { font-weight: 500; color: #4a5568; }
    .menu-reorder { display: inline-flex; flex-direction: column; line-height: 0.7; }
    .menu-arrow { border: none; background: none; cursor: pointer; color: #7c3aed; font-size: 0.62rem; padding: 0.05rem 0.25rem; }
    .menu-arrow:disabled { color: #cbd5e0; cursor: default; }
    .menu-group-tag { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: #7c3aed; background: #f0ecff; border-radius: 999px; padding: 0.08rem 0.45rem; margin-left: 0.35rem; vertical-align: middle; }
    .menu-group-actions { display: inline-flex; gap: 0.6rem; }
    #mnu-overlay { position: fixed; inset: 0; background: rgba(15,18,34,0.45); display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 1rem; }
    .mnu-card { background: #fff; border-radius: 14px; max-width: 480px; width: 100%; max-height: 80vh; overflow: auto; padding: 1.5rem; box-shadow: 0 24px 60px rgba(0,0,0,0.28); }
    .mnu-card h3 { margin: 0 0 0.3rem; font-size: 1.25rem; }
    .mnu-sub { color: #4a5568; font-size: 0.9rem; margin: 0 0 1rem; }
    .mnu-tree { list-style: none; margin: 0; padding-left: 0.5rem; }
    .mnu-tree .mnu-tree { padding-left: 1.25rem; border-left: 2px solid #ece9fb; margin: 0.25rem 0; }
    .mnu-tree li { padding: 0.3rem 0; font-size: 0.95rem; color: #1a202c; }
    .mnu-badge { font-size: 0.7rem; background: #f0ecff; color: #7c3aed; border-radius: 999px; padding: 0.05rem 0.5rem; margin-left: 0.3rem; }
    .mnu-badge.mnu-hide { background: #fde8e8; color: #c53030; }
    .mnu-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }
    .mnu-cancel { background: none; border: 1px solid #d6d3e8; border-radius: 8px; padding: 0.55rem 1.1rem; cursor: pointer; }
    .mnu-apply { background: #7c3aed; color: #fff; border: none; border-radius: 8px; padding: 0.55rem 1.3rem; font-weight: 600; cursor: pointer; }
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
      <a href="/billing" class="credit-chip" title="${tr('cust.credits_title', { m: creditState.monthlyRemaining.toLocaleString(), p: creditState.purchased.toLocaleString() })}">✨ <strong>${creditState.totalRemaining.toLocaleString()}</strong></a>
      <a href="/dashboard" class="btn btn-secondary" title="${tr('cust.dashboard_title')}">${tr('cust.dashboard')}</a>
      <a href="/ai-builder/analytics/${project.project_id}" class="btn btn-secondary" title="${tr('cust.analytics_title')}">${tr('cust.analytics')}</a>
      <a href="/ai-builder/blog/${project.project_id}" class="btn btn-secondary" title="${tr('cust.blog_title')}">${tr('cust.blog')}</a>
      <a href="/ai-builder/store/${project.project_id}" class="btn btn-secondary" title="${tr('cust.store_title')}">${tr('cust.store')}</a>
      <a href="/ai-preview/${project.project_id}" class="btn btn-secondary" target="_blank">${tr('cust.full_preview')}</a>
      <span class="pub-badge ${currentSubdomain ? 'pub' : 'draft'}" id="pub-badge" title="${currentSubdomain ? tr('cust.status_published_title') : tr('cust.status_draft_title')}">${currentSubdomain ? tr('cust.status_published') : tr('cust.status_draft')}</span>
      ${showDeploy ? `<button class="btn btn-primary" onclick="deployWebsite(this)">${tr('cust.deploy')}</button>` : ''}
    </div>
  </div>

  <div class="container">
    <div class="split-view">
      <div class="sections-panel">
        <div class="builder-tabs">
          <button type="button" class="builder-tab active" data-pane="content" onclick="switchPanel('content')">${tr('cust.tab_content')}</button>
          <button type="button" class="builder-tab" data-pane="design" onclick="switchPanel('design')">${tr('cust.tab_design')}</button>
        </div>
        <div id="pane-content" class="builder-pane">
        <h2 style="margin-bottom: 0.5rem;">${tr('cust.pages')}</h2>
        <div class="page-tabs">
          ${pages
            .filter((p) => !p.is_group)
            .map((p) => `<button class="page-tab ${p.slug === currentSlug ? 'active' : ''}" onclick="switchPage('${p.slug}')">${p.is_home ? '🏠 ' : ''}${esc(p.nav_label || p.slug)}</button>`)
            .join('')}
          <button class="page-tab page-tab-add" onclick="addPage()" title="${tr('cust.add_page_title')}">${tr('cust.add_page')}</button>
        </div>
        <div class="page-toolbar">
          ${currentPage && !currentPage.is_home
            ? `<button class="link-btn" onclick="renamePage(${currentPage.id}, '${esc(currentPage.nav_label || '').replace(/'/g, "\\'")}')">${tr('cust.rename')}</button>
               <button class="link-btn danger" onclick="deletePage(${currentPage.id})">${tr('cust.delete_page')}</button>`
            : `<span class="muted">${tr('cust.home_page')}</span>`}
        </div>
        ${currentPage && !currentPage.is_home
          ? (() => {
              const hasChildren = pages.some((p) => p.parent_id === currentPage.id);
              // Valid parents = any TOP-LEVEL page/group except this page. A
              // group/page may hold MANY children, so do NOT exclude parents
              // that already have children (that previously capped a group at
              // one item). One-level nesting is still enforced: a page that
              // itself has children shows "has submenu items" below instead of
              // this selector, and the API rejects deeper nesting.
              const candidates = pages.filter((p) => !p.parent_id && p.id !== currentPage.id);
              return `<div class="menu-org">
          <label class="menu-org-row">${tr('cust.menu_parent') || 'Menu parent'}:
            ${hasChildren
              ? `<span class="muted">${tr('cust.menu_has_children') || 'has submenu items'}</span>`
              : `<select onchange="setPageParent(${currentPage.id}, this.value)">
                  <option value="">${tr('cust.menu_top_level') || 'Top level'}</option>
                  ${candidates.map((p) => `<option value="${p.id}" ${currentPage.parent_id === p.id ? 'selected' : ''}>${p.is_group ? '▾ ' : ''}${esc(p.nav_label || p.slug)}</option>`).join('')}
                </select>`}
          </label>
          <label class="menu-org-row"><input type="checkbox" ${currentPage.is_visible ? 'checked' : ''} onchange="setPageVisible(${currentPage.id}, this.checked)"> ${tr('cust.menu_show') || 'Show in menu'}</label>
          <label class="menu-org-row"><input type="checkbox" ${currentPage.show_sections_in_nav ? 'checked' : ''} onchange="setShowSections(${currentPage.id}, this.checked)"> ${tr('cust.menu_sections_sub') || 'Sections as submenu'}</label>
        </div>`;
            })()
          : ''}

        <h2 style="margin: 1.75rem 0 0.35rem;">${tr('cust.menu') || 'Menu'}</h2>
        <p class="muted" style="font-size: 0.85rem; margin-bottom: 0.7rem;">${tr('cust.menu_note') || 'Organize how items appear in the top navigation. Groups are dropdown headers — nest pages under them with each page’s “Menu parent”.'}</p>
        <div class="page-tabs">
          <button class="page-tab page-tab-add" onclick="addGroup()" title="A dropdown menu header with no page of its own — nest pages under it">${tr('cust.add_group') || '+ Menu group'}</button>
          <button class="page-tab page-tab-ai" onclick="organizeMenu()" title="${tr('cust.menu_ai_title') || 'Let AI tidy your menu into groups & submenus — preview before applying'}">${tr('cust.menu_ai') || '✨ Organize menu'}</button>
        </div>
        ${(() => {
          const top = pages.filter((p) => !p.parent_id);
          if (top.length <= 1 && !pages.some((p) => p.parent_id)) {
            return `<p class="muted" style="font-size: 0.85rem;">${tr('cust.menu_no_groups') || 'No menu groups yet. Create one to nest pages under a dropdown.'}</p>`;
          }
          const childrenOf = (id) => pages.filter((p) => p.parent_id === id);
          const order = { top: top.map((p) => p.id), groups: {} };
          top.forEach((p) => { const k = childrenOf(p.id); if (k.length) order.groups[p.id] = k.map((c) => c.id); });
          const arrows = (id, idx, len) => `<span class="menu-reorder">
            <button class="menu-arrow" ${idx === 0 ? 'disabled' : ''} onclick="moveMenuItem(${id},-1)" title="${tr('cust.menu_move_up') || 'Move up'}" aria-label="${tr('cust.menu_move_up') || 'Move up'}">▲</button>
            <button class="menu-arrow" ${idx === len - 1 ? 'disabled' : ''} onclick="moveMenuItem(${id},1)" title="${tr('cust.menu_move_down') || 'Move down'}" aria-label="${tr('cust.menu_move_down') || 'Move down'}">▼</button>
          </span>`;
          const rows = top.map((p, i) => {
            const kids = childrenOf(p.id);
            const tag = p.is_group ? ` <span class="menu-group-tag">${tr('cust.mnu_group_badge') || 'group'}</span>` : (kids.length ? ` <span class="menu-group-tag">▾</span>` : '');
            const actions = p.is_group
              ? `<span class="menu-group-actions"><button class="link-btn" onclick="renamePage(${p.id}, '${esc(p.nav_label || '').replace(/'/g, "\\'")}')">${tr('cust.rename')}</button><button class="link-btn danger" onclick="deleteGroup(${p.id})">${tr('cust.delete_group') || 'Delete group'}</button></span>`
              : '';
            const head = `<div class="menu-row${p.is_home ? ' menu-row-home' : ''}">${arrows(p.id, i, top.length)}<span class="menu-row-name">${p.is_home ? '🏠 ' : ''}${esc(p.nav_label || p.slug)}${tag}</span>${actions}</div>`;
            const childRows = kids.map((k, j) => `<div class="menu-row menu-row-child">${arrows(k.id, j, kids.length)}<span class="menu-row-name">${esc(k.nav_label || k.slug)}</span></div>`).join('');
            return head + childRows;
          }).join('');
          return `<script>window.MENU_ORDER=${JSON.stringify(order)};</script><div class="menu-tree">${rows}</div>`;
        })()}

        ${siteSections.length
          ? `<h3 class="group-title">${tr('cust.sitewide')} <span class="muted">${tr('cust.sitewide_note')}</span></h3>
             <div class="sections-list">${siteSections.map((s) => renderTile(s, true)).join('')}</div>`
          : ''}

        <h3 class="group-title">${tr('cust.sections_of', { page: esc((currentPage && currentPage.nav_label) || 'Home') })}</h3>
        <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1rem;">
          ${tr('cust.sections_hint')}
        </p>
        <div id="sections-list">
          ${sections.map((s) => renderTile(s)).join('') || `<p class="muted">${tr('cust.no_sections')}</p>`}
        </div>

        <div class="add-section-wrap">
          <button class="add-section-btn" onclick="toggleAddSection()" title="${tr('cust.add_section_title')}">${tr('cust.add_section')}</button>
          <div class="add-section-menu" id="add-section-menu" hidden>
            ${ADDABLE_SECTIONS.map((s) => `<button class="add-section-option" onclick="pickSectionType('${s.type}')">${s.emoji} ${esc(s.label)}</button>`).join('')}
          </div>
          <div class="add-variant-menu" id="add-variant-menu" hidden></div>
        </div>

        <details class="design-group" id="seo-group">
          <summary>${tr('cust.seo_summary')}</summary>
          <div class="design-group-body">
            <p class="seo-hint">${tr('cust.seo_hint')}</p>
            <label class="seo-label">${tr('cust.seo_page_title')} <span class="seo-count" id="seo-title-count"></span></label>
            <input type="text" id="seo-title" class="seo-input" maxlength="120" oninput="seoSync()"
              placeholder="${esc((currentPage && (currentPage.title || currentPage.nav_label)) || 'Home')} | ${tr('cust.seo_title_ph_suffix')}"
              value="${esc((currentPage && currentPage.seo_title) || '')}">
            <label class="seo-label">${tr('cust.seo_meta_desc')} <span class="seo-count" id="seo-desc-count"></span></label>
            <textarea id="seo-desc" class="seo-input" rows="3" maxlength="320" oninput="seoSync()"
              placeholder="${tr('cust.seo_desc_ph')}">${esc((currentPage && currentPage.seo_description) || '')}</textarea>
            <label class="seo-label">${tr('cust.seo_social')} <span class="seo-sub">${tr('cust.seo_sitewide')}</span></label>
            <input type="text" id="seo-social" class="seo-input" placeholder="https://…/share-image.jpg"
              value="${esc(config.social_image || '')}">
            <div class="serp-preview">
              <div class="serp-url">${esc(currentSubdomain ? `${currentSubdomain}.${sitesBase}` : `yoursite.${sitesBase}`)}${currentPage && currentPage.is_home ? '' : '/' + esc((currentPage && currentPage.slug) || '')}</div>
              <div class="serp-title" id="serp-title"></div>
              <div class="serp-desc" id="serp-desc"></div>
            </div>
            <button class="link-btn" id="seo-save" onclick="saveSeo(this)" style="font-weight:700">${tr('cust.save_seo')}</button>
            <button class="link-btn" id="seo-ai" onclick="aiSeoReview(this)">${tr('cust.seo_ai_btn')}</button>
            <span class="seo-saved" id="seo-saved" hidden>${tr('cust.saved')}</span>
          </div>
        </details>

        <details class="design-group" id="versions-group" ontoggle="if(this.open) loadSnapshots()">
          <summary>${tr('snap.summary')}</summary>
          <div class="design-group-body">
            <p class="seo-hint">${tr('snap.hint')}</p>
            <div class="snap-save">
              <input type="text" id="snap-label" class="seo-input" maxlength="120" placeholder="${tr('snap.label_ph')}">
              <button class="add-section-btn" id="snap-save-btn" onclick="saveSnapshot(this)">${tr('snap.save_btn')}</button>
            </div>
            <label class="snap-auto"><input type="checkbox" id="snap-auto-cb" ${config.auto_snapshot === 0 ? '' : 'checked'} onchange="toggleAutoSnap(this)"> ${tr('snap.auto_toggle')}</label>
            <button class="link-btn" id="revert-original-btn" onclick="revertToOriginal(this)" style="margin:.4rem 0 .2rem">↩ ${tr('snap.revert_original')}</button>
            <p class="seo-hint">${tr('snap.revert_original_hint')}</p>
            <div id="snap-list"><p class="seo-hint">${tr('snap.loading')}</p></div>
          </div>
        </details>
        ${showDomains ? domainsPanelBlock : ''}
        </div>

        <div id="pane-design" class="builder-pane" hidden>
          ${generateTemplatePicker(config.style_theme, lang, selectTemplate(inferIndustry(industrySignal)).key, params.project_id)}
          ${generateColorPicker(config, project.project_id, lang)}
          ${generateFontPicker(config, project.project_id, lang)}

          <details class="design-group" id="logo-group">
            <summary>${tr('logo.summary')}</summary>
            <div class="design-group-body">
              <div id="logo-current">
                ${config.logo_url
                  ? `<img src="${esc(config.logo_url)}" alt="logo"><button class="link-btn danger" onclick="removeLogo()">${tr('logo.remove')}</button>`
                  : `<p class="seo-hint">${tr('logo.none')}</p>`}
              </div>
              <p class="seo-hint">${tr('logo.hint')}</p>
              ${creditState.tier === 'free_trial' && env.ENVIRONMENT === 'production'
                ? `<p class="seo-hint">🔒 ${tr('logo.locked')} <a href="/billing" style="font-weight:700">${tr('logo.upgrade')}</a></p>`
                : `<input type="text" id="logo-brief" class="seo-input" maxlength="200" placeholder="${tr('logo.brief_ph')}">
              <button class="add-section-btn" id="logo-gen-btn" onclick="generateLogos(this)">${tr('logo.generate')}</button>
              <p class="seo-hint">${tr('logo.cost', { n: CREDIT_COSTS.logo })}</p>
              <div id="logo-options"></div>`}
              <label class="logo-upload">${tr('logo.upload')} <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange="uploadLogo(this)"></label>
              <p class="logo-disclaimer">${tr('logo.disclaimer')}</p>
            </div>
          </details>

        <details class="design-group" id="holiday-group">
          <summary>${tr('hol.summary')}</summary>
          <div class="design-group-body">
            <p class="seo-hint">${tr('hol.hint')}</p>
            <label class="bk-check" style="display:flex;gap:.5rem;align-items:center;cursor:pointer;margin-bottom:.6rem">
              <input type="checkbox" id="hol-enabled"${holidaySettings.enabled ? ' checked' : ''}> <strong>${tr('hol.enable')}</strong>
            </label>
            <div id="hol-list" style="display:flex;flex-direction:column;gap:.35rem;margin:.3rem 0 .7rem">
              ${HOLIDAY_KEYS.map((k) => `<label style="display:flex;gap:.5rem;align-items:center;cursor:pointer;font-size:.9rem">
                <input type="checkbox" class="hol-day" value="${k}"${holidaySettings.holidays.includes(k) ? ' checked' : ''}>
                ${HOLIDAY_SKINS[k].emoji} ${tr(`hol.h_${k}`)}
                <span style="display:inline-flex;gap:3px;margin-left:auto">
                  <span style="width:14px;height:14px;border-radius:4px;background:${HOLIDAY_SKINS[k].colors.primary}"></span>
                  <span style="width:14px;height:14px;border-radius:4px;background:${HOLIDAY_SKINS[k].colors.secondary}"></span>
                </span>
              </label>`).join('')}
            </div>
            <label style="display:flex;gap:.5rem;align-items:center;cursor:pointer;font-size:.9rem;margin-bottom:.6rem">
              <input type="checkbox" id="hol-decor"${holidaySettings.decor ? ' checked' : ''}> ${tr('hol.decor')}
            </label>
            ${holidaySettings.applied ? `<p class="seo-hint" style="color:#92400e">${tr('hol.active_now')} ${HOLIDAY_SKINS[holidaySettings.applied.holiday] ? HOLIDAY_SKINS[holidaySettings.applied.holiday].emoji : ''} ${tr(`hol.h_${holidaySettings.applied.holiday}`)}</p>` : ''}
            <button class="link-btn" style="font-weight:700" onclick="saveHolidays(this)">${tr('hol.save')}</button>
            <span class="seo-saved" id="hol-saved" hidden>${tr('cust.saved')}</span>
          </div>
        </details>
        </div>
      </div>

      <div class="preview-frame">
        <iframe src="/ai-preview/${project.project_id}/${currentSlug}?embed=1" id="preview-iframe"></iframe>
      </div>
    </div>
  </div>

  <script>
    const projectId = '${project.project_id}';
    const currentPageSlug = '${currentSlug}';
    const seoPageId = ${currentPage ? currentPage.id : 'null'};
    let draggedElement = null;

    // ---- Versions panel (snapshots: save / restore / delete) ----
    const SNAP_T = ${JSON.stringify({
      empty: tr('snap.empty'),
      err: tr('snap.err'),
      unnamed: tr('snap.unnamed'),
      auto_backup: tr('snap.auto_backup'),
      auto_save: tr('snap.auto_save'),
      restore: tr('snap.restore'),
      restore_confirm: tr('snap.restore_confirm'),
      del: tr('snap.delete'),
      delete_confirm: tr('snap.delete_confirm'),
      saving: tr('snap.saving'),
      save_btn: tr('snap.save_btn'),
      restoring: tr('snap.restoring'),
      revert_original: tr('snap.revert_original'),
      revert_confirm: tr('snap.revert_confirm'),
      reverting: tr('snap.reverting'),
      revert_none: tr('snap.revert_none'),
    })};
    const SNAP_LANG = ${JSON.stringify(lang)};
    let snapsLoaded = false;
    async function loadSnapshots(force) {
      if (snapsLoaded && !force) return;
      snapsLoaded = true;
      const box = document.getElementById('snap-list');
      try {
        const r = await fetch('/api/ai-builder/' + projectId + '/snapshots');
        const d = await r.json();
        const rows = (d && d.snapshots) || [];
        box.innerHTML = '';
        if (!rows.length) { box.innerHTML = '<p class="seo-hint">' + SNAP_T.empty + '</p>'; return; }
        rows.forEach(function (s) {
          const div = document.createElement('div'); div.className = 'snap-row';
          const name = document.createElement('span'); name.className = 'snap-name';
          name.textContent = s.label || (s.trigger_type === 'pre_restore' ? SNAP_T.auto_backup : s.trigger_type === 'auto' ? SNAP_T.auto_save : SNAP_T.unnamed);
          const meta = document.createElement('span'); meta.className = 'snap-meta';
          meta.textContent = new Date(s.created_at * 1000).toLocaleString(SNAP_LANG, { dateStyle: 'medium', timeStyle: 'short' })
            + ' · ' + Math.max(1, Math.round((s.size_bytes || 0) / 1024)) + ' KB';
          const acts = document.createElement('span'); acts.className = 'snap-acts';
          const rb = document.createElement('button'); rb.className = 'link-btn'; rb.style.fontWeight = '700';
          rb.textContent = SNAP_T.restore; rb.onclick = function () { restoreSnapshot(s.id, rb); };
          const del = document.createElement('button'); del.className = 'link-btn'; del.style.color = '#b91c1c';
          del.textContent = SNAP_T.del; del.onclick = function () { deleteSnapshot(s.id); };
          acts.appendChild(rb); acts.appendChild(del);
          div.appendChild(name); div.appendChild(meta); div.appendChild(acts);
          box.appendChild(div);
        });
      } catch (e) { box.innerHTML = '<p class="seo-hint">' + SNAP_T.err + '</p>'; }
    }
    async function saveSnapshot(btn) {
      const input = document.getElementById('snap-label');
      btn.disabled = true; btn.textContent = SNAP_T.saving;
      try {
        const r = await fetch('/api/ai-builder/' + projectId + '/snapshots', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: input.value || '' })
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || 'Failed');
        input.value = '';
        await loadSnapshots(true);
      } catch (e) { alert(e.message); }
      btn.disabled = false; btn.textContent = SNAP_T.save_btn;
    }
    async function restoreSnapshot(id, btn) {
      if (!confirm(SNAP_T.restore_confirm)) return;
      btn.disabled = true; btn.textContent = SNAP_T.restoring;
      try {
        const r = await fetch('/api/ai-builder/' + projectId + '/snapshots/' + id + '/restore', { method: 'POST' });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || 'Failed');
        flashToast(${JSON.stringify(tr('cust.toast_snapshot_restored'))});
        location.reload();
      } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = SNAP_T.restore; }
    }
    async function revertToOriginal(btn) {
      if (!confirm(SNAP_T.revert_confirm)) return;
      const label = btn.innerHTML;
      btn.disabled = true; btn.textContent = SNAP_T.reverting;
      try {
        const r = await fetch('/api/ai-builder/' + projectId + '/revert-original', { method: 'POST' });
        const d = await r.json();
        if (r.status === 404) { alert(SNAP_T.revert_none); btn.disabled = false; btn.innerHTML = label; return; }
        if (!r.ok || !d.success) throw new Error((d && d.error) || 'Failed');
        flashToast(${JSON.stringify(tr('cust.toast_snapshot_restored'))});
        location.reload();
      } catch (e) { alert(e.message); btn.disabled = false; btn.innerHTML = label; }
    }
    async function toggleAutoSnap(cb) {
      try {
        const r = await fetch('/api/ai-builder/' + projectId + '/snapshots/auto', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: cb.checked })
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || 'Failed');
      } catch (e) { alert(e.message); cb.checked = !cb.checked; }
    }
    async function deleteSnapshot(id) {
      if (!confirm(SNAP_T.delete_confirm)) return;
      try {
        const r = await fetch('/api/ai-builder/' + projectId + '/snapshots/' + id, { method: 'DELETE' });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || 'Failed');
        await loadSnapshots(true);
      } catch (e) { alert(e.message); }
    }

    // ---- SEO panel (live preview + save) ----
    function seoSync() {
      const t = document.getElementById('seo-title'), d = document.getElementById('seo-desc');
      if (!t || !d) return;
      document.getElementById('seo-title-count').textContent = t.value.length + '/60';
      document.getElementById('seo-desc-count').textContent = d.value.length + '/160';
      document.getElementById('serp-title').textContent = t.value || t.placeholder;
      document.getElementById('serp-desc').textContent = d.value || d.placeholder;
    }
    async function saveSeo(btn) {
      btn.disabled = true;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/seo\`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId: seoPageId,
            seo_title: document.getElementById('seo-title').value,
            seo_description: document.getElementById('seo-desc').value,
            social_image: document.getElementById('seo-social').value,
          }),
        });
        const d = await r.json();
        if (d.success) showNotification(${JSON.stringify(tr('cust.toast_seo_saved'))}, 'success');
        else alert(d.error || ${JSON.stringify(tr('cust.could_not_save_seo'))});
      } catch (_) { alert(${JSON.stringify(tr('cust.err_network'))}); }
      finally { btn.disabled = false; }
    }
    async function saveHolidays(btn) {
      btn.disabled = true;
      try {
        var hols = [];
        document.querySelectorAll('.hol-day:checked').forEach(function (el) { hols.push(el.value); });
        const r = await fetch(\`/api/ai-builder/\${projectId}/holiday-themes\`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: document.getElementById('hol-enabled').checked, holidays: hols, decor: document.getElementById('hol-decor').checked }),
        });
        const d = await r.json().catch(() => ({}));
        if (d.success) {
          var ok = document.getElementById('hol-saved');
          if (ok) { ok.hidden = false; setTimeout(function () { ok.hidden = true; }, 1800); }
          showNotification(${JSON.stringify(tr('hol.saved_note'))}, 'success');
        } else alert(d.error || ${JSON.stringify(tr('cust.err_network'))});
      } catch (_) { alert(${JSON.stringify(tr('cust.err_network'))}); }
      finally { btn.disabled = false; }
    }
    async function aiSeoReview(btn) {
      btn.disabled = true;
      const was = btn.textContent;
      btn.textContent = ${JSON.stringify(tr('cust.seo_ai_busy'))};
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/seo/ai-review\`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: seoPageId }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 402) { alert(d.error || ${JSON.stringify(tr('cust.seo_ai_err'))}); return; }
        if (!r.ok || !d.success) { alert(d.error || ${JSON.stringify(tr('cust.seo_ai_err'))}); return; }
        if (d.seo) {
          document.getElementById('seo-title').value = d.seo.seo_title || '';
          document.getElementById('seo-desc').value = d.seo.seo_description || '';
          seoSync();
        }
        showNotification(${JSON.stringify(tr('cust.seo_ai_done'))}.replace('{n}', d.pages_updated), 'success');
      } catch (_) { alert(${JSON.stringify(tr('cust.err_network'))}); }
      finally { btn.disabled = false; btn.textContent = was; }
    }
    seoSync();

    // ---- Logo panel (AI generate / pick / upload / remove) ----
    const LOGO_T = ${JSON.stringify({
      generate: tr('logo.generate'),
      generating: tr('logo.generating'),
      pick: tr('logo.pick'),
      none: tr('logo.none'),
      remove: tr('logo.remove'),
      err: tr('logo.err'),
    })};
    async function generateLogos(btn) {
      btn.disabled = true; btn.textContent = LOGO_T.generating;
      try {
        const r = await fetch('/api/ai-builder/' + projectId + '/logo/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brief: document.getElementById('logo-brief').value.trim() }),
        });
        const d = await r.json();
        if (!r.ok || !d.success) {
          // Paid-plan / out-of-credits → upgrade popup instead of a dead-end alert.
          if (d && d.billing_url) { showUpgradePrompt(d.upgrade_message || d.error, d.billing_url); return; }
          throw new Error((d && d.error) || LOGO_T.err);
        }
        const box = document.getElementById('logo-options');
        box.innerHTML = '<p class="seo-hint">' + LOGO_T.pick + '</p>';
        d.options.forEach(function (u) {
          const card = document.createElement('button');
          card.className = 'logo-option'; card.type = 'button';
          const img = document.createElement('img'); img.src = u; img.alt = 'logo option';
          const nm = document.createElement('span'); nm.className = 'logo-option-name';
          nm.textContent = d.business_name || '';
          card.appendChild(img); card.appendChild(nm);
          card.onclick = function () { setLogo(u, card); };
          box.appendChild(card);
        });
      } catch (e) { alert(e.message || LOGO_T.err); }
      finally { btn.disabled = false; btn.textContent = LOGO_T.generate; }
    }
    async function setLogo(url, card) {
      try {
        const r = await fetch('/api/ai-builder/' + projectId + '/logo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url }),
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || LOGO_T.err);
        renderCurrentLogo(d.logo_url);
        document.querySelectorAll('.logo-option.selected').forEach(function (el) { el.classList.remove('selected'); });
        if (card) card.classList.add('selected');
        const f = document.getElementById('preview-iframe'); f.src = f.src; // reflect the new header logo
        showNotification(url ? ${JSON.stringify(tr('cust.toast_logo_updated'))} : ${JSON.stringify(tr('cust.toast_logo_removed'))}, 'success');
      } catch (e) { alert(e.message || LOGO_T.err); }
    }
    function removeLogo() { setLogo(''); }
    function renderCurrentLogo(url) {
      const box = document.getElementById('logo-current');
      box.innerHTML = '';
      if (!url) { box.innerHTML = '<p class="seo-hint">' + LOGO_T.none + '</p>'; return; }
      const img = document.createElement('img'); img.src = url; img.alt = 'logo';
      const btn = document.createElement('button'); btn.className = 'link-btn danger'; btn.type = 'button';
      btn.textContent = LOGO_T.remove; btn.onclick = removeLogo;
      box.appendChild(img); box.appendChild(btn);
    }
    async function uploadLogo(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const fd = new FormData(); fd.append('file', file); fd.append('asset_type', 'logo');
      try {
        const r = await fetch('/api/ai-builder/' + projectId + '/upload', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error((d && d.error) || LOGO_T.err);
        await setLogo(d.url);
      } catch (e) { alert(e.message || LOGO_T.err); }
      finally { input.value = ''; }
    }

    // ---- Pages (multi-page) ----
    function gotoPage(slug) {
      const u = new URL(location.href);
      u.searchParams.set('page', slug);
      location.href = u.toString();
    }
    function switchPage(slug) { gotoPage(slug); }
    function switchPanel(name) {
      document.querySelectorAll('.builder-pane').forEach(function (p) { p.hidden = p.id !== 'pane-' + name; });
      document.querySelectorAll('.builder-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.pane === name); });
    }

    async function addPage() {
      const label = prompt('New page name?', 'New Page');
      if (!label) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/pages\`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nav_label: label })
        });
        const d = await r.json();
        if (d.success) { flashToast(${JSON.stringify(tr('cust.toast_page_added'))}); gotoPage(d.page.slug); } else alert(d.error || 'Failed to add page');
      } catch (e) { alert(${JSON.stringify(tr('cust.err_add_page'))} + e.message); }
    }

    // ---- Menu organization (nesting / groups) ----
    const MNU = ${JSON.stringify({
      group_name_prompt: tr('cust.mnu_group_name_prompt'),
      group_added: tr('cust.mnu_group_added'),
      updated: tr('cust.mnu_updated'),
      update_fail: tr('cust.mnu_update_fail'),
      group_del_confirm: tr('cust.mnu_group_del_confirm'),
      group_deleted: tr('cust.mnu_group_deleted'),
      asking: tr('cust.mnu_asking'),
      suggest_fail: tr('cust.mnu_suggest_fail'),
      title: tr('cust.mnu_title'),
      sub: tr('cust.mnu_sub'),
      cancel: tr('cust.mnu_cancel'),
      apply: tr('cust.mnu_apply'),
      applied: tr('cust.mnu_applied'),
      apply_fail: tr('cust.mnu_apply_fail'),
      badge_group: tr('cust.mnu_group_badge'),
      badge_sections: tr('cust.mnu_badge_sections'),
      badge_hidden: tr('cust.mnu_badge_hidden'),
    })};
    async function addGroup() {
      const label = prompt(MNU.group_name_prompt);
      if (!label) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/pages\`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nav_label: label, is_group: 1 })
        });
        const d = await r.json();
        if (d.success) { flashToast(MNU.group_added); location.reload(); } else alert(d.error || MNU.update_fail);
      } catch (e) { alert(MNU.update_fail + ': ' + e.message); }
    }
    async function updatePageField(id, patch) {
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/pages/\${id}\`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
        });
        const d = await r.json();
        if (d.success) { flashToast(MNU.updated); location.reload(); } else alert(d.error || MNU.update_fail);
      } catch (e) { alert(MNU.update_fail + ': ' + e.message); }
    }
    function setPageParent(id, parentId) { updatePageField(id, { parent_id: parentId ? Number(parentId) : null }); }
    function setPageVisible(id, vis) { updatePageField(id, { is_visible: vis ? 1 : 0 }); }
    function setShowSections(id, val) { updatePageField(id, { show_sections_in_nav: val ? 1 : 0 }); }
    async function reorderMenuScope(ids) {
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/pages/reorder\`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_ids: ids })
        });
        const d = await r.json();
        if (d.success) { flashToast(MNU.updated); location.reload(); } else alert(d.error || MNU.update_fail);
      } catch (e) { alert(MNU.update_fail + ': ' + e.message); }
    }
    // Move a menu item up/down among its siblings (same parent scope). Each scope
    // is reordered independently — page_order is only relative within a scope.
    function moveMenuItem(id, dir) {
      const order = window.MENU_ORDER || { top: [], groups: {} };
      const lists = [order.top].concat(Object.keys(order.groups).map((k) => order.groups[k]));
      for (const arr of lists) {
        const i = arr.indexOf(id);
        if (i < 0) continue;
        const j = i + dir;
        if (j < 0 || j >= arr.length) return;
        const n = arr.slice(); const t = n[i]; n[i] = n[j]; n[j] = t;
        reorderMenuScope(n); return;
      }
    }
    async function deleteGroup(id) {
      if (!confirm(MNU.group_del_confirm)) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/pages/\${id}\`, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) { flashToast(MNU.group_deleted); location.reload(); } else alert(d.error || MNU.update_fail);
      } catch (e) { alert(MNU.update_fail + ': ' + e.message); }
    }

    // ---- AI Smart Menu (suggest → preview → apply) ----
    function escMenu(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
    function renderMenuTree(items){
      var html = '<ul class="mnu-tree">';
      (items||[]).forEach(function(it){
        if(!it) return;
        var badge = it.kind==='group' ? ' <span class="mnu-badge">'+MNU.badge_group+'</span>' : (it.sectionsAsSubmenu ? ' <span class="mnu-badge">'+MNU.badge_sections+'</span>' : '') + (it.hide ? ' <span class="mnu-badge mnu-hide">'+MNU.badge_hidden+'</span>' : '');
        html += '<li>'+ (it.kind==='group'?'▾ ':'') + escMenu(it.label || ('Page '+it.id)) + badge;
        if(Array.isArray(it.children) && it.children.length) html += renderMenuTree(it.children);
        html += '</li>';
      });
      return html + '</ul>';
    }
    var _menuSuggestion = null;
    async function organizeMenu(){
      flashToast(MNU.asking);
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/menu/suggest\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const d = await r.json();
        if(!d.success){ alert(d.error || MNU.suggest_fail); return; }
        _menuSuggestion = d.suggestion;
        const host = document.createElement('div');
        host.id = 'mnu-overlay';
        host.innerHTML =
          '<div class="mnu-card">'
          + '<h3>' + escMenu(MNU.title) + '</h3>'
          + '<p class="mnu-sub">' + escMenu(MNU.sub) + '</p>'
          + renderMenuTree(d.suggestion.items)
          + '<div class="mnu-actions"><button class="mnu-cancel" onclick="closeMenuPreview()">' + escMenu(MNU.cancel) + '</button>'
          + '<button class="mnu-apply" onclick="applyMenuSuggestion()">' + escMenu(MNU.apply) + '</button></div>'
          + '</div>';
        document.body.appendChild(host);
      } catch (e) { alert(MNU.suggest_fail + ': ' + e.message); }
    }
    function closeMenuPreview(){ var o=document.getElementById('mnu-overlay'); if(o) o.remove(); }
    async function applyMenuSuggestion(){
      if(!_menuSuggestion) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/menu/apply\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: _menuSuggestion.items }) });
        const d = await r.json();
        if(d.success){ flashToast(MNU.applied); location.reload(); } else alert(d.error || MNU.apply_fail);
      } catch (e) { alert(MNU.apply_fail + ': ' + e.message); }
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
        '<div class="variant-head"><button class="variant-back" onclick="backToTypes()">' + ${JSON.stringify(tr('cust.back'))} + '</button>'
        + '<span>' + ${JSON.stringify(tr('cust.choose_layout', { label: '%L%' }))}.replace('%L%', label) + '</span></div>'
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
        if (d.success) { flashToast(${JSON.stringify(tr('cust.toast_section_added'))}); location.reload(); } else alert(d.error || 'Failed to add section');
      } catch (e) { alert(${JSON.stringify(tr('cust.err_add_section'))} + e.message); }
    }

    async function removeSection(event, id) {
      event.stopPropagation();
      if (!confirm('Delete this section? You can add it again later.')) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/sections/\${id}\`, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) { flashToast(${JSON.stringify(tr('cust.toast_section_removed'))}); location.reload(); } else alert(d.error || 'Failed to delete section');
      } catch (e) { alert(${JSON.stringify(tr('cust.err_del_section'))} + e.message); }
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
        if (d.success) { flashToast(${JSON.stringify(tr('cust.toast_page_renamed'))}); location.reload(); } else alert(d.error || 'Failed to rename');
      } catch (e) { alert(${JSON.stringify(tr('cust.err_rename'))} + e.message); }
    }

    async function deletePage(id) {
      if (!confirm('Delete this page? Its sections move to Home.')) return;
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/pages/\${id}\`, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) { flashToast(${JSON.stringify(tr('cust.toast_page_deleted'))}); gotoPage('home'); } else alert(d.error || 'Failed to delete');
      } catch (e) { alert(${JSON.stringify(tr('cust.err_del'))} + e.message); }
    }

    async function moveSectionToPage(sectionId, pageId) {
      try {
        const r = await fetch(\`/api/ai-builder/\${projectId}/sections/\${sectionId}\`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page_id: parseInt(pageId) })
        });
        const d = await r.json();
        if (d.success) gotoPage(currentPageSlug); else alert(d.error || 'Failed to move section');
      } catch (e) { alert(${JSON.stringify(tr('cust.err_move'))} + e.message); }
    }

    function handleDragStart(e) {
      // Resolve to the TILE — drag/drop events fire on the innermost child
      // (type label, header row, buttons), and matching e.target directly made
      // most of the tile's surface a dead drop zone ("can't drag to the top").
      draggedElement = e.target.closest ? e.target.closest('.section-item') : e.target;
      if (!draggedElement) draggedElement = e.target;
      draggedElement.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedElement.dataset.sectionId || '');
    }

    function handleDragOver(e) {
      if (e.preventDefault) {
        e.preventDefault();
      }
      e.dataTransfer.dropEffect = 'move';
      return false;
    }

    function handleDragEnter(e) {
      var item = e.target.closest ? e.target.closest('.section-item') : null;
      if (item && item !== draggedElement) item.classList.add('drag-over');
    }

    function handleDragLeave(e) {
      var item = e.target.closest ? e.target.closest('.section-item') : null;
      // Only clear when truly leaving the tile, not when crossing its children.
      if (item && !item.contains(e.relatedTarget)) item.classList.remove('drag-over');
    }

    function handleDrop(e) {
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault) e.preventDefault();

      var target = e.target.closest ? e.target.closest('.section-item') : null;
      if (target) target.classList.remove('drag-over');

      if (draggedElement && target && target !== draggedElement) {
        const container = document.getElementById('sections-list');
        const allItems = Array.from(container.children);
        const draggedIndex = allItems.indexOf(draggedElement);
        const targetIndex = allItems.indexOf(target);

        if (draggedIndex < targetIndex) {
          container.insertBefore(draggedElement, target.nextSibling);
        } else {
          container.insertBefore(draggedElement, target);
        }

        // Update section order in database
        updateSectionOrder();
      }

      return false;
    }

    function handleDragEnd(e) {
      if (draggedElement) draggedElement.classList.remove('dragging');
      else if (e.target.classList) e.target.classList.remove('dragging');

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
        alert(${JSON.stringify(tr('cust.err_order'))} + error.message);
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

        alert(${JSON.stringify(tr('cust.err_visibility'))} + error.message);
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

    async function editSection(sectionId, fieldHint) {
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

        if (fieldHint) focusEditorField(fieldHint);
      } catch (error) {
        alert(${JSON.stringify(tr('cust.err_load_editor'))} + error.message);
      }
    }

    // Deep-link to a field after the editor loads (element-level click-to-edit):
    // open the manual-edit form, scroll to + flash the matching field, focus it.
    function focusEditorField(hint) {
      const MAP = { heading: ['heading'], text: ['subheading', 'description', 'tagline'], link: ['cta_link', 'cta_url'], image: ['image_url'] };
      const names = MAP[hint] || [];
      setTimeout(() => {
        const host = document.getElementById('section-editor-host');
        if (!host) return;
        const det = host.querySelector('details.manual-edit');
        if (det) det.open = true;
        let el = null;
        for (const n of names) { el = host.querySelector('[name="' + n + '"]'); if (el) break; }
        if (!el) return;
        let focusEl = el;
        if (el.type === 'hidden') {
          const lp = el.closest('.lp');
          focusEl = lp ? lp.querySelector('.lp-search') : null; // link picker search box; image stays scroll-only
        }
        const group = el.closest('.form-group') || el;
        group.scrollIntoView({ behavior: 'smooth', block: 'center' });
        group.classList.add('field-flash');
        setTimeout(() => group.classList.remove('field-flash'), 1700);
        if (focusEl && focusEl.focus) { try { focusEl.focus({ preventScroll: true }); } catch (e) {} }
      }, 280);
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
        alert(${JSON.stringify(tr('cust.err_switch_tpl'))} + error.message);
      }
    }

    // ---- Custom domains (shared component) ----
    ${domainsJs(lang)}

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
        alert(${JSON.stringify(tr('cust.err_apply_tpl'))} + error.message);
      }
    }

    async function deployWebsite(btn) {
      // No confirm() — it silently no-ops when the browser suppresses dialogs.
      if (btn && btn.disabled) return;
      if (btn) { btn.disabled = true; btn.textContent = ${JSON.stringify(tr('cust.deploying'))}; }
      if (typeof showNotification === 'function') showNotification(${JSON.stringify(tr('cust.deploying'))}, 'info');
      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/deploy\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
          const badge = document.getElementById('pub-badge');
          if (badge) { badge.classList.remove('draft'); badge.classList.add('pub'); badge.textContent = ${JSON.stringify(tr('cust.status_published'))}; }
          showDeploySuccess(data.deployed_url || data.subdomain_url || data.site_url);
        } else if (response.status === 401 && data.auth_required) {
          // Signed-out drafter: must verify their email before publishing.
          showVerifyToPublish();
        } else {
          throw new Error(data.error || 'Deployment failed');
        }
      } catch (error) {
        if (typeof showNotification === 'function') showNotification(${JSON.stringify(tr('cust.err_deploy'))} + error.message, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = ${JSON.stringify(tr('cust.deploy'))}; }
      }
    }

    // Verify-to-publish modal: a signed-out drafter must prove they own the
    // project's email before the site can go live. Reuses the magic-link sign-in
    // (native form POST → /billing?sent=1 "check your email"); the link returns
    // here and the retried publish succeeds as the verified owner.
    function showVerifyToPublish() {
      if (document.getElementById('verify-publish')) return;
      var wrap = document.createElement('div');
      wrap.id = 'verify-publish';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center';
      var safeNext = String(window.location.pathname);
      wrap.innerHTML =
        '<div style="position:absolute;inset:0;background:rgba(15,23,42,.55)" onclick="closeVerifyPublish()"></div>'
        + '<div style="position:relative;background:#fff;border-radius:16px;padding:1.75rem;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">'
        + '<div style="font-size:2.25rem">🔒</div>'
        + '<h2 style="margin:.4rem 0 .25rem;color:#1a202c">' + ${JSON.stringify(tr('cust.verify_title'))} + '</h2>'
        + '<p style="color:#718096;font-size:.9rem;margin:0 0 1rem">' + ${JSON.stringify(tr('cust.verify_body'))} + '</p>'
        + '<form method="POST" action="/api/billing/login">'
        + '<input type="email" name="email" required placeholder="you@example.com" autocomplete="email" '
        + 'style="width:100%;padding:.65rem .75rem;border:2px solid #e2e8f0;border-radius:9px;font-size:.95rem;box-sizing:border-box;margin-bottom:.6rem">'
        + '<input type="hidden" name="next" value="' + safeNext.replace(/"/g,'&quot;') + '">'
        + '<button type="submit" class="btn btn-primary" style="width:100%">' + ${JSON.stringify(tr('cust.verify_send'))} + '</button>'
        + '</form>'
        + '<button type="button" class="btn btn-secondary" style="margin-top:.5rem;width:100%" onclick="closeVerifyPublish()">' + ${JSON.stringify(tr('cust.close'))} + '</button>'
        + '</div>';
      document.body.appendChild(wrap);
    }
    function closeVerifyPublish() {
      var el = document.getElementById('verify-publish');
      if (el) el.remove();
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
        + '<h2>' + ${JSON.stringify(tr('cust.site_live'))} + '</h2>'
        + '<p class="ds-sub">' + ${JSON.stringify(tr('cust.site_live_sub'))} + '</p>'
        + '<a class="ds-url" href="' + safe + '" target="_blank" rel="noopener">' + safe + '</a>'
        + '<div class="ds-actions">'
        + '<a class="btn btn-primary" href="' + safe + '" target="_blank" rel="noopener">' + ${JSON.stringify(tr('cust.open_site'))} + '</a>'
        + '<button type="button" class="btn btn-secondary" onclick="copyDeployUrl(\\'' + safe + '\\')">' + ${JSON.stringify(tr('cust.copy_link'))} + '</button>'
        + '<button type="button" class="btn btn-secondary" onclick="closeDeploySuccess()">' + ${JSON.stringify(tr('cust.close'))} + '</button>'
        + '</div></div>';
      document.body.appendChild(wrap);
    }
    function closeDeploySuccess() {
      const el = document.getElementById('deploy-success');
      if (el) el.remove();
    }
    // Paid-plan / out-of-credits prompt with a real upgrade CTA (used by gated
    // AI features so a 402 isn't a dead-end). Reuses the deploy modal styling.
    function showUpgradePrompt(message, url) {
      closeDeploySuccess();
      const safe = String(url || '/billing');
      const msg = String(message || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const wrap = document.createElement('div');
      wrap.id = 'deploy-success';
      wrap.innerHTML =
        '<div class="ds-backdrop" onclick="closeDeploySuccess()"></div>'
        + '<div class="ds-card" role="dialog" aria-modal="true">'
        + '<div class="ds-emoji">✨</div>'
        + '<h2>' + ${JSON.stringify(tr('cust.upgrade_title'))} + '</h2>'
        + '<p class="ds-sub">' + msg + '</p>'
        + '<div class="ds-actions">'
        + '<a class="btn btn-primary" href="' + safe + '">' + ${JSON.stringify(tr('cust.view_plans'))} + '</a>'
        + '<button type="button" class="btn btn-secondary" onclick="closeDeploySuccess()">' + ${JSON.stringify(tr('cust.maybe_later'))} + '</button>'
        + '</div></div>';
      document.body.appendChild(wrap);
    }
    function copyDeployUrl(u) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(u).then(function () { showNotification(${JSON.stringify(tr('cust.link_copied'))}, 'success'); }).catch(function () {});
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

    // Feedback that survives a page reload/navigation: the action stashes a
    // message, and we surface it once the new page loads.
    function flashToast(message, type) {
      try { sessionStorage.setItem('cf_flash', JSON.stringify({ msg: message, type: type || 'success' })); } catch (e) {}
    }
    (function () {
      try {
        const f = sessionStorage.getItem('cf_flash');
        if (f) { sessionStorage.removeItem('cf_flash'); const o = JSON.parse(f); showNotification(o.msg, o.type || 'success'); }
      } catch (e) {}
    })();

    // Click-to-edit: the preview iframe posts the section id of the "✎ Edit"
    // pill the user clicked; open that section's editor (which also focuses it).
    window.addEventListener('message', function (e) {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.source !== 'caddisfly-preview' || d.type !== 'edit-section') return;
      const id = parseInt(d.sectionId, 10);
      if (!isNaN(id)) { switchPanel('content'); editSection(id, d.field); }
    });
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
