// Social syndication API (P3) — connect Discord/Slack webhooks, test them, and
// share a published post. Starter+ in production (like logo/hero-video/email).
//   PUT  /api/ai-builder/:project_id/social/settings   set/replace webhooks
//   POST /api/ai-builder/:project_id/social/test       { platform, webhook }
//   POST /api/ai-builder/:project_id/blog/:post_id/share  share one post now
// Plus autoSyndicateOnDeploy(), called from deploy.js after a successful publish.

import { getAIProjectByProjectId } from '../../../db/ai-projects.js';
import { getProjectByPreviewId } from '../../../db/projects.js';
import { getOrCreateConfig } from './store.js';
import { updateWebsiteConfigById } from '../../../db/ai-config.js';
import {
  getPostById, updatePost, getUnsharedPublishedPosts, markPublishedPostsShared,
} from '../../../db/blog-posts.js';
import { getUserTier } from '../../../utils/rate-limiter.js';
import { audit } from '../../../utils/audit.js';
import { canAfford, chargeCredits, CREDIT_COSTS } from '../../../utils/credits.js';
import {
  SOCIAL_PLATFORMS, validateConnection, fieldsFromBody, parseConnections, enabledPlatforms,
  sharePost, postToPlatform, buildLiveUrl, aiCaptionsEnabled, generateAnnouncementVariants,
} from '../../../utils/social-share.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const nowSec = () => Math.floor(Date.now() / 1000);

/** Resolve :project_id (ai-first) to { projectKey, email, subdomain, name, industry, language }. */
async function resolveProject(env, project_id) {
  const ai = await getAIProjectByProjectId(env.DB, project_id);
  if (ai) {
    return {
      projectKey: { aiProjectId: ai.id }, email: ai.customer_email, subdomain: ai.subdomain || '',
      name: ai.project_name || 'My Website', industry: ai.industry || '', language: ai.language || 'en',
    };
  }
  const rp = await getProjectByPreviewId(env.DB, project_id);
  if (rp) {
    let name = rp.website_url || 'My Website';
    let industry = '';
    try {
      const p = JSON.parse(rp.company_profile_json || '{}');
      if (p && p.name) name = p.name;
      if (p && p.category) industry = p.category;
    } catch { /* ignore */ }
    return {
      projectKey: { projectId: rp.id }, email: rp.customer_email, subdomain: rp.subdomain || '',
      name, industry, language: rp.language || 'en',
    };
  }
  return null;
}

/**
 * AI-written per-platform announcement copy for one post share. Charges
 * CREDIT_COSTS.social_pack ONLY when generation succeeds; any blocker (toggle
 * off, can't afford, AI failure) returns null and the share falls back to the
 * plain title+excerpt+link template. Never throws — the share must go out.
 */
async function aiVariantsForPost(env, ctx, { conns, site, post }) {
  try {
    if (!aiCaptionsEnabled(conns)) return null;
    const afford = await canAfford(env, env.DB, site.email, CREDIT_COSTS.social_pack);
    if (!afford.ok) return null;
    const variants = await generateAnnouncementVariants(env, {
      post, businessName: site.name, industry: site.industry, language: site.language,
      platforms: enabledPlatforms(conns),
    });
    if (!variants) return null;
    await chargeCredits(env, env.DB, site.email, CREDIT_COSTS.social_pack);
    audit(ctx, 'credit.social_announce', {
      teamOwner: site.email, resourceType: 'site', resourceId: site.projectId,
      metadata: { credits: CREDIT_COSTS.social_pack, post_id: post.id },
    });
    return variants;
  } catch (e) {
    console.error('social ai variants:', e.message);
    return null;
  }
}

/** Paid-plan gate (prod only) — returns a 402 Response if blocked, else null. */
async function paidGate(env, email) {
  if (env.ENVIRONMENT !== 'production') return null;
  const tier = await getUserTier(env.DB, email);
  if (tier === 'free_trial') {
    return json({
      success: false,
      error: 'Auto-sharing to social accounts is available on paid plans.',
      upgrade_message: 'Upgrade to Starter or higher to auto-share your posts.',
      billing_url: '/billing',
    }, 402);
  }
  return null;
}

/** PUT /social/settings — set/replace the Discord/Slack webhooks. */
export async function handleSocialSettings(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const gate = await paidGate(env, r.email);
    if (gate) return gate;

    const body = await request.json().catch(() => ({}));

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    const existing = parseConnections(config);
    const hadConnections = enabledPlatforms(existing).length > 0;

    const next = {};
    for (const p of SOCIAL_PLATFORMS) {
      const v = validateConnection(p, fieldsFromBody(p, body));
      if (!v.ok) return json({ success: false, error: `${p}: ${v.error}` }, 400);
      if (v.value) next[p] = v.value;
    }
    // AI-written announcements toggle — default ON, so only an explicit opt-out
    // is stored (absent key = enabled, which also covers pre-toggle configs).
    if (body.ai_captions === false || body.ai_captions === 'false') next.ai_captions = false;

    await updateWebsiteConfigById(env.DB, config.id, { social_connections_json: JSON.stringify(next) });

    // First time connecting → baseline the back-catalog so auto-share-on-deploy
    // only fires for posts published from here on (don't blast old posts).
    if (!hadConnections && enabledPlatforms(next).length > 0) {
      await markPublishedPostsShared(env.DB, r.projectKey, nowSec());
    }
    audit(ctx, 'social.settings', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, metadata: { platforms: enabledPlatforms(next) } });
    return json({ success: true, connected: Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, !!next[p]])) });
  } catch (e) {
    console.error('social settings error:', e);
    return json({ success: false, error: 'Could not save your social connections.' }, 500);
  }
}

