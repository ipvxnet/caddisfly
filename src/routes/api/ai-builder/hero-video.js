// AI hero background video — animate the hero's image into a short looping
// background clip (Cloudflare ai/run → xai/grok image-to-video). Synchronous
// (~30s); we re-host the result in R2 and switch the hero to the video variant.
//   POST /api/ai-builder/:project_id/hero-video/generate  { brief? }
//
// Paid feature + credit charge (CREDIT_COSTS.hero_video). Mirrors logo.js.

import { resolveStoreProject as resolveProject } from './store.js';
import { audit } from '../../../utils/audit.js';
import { getSectionById, updateSectionContent, updateSection } from '../../../db/ai-sections.js';
import { generateImageToR2 } from './ai-edit.js';
import { generateImageToVideo, isVideoGenConfigured } from '../../../utils/ai-video.js';
import { uploadToR2 } from '../../../utils/r2-storage.js';
import { generateToken } from '../../../utils/crypto.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS } from '../../../utils/credits.js';
import { getUserTier } from '../../../utils/rate-limiter.js';
import { screenContent, policyError } from '../../../utils/content-policy.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const DURATION = 6; // short loop — cheaper + loops cleanly as a background

/** Make a stored asset path absolute so the video service can fetch it. */
function absolutize(url, appOrigin) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${appOrigin || ''}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function handleGenerateHeroVideo(ctx) {
  const { request, env, params } = ctx;
  try {
    if (!isVideoGenConfigured(env)) return json({ success: false, error: 'Video generation isn’t configured yet.' }, 503);

    const r = await resolveProject(env, params.project_id);
    if (!r) return json({ success: false, error: 'Project not found' }, 404);

    let brief = '', sectionId = 0;
    try { const body = await request.json(); brief = (body.brief || '').toString().trim().slice(0, 200); sectionId = parseInt(body.section_id, 10) || 0; } catch { /* empty ok */ }
    if (brief) { const screen = screenContent(brief); if (!screen.allowed) return json(policyError(screen), 422); }

    // Paid feature (prod-gated, like logo/Flux).
    if (env.ENVIRONMENT === 'production') {
      const tier = await getUserTier(env.DB, r.email);
      if (tier === 'free_trial') {
        return json({ success: false, error: 'AI background video is available on paid plans.', upgrade_message: 'Upgrade to Starter or higher to generate video.', billing_url: '/billing' }, 402);
      }
    }

    const cost = CREDIT_COSTS.hero_video;
    const afford = await canAfford(env, env.DB, r.email, cost);
    if (!afford.ok) return json(formatCreditError(afford.state, 'background video'), 402);

    // Animate the section the user is editing (the hero), verifying it's ours.
    if (!sectionId) return json({ success: false, error: 'No section selected.' }, 400);
    const hero = await getSectionById(env.DB, sectionId);
    const owns = hero && (r.projectKey.aiProjectId != null ? hero.ai_project_id === r.projectKey.aiProjectId : hero.project_id === r.projectKey.projectId);
    if (!hero || !owns) return json({ success: false, error: 'Section not found.' }, 404);
    let heroContent = {};
    try { heroContent = JSON.parse(hero.content_json || '{}'); } catch { heroContent = {}; }

    const appOrigin = env.APP_URL || '';
    // Starting image: the hero's current image, else generate one with Flux.
    let imageUrl = absolutize(heroContent.background_image || heroContent.image_url || '', appOrigin);
    if (!imageUrl) {
      const subject = `for ${r.industry ? `a ${r.industry} business` : 'a small business'} named "${r.businessName}"`;
      const genPath = await generateImageToR2(env, params.project_id, `cinematic hero background photo ${subject}${brief ? `, ${brief}` : ''}, wide, atmospheric, no text`);
      heroContent.background_image = genPath; // keep as the poster/fallback
      imageUrl = absolutize(genPath, appOrigin);
    }

    // Generate (blocks ~30s) → temporary URL → re-host in our R2.
    const motion = `subtle cinematic motion, gentle camera movement, seamless looping background${r.industry ? ` for a ${r.industry} website` : ''}${brief ? `, ${brief}` : ''}, no text, no people talking`;
    const tempUrl = await generateImageToVideo(env, { imageUrl, prompt: motion, duration: DURATION });

    const vidRes = await fetch(tempUrl);
    if (!vidRes.ok) throw new Error('Could not download the generated video.');
    const bytes = new Uint8Array(await vidRes.arrayBuffer());
    const file = `hero-vid-${generateToken(10)}.mp4`;
    await uploadToR2(env.STORAGE, `assets/${params.project_id}/${file}`, bytes, 'video/mp4');
    const videoPath = `/preview-asset/${params.project_id}/${file}`;

    // Point the hero at the video + switch to the video variant.
    heroContent.video_url = videoPath;
    await updateSectionContent(env.DB, hero.id, heroContent);
    await updateSection(env.DB, hero.id, { html_template: 'video' });

    await chargeCredits(env, env.DB, r.email, cost);
    audit(ctx, 'credit.hero_video', { teamOwner: r.email, resourceType: 'site', resourceId: params.project_id, resourceName: r.businessName, metadata: { credits: cost, bytes: bytes.length } });

    return json({ success: true, video_url: videoPath });
  } catch (error) {
    console.error('hero video generation error:', error);
    return json({ success: false, error: error.message || 'Failed to generate background video' }, 502);
  }
}
