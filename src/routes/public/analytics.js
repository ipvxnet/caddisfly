// GET /ai-builder/analytics/:project_id — per-site traffic dashboard for the
// owner. First-party, cookieless data from site_events (see db/analytics.js).

import { htmlResponse } from '../../utils/response.js';
import { headTags, baseCss, siteHeader, siteFooter } from '../../components/brand.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { getSiteAnalytics } from '../../db/analytics.js';
import { translator } from '../../i18n/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function countryName(code, lang, unknownLabel) {
  if (!code) return unknownLabel;
  try {
    const dn = new Intl.DisplayNames([lang, 'en'], { type: 'region' });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

export async function handleSiteAnalytics(ctx) {
  const { env, params, url } = ctx;
  const lang = (ctx && ctx.lang) || 'en';
  const tr = translator(lang);
  const publicId = params.project_id;

  const aiProject = await getAIProjectByProjectId(env.DB, publicId);
  let name, deployedUrl;
  if (aiProject) {
    name = aiProject.project_name || 'Your Website';
    deployedUrl = aiProject.deployed_url || `/site/${publicId}`;
  } else {
    const rp = await getProjectByPreviewId(env.DB, publicId);
    if (!rp) return new Response('Project not found', { status: 404 });
    name = rp.website_url || 'Your Website';
    deployedUrl = `/site/${publicId}`;
  }

  const a = await getSiteAnalytics(env.DB, publicId, 30);
  const maxDay = Math.max(1, ...a.byDay.map((d) => d.views));

  const bars = a.byDay.length
    ? a.byDay
        .map(
          (d) =>
            `<div class="bar" title="${d.day}: ${d.views} · ${d.uniques}"><span style="height:${Math.round((d.views / maxDay) * 100)}%"></span></div>`
        )
        .join('')
    : `<p class="empty">${tr('ana.no_visits')}</p>`;

  const list = (rows, keyField, emptyMsg) => {
    if (!rows.length) return `<p class="empty">${emptyMsg}</p>`;
    const max = Math.max(...rows.map((r) => r.views));
    return rows
      .map((r) => {
        const key = keyField === 'country' ? countryName(r[keyField], lang, tr('ana.unknown')) : r[keyField] || tr('ana.direct');
        return `<div class="lrow"><div class="lbar" style="width:${Math.round((r.views / max) * 100)}%"></div><span class="lk">${esc(key)}</span><span class="lv">${r.views}</span></div>`;
      })
      .join('');
  };

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headTags({ title: tr('ana.meta_title', { name: esc(name) }), description: 'Traffic for your published site.', origin: url.origin })}
  <meta name="robots" content="noindex">
  <style>
    ${baseCss()}
    .awrap{max-width:960px;margin:0 auto;padding:2.5rem 1.5rem 4rem}
    .ahead{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:.5rem}
    .ahead h1{font-size:clamp(1.6rem,3.5vw,2.2rem);font-weight:900;color:var(--ink);letter-spacing:-.02em}
    .ahead .sub{color:var(--muted);font-size:.92rem}
    .ahead .acts{display:flex;gap:.5rem;flex-wrap:wrap}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.5rem 0}
    .stat{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.3rem 1.4rem}
    .stat .n{font-size:2.2rem;font-weight:900;color:var(--ink);line-height:1;letter-spacing:-1px}
    .stat .l{color:var(--muted);font-size:.85rem;font-weight:700;margin-top:.35rem;text-transform:uppercase;letter-spacing:.03em}
    .panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:1.4rem 1.5rem;margin-bottom:1.2rem}
    .panel h2{font-size:1.05rem;color:var(--ink);margin-bottom:1rem}
    .chart{display:flex;align-items:flex-end;gap:3px;height:140px}
    .bar{flex:1;display:flex;align-items:flex-end;height:100%}
    .bar span{display:block;width:100%;background:var(--grad);border-radius:3px 3px 0 0;min-height:2px}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem}
    .lrow{position:relative;display:flex;align-items:center;padding:.45rem .6rem;border-radius:8px;overflow:hidden;margin-bottom:.2rem}
    .lbar{position:absolute;left:0;top:0;bottom:0;background:#f3f0ff;z-index:0}
    .lk{position:relative;z-index:1;flex:1;color:var(--ink);font-size:.9rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lv{position:relative;z-index:1;color:var(--muted);font-weight:800;font-size:.9rem}
    .empty{color:var(--muted);font-size:.9rem;padding:.5rem 0}
    .note{color:var(--muted);font-size:.85rem;margin-top:1rem}
    @media (max-width:680px){.stats{grid-template-columns:1fr 1fr}.cols{grid-template-columns:1fr}}
  </style>
</head>
<body>
  ${siteHeader('', { lang })}
  <main><div class="awrap">
    <div class="ahead">
      <div>
        <h1>${esc(name)}</h1>
        <div class="sub">${tr('ana.sub')}</div>
      </div>
      <div class="acts">
        <a class="btn btn-ghost" href="/ai-builder/customize/${esc(publicId)}">${tr('ana.customize')}</a>
        <a class="btn btn-primary" href="${esc(deployedUrl)}" target="_blank">${tr('ana.view_site')}</a>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="n">${a.totals.views.toLocaleString()}</div><div class="l">${tr('ana.page_views')}</div></div>
      <div class="stat"><div class="n">${a.totals.uniques.toLocaleString()}</div><div class="l">${tr('ana.visitors')}</div></div>
      <div class="stat"><div class="n">${a.byDay.length}</div><div class="l">${tr('ana.active_days')}</div></div>
    </div>

    <div class="panel">
      <h2>${tr('ana.views_per_day')}</h2>
      <div class="chart">${bars}</div>
    </div>

    <div class="cols">
      <div class="panel"><h2>${tr('ana.top_pages')}</h2>${list(a.topPaths, 'path', tr('ana.no_pages'))}</div>
      <div class="panel"><h2>${tr('ana.referrers')}</h2>${list(a.topReferrers, 'referrer_host', tr('ana.no_referrers'))}</div>
    </div>
    <div class="panel"><h2>${tr('ana.countries')}</h2>${list(a.topCountries, 'country', tr('ana.no_countries'))}</div>

    <p class="note">${tr('ana.privacy_note', { privacy: `<a href="/privacy" style="color:var(--p2);font-weight:600">${tr('ana.privacy_link')}</a>` })}</p>
  </div></main>
  ${siteFooter({ lang })}
</body>
</html>`;

  return htmlResponse(html);
}
