// GET /api/ai-builder/:project_id/export — download the published site as a
// ZIP. "Your site is yours": pages + blog + the project's uploaded/generated
// assets + a README, ready to host anywhere. Wix structurally can't offer
// this (no export is their #1 lock-in complaint) — available on ALL tiers.
//
// The export uses the SUBDOMAIN copy (sites/<sub>/*.html, nav rooted at /).
// Internal links are rewritten depth-aware to plain .html form ("/about" →
// "about.html"; from blog/x.html → "../about.html") so the zip works on any
// static host with no clean-URL config. Asset references stay absolute
// (/preview-asset/...) and the files are included at that path — serving the
// zip from a domain root resolves them. The contact form and analytics beacon
// post to absolute caddisfly URLs, so both KEEP WORKING from an exported site.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { buildZip } from '../../../utils/zip.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Map a root-relative site path to its file name in the zip. */
function pathToFile(p) {
  const clean = p.replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'index') return 'index.html';
  return `${clean}.html`;
}

/** Rewrite internal root-relative <a href> links to relative .html form. */
async function rewriteLinks(html, depth) {
  const prefix = '../'.repeat(depth);
  const rewriter = new HTMLRewriter().on('a[href]', {
    element(el) {
      const href = el.getAttribute('href') || '';
      // Only single-origin root-relative PAGE links; leave anchors, externals,
      // protocol-relative URLs, and asset paths alone.
      if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/preview-asset/')) return;
      const [path, hash] = href.split('#');
      el.setAttribute('href', `${prefix}${pathToFile(path)}${hash ? `#${hash}` : ''}`);
    },
  });
  return rewriter.transform(new Response(html)).text();
}

function readme(siteName, host) {
  return `${siteName} — static site export from Caddisfly
====================================================

This folder contains your complete published website as plain HTML — it is
yours to host anywhere.

How to host it
--------------
Upload the CONTENTS of this folder to the root of any static host:
Netlify, Vercel, GitHub Pages, Amazon S3 + CloudFront, nginx, Apache, etc.

- index.html is your home page.
- Images live under /preview-asset/ — keep that folder at the site root so
  the absolute image paths resolve.
- Internal links use plain .html files, so no special server config is needed.

Good to know
------------
- The contact form and the privacy-friendly analytics beacon point at your
  Caddisfly site id, so submissions and stats KEEP WORKING while your
  Caddisfly site exists (manage them from your dashboard).
- This export is a point-in-time copy${host ? ` of https://${host}` : ''}. Republish + re-export
  after making changes in the editor.

Built with Caddisfly — https://caddisfly.ai
`;
}

export async function handleSiteExport(ctx) {
  const { env, params } = ctx;
  try {
    const publicId = params.project_id;
    const aiProject = await getAIProjectByProjectId(env.DB, publicId);
    let subdomain, siteName;
    if (aiProject) {
      subdomain = aiProject.subdomain;
      siteName = aiProject.project_name || 'Your website';
    } else {
      const rp = await getProjectByPreviewId(env.DB, publicId);
      if (!rp) return json({ success: false, error: 'Project not found' }, 404);
      subdomain = rp.subdomain;
      try {
        const p = JSON.parse(rp.company_profile_json || '{}');
        siteName = (p && p.name) || rp.website_url || 'Your website';
      } catch { siteName = rp.website_url || 'Your website'; }
    }
    if (!subdomain) {
      return json({ success: false, error: 'Publish your site first — the export packages the published pages.' }, 400);
    }

    // Pages: the subdomain copy (nav rooted at /). Skip the index.html
    // duplicate of home (home.html is also written; keep both — links may
    // point at either).
    const pagePrefix = `sites/${subdomain}/`;
    const listed = await env.STORAGE.list({ prefix: pagePrefix });
    const pageKeys = (listed.objects || []).map((o) => o.key);
    if (!pageKeys.length) {
      return json({ success: false, error: 'No published pages found — publish your site first.' }, 400);
    }

    const entries = [];
    for (const key of pageKeys) {
      const rel = key.slice(pagePrefix.length); // e.g. index.html, about.html, blog/x.html
      const obj = await env.STORAGE.get(key);
      if (!obj) continue;
      const html = await obj.text();
      const depth = rel.split('/').length - 1;
      entries.push({ name: rel, data: await rewriteLinks(html, depth) });
    }

    // Project assets (uploaded + AI-generated images) at their absolute path.
    const assetPrefix = `assets/${publicId}/`;
    const assets = await env.STORAGE.list({ prefix: assetPrefix });
    for (const o of assets.objects || []) {
      const obj = await env.STORAGE.get(o.key);
      if (!obj) continue;
      entries.push({
        name: `preview-asset/${publicId}/${o.key.slice(assetPrefix.length)}`,
        data: new Uint8Array(await obj.arrayBuffer()),
      });
    }

    const sitesBase = env.SITES_BASE || 'caddisfly.app';
    const host = `${subdomain}${env.SITES_PREVIEW_SUFFIX || ''}.${sitesBase}`;
    entries.push({ name: 'README.txt', data: readme(siteName, host) });

    const zip = buildZip(entries);
    return new Response(zip, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${subdomain}-site.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('site export error:', e);
    return json({ success: false, error: 'Export failed — please try again.' }, 500);
  }
}
