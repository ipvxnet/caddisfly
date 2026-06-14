// GET /ai-builder/detailed/:project_id
// Single-page "detailed" business form (Phase 2). Pre-filled from
// ai_projects.detailed_profile_json (populated by research in Phase 4); the user
// confirms and fills gaps, then submits one payload to the detailed API.

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { parseDetailedProfile, coerceDetailedProfile, SOCIAL_PLATFORMS } from '../../utils/detailed-profile.js';
import { translator } from '../../i18n/index.js';

const SOCIAL_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X (Twitter)',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};

export async function handleAIBuilderDetailed(ctx) {
  const { env, params } = ctx;

  try {
    const { project_id } = params;

    // Resolve AI-builder project first, else a refactor (regular) project.
    let project = await getAIProjectByProjectId(env.DB, project_id);
    let isRefactor = false;
    let publicId;
    let profile;

    if (project) {
      publicId = project.project_id;
      profile = parseDetailedProfile(project.detailed_profile_json);
      if (!profile.business_name) profile.business_name = project.project_name || '';
    } else {
      const rp = await getProjectByPreviewId(env.DB, project_id);
      if (!rp) {
        return new Response('Project not found', { status: 404, headers: { 'Content-Type': 'text/html' } });
      }
      project = rp;
      isRefactor = true;
      publicId = rp.preview_id;
      profile = detailedFromCompanyProfile(rp);
    }

    const lang = project.language || (ctx && ctx.lang) || 'en';
    const html = buildDetailedForm({ project_id: publicId }, profile, lang, isRefactor);
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error displaying detailed form:', error);
    return new Response('Error loading form', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

/** Seed the detailed form from a refactor project's stored company profile. */
function detailedFromCompanyProfile(rp) {
  let cp = {};
  try {
    cp = JSON.parse(rp.company_profile_json || '{}');
  } catch {
    cp = {};
  }
  // A previously-saved detailed override round-trips exactly.
  if (cp._detailed) return coerceDetailedProfile(cp._detailed);

  const social = Array.isArray(cp.social)
    ? Object.fromEntries(cp.social.map((s) => [s.platform, s.url]))
    : {};
  return coerceDetailedProfile({
    business_name: cp.name || rp.project_name || '',
    website_url: rp.website_url || cp.website || '',
    history: cp.description || '',
    contact: { phone: cp.phone || '', address: cp.address || '', email: cp.email || '' },
    logo_url: cp.logo || '',
    social,
  });
}

function buildDetailedForm(project, p, lang, isRefactor = false) {
  const tr = translator(lang);
  const a = (v) => escapeAttr(v);

  const socialRows = SOCIAL_PLATFORMS.map(
    (key) => `
      <div class="field">
        <label for="social_${key}">${SOCIAL_LABELS[key]}</label>
        <input type="url" id="social_${key}" data-social="${key}" value="${a(p.social[key])}" placeholder="https://${key}.com/...">
      </div>`
  ).join('');

  const areaOpt = (val, label) =>
    `<option value="${val}"${p.service_area.type === val ? ' selected' : ''}>${label}</option>`;

  const pictureThumbs = p.picture_urls
    .map((u) => `<img src="${a(u)}" class="thumb" alt="">`)
    .join('');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(tr('convo.form.title'))} - Caddisfly</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 2rem 1rem; color: #1a202c; }
    .wrap { max-width: 760px; margin: 0 auto; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.3); overflow: hidden; }
    .head { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 2rem; }
    .head h1 { font-size: 1.6rem; margin-bottom: .5rem; }
    .head p { opacity: .92; font-size: .98rem; line-height: 1.5; }
    .body { padding: 2rem; }
    .section { margin-bottom: 2rem; }
    .section > h2 { font-size: 1.05rem; margin-bottom: 1rem; color: #4a5568; border-bottom: 2px solid #edf2f7; padding-bottom: .5rem; }
    .field { margin-bottom: 1.1rem; }
    label { display: block; font-weight: 600; margin-bottom: .4rem; font-size: .92rem; }
    input, textarea, select { width: 100%; padding: .8rem; border: 2px solid #e2e8f0; border-radius: 8px; font: inherit; background: #fff; }
    input:focus, textarea:focus, select:focus { outline: none; border-color: #667eea; }
    textarea { resize: vertical; min-height: 90px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .area-row { display: grid; grid-template-columns: 1fr 1.4fr; gap: 1rem; }
    .prefill { background: #f7fafc; border: 1px dashed #cbd5e0; border-radius: 10px; padding: 1rem; margin-bottom: 1.5rem; }
    .prefill .row { display: flex; gap: .6rem; margin-top: .6rem; flex-wrap: wrap; }
    .prefill input { flex: 1; min-width: 200px; }
    .btn { padding: .8rem 1.2rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font: inherit; }
    .btn-secondary { background: #edf2f7; color: #4a5568; }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; width: 100%; padding: 1rem; font-size: 1.05rem; }
    .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
    .note { font-size: .82rem; color: #718096; margin-top: .35rem; }
    .status { font-size: .9rem; margin-top: .6rem; color: #4a5568; }
    .thumbs { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .6rem; }
    .thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
    .err { background: #fff5f5; border: 1px solid #fc8181; color: #c53030; padding: .8rem; border-radius: 8px; margin-bottom: 1rem; display: none; }
    .hidden { display: none; }
    @media (max-width: 600px) { .grid2, .area-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="head">
        <h1>${escapeHtml(tr('convo.form.title'))}</h1>
        <p>${escapeHtml(tr('convo.form.subtitle'))}</p>
      </div>
      <div class="body">
        <div class="err" id="err"></div>

        ${isRefactor ? `<input type="hidden" id="website_url" value="${a(p.website_url)}">` : `
        <div class="prefill">
          <label>${escapeHtml(tr('convo.form.prefill_label'))}</label>
          <div class="row">
            <input type="url" id="website_url" value="${a(p.website_url)}" placeholder="${a(tr('convo.form.website_url_ph'))}">
            <button type="button" class="btn btn-secondary" id="prefill-btn" onclick="runPrefill()">${escapeHtml(tr('convo.form.prefill_btn'))}</button>
          </div>
          <div class="status" id="prefill-status"></div>
        </div>`}

        <div class="section">
          <div class="field">
            <label for="business_name">${escapeHtml(tr('convo.form.business_name_label'))}</label>
            <input type="text" id="business_name" value="${a(p.business_name)}" placeholder="${a(tr('convo.form.business_name_ph'))}" required>
          </div>
          <div class="field">
            <label for="history">${escapeHtml(tr('convo.form.history_label'))}</label>
            <textarea id="history" placeholder="${a(tr('convo.form.history_ph'))}">${escapeHtml(p.history)}</textarea>
          </div>
          <div class="field">
            <label for="founder">${escapeHtml(tr('convo.form.founder_label'))}</label>
            <textarea id="founder" placeholder="${a(tr('convo.form.founder_ph'))}">${escapeHtml(p.founder)}</textarea>
          </div>
          <div class="field">
            <label for="services">${escapeHtml(tr('convo.form.services_label'))}</label>
            <textarea id="services" placeholder="${a(tr('convo.form.services_ph'))}">${escapeHtml(p.services)}</textarea>
          </div>
        </div>

        <div class="section">
          <h2>${escapeHtml(tr('convo.form.demographics_label'))} · ${escapeHtml(tr('convo.form.area_label'))}</h2>
          <div class="field">
            <label for="demographics">${escapeHtml(tr('convo.form.demographics_label'))}</label>
            <textarea id="demographics" placeholder="${a(tr('convo.form.demographics_ph'))}">${escapeHtml(p.demographics)}</textarea>
          </div>
          <div class="field">
            <label>${escapeHtml(tr('convo.form.area_label'))}</label>
            <div class="area-row">
              <select id="area_type">
                ${areaOpt('city', escapeHtml(tr('convo.form.area_city')))}
                ${areaOpt('country', escapeHtml(tr('convo.form.area_country')))}
                ${areaOpt('world', escapeHtml(tr('convo.form.area_world')))}
              </select>
              <input type="text" id="area_value" value="${a(p.service_area.value)}" placeholder="${a(tr('convo.form.area_value_ph'))}">
            </div>
          </div>
        </div>

        <div class="section">
          <h2>${escapeHtml(tr('convo.form.social_title'))}</h2>
          <div class="grid2">${socialRows}</div>
        </div>

        <div class="section">
          <h2>${escapeHtml(tr('convo.form.contact_title'))}</h2>
          <div class="grid2">
            <div class="field">
              <label for="contact_email">${escapeHtml(tr('convo.form.email_label'))}</label>
              <input type="email" id="contact_email" value="${a(p.contact.email)}">
            </div>
            <div class="field">
              <label for="contact_phone">${escapeHtml(tr('convo.form.phone_label'))}</label>
              <input type="tel" id="contact_phone" value="${a(p.contact.phone)}">
            </div>
          </div>
          <div class="field">
            <label for="contact_address">${escapeHtml(tr('convo.form.address_label'))}</label>
            <input type="text" id="contact_address" value="${a(p.contact.address)}">
          </div>
        </div>

        <div class="section">
          <h2>${escapeHtml(tr('convo.form.logo_label'))} · ${escapeHtml(tr('convo.form.pictures_label'))}</h2>
          <div class="field">
            <label>${escapeHtml(tr('convo.form.logo_label'))}</label>
            <input type="file" id="logo_file" accept="image/*" onchange="uploadLogo()">
            <div class="note">${escapeHtml(tr('convo.form.logo_hint'))}</div>
            <div class="thumbs">${p.logo_url ? `<img src="${a(p.logo_url)}" class="thumb" id="logo-thumb" alt="">` : '<img class="thumb hidden" id="logo-thumb" alt="">'}</div>
          </div>
          <div class="field">
            <label>${escapeHtml(tr('convo.form.pictures_label'))}</label>
            <input type="file" id="pictures_file" accept="image/*" multiple onchange="uploadPictures()">
            <div class="thumbs" id="picture-thumbs">${pictureThumbs}</div>
          </div>
        </div>

        <button type="button" class="btn btn-primary" id="submit-btn" onclick="submitForm()">${escapeHtml(tr('convo.form.submit'))}</button>
      </div>
    </div>
  </div>

  <script>
    const projectId = ${JSON.stringify(project.project_id)};
    const T = ${JSON.stringify({
      uploading: tr('convo.form.uploading'),
      submitting: tr('convo.form.submitting'),
      submit: tr('convo.form.submit'),
      required: tr('convo.form.required_err'),
      generic: tr('convo.form.error_generic'),
      prefill_btn: tr('convo.form.prefill_btn'),
      prefill_checking: tr('convo.form.prefill_checking'),
      prefill_done: tr('convo.form.prefill_done'),
      prefill_none: tr('convo.form.prefill_none'),
      prefill_stages: [
        tr('convo.form.prefill_stage_scrape'),
        tr('convo.form.prefill_stage_search'),
        tr('convo.form.prefill_stage_photos'),
        tr('convo.form.prefill_checking'),
      ],
    })};
    const SOCIAL = ${JSON.stringify(SOCIAL_PLATFORMS)};
    let logoUrl = ${JSON.stringify(p.logo_url || '')};
    let pictureUrls = ${JSON.stringify(p.picture_urls || [])};

    function showErr(msg) { const e = document.getElementById('err'); e.textContent = msg; e.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'smooth' }); }

    async function uploadOne(file, assetType) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('asset_type', assetType);
      const res = await fetch('/api/ai-builder/' + projectId + '/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || T.generic);
      return data.url;
    }

    async function uploadLogo() {
      const f = document.getElementById('logo_file').files[0];
      if (!f) return;
      try {
        logoUrl = await uploadOne(f, 'logo');
        const thumb = document.getElementById('logo-thumb');
        thumb.src = logoUrl; thumb.classList.remove('hidden');
      } catch (e) { showErr(e.message); }
    }

    async function uploadPictures() {
      const files = Array.from(document.getElementById('pictures_file').files || []);
      const cont = document.getElementById('picture-thumbs');
      for (const f of files) {
        try {
          const url = await uploadOne(f, 'gallery');
          pictureUrls.push(url);
          const img = document.createElement('img');
          img.src = url; img.className = 'thumb'; cont.appendChild(img);
        } catch (e) { showErr(e.message); }
      }
    }

    function collect() {
      const social = {};
      SOCIAL.forEach((k) => { social[k] = (document.querySelector('[data-social="' + k + '"]').value || '').trim(); });
      return {
        business_name: document.getElementById('business_name').value.trim(),
        website_url: document.getElementById('website_url').value.trim(),
        history: document.getElementById('history').value.trim(),
        founder: document.getElementById('founder').value.trim(),
        services: document.getElementById('services').value.trim(),
        demographics: document.getElementById('demographics').value.trim(),
        social,
        service_area: { type: document.getElementById('area_type').value, value: document.getElementById('area_value').value.trim() },
        contact: {
          email: document.getElementById('contact_email').value.trim(),
          phone: document.getElementById('contact_phone').value.trim(),
          address: document.getElementById('contact_address').value.trim(),
        },
        logo_url: logoUrl,
        picture_urls: pictureUrls,
      };
    }

    async function runPrefill() {
      const url = document.getElementById('website_url').value.trim();
      const btn = document.getElementById('prefill-btn');
      const status = document.getElementById('prefill-status');
      if (!url) { showErr(T.generic); return; }
      btn.disabled = true;
      // Scripted-but-realistic staging: cycle the research steps while the
      // request runs (it reflects the real pipeline order: scrape → search → media).
      let si = 0;
      status.textContent = T.prefill_stages[0];
      const iv = setInterval(() => {
        if (si < T.prefill_stages.length - 1) status.textContent = T.prefill_stages[++si];
      }, 1600);
      try {
        const res = await fetch('/api/ai-builder/' + projectId + '/prefill', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ website_url: url, current: collect() }),
        });
        const data = await res.json();
        clearInterval(iv);
        if (!data.success) throw new Error(data.error || T.generic);
        status.textContent = data.found ? T.prefill_done : T.prefill_none;
        // Reload so the server re-renders the form pre-filled from storage.
        setTimeout(() => window.location.reload(), 700);
      } catch (e) {
        clearInterval(iv);
        btn.disabled = false; status.textContent = '';
        showErr(e.message);
      }
    }

    async function submitForm() {
      const payload = collect();
      if (!payload.business_name) { showErr(T.required); return; }
      const btn = document.getElementById('submit-btn');
      btn.disabled = true; btn.textContent = T.submitting;
      try {
        const res = await fetch('/api/ai-builder/' + projectId + '/detailed', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || T.generic);
        window.location.href = data.redirect || ('/ai-builder/generating/' + projectId);
      } catch (e) {
        btn.disabled = false; btn.textContent = T.submit;
        showErr(e.message);
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

// Attribute-safe (used inside double-quoted attributes).
function escapeAttr(text) {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}
