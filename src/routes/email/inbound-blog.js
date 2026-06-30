// Email-to-blog (P1) — the Cloudflare Email Worker handler. A site owner sends
// an email to their secret per-site address (post-<token>@<INBOUND_EMAIL_DOMAIN>)
// and we turn it into a DRAFT blog post for review (never auto-published).
//
// Wired as the worker's `email()` export (see src/index.js). Cloudflare Email
// Routing must have a rule pointing the address/catch-all at this worker.
//
// Trust model: the secret token in the address is the primary gate; on top we
// require the From address to match the project's account email, dedupe by
// Message-ID (so a delivery retry can't double-post), and run the same content
// policy + credit + plan gates as the interactive drafting path.

import PostalMime from 'postal-mime';
import { getAIProjectByInboundToken } from '../../db/ai-projects.js';
import { getProjectByInboundToken } from '../../db/projects.js';
import {
  createPost, updatePost, uniquePostSlug, getPostBySourceMessageId, countEmailPostsSince,
} from '../../db/blog-posts.js';
import { generateBlogDraftContent, buildBlogCoverPrompt } from '../../utils/blog-draft.js';
import { generateImageToR2 } from '../api/ai-builder/ai-edit.js';
import { screenContent } from '../../utils/content-policy.js';
import { canAfford, chargeCredits, CREDIT_COSTS } from '../../utils/credits.js';
import { getUserTier } from '../../utils/rate-limiter.js';
import { sendBlogDraftReadyEmail, sendBlogNoticeEmail } from '../../utils/email.js';
import { notifyOps } from '../../utils/ops-notify.js';
import { audit } from '../../utils/audit.js';

// Per-tier daily cap on inbound drafts (prod only). free_trial is blocked by the
// paid gate before this matters; the cap guards against a leaked address or a
// runaway forwarding rule burning credits.
const INBOUND_DAILY_CAP = { starter: 10, pro: 30, agency: 100 };

/**
 * Extract the secret token from a recipient address local-part. Primary scheme
 * is subaddressing — the token is the +tag (post+<token>@…). Falls back to the
 * post-<token> prefix scheme used with a catch-all route.
 */
function tokenFromAddress(addr) {
  const local = String(addr || '').split('@')[0].trim().toLowerCase();
  if (!local) return '';
  const plus = local.indexOf('+');
  if (plus !== -1) {
    const tag = local.slice(plus + 1).trim();
    if (tag) return tag;
  }
  if (local.startsWith('post-')) return local.slice(5);
  return '';
}

/** Resolve a project (ai-first, then refactor) from an inbound token. */
async function resolveByToken(env, token) {
  const ai = await getAIProjectByInboundToken(env.DB, token);
  if (ai) {
    return {
      projectKey: { aiProjectId: ai.id },
      publicId: ai.project_id,
      email: ai.customer_email,
      language: ai.language || 'en',
      businessName: ai.project_name || 'My Website',
      industry: ai.industry || '',
    };
  }
  const rp = await getProjectByInboundToken(env.DB, token);
  if (rp) {
    let businessName = rp.website_url || 'My Website';
    let industry = '';
    try {
      const p = JSON.parse(rp.company_profile_json || '{}');
      if (p && p.name) businessName = p.name;
      if (p && p.category) industry = p.category;
    } catch { /* ignore */ }
    return {
      projectKey: { projectId: rp.id },
      publicId: rp.preview_id,
      email: rp.customer_email,
      language: rp.language || 'en',
      businessName,
      industry,
    };
  }
  return null;
}

/**
 * Cloudflare Email Worker handler. `message` is a ForwardableEmailMessage.
 * Best-effort throughout: failures notify the owner where possible and never
 * throw out (an uncaught throw would make Email Routing retry, re-charging).
 */
