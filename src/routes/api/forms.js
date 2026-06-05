// Forms backend for published customer sites.
//
// POST /api/forms/submit — public endpoint receiving contact-form submissions.
// Published forms POST here cross-origin (the sites worker is DB-free), exactly
// like the analytics beacon. No cookies and no stored IP — the spam guard uses
// the same daily per-site pseudonymous visitor_hash as /api/track.
//
// Spam guards (all bypassed in preview via limitsDisabled):
//   - honeypot field: bots that fill it get a silent "success" and are dropped
//   - per-visitor cap: 5 submissions/hour (by daily visitor_hash)
//   - per-site flood cap: 200 submissions/day
//   - owner email notifications cap at 20/day (submissions still stored)
//
// DELETE /api/ai-builder/:project_id/forms/:id — inbox row delete (projectAccess).

import { jsonResponse } from '../../utils/response.js';
import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../db/projects.js';
import { createSubmission, countRecentByHash, countSince, deleteSubmission } from '../../db/form-submissions.js';
import { sendFormSubmissionEmail, isValidEmail } from '../../utils/email.js';
import { limitsDisabled } from '../../utils/rate-limiter.js';
import { t } from '../../i18n/index.js';

const PUBLIC_ID_RE = /^[a-f0-9-]{8,64}$/i;
const VISITOR_HOURLY_CAP = 5;
const SITE_DAILY_CAP = 200;
const EMAIL_DAILY_CAP = 20;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Resolve a published site's owner + display name from either project table. */
async function resolveSite(db, publicId) {
  const aiProject = await getAIProjectByProjectId(db, publicId);
  if (aiProject) {
    return { ownerEmail: aiProject.customer_email, siteName: aiProject.project_name || 'Your website' };
  }
  const rp = await getProjectByPreviewId(db, publicId);
  if (rp) {
    let name = rp.website_url || 'Your website';
    try {
      const p = JSON.parse(rp.company_profile_json || '{}');
      if (p && p.name) name = p.name;
    } catch { /* ignore */ }
    return { ownerEmail: rp.customer_email, siteName: name };
  }
  return null;
}

export async function handleFormSubmit(ctx) {
  const { request, env } = ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = (body.s || '').toString();
    if (!PUBLIC_ID_RE.test(publicId)) {
      return jsonResponse({ success: false, error: 'Unknown site' }, 404);
    }

    const site = await resolveSite(env.DB, publicId);
    if (!site) return jsonResponse({ success: false, error: 'Unknown site' }, 404);

    // Honeypot: a hidden field humans never see. Pretend success so bots move on.
    if ((body.hp || '').toString().trim() !== '') {
      return jsonResponse({ success: true });
    }

    const name = (body.name || '').toString().trim().slice(0, 200);
    const email = (body.email || '').toString().trim().slice(0, 320);
    const message = (body.message || '').toString().trim().slice(0, 5000);
    if (!name || !message || !isValidEmail(email)) {
      return jsonResponse({ success: false, error: t(ctx.lang, 'formw.err_fields') }, 400);
    }
    const pagePath = (body.p || '/').toString().slice(0, 200);

    // Same pseudonymous daily key as the analytics beacon — IP+UA hashed with
    // site and day, never stored in the clear.
    const ts = Math.floor(Date.now() / 1000);
    const day = new Date(ts * 1000).toISOString().slice(0, 10);
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    const visitorHash = (await sha256Hex(`${publicId}|${day}|${ip}|${ua}`)).slice(0, 32);

    const dayStartTs = Math.floor(ts / 86400) * 86400;
    if (!limitsDisabled(env)) {
      const [recent, today] = await Promise.all([
        countRecentByHash(env.DB, publicId, visitorHash, ts - 3600),
        countSince(env.DB, publicId, dayStartTs),
      ]);
      if (recent >= VISITOR_HOURLY_CAP || today >= SITE_DAILY_CAP) {
        return jsonResponse({ success: false, error: t(ctx.lang, 'formw.err_rate') }, 429);
      }
    }

    const sentToday = await countSince(env.DB, publicId, dayStartTs); // pre-insert count = emails already triggered
    await createSubmission(env.DB, {
      public_id: publicId,
      name,
      email,
      message,
      page_path: pagePath,
      visitor_hash: visitorHash,
      created_at: ts,
    });

    // Notify the owner (best-effort, off the response path). Capped per day so a
    // burst can't flood their mailbox — the inbox still has everything.
    if (site.ownerEmail && sentToday < EMAIL_DAILY_CAP) {
      const inboxUrl = `${env.APP_URL || ''}/ai-builder/forms/${publicId}`;
      const send = sendFormSubmissionEmail(env, {
        to: site.ownerEmail,
        siteName: site.siteName,
        fromName: name,
        fromEmail: email,
        message,
        pagePath,
        inboxUrl,
      }).catch((e) => console.error('form-submission email failed:', e.message));
      if (ctx.ctx && ctx.ctx.waitUntil) ctx.ctx.waitUntil(send);
      else await send;
    }

    return jsonResponse({ success: true });
  } catch (e) {
    console.error('form submit error:', e.message);
    return jsonResponse({ success: false, error: 'Something went wrong' }, 500);
  }
}

/** DELETE /api/ai-builder/:project_id/forms/:id — remove one inbox message. */
export async function handleFormDelete(ctx) {
  const { env, params } = ctx;
  const publicId = params.project_id;
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return jsonResponse({ success: false, error: 'Bad id' }, 400);
  const ok = await deleteSubmission(env.DB, publicId, id);
  return ok ? jsonResponse({ success: true }) : jsonResponse({ success: false, error: 'Not found' }, 404);
}
