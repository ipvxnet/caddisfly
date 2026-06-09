// Blog v1 API (registered with [billingAuth, projectAccess] like other
// project-scoped routes):
//   GET    /api/ai-builder/:project_id/blog                 list posts
//   POST   /api/ai-builder/:project_id/blog                 create (manual)
//   POST   /api/ai-builder/:project_id/blog/ai-draft        few sentences -> AI post draft
//   PUT    /api/ai-builder/:project_id/blog/:post_id        update fields
//   POST   /api/ai-builder/:project_id/blog/:post_id/publish    publish|unpublish
//   POST   /api/ai-builder/:project_id/blog/:post_id/social     AI social variants
//   DELETE /api/ai-builder/:project_id/blog/:post_id        delete
//
// AI drafting + the social pack are metered through the credit ledger
// (CREDIT_COSTS.blog_post / social_pack) and screened by the content policy.
// NOTE: publishing a post does NOT redeploy the site — the manager UI prompts
// to republish so the static R2 copies pick the post up.

import { getAIProjectByProjectId, updateAIProject } from '../../../db/ai-projects.js';
import { audit } from '../../../utils/audit.js';
import { getProjectByPreviewId, updateProject } from '../../../db/projects.js';
import { generateToken } from '../../../utils/crypto.js';
import { getUserTier } from '../../../utils/rate-limiter.js';
import {
  createPost, getPostsByProject, getPostById, updatePost, deletePost, uniquePostSlug,
} from '../../../db/blog-posts.js';
import { callWorkersAI } from '../../../utils/ai-content-generator.js';
import { screenContent, policyError, POLICY_INSTRUCTION } from '../../../utils/content-policy.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS } from '../../../utils/credits.js';
import { mdLiteExcerpt } from '../../../utils/md-lite.js';
import { generateImageToR2 } from './ai-edit.js';
import { generateBlogDraftContent, buildBlogCoverPrompt, parseLabeled } from '../../../utils/blog-draft.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// parseLabeled lives in utils/blog-draft.js (shared with the email-to-blog
// handler); the social pack below reuses it for its XPOST/INSTAGRAM/LINKEDIN
// response. LANG_NAMES is still needed locally for the social prompt.
const LANG_NAMES = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

/** Resolve :project_id to { projectKey, project } (ai-first, like pages.js). */
async function resolveProject(env, project_id) {
  const aiProject = await getAIProjectByProjectId(env.DB, project_id);
  if (aiProject) {
    return {
      projectKey: { aiProjectId: aiProject.id },
      email: aiProject.customer_email,
      language: aiProject.language || 'en',
      businessName: aiProject.project_name || 'My Website',
      industry: aiProject.industry || '',
    };
  }
  const regular = await getProjectByPreviewId(env.DB, project_id);
  if (regular) {
    let businessName = regular.website_url || 'My Website';
    let industry = '';
    try {
      const p = JSON.parse(regular.company_profile_json || '{}');
      if (p && p.name) businessName = p.name;
      if (p && p.category) industry = p.category;
    } catch { /* ignore */ }
    return {
      projectKey: { projectId: regular.id },
      email: regular.customer_email,
      language: regular.language || 'en',
      businessName,
      industry,
    };
  }
  return { error: json({ success: false, error: 'Project not found' }, 404) };
}

export async function handleBlogList(ctx) {
  const { env, params } = ctx;
  const r = await resolveProject(env, params.project_id);
  if (r.error) return r.error;
  const posts = await getPostsByProject(env.DB, r.projectKey);
  return json({ success: true, posts });
}

export async function handleBlogCreate(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;
    const body = await request.json().catch(() => ({}));
    const title = (body.title || '').toString().trim().slice(0, 200);
    const content = (body.content || '').toString().slice(0, 30000);
    if (!title) return json({ success: false, error: 'Title is required' }, 400);
    const screen = screenContent(`${title}\n${content}`);
    if (!screen.allowed) return json(policyError(screen), 422);
    const slug = await uniquePostSlug(env.DB, r.projectKey, title);
    const post = await createPost(env.DB, r.projectKey, {
      slug,
      title,
      excerpt: (body.excerpt || '').toString().trim().slice(0, 300) || mdLiteExcerpt(content),
      content,
      cover_image: (body.cover_image || '').toString().trim().slice(0, 500),
      status: 'draft',
    });
    return json({ success: true, post }, 201);
  } catch (e) {
    console.error('blog create error:', e);
    return json({ success: false, error: 'Failed to create post' }, 500);
  }
}

