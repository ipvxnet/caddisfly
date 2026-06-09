// GET /api/ai-builder/:project_id/qr — an SVG QR code for the site's live URL,
// for printing/sharing (flyers, menus, business cards). First-party (generated
// in-worker, no third-party QR service), free, available on all tiers.
//
// The encoded URL prefers an ACTIVE custom domain, falling back to the
// caddisfly.app subdomain — the same address shown on the dashboard. Inline by
// default (so an <img> can display it); ?download=svg attaches it as a file.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getDomainsByProject } from '../../../db/custom-domains.js';
import { buildQrSvg } from '../../../utils/qr.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handleSiteQr(ctx) {
  const { env, params, url } = ctx;
  try {
    const publicId = params.project_id;
    const aiProject = await getAIProjectByProjectId(env.DB, publicId);
    let subdomain, projectKey;
    if (aiProject) {
      subdomain = aiProject.subdomain;
      projectKey = { aiProjectId: aiProject.id };
    } else {
      const rp = await getProjectByPreviewId(env.DB, publicId);
      if (!rp) return json({ success: false, error: 'Project not found' }, 404);
      subdomain = rp.subdomain;
      projectKey = { projectId: rp.id };
    }

    // Prefer an active custom domain (the address customers actually advertise),
    // else the published subdomain.
    let target = '';
    const domains = await getDomainsByProject(env.DB, projectKey);
    const active = domains.find((d) => d.status === 'active');
    if (active && active.hostname) {
      target = `https://${active.hostname}`;
    } else if (subdomain) {
      const sitesBase = env.SITES_BASE || 'caddisfly.app';
      target = `https://${subdomain}${env.SITES_PREVIEW_SUFFIX || ''}.${sitesBase}`;
    }
    if (!target) {
      return json({ success: false, error: 'Publish your site first — the QR code points at your live address.' }, 400);
    }

    const svg = buildQrSvg(target, { size: 1024 });
    const headers = {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    };
    if (url.searchParams.get('download') === 'svg') {
      const name = (active && active.hostname) || subdomain || 'site';
      headers['Content-Disposition'] = `attachment; filename="${name.replace(/[^a-z0-9.-]/gi, '-')}-qr.svg"`;
    }
    return new Response(svg, { status: 200, headers });
  } catch (error) {
    console.error('Error in site QR:', error);
    return json({ success: false, error: 'Failed to generate QR code', details: error.message }, 500);
  }
}
