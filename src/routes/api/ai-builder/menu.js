// AI Smart Menu — suggest a reorganized navigation, preview it, apply on confirm.
//   POST /api/ai-builder/:project_id/menu/suggest  → AI proposal (charges credits)
//   POST /api/ai-builder/:project_id/menu/apply    → apply an approved proposal
//
// The model only ever reorganizes EXISTING pages/sections (by id): it nests
// them under parents or new label-only groups, renames nav labels, reorders,
// can hide pages, opt a page into showing its sections as a submenu, and hide
// individual sections. One level of nesting. We validate every id before
// writing, so a hallucinated id is ignored rather than corrupting the menu.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import {
  getPagesByProject, createPage, updatePage,
} from '../../../db/ai-pages.js';
import {
  getBodySectionsForPage, getHomeBodySections, updateSectionContent,
} from '../../../db/ai-sections.js';
import { callWorkersAI, extractJSON } from '../../../utils/ai-content-generator.js';
import { SECTION_NAV_LABELS } from '../../../utils/anchor-normalize.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS } from '../../../utils/credits.js';
import { audit } from '../../../utils/audit.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function resolveProject(env, publicId) {
  const ai = await getAIProjectByProjectId(env.DB, publicId);
  if (ai) return { projectKey: { aiProjectId: ai.id }, email: ai.customer_email, lang: ai.language || 'en' };
  const rp = await getProjectByPreviewId(env.DB, publicId);
  if (rp) return { projectKey: { projectId: rp.id }, email: rp.customer_email, lang: rp.language || 'en' };
  return null;
}

// A section's display title for the menu (its heading, else the localized
// section-type label). Used both to brief the model and as an apply-time label.
function sectionTitle(s, lang) {
  let meta = {};
  try { meta = s.content_json ? JSON.parse(s.content_json) : {}; } catch { /* ignore */ }
  const labels = SECTION_NAV_LABELS[lang] || SECTION_NAV_LABELS.en || {};
  return meta._nav_label || meta.heading || labels[s.section_type] || s.section_type;
}

// Gather the project's pages + each page's sections in a compact shape.
async function gatherMenu(env, projectKey, lang) {
  const pages = (await getPagesByProject(env.DB, projectKey)).filter((p) => p.is_visible !== 0 || true);
  const homePage = pages.find((p) => p.is_home) || pages.find((p) => p.slug === 'home') || null;
  const out = [];
  for (const p of pages) {
    if (p.is_group) { out.push({ id: p.id, kind: 'group', label: p.nav_label || p.slug, sections: [] }); continue; }
    const secs = p.is_home && homePage
      ? await getHomeBodySections(env.DB, projectKey, homePage.id, true)
      : await getBodySectionsForPage(env.DB, p.id, true);
    out.push({
      id: p.id, kind: 'page', isHome: !!p.is_home, label: p.nav_label || p.title || p.slug,
      sectionsAsSubmenu: !!p.show_sections_in_nav, // current state, so the model can preserve it
      sections: (secs || []).map((s) => ({ id: s.id, type: s.section_type, title: sectionTitle(s, lang) })),
    });
  }
  return { pages: out };
}

const SYSTEM = `You are an information architect for small-business websites. You reorganize a site's NAVIGATION MENU so it's clean and uncrowded. You ONLY rearrange existing pages and sections by their numeric id — never invent pages, sections, or ids. Keep it to ONE level of nesting. Reply with STRICT JSON only, no prose.`;

function buildPrompt(menu, lang) {
  return `Here is the site's current menu data (pages, each with its sections):
${JSON.stringify(menu)}

Reorganize it into a clean top navigation. Rules:
- Keep the Home page first and visible.
- Group related pages under a NEW label-only group (kind:"group", short label, no id) OR an existing group (reuse its id) when it de-crowds the bar.
- For a page with several sections, you MAY set "sectionsAsSubmenu": true so its sections become its dropdown.
- Use concise, ${({ en: 'English', es: 'Spanish', pt: 'Portuguese' }[lang] || 'English')} nav labels (1–2 words).
- You may hide a clearly redundant page ("hide": true) or section (list its id in "hideSections"), but hide nothing by default.
- Only use page/section ids that appear above.

Return STRICT JSON of this exact shape:
{"items":[
  {"kind":"page","id":<id>,"label":"<label>","hide":false,"sectionsAsSubmenu":false,"hideSections":[]},
  {"kind":"group","label":"<label>","children":[{"kind":"page","id":<id>,"label":"<label>"}]}
]}
Every top-level page and group is an item; nested pages go in a parent's "children". Output JSON only.`;
}