/** Few sentences in -> full AI-drafted post (title/excerpt/markdown-lite content). */
export async function handleBlogAIDraft(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;
    const body = await request.json().catch(() => ({}));
    const brief = (body.brief || '').toString().trim().slice(0, 2000);
    if (brief.length < 10) return json({ success: false, error: 'Tell us a bit more (a few sentences) so the AI has something to work with.' }, 400);
    const screen = screenContent(brief);
    if (!screen.allowed) return json(policyError(screen), 422);

    const afford = await canAfford(env, env.DB, r.email, CREDIT_COSTS.blog_post);
    if (!afford.ok) return json({ success: false, error: formatCreditError(afford.state, 'AI blog drafting').error }, 402);

    let draft;
    try {
      draft = await generateBlogDraftContent(env, r, brief);
    } catch (e) {
      if (e.code === 'policy') return json(policyError(e.screen), 422);
      return json({ success: false, error: e.message || 'AI drafting failed — please try again.' }, 502);
    }

    await chargeCredits(env, env.DB, r.email, CREDIT_COSTS.blog_post);
    audit(ctx, 'credit.blog_draft', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, metadata: { credits: CREDIT_COSTS.blog_post } });

    const slug = await uniquePostSlug(env.DB, r.projectKey, draft.title);
    const post = await createPost(env.DB, r.projectKey, {
      slug,
      title: draft.title,
      excerpt: draft.excerpt,
      content: draft.content,
      cover_image: '',
      status: 'draft',
    });
    return json({ success: true, post }, 201);
  } catch (e) {
    console.error('blog ai-draft error:', e);
    return json({ success: false, error: 'AI drafting failed — please try again.' }, 500);
  }
}

export async function handleBlogUpdate(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;
    const post = await getPostById(env.DB, r.projectKey, parseInt(params.post_id, 10));
    if (!post) return json({ success: false, error: 'Post not found' }, 404);
    const body = await request.json().catch(() => ({}));

    const updates = {};
    if (body.title != null) {
      const title = body.title.toString().trim().slice(0, 200);
      if (!title) return json({ success: false, error: 'Title is required' }, 400);
      updates.title = title;
      if (title !== post.title) updates.slug = await uniquePostSlug(env.DB, r.projectKey, title, post.id);
    }
    if (body.content != null) updates.content = body.content.toString().slice(0, 30000);
    if (body.excerpt != null) updates.excerpt = body.excerpt.toString().trim().slice(0, 300);
    if (body.cover_image != null) updates.cover_image = body.cover_image.toString().trim().slice(0, 500);
    if (body.seo_title != null) updates.seo_title = body.seo_title.toString().trim().slice(0, 120) || null;
    if (body.seo_description != null) updates.seo_description = body.seo_description.toString().trim().slice(0, 200) || null;

    const screen = screenContent(`${updates.title || post.title}\n${updates.content != null ? updates.content : post.content}`);
    if (!screen.allowed) return json(policyError(screen), 422);

    const updated = await updatePost(env.DB, r.projectKey, post.id, updates);
    return json({ success: true, post: updated });
  } catch (e) {
    console.error('blog update error:', e);
    return json({ success: false, error: 'Failed to update post' }, 500);
  }
}

export async function handleBlogPublish(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;
    const post = await getPostById(env.DB, r.projectKey, parseInt(params.post_id, 10));
    if (!post) return json({ success: false, error: 'Post not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const publish = body.publish !== false;
    const updated = await updatePost(env.DB, r.projectKey, post.id, {
      status: publish ? 'published' : 'draft',
      published_at: publish ? (post.published_at || Math.floor(Date.now() / 1000)) : post.published_at,
    });
    return json({ success: true, post: updated });
  } catch (e) {
    console.error('blog publish error:', e);
    return json({ success: false, error: 'Failed to update post status' }, 500);
  }
}

export async function handleBlogDelete(ctx) {
  const { env, params } = ctx;
  const r = await resolveProject(env, params.project_id);
  if (r.error) return r.error;
  const ok = await deletePost(env.DB, r.projectKey, parseInt(params.post_id, 10));
  return ok ? json({ success: true }) : json({ success: false, error: 'Post not found' }, 404);
}

// Post-by-email address = <mailbox>+<token>@<domain>. We use Cloudflare Email
// Routing SUBADDRESSING: one fixed mailbox rule (e.g. post@caddisfly.ai) routes
// post+<anything>@... to the worker, and the +token is the per-site secret — so
// no catch-all that would swallow all mail to the apex. Mailbox differs per env
// (post-preview vs post) so preview and prod route to their own workers.
export function inboundEmailDomain(env) {
  return (env && env.INBOUND_EMAIL_DOMAIN) || 'caddisfly.ai';
}
export function inboundEmailMailbox(env) {
  return (env && env.INBOUND_EMAIL_MAILBOX) || 'post';
}

/** Build the per-site post-by-email address from a token. */
export function buildInboundAddress(env, token) {
  return token ? `${inboundEmailMailbox(env)}+${token}@${inboundEmailDomain(env)}` : '';
}

/**
 * POST /api/ai-builder/:project_id/blog/inbound-address — provision (or rotate)
 * the site's secret post-by-email address. Paid-only in production (like the
 * other AI features). Rotating invalidates the old address.
 */
export async function handleBlogInboundAddress(ctx) {
  const { env, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;

    if (env.ENVIRONMENT === 'production') {
      const tier = await getUserTier(env.DB, r.email);
      if (tier === 'free_trial') {
        return json({
          success: false,
          error: 'Post-by-email is available on paid plans.',
          upgrade_message: 'Upgrade to Starter or higher to post your blog by email.',
          billing_url: '/billing',
        }, 402);
      }
    }

    const token = generateToken(9); // 18 hex chars — unguessable
    if (r.projectKey.aiProjectId != null) {
      await updateAIProject(env.DB, r.projectKey.aiProjectId, { inbound_email_token: token });
    } else {
      await updateProject(env.DB, r.projectKey.projectId, { inbound_email_token: token });
    }
    audit(ctx, 'blog.inbound_address', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id });
    return json({ success: true, address: buildInboundAddress(env, token) });
  } catch (e) {
    console.error('blog inbound-address error:', e);
    return json({ success: false, error: 'Could not set up your post-by-email address.' }, 500);
  }
}

