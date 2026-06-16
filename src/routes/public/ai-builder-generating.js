// GET /ai-builder/generating/:project_id
// Shows generation progress and triggers preview generation

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { translator } from '../../i18n/index.js';
import { buildLoaderAssets, buildLoaderMarkup } from '../../components/build-loader.js';
import { cannedJoke } from '../../utils/jokes.js';

/**
 * Handle generation progress page
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderGenerating(ctx) {
  const { env, params } = ctx;

  try {
    const { project_id } = params;
    const lang = (ctx && ctx.lang) || 'en';
    const tr = translator(lang);

    // Get project
    const project = await getAIProjectByProjectId(env.DB, project_id);

    if (!project) {
      return new Response('Project not found', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const retryBtn = `<p style="margin-top:1.2rem"><button onclick="retryGeneration()" style="padding:.8rem 1.6rem;background:#fff;color:#764ba2;border:none;border-radius:9px;font-weight:700;cursor:pointer;font-size:1rem;font-family:inherit">${tr('loading.retry')}</button></p>`;
    const html = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generating Your Website - Caddisfly</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:linear-gradient(135deg,#667eea 0%,#764ba2 55%,#f093fb 120%);min-height:100vh;
         display:flex;align-items:center;justify-content:center;padding:2rem;color:#fff}
  </style>
  ${buildLoaderAssets(lang)}
</head>
<body>
  ${buildLoaderMarkup({
    lang,
    title: tr('loading.generating_title'),
    sub: tr('loading.generating_sub'),
    joke: cannedJoke(0, lang),
    errHtml: retryBtn,
  })}
  <script>
    const projectId = '${project.project_id}';
    async function startGeneration() {
      document.getElementById('cf-err').style.display = 'none';
      CFLoader.startSteps();
      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/generate-preview\`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
          CFLoader.complete();
          setTimeout(() => { window.location.href = \`/ai-preview/\${projectId}\`; }, 1400);
        } else {
          throw new Error(data.error || ${JSON.stringify(tr('loading.err_generation'))});
        }
      } catch (error) {
        CFLoader.fail(error.message || ${JSON.stringify(tr('loading.err_generation'))});
      }
    }
    function retryGeneration() { startGeneration(); }
    startGeneration();
  </script>
</body>
</html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error displaying generating page:', error);

    return new Response('Error loading page', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
