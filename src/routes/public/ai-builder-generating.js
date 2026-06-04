// GET /ai-builder/generating/:project_id
// Shows generation progress and triggers preview generation

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { translator } from '../../i18n/index.js';

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

    const html = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generating Your Website - Caddisfly</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: white;
    }

    .container {
      text-align: center;
      max-width: 600px;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      animation: fadeIn 0.5s ease-out;
    }

    .subtitle {
      font-size: 1.25rem;
      opacity: 0.9;
      margin-bottom: 3rem;
      animation: fadeIn 0.5s ease-out 0.2s both;
    }

    .progress-container {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      animation: fadeIn 0.5s ease-out 0.4s both;
    }

    .spinner {
      width: 60px;
      height: 60px;
      border: 6px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 2rem;
    }

    .status-text {
      font-size: 1.125rem;
      font-weight: 500;
      margin-bottom: 1rem;
    }

    .steps {
      text-align: left;
      margin-top: 2rem;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      opacity: 0.5;
      transition: all 0.3s ease;
    }

    .step.active {
      opacity: 1;
      background: rgba(255, 255, 255, 0.2);
    }

    .step.complete {
      opacity: 1;
    }

    .step-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      flex-shrink: 0;
    }

    .step.complete .step-icon {
      background: white;
      color: #667eea;
    }

    .step.active .step-icon {
      border-width: 3px;
    }

    .error-container {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 2rem;
      display: none;
    }

    .error-container.show {
      display: block;
      animation: fadeIn 0.3s ease-out;
    }

    .error-title {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }

    .retry-button {
      margin-top: 1.5rem;
      padding: 1rem 2rem;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 1rem;
      transition: transform 0.2s;
    }

    .retry-button:hover {
      transform: translateY(-2px);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${tr('loading.generating_title')}</h1>
    <p class="subtitle">${tr('loading.generating_sub')}</p>

    <div class="progress-container" id="progress-container">
      <div class="spinner"></div>
      <div class="status-text" id="status-text">Initializing...</div>

      <div class="steps">
        <div class="step" id="step-1">
          <div class="step-icon"></div>
          <div>${tr('loading.step_analyzing')}</div>
        </div>
        <div class="step" id="step-2">
          <div class="step-icon"></div>
          <div>${tr('loading.step_generating')}</div>
        </div>
        <div class="step" id="step-3">
          <div class="step-icon"></div>
          <div>${tr('loading.step_design')}</div>
        </div>
        <div class="step" id="step-4">
          <div class="step-icon"></div>
          <div>${tr('loading.step_sections')}</div>
        </div>
        <div class="step" id="step-5">
          <div class="step-icon"></div>
          <div>${tr('loading.step_seo')}</div>
        </div>
        <div class="step" id="step-6">
          <div class="step-icon"></div>
          <div>${tr('loading.step_finalizing')}</div>
        </div>
      </div>
    </div>

    <div class="error-container" id="error-container">
      <div class="error-title">⚠️ Generation Failed</div>
      <p id="error-message">Something went wrong. Please try again.</p>
      <button class="retry-button" onclick="retryGeneration()">Retry</button>
    </div>
  </div>

  <script>
    const projectId = '${project.project_id}';
    let currentStep = 0;
    const steps = [
      ${JSON.stringify(tr('loading.step_analyzing') + '…')},
      ${JSON.stringify(tr('loading.step_generating') + '…')},
      ${JSON.stringify(tr('loading.step_design') + '…')},
      ${JSON.stringify(tr('loading.step_sections') + '…')},
      ${JSON.stringify(tr('loading.step_seo') + '…')},
      ${JSON.stringify(tr('loading.step_finalizing') + '…')},
      ${JSON.stringify(tr('loading.status_complete'))}
    ];

    // Simulate progress animation
    function animateProgress() {
      if (currentStep < steps.length - 1) {
        currentStep++;
        updateUI();
        setTimeout(animateProgress, 2000);
      }
    }

    function updateUI() {
      document.getElementById('status-text').textContent = steps[currentStep];

      // Update step indicators
      for (let i = 1; i <= 6; i++) {
        const stepEl = document.getElementById(\`step-\${i}\`);
        stepEl.classList.remove('active', 'complete');

        if (i < currentStep) {
          stepEl.classList.add('complete');
          stepEl.querySelector('.step-icon').textContent = '✓';
        } else if (i === currentStep) {
          stepEl.classList.add('active');
        }
      }
    }

    // Start generation
    async function startGeneration() {
      try {
        // Start progress animation
        animateProgress();

        const response = await fetch(\`/api/ai-builder/\${projectId}/generate-preview\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
          // Show completion
          currentStep = steps.length - 1;
          updateUI();

          // Redirect to preview
          setTimeout(() => {
            window.location.href = \`/ai-preview/\${projectId}\`;
          }, 1500);
        } else {
          throw new Error(data.error || 'Generation failed');
        }
      } catch (error) {
        showError(error.message);
      }
    }

    function showError(message) {
      document.getElementById('progress-container').style.display = 'none';
      document.getElementById('error-container').classList.add('show');
      document.getElementById('error-message').textContent = message;
    }

    function retryGeneration() {
      document.getElementById('progress-container').style.display = 'block';
      document.getElementById('error-container').classList.remove('show');
      currentStep = 0;
      startGeneration();
    }

    // Start on page load
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