/**
 * AI cover image: Flux-generated tile from the post's title/excerpt/industry.
 * Same model + R2 path as AI-edit image gen; charged as a normal image (5).
 * Diffusion models render text poorly, so the prompt explicitly forbids
 * words/typography — we want a clean photographic tile, not a fake headline.
 */
export async function handleBlogCover(ctx) {
  const { env, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;
    const post = await getPostById(env.DB, r.projectKey, parseInt(params.post_id, 10));
    if (!post) return json({ success: false, error: 'Post not found' }, 404);

    const afford = await canAfford(env, env.DB, r.email, CREDIT_COSTS.image);
    if (!afford.ok) return json({ success: false, error: formatCreditError(afford.state, 'AI image generation').error }, 402);

    const excerpt = post.excerpt || mdLiteExcerpt(post.content, 200);
    const prompt = await buildBlogCoverPrompt(env, { title: post.title, excerpt, industry: r.industry });

    const url = await generateImageToR2(env, params.project_id, prompt);
    await chargeCredits(env, env.DB, r.email, CREDIT_COSTS.image);
    audit(ctx, 'credit.blog_image', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, metadata: { credits: CREDIT_COSTS.image } });
    const updated = await updatePost(env.DB, r.projectKey, post.id, { cover_image: url });
    return json({ success: true, cover_image: url, post: updated });
  } catch (e) {
    console.error('blog cover error:', e);
    return json({ success: false, error: 'Cover generation failed — please try again.' }, 500);
  }
}

/** AI social pack: X + Instagram + LinkedIn variants for a post. */
export async function handleBlogSocial(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (r.error) return r.error;
    const post = await getPostById(env.DB, r.projectKey, parseInt(params.post_id, 10));
    if (!post) return json({ success: false, error: 'Post not found' }, 404);
    const body = await request.json().catch(() => ({}));
    const postUrl = (body.url || '').toString().slice(0, 300);

    const afford = await canAfford(env, env.DB, r.email, CREDIT_COSTS.social_pack);
    if (!afford.ok) return json({ success: false, error: formatCreditError(afford.state, 'social posts').error }, 402);

    const langName = LANG_NAMES[r.language] || 'English';
    const prompt = `A small business ("${r.businessName}"${r.industry ? `, ${r.industry}` : ''}) just published this blog post:

Title: ${post.title}
Summary: ${post.excerpt || mdLiteExcerpt(post.content)}
${postUrl ? `Link: ${postUrl}` : ''}

Write social media posts announcing it, ALL in ${langName}:
1. XPOST: for X/Twitter — max 240 characters including the link placeholder {URL}, punchy, no hashtag spam (max 2).
2. INSTAGRAM: a caption — 2-4 short lines, friendly, 3-5 relevant hashtags at the end, mention "link in bio".
3. LINKEDIN: professional tone, 2-3 short paragraphs, ends with the link placeholder {URL}.

Respond in EXACTLY this format (plain text, no JSON, no commentary, keep the uppercase labels):
XPOST: the X/Twitter post
INSTAGRAM:
the Instagram caption
LINKEDIN:
the LinkedIn post
${POLICY_INSTRUCTION}`;

    const raw = await callWorkersAI(env, prompt, { max_tokens: 900, temperature: 0.7, system_message: 'You are a social media copywriter for small businesses.' });
    const pack = parseLabeled(raw, ['XPOST', 'INSTAGRAM', 'LINKEDIN']);
    if (!pack || !pack.xpost) {
      return json({ success: false, error: 'The AI came back malformed — please try again.' }, 502);
    }

    await chargeCredits(env, env.DB, r.email, CREDIT_COSTS.social_pack);
    audit(ctx, 'credit.social_pack', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, metadata: { credits: CREDIT_COSTS.social_pack } });

    const fill = (s) => String(s || '').replace(/\{URL\}/g, postUrl || '').trim();
    return json({ success: true, social: { x: fill(pack.xpost), instagram: fill(pack.instagram), linkedin: fill(pack.linkedin) } });
  } catch (e) {
    console.error('blog social error:', e);
    return json({ success: false, error: 'Social generation failed — please try again.' }, 500);
  }
}