/** POST /social/test — post a test message to a webhook (no save required). */
export async function handleSocialTest(ctx) {
  const { env, request, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const gate = await paidGate(env, r.email);
    if (gate) return gate;

    const body = await request.json().catch(() => ({}));
    const platform = String(body.platform || '').toLowerCase();
    if (!SOCIAL_PLATFORMS.includes(platform)) return json({ success: false, error: 'Unknown platform' }, 400);
    const v = validateConnection(platform, fieldsFromBody(platform, body));
    if (!v.ok || !v.value) return json({ success: false, error: v.error || 'Fill in the connection details first.' }, 400);

    const ann = {
      title: `✅ ${r.name} is connected to Caddisfly`,
      excerpt: 'This is a test — your new posts will be announced here automatically.',
      url: `${env.APP_URL || ''}/dashboard`,
      image: '',
    };
    const result = await postToPlatform(platform, v.value, ann);
    if (!result.ok) return json({ success: false, error: `Couldn't reach ${platform}: ${result.error}` }, 502);
    return json({ success: true });
  } catch (e) {
    console.error('social test error:', e);
    return json({ success: false, error: 'Test failed.' }, 500);
  }
}

/** POST /blog/:post_id/share — share one published post to all enabled platforms. */
export async function handleSocialShare(ctx) {
  const { env, params } = ctx;
  try {
    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);
    const gate = await paidGate(env, r.email);
    if (gate) return gate;

    const post = await getPostById(env.DB, r.projectKey, parseInt(params.post_id, 10));
    if (!post) return json({ success: false, error: 'Post not found' }, 404);
    if (post.status !== 'published') return json({ success: false, error: 'Publish the post first, then share it.' }, 400);
    if (!r.subdomain) return json({ success: false, error: 'Publish your site first so the post has a live link.' }, 400);

    const config = await getOrCreateConfig(env.DB, r.projectKey);
    const conns = parseConnections(config);
    if (enabledPlatforms(conns).length === 0) {
      return json({ success: false, error: 'Connect a social account first.' }, 400);
    }

    const liveUrl = buildLiveUrl(env, r.subdomain, post.slug);
    const variants = await aiVariantsForPost(env, ctx, {
      conns, post, site: { email: r.email, name: r.name, industry: r.industry, language: r.language, projectId: params.project_id },
    });
    const results = await sharePost(env, { config, post, liveUrl, variants });
    await updatePost(env.DB, r.projectKey, post.id, { social_shared_at: nowSec() });
    audit(ctx, 'social.share', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, metadata: { post_id: post.id, results } });

    const ok = results.filter((x) => x.ok).length;
    return json({ success: true, shared: ok, results });
  } catch (e) {
    console.error('social share error:', e);
    return json({ success: false, error: 'Could not share the post.' }, 500);
  }
}

/**
 * Auto-share newly-live posts after a successful deploy. Best-effort, off the
 * response path (called via ctx.waitUntil from deploy.js). Only posts that are
 * published and not yet shared go out; no-op when no platforms are connected.
 * `site` carries { email, name, industry, language, projectId } so each post
 * can get AI-written copy (2 credits/post, silent template fallback); `ctx` is
 * the deploy request context, used only for audit.
 */
export async function autoSyndicateOnDeploy(env, { projectKey, subdomain, site, ctx }) {
  if (!subdomain) return;
  const config = await getOrCreateConfig(env.DB, projectKey);
  const conns = parseConnections(config);
  if (enabledPlatforms(conns).length === 0) return;

  const posts = await getUnsharedPublishedPosts(env.DB, projectKey);
  if (!posts.length) return;

  for (const post of posts) {
    try {
      const liveUrl = buildLiveUrl(env, subdomain, post.slug);
      const variants = site ? await aiVariantsForPost(env, ctx || { env }, { conns, site, post }) : null;
      const results = await sharePost(env, { config, post, liveUrl, variants });
      await updatePost(env.DB, projectKey, post.id, { social_shared_at: nowSec() });
      console.log('auto-syndicate:', { post_id: post.id, ai: !!variants, shared: results.filter((x) => x.ok).length, of: results.length });
    } catch (e) {
      console.error('auto-syndicate post failed:', post.id, e.message);
    }
  }
}
