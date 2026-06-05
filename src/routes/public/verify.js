/**
 * GET /verify/:token
 *
 * The email-verification gate. Clicking this link confirms the user's email and
 * serves the "building" page, which then drives the PAID Google Places
 * enrichment + site generation through POST /api/preview/run-build/:token
 * (see routes/api/preview/run-build.js). The build runs INSIDE that live
 * request — running it via ctx.waitUntil after this response got it cancelled
 * by the runtime (~30s post-invocation cap), wedging enrichment_status at
 * 'running' forever.
 *
 * State machine (projects.enrichment_status):
 *   pending  -> first click: verify, serve building page (page claims + builds)
 *   running  -> build in flight: show building page (stale claims are
 *               re-claimable by run-build after BUILD_STALE_SECONDS)
 *   complete -> redirect to the finished preview (idempotent)
 *   no_match -> Places found nothing: show manual-entry page
 *   failed   -> show retryable error
 */

import { getProjectByVerificationToken, updateProject } from '../../db/projects.js';
import { getUserTier, checkEnrichmentLimit, formatRateLimitError, limitsDisabled, unlimited } from '../../utils/rate-limiter.js';
import { canAfford, chargeCredits, formatCreditError, CREDIT_COSTS } from '../../utils/credits.js';
import { enrichBusiness } from '../../utils/google-places.js';
import { buildProfile } from '../../utils/company-profile.js';
import { generateAndStore } from '../../utils/template-generation.js';
import { sendPreviewEmail } from '../../utils/email.js';
import { htmlResponse, redirect, badRequest } from '../../utils/response.js';
import { brandMark } from '../../components/brand.js';
import { cannedJoke } from '../../utils/jokes.js';
import { translator } from '../../i18n/index.js';

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

export async function handleVerify(ctx) {
  const { env, params } = ctx;
  const token = params.token;

  if (!token) {
    return badRequest('Invalid verification link.');
  }

  const project = await getProjectByVerificationToken(env.DB, token);
  if (!project) {
    return htmlResponse(statusPage('Link not found', 'This verification link is invalid or has already been used.'), 404);
  }

  // Idempotent terminal/intermediate states.
  if (project.enrichment_status === 'complete') {
    return redirect(`/ai-preview/${project.preview_id}`);
  }
  if (project.enrichment_status === 'no_match') {
    return htmlResponse(manualEntryPage(token, project));
  }
  if (project.enrichment_status === 'running') {
    // Build already in flight — show the fun page; it polls until ready.
    return htmlResponse(buildingPage(project.preview_id, token, cannedJoke(Date.now()), (ctx && ctx.lang) || 'en'));
  }
  if (project.enrichment_status === 'failed') {
    return htmlResponse(
      statusPage('Something went wrong', 'We hit a snag building your site. Please request a new preview from the homepage.'),
      500
    );
  }

  // Expiry only applies before the first verification.
  const now = Math.floor(Date.now() / 1000);
  if (!project.email_verified && project.verification_sent_at && now - project.verification_sent_at > TOKEN_TTL_SECONDS) {
    return htmlResponse(statusPage('Link expired', 'This link has expired. Please request a new preview from the homepage.'), 410);
  }

  // Cost control: per-email daily enrichment cap.
  const tier = await getUserTier(env.DB, project.customer_email);
  const limit = limitsDisabled(env)
    ? unlimited(tier)
    : await checkEnrichmentLimit(env.DB, project.customer_email, tier);
  if (!limit.allowed) {
    const msg = formatRateLimitError(limit, 'enrichments').error;
    return htmlResponse(statusPage('Daily limit reached', msg), 429);
  }

  // AI credit pre-check (enforced in production; non-blocking in preview/dev).
  const afford = await canAfford(env, env.DB, project.customer_email, CREDIT_COSTS.enrich);
  if (!afford.ok) {
    return htmlResponse(
      statusPage('Out of AI credits', formatCreditError(afford.state, 'business enrichment').error + ' Add credits at /billing to continue.'),
      402
    );
  }

  // Mark verified, then hand off to the building page. The page POSTs
  // run-build, which atomically claims the job (so reloads/extra tabs can't
  // double-run the paid build) and runs it inside a LIVE request — the client
  // connection keeps the worker alive for the full build, unlike waitUntil.
  await updateProject(env.DB, project.id, {
    email_verified: 1,
    verified_at: now,
    status: 'enriching',
  });

  return htmlResponse(buildingPage(project.preview_id, token, cannedJoke(now), (ctx && ctx.lang) || 'en'));
}