export async function handleInboundEmail(message, env, ctx) {
  const reject = (reason) => { try { message.setReject(reason); } catch { /* some runtimes lack setReject */ } };
  let site = null;
  try {
    const token = tokenFromAddress(message.to);
    if (!token) return reject('Unknown address.');

    site = await resolveByToken(env, token);
    if (!site) return reject('Unknown address.');

    // Parse the MIME. postal-mime accepts the raw ReadableStream directly.
    const email = await PostalMime.parse(message.raw);
    const senderAddr = (email.from && email.from.address) || message.from || '';

    // Sender must be the site's account email (the token alone isn't enough).
    if (String(senderAddr).trim().toLowerCase() !== String(site.email).trim().toLowerCase()) {
      return reject('Sender not authorized for this address.');
    }

    const subject = (email.subject || '').toString().trim();
    const bodyText = (email.text || '').toString().trim();
    const brief = `${subject}\n\n${bodyText}`.trim().slice(0, 4000);
    if (brief.replace(/\s/g, '').length < 10) return reject('Message too short to make a post.');

    // Dedupe: a redelivery of the same Message-ID must not create a second post.
    const messageId = (email.messageId || '').toString().slice(0, 400) || null;
    if (messageId) {
      const existing = await getPostBySourceMessageId(env.DB, site.projectKey, messageId);
      if (existing) { console.log('inbound-blog: duplicate message-id, skipping', messageId); return; }
    }

    const billingUrl = `${env.APP_URL || ''}/billing`;
    const notice = (kind) => sendBlogNoticeEmail(env, { to: site.email, siteName: site.businessName, kind, billingUrl });

    // Content policy on the inbound text.
    const screen = screenContent(brief);
    if (!screen.allowed) { await notice('policy'); return; }

    const isProd = env.ENVIRONMENT === 'production';

    // Paid feature (prod only, like logo/hero-video): free_trial is blocked.
    const tier = await getUserTier(env.DB, site.email);
    if (isProd && tier === 'free_trial') { await notice('paid_only'); return; }

    // Daily rate-limit (prod only — preview/dev stays unthrottled for testing).
    if (isProd) {
      const cap = INBOUND_DAILY_CAP[tier] || INBOUND_DAILY_CAP.starter;
      const dayAgo = Math.floor(Date.now() / 1000) - 86400;
      const used = await countEmailPostsSince(env.DB, site.projectKey, dayAgo);
      if (used >= cap) { await notice('rate_limited'); return; }
    }

    // Credits.
    const afford = await canAfford(env, env.DB, site.email, CREDIT_COSTS.blog_post);
    if (!afford.ok) { await notice('no_credits'); return; }

    // Generate the draft.
    let draft;
    try {
      draft = await generateBlogDraftContent(env, site, brief);
    } catch (e) {
      await notice(e.code === 'policy' ? 'policy' : 'failed');
      return;
    }

    await chargeCredits(env, env.DB, site.email, CREDIT_COSTS.blog_post);

    const slug = await uniquePostSlug(env.DB, site.projectKey, draft.title);
    let post = await createPost(env.DB, site.projectKey, {
      slug,
      title: draft.title,
      excerpt: draft.excerpt,
      content: draft.content,
      cover_image: '',
      status: 'draft',
      seo_description: draft.seo_description,
      source: 'email',
      source_message_id: messageId,
    });

    // Auto-generate a cover image (best-effort — a cover failure must not lose
    // the post). Charged as a normal image, only when it succeeds.
    let coverCredits = 0;
    try {
      const coverPrompt = await buildBlogCoverPrompt(env, { title: draft.title, excerpt: draft.excerpt, industry: site.industry });
      const url = await generateImageToR2(env, site.publicId, coverPrompt);
      await chargeCredits(env, env.DB, site.email, CREDIT_COSTS.image);
      coverCredits = CREDIT_COSTS.image;
      post = await updatePost(env.DB, site.projectKey, post.id, { cover_image: url });
    } catch (e) {
      console.warn('inbound-blog: cover generation failed (post kept):', e.message);
    }

    audit({ env, ctx }, 'credit.blog_email', {
      actor: site.email, teamOwner: site.email, resourceType: 'site', resourceId: site.publicId,
      resourceName: site.businessName, metadata: { credits: CREDIT_COSTS.blog_post + coverCredits, post_id: post.id },
    });

    // Notify the owner + ops.
    const reviewUrl = `${env.APP_URL || ''}/ai-builder/blog/${site.publicId}?post=${post.id}`;
    await sendBlogDraftReadyEmail(env, { to: site.email, siteName: site.businessName, postTitle: draft.title, reviewUrl });
    const opsMsg = `📧 *Email→blog draft* for *${site.businessName}* from ${senderAddr}\n*${draft.title}*\n<${reviewUrl}|Review draft>`;
    if (ctx && ctx.waitUntil) ctx.waitUntil(notifyOps(env, opsMsg)); else await notifyOps(env, opsMsg);
    console.log('inbound-blog: created draft', { publicId: site.publicId, postId: post.id });
  } catch (e) {
    console.error('inbound-blog: unhandled error:', e && e.message);
    // Last-ditch: tell the owner we couldn't process it (only if we know them).
    if (site && site.email) {
      try { await sendBlogNoticeEmail(env, { to: site.email, siteName: site.businessName, kind: 'failed', billingUrl: `${env.APP_URL || ''}/billing` }); } catch { /* ignore */ }
    }
  }
}