/** POST …/menu/suggest — AI proposal (does not mutate; charges credits). */
export async function handleSuggestMenu(ctx) {
  const { env, params } = ctx;
  const proj = await resolveProject(env, params.project_id);
  if (!proj) return json({ success: false, error: 'Project not found' }, 404);

  const cost = CREDIT_COSTS.menu_ai;
  const afford = await canAfford(env, env.DB, proj.email, cost);
  if (!afford.ok) return json(formatCreditError(afford.state, 'an AI menu suggestion'), 402);

  try {
    const menu = await gatherMenu(env, proj.projectKey, proj.lang);
    if (menu.pages.length < 2) {
      return json({ success: false, error: 'Add a few pages first — there’s nothing to organize yet.' }, 400);
    }
    const raw = await callWorkersAI(env, buildPrompt(menu, proj.lang), {
      system_message: SYSTEM, temperature: 0.2, max_tokens: 1500,
    });
    const parsed = extractJSON(raw);
    const items = Array.isArray(parsed) ? parsed : (parsed && parsed.items);
    if (!Array.isArray(items) || !items.length) return json({ success: false, error: 'The AI could not propose a menu. Try again.' }, 502);

    await chargeCredits(env, env.DB, proj.email, cost);
    audit(ctx, 'credit.menu_ai', { teamOwner: proj.email, resourceType: 'site', resourceId: params.project_id, metadata: { credits: cost } });
    return json({ success: true, suggestion: { items }, current: menu });
  } catch (e) {
    console.error('menu suggest error:', e);
    return json({ success: false, error: 'Failed to suggest a menu', details: e.message }, 500);
  }
}

/** POST …/menu/apply — apply an approved proposal (no extra credit). */
export async function handleApplyMenu(ctx) {
  const { env, request, params } = ctx;
  const proj = await resolveProject(env, params.project_id);
  if (!proj) return json({ success: false, error: 'Project not found' }, 404);

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items) return json({ success: false, error: 'No menu provided' }, 400);

  try {
    const pages = await getPagesByProject(env.DB, proj.projectKey);
    const pageById = new Map(pages.map((p) => [p.id, p]));
    const homeId = (pages.find((p) => p.is_home) || {}).id;
    // Valid section ids per page (so hideSections can't touch foreign rows).
    const sectionCache = new Map(); // pageId -> sections[]
    const sectionsFor = async (p) => {
      if (sectionCache.has(p.id)) return sectionCache.get(p.id);
      const secs = p.is_home
        ? await getHomeBodySections(env.DB, proj.projectKey, p.id, false)
        : await getBodySectionsForPage(env.DB, p.id, false);
      sectionCache.set(p.id, secs || []);
      return secs || [];
    };

    let order = 0;
    const applyPage = async (item, parentId) => {
      const p = pageById.get(Number(item.id));
      if (!p) return;
      const updates = {
        parent_id: parentId,
        page_order: order++,
        is_visible: item.hide ? 0 : 1,
      };
      if (p.is_home) { updates.is_visible = 1; updates.parent_id = null; } // home stays top-level & visible
      if (typeof item.label === 'string' && item.label.trim()) updates.nav_label = item.label.trim().slice(0, 60);
      // Only touch "sections as submenu" when the proposal explicitly says so —
      // otherwise an omission would silently disable a feature the user turned on.
      if (item.sectionsAsSubmenu !== undefined) updates.show_sections_in_nav = item.sectionsAsSubmenu ? 1 : 0;
      await updatePage(env.DB, p.id, updates);

      // Per-section hide flags (only this page's own sections).
      const hide = new Set((Array.isArray(item.hideSections) ? item.hideSections : []).map(Number));
      const secs = await sectionsFor(p);
      for (const s of secs) {
        let meta = {};
        try { meta = s.content_json ? JSON.parse(s.content_json) : {}; } catch { meta = {}; }
        const want = hide.has(s.id);
        if (!!meta._nav_hidden === want) continue; // no change
        if (want) meta._nav_hidden = true; else delete meta._nav_hidden;
        await updateSectionContent(env.DB, s.id, meta);
      }
    };

    for (const item of items) {
      if (item && item.kind === 'group') {
        // Reuse an existing group by id, else create one.
        let groupId = item.id && pageById.has(Number(item.id)) && pageById.get(Number(item.id)).is_group ? Number(item.id) : null;
        const label = (typeof item.label === 'string' && item.label.trim()) ? item.label.trim().slice(0, 60) : 'Menu';
        if (groupId) {
          await updatePage(env.DB, groupId, { nav_label: label, parent_id: null, page_order: order++, is_group: 1, is_visible: 1 });
        } else {
          const slugBase = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';
          const created = await createPage(env.DB, {
            ai_project_id: proj.projectKey.aiProjectId ?? null,
            project_id: proj.projectKey.projectId ?? null,
            slug: `${slugBase}-${Date.now().toString(36)}`,
            title: label, nav_label: label, page_order: order++, is_home: 0, is_visible: 1, is_group: 1,
          });
          groupId = created.id;
        }
        const kids = Array.isArray(item.children) ? item.children : [];
        for (const child of kids) await applyPage(child, groupId);
      } else if (item && item.kind === 'page') {
        await applyPage(item, null);
        const kids = Array.isArray(item.children) ? item.children : [];
        for (const child of kids) await applyPage(child, Number(item.id));
      }
    }

    return json({ success: true });
  } catch (e) {
    console.error('menu apply error:', e);
    return json({ success: false, error: 'Failed to apply menu', details: e.message }, 500);
  }
}