/**
 * The actual paid build: Google Places enrichment + template generation.
 * Called by POST /api/preview/run-build/:token (inside a live request, AFTER a
 * successful claim); communicates only via project status:
 *   running -> complete | no_match | failed
 */
export async function runBuild(env, project, origin) {
  // Recover the interim scrape signal stored at create time.
  let scrapeSignal = null;
  try {
    scrapeSignal = JSON.parse(project.company_profile_json || '{}').scrapeSignal || null;
  } catch {
    scrapeSignal = null;
  }
  const businessName = (scrapeSignal && (scrapeSignal.siteName || scrapeSignal.title)) || '';

  // PAID: identify the business via Google Places.
  let places;
  try {
    places = await enrichBusiness(env, { businessName, website: project.website_url });
  } catch (error) {
    console.error('Places enrichment error:', error);
    await updateProject(env.DB, project.id, { enrichment_status: 'failed' });
    return;
  }

  // Charge AI credits for the paid enrichment (the Google call ran).
  await chargeCredits(env, env.DB, project.customer_email, CREDIT_COSTS.enrich);

  // Places may have found nothing, or found an UNVERIFIED match (its website
  // domain didn't match the customer's — see google-places.js). Either way we
  // don't trust its identity. If the scrape gave us real content, build from
  // THAT (scrape-first); only fall back to manual entry when we have nothing.
  const haveScrape =
    scrapeSignal &&
    (((scrapeSignal.headings || []).length > 0) ||
      (scrapeSignal.sampleText && scrapeSignal.sampleText.length > 80) ||
      (scrapeSignal.title && scrapeSignal.title.length > 0));

  if (!places.found && !haveScrape) {
    await updateProject(env.DB, project.id, { enrichment_status: 'no_match' });
    return;
  }
  if (!places.found) {
    console.log(`Places unverified (${places.reason}${places.matched_name ? `: matched "${places.matched_name}"` : ''}); building scrape-first for ${project.website_url}`);
  }

  // Build the site from the merged profile using the shared template pipeline.
  // When places is unverified, buildProfile uses scrape-only identity.
  const profile = buildProfile(scrapeSignal, places);
  try {
    await generateAndStore(env, project, profile);
  } catch (error) {
    console.error('Profile-based generation error:', error);
    await updateProject(env.DB, project.id, { enrichment_status: 'failed' });
    return;
  }

  await updateProject(env.DB, project.id, {
    status: 'preview_ready',
    enrichment_status: 'complete',
    template_generation_status: 'complete',
    place_id: places.place_id || null,
    company_profile_json: JSON.stringify(profile),
  });

  // Best-effort preview email (no-op until SEND_EMAIL is wired).
  try {
    await sendPreviewEmail(env, project.customer_email, project.preview_id, `${origin}/ai-preview/${project.preview_id}`);
  } catch (error) {
    console.error('Preview email failed (non-fatal):', error);
  }
}

// ---- branded pages ----

function pageShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · Caddisfly</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; }
  .card { background: #fff; border-radius: 16px; padding: 40px; max-width: 480px; width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
  h1 { font-size: 22px; margin: 0 0 12px; color: #1a1a2e; }
  p { color: #555; line-height: 1.6; }
  label { display: block; font-size: 13px; font-weight: 600; color: #333; margin: 14px 0 6px; }
  input, textarea { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 1px solid #d8dae5;
          border-radius: 8px; font-size: 14px; font-family: inherit; }
  button { margin-top: 20px; width: 100%; padding: 14px; border: none; border-radius: 8px; cursor: pointer;
          font-size: 15px; font-weight: 600; color: #fff;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
  a { color: #667eea; }
  .muted { color: #888; font-size: 13px; }
</style>
</head>
<body><div class="card">${bodyHtml}</div></body>
</html>`;
}

function statusPage(title, message) {
  return pageShell(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/">Back to homepage</a></p>`);
}

function buildingPage(previewId, token, joke, lang = 'en') {
  const pid = JSON.stringify(previewId);
  const tok = JSON.stringify(token);
  const tr = translator(lang);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Building your site · Caddisfly</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;min-height:100vh;
       display:flex;align-items:center;justify-content:center;color:#fff;padding:24px;
       background:linear-gradient(135deg,#667eea 0%,#764ba2 55%,#f093fb 120%)}
  .wrap{text-align:center;max-width:560px;width:100%}
  .logo{width:128px;height:128px;margin:0 auto 6px;filter:drop-shadow(0 10px 28px rgba(0,0,0,.28))}
  .logo svg{width:100%;height:100%}
  h1{font-size:25px;margin:6px 0 8px;font-weight:800;letter-spacing:-.01em}
  .sub{opacity:.92;margin:0 auto 30px;max-width:420px;line-height:1.55}
  .joke-label{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.8;margin:0 0 10px}
  .joke-card{background:rgba(255,255,255,.15);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
             border:1px solid rgba(255,255,255,.28);border-radius:18px;padding:24px 26px;min-height:92px;
             display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1.5;
             transition:opacity .45s ease}
  .dots{margin-top:30px;display:flex;gap:8px;justify-content:center}
  .dots i{width:10px;height:10px;border-radius:50%;background:#fff;opacity:.5;animation:bob 1.2s infinite ease-in-out}
  .dots i:nth-child(2){animation-delay:.18s}.dots i:nth-child(3){animation-delay:.36s}
  @keyframes bob{0%,100%{opacity:.35;transform:translateY(0)}50%{opacity:1;transform:translateY(-6px)}}
  .err{display:none;margin-top:24px;line-height:1.6}
  .err a{color:#fff;font-weight:700}
  @media (prefers-reduced-motion:reduce){.dots i{animation:none}}
</style>
</head>
<body>
  <div class="wrap">
    <div class="logo">${brandMark('build-logo', '', true)}</div>
    <h1>${tr('loading.building_title')}</h1>
    <p class="sub">${tr('loading.building_sub')}</p>
    <p class="joke-label">${tr('loading.joke_label')}</p>
    <div class="joke-card" id="joke">${escapeHtml(joke)}</div>
    <div class="dots"><i></i><i></i><i></i></div>
    <div class="err" id="err">
      <p>This is taking longer than usual. <a href="/ai-preview/${escapeHtml(previewId)}">Try opening your site</a>, or <a href="/">start over</a>.</p>
    </div>
  </div>
  <script>
    var previewId=${pid}, token=${tok};
    var jokeEl=document.getElementById('joke'), errEl=document.getElementById('err');
    function rotateJoke(){
      fetch('/api/fun/joke').then(function(r){return r.json()}).then(function(d){
        if(d&&d.joke){jokeEl.style.opacity=0;setTimeout(function(){jokeEl.textContent=d.joke;jokeEl.style.opacity=1;},450);}
      }).catch(function(){});
    }
    var jokeTimer=setInterval(rotateJoke,12000);
    function done(s){
      if(s==='complete'){clearInterval(jokeTimer);location.href='/ai-preview/'+encodeURIComponent(previewId);return true;}
      if(s==='no_match'){clearInterval(jokeTimer);location.href='/verify/'+encodeURIComponent(token);return true;}
      if(s==='failed'){clearInterval(jokeTimer);errEl.style.display='block';return true;}
      return false;
    }
    // Drive the build: this request stays open for the whole build (the worker
    // needs a live client). The server claims the job atomically, so extra
    // tabs/reloads get {status:'running'} and just wait on the poller below.
    function kickBuild(){
      fetch('/api/preview/run-build/'+encodeURIComponent(token),{method:'POST'}).then(function(r){return r.json()}).then(function(d){
        done(d&&d.status);
      }).catch(function(){setTimeout(kickBuild,5000);});
    }
    kickBuild();
    var tries=0;
    function poll(){
      tries++;
      fetch('/api/preview/'+encodeURIComponent(previewId)+'/status').then(function(r){return r.json()}).then(function(d){
        if(done(d&&d.status))return;
        if(tries===72){errEl.style.display='block';}  // ~3 min: surface the escape hatch, keep polling
        if(tries>240){return;}                        // ~10 min: give up
        setTimeout(poll,2500);
      }).catch(function(){setTimeout(poll,3000);});
    }
    setTimeout(poll,2500);
  </script>
</body>
</html>`;
}

function manualEntryPage(token, project) {
  const hint = safeHostname(project.website_url);
  return pageShell(
    'Tell us about your business',
    `<h1>We couldn't find your business on Google</h1>
     <p>No problem — add a few details and we'll build your site from those.</p>
     <form method="POST" action="/api/preview/manual/${escapeHtml(token)}">
       <label for="name">Business name</label>
       <input id="name" name="name" required placeholder="${escapeHtml(hint)}">
       <label for="category">What you do</label>
       <input id="category" name="category" placeholder="e.g. Plumbing, Bakery, Law firm">
       <label for="description">Short description</label>
       <textarea id="description" name="description" rows="3" placeholder="One or two sentences about your business"></textarea>
       <label for="phone">Phone (optional)</label>
       <input id="phone" name="phone" placeholder="(555) 123-4567">
       <label for="address">Address (optional)</label>
       <input id="address" name="address" placeholder="123 Main St, City, ST">
       <button type="submit">Build my preview</button>
     </form>`
  );
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
