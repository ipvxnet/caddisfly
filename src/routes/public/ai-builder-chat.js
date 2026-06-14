// GET /ai-builder/chat/:project_id
// Chat interface for AI builder conversation

import { getAIProjectByProjectId } from '../../db/ai-projects.js';
import { getConversationsByProjectId } from '../../db/ai-conversations.js';
import { formatStepForResponse } from '../../utils/ai-conversation.js';
import { translator } from '../../i18n/index.js';

/**
 * Handle AI builder chat interface
 * @param {object} ctx - Request context
 * @returns {Response} HTTP response
 */
export async function handleAIBuilderChat(ctx) {
  const { env, params } = ctx;

  try {
    const { project_id } = params;

    // Get project
    const project = await getAIProjectByProjectId(env.DB, project_id);

    if (!project) {
      return new Response('Project not found', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Get conversation history
    const conversations = await getConversationsByProjectId(env.DB, project.id);

    // Get current question
    const currentStep = formatStepForResponse(project.conversation_step, project.language || 'en', project.flow_path || 'regular');

    // Build conversation history for display
    const conversationHistory = conversations
      .filter((c) => c.answer)
      .map((c) => ({
        question: c.question,
        answer: c.answer,
        step_name: c.step_name,
      }));

    // Check if conversation is complete
    const isComplete = project.status !== 'conversation';

    const html = buildChatUI(project, conversationHistory, currentStep, isComplete);

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error displaying chat:', error);

    return new Response('Error loading chat interface', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

/**
 * Build chat UI HTML
 */
function buildChatUI(project, conversationHistory, currentStep, isComplete) {
  const lang = (project && project.language) || 'en';
  const tr = translator(lang);
  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tr('convo.ui.title')} - Caddisfly</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
      padding: 1rem;
    }

    .chat-container {
      width: 100%;
      max-width: 800px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 90vh;
      max-height: 800px;
    }

    .chat-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1.5rem;
      text-align: center;
    }

    .chat-header h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 1rem;
    }

    .progress-fill {
      height: 100%;
      background: white;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 0.875rem;
      margin-top: 0.5rem;
      opacity: 0.9;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 2rem;
      background: #f7fafc;
    }

    .message {
      margin-bottom: 1.5rem;
      animation: fadeInUp 0.3s ease-out;
    }

    .message.bot {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .message.user {
      display: flex;
      justify-content: flex-end;
    }

    .bot-avatar {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      flex-shrink: 0;
    }

    .message-content {
      max-width: 70%;
    }

    .message.bot .message-bubble {
      background: white;
      padding: 1rem 1.25rem;
      border-radius: 12px 12px 12px 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .message.user .message-bubble {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1rem 1.25rem;
      border-radius: 12px 12px 4px 12px;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      max-width: 70%;
    }

    .message-bubble p {
      line-height: 1.6;
    }

    .options-grid {
      display: grid;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .option-button {
      padding: 0.875rem 1.25rem;
      background: #f7fafc;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      font-family: inherit;
      font-size: 1rem;
    }

    .option-button:hover {
      border-color: #667eea;
      background: #eef2ff;
    }

    .option-button.selected {
      border-color: #667eea;
      background: #eef2ff;
      position: relative;
    }

    .option-button.selected::after {
      content: '✓';
      position: absolute;
      right: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: #667eea;
      font-weight: bold;
    }

    .option-label {
      font-weight: 600;
      color: #1a202c;
      margin-bottom: 0.25rem;
    }

    .option-description {
      font-size: 0.875rem;
      color: #718096;
    }

    .chat-input-container {
      padding: 1.5rem;
      background: white;
      border-top: 1px solid #e2e8f0;
      max-height: 50vh;
      overflow-y: auto;
    }

    .input-group {
      display: flex;
      gap: 0.75rem;
    }

    .chat-input {
      flex: 1;
      padding: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-family: inherit;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .chat-input:focus {
      outline: none;
      border-color: #667eea;
    }

    .chat-textarea {
      width: 100%;
      padding: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-family: inherit;
      font-size: 1rem;
      resize: vertical;
      min-height: 100px;
      margin-bottom: 0.75rem;
    }

    .chat-textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    .send-button {
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      font-size: 1rem;
    }

    .send-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-message {
      background: #fff5f5;
      border: 1px solid #fc8181;
      color: #c53030;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      display: none;
    }

    .generating-message {
      text-align: center;
      padding: 3rem;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #e2e8f0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .completion-card {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    .completion-card h2 {
      color: #1a202c;
      margin-bottom: 1rem;
      font-size: 1.75rem;
    }

    .completion-card p {
      color: #4a5568;
      margin-bottom: 1.5rem;
    }

    .preview-button {
      display: inline-block;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: transform 0.2s;
    }

    .preview-button:hover {
      transform: translateY(-2px);
    }

    @media (max-width: 768px) {
      body {
        padding: 0;
      }

      .chat-container {
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
      }

      .message-content {
        max-width: 85%;
      }

      .chat-messages {
        padding: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <h1>${project.project_name || 'Create Your Website'}</h1>
      <p class="progress-text">${tr('convo.ui.step_of', { current: currentStep?.progress?.current || 0, total: currentStep?.progress?.total || 7 })}</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${currentStep?.progress?.percentage || 0}%"></div>
      </div>
    </div>

    <div class="chat-messages" id="chat-messages">
      ${buildConversationHTML(conversationHistory, currentStep, isComplete, lang)}
    </div>

    ${!isComplete ? buildInputArea(currentStep, lang) : ''}
  </div>

  <script>
    const projectId = '${project.project_id}';
    const currentStep = ${JSON.stringify(currentStep)};
    const isComplete = ${isComplete};

    // Scroll to bottom
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    ${!isComplete ? buildChatScript(lang) : buildCompletionScript()}
  </script>
</body>
</html>
  `;
}

function buildConversationHTML(history, currentStep, isComplete, lang = 'en') {
  const tr = translator(lang);
  let html = '';

  // Show conversation history
  history.forEach((msg) => {
    html += `
      <div class="message bot">
        <div class="bot-avatar">AI</div>
        <div class="message-content">
          <div class="message-bubble">
            <p>${escapeHtml(msg.question)}</p>
          </div>
        </div>
      </div>
      <div class="message user">
        <div class="message-bubble">
          <p>${formatAnswer(msg.answer, msg.step_name)}</p>
        </div>
      </div>
    `;
  });

  // Show current question if not complete
  if (!isComplete && currentStep) {
    html += `
      <div class="message bot">
        <div class="bot-avatar">AI</div>
        <div class="message-content">
          <div class="message-bubble">
            <p>${escapeHtml(currentStep.question)}</p>
          </div>
        </div>
      </div>
    `;
  }

  // Show completion message if complete
  if (isComplete) {
    html += `
      <div class="completion-card">
        <h2>🎉 All set!</h2>
        <p>I'm generating your website now. This will take about 10-15 seconds.</p>
        <div class="spinner"></div>
        <p id="status-text">${tr('convo.ui.generating')}</p>
      </div>
    `;
  }

  return html;
}

function buildInputArea(currentStep, lang = 'en') {
  const tr = translator(lang);
  if (!currentStep) return '';

  const { type, options, placeholder } = currentStep;
  const defaults = Array.isArray(currentStep.defaults) ? currentStep.defaults : [];

  if (type === 'text') {
    return `
      <div class="chat-input-container">
        <div class="error-message" id="error-message"></div>
        <div class="input-group">
          <textarea
            class="chat-textarea"
            id="chat-input"
            placeholder="${escapeHtml(placeholder || tr('convo.ui.type_answer'))}"
            rows="3"
          ></textarea>
        </div>
        <button class="send-button" id="send-button" onclick="sendAnswer()">
          ${tr('convo.ui.send')}
        </button>
      </div>
    `;
  }

  if (type === 'single_choice') {
    const optionsHTML = options
      .map(
        (opt) => `
      <button class="option-button" onclick="selectSingleOption('${opt.value}')">
        <div class="option-label">${escapeHtml(opt.label)}</div>
        <div class="option-description">${escapeHtml(opt.description)}</div>
      </button>
    `
      )
      .join('');

    return `
      <div class="chat-input-container">
        <div class="error-message" id="error-message"></div>
        <div class="options-grid">
          ${optionsHTML}
        </div>
      </div>
    `;
  }

  if (type === 'multiple_choice') {
    const optionsHTML = options
      .map(
        (opt) => `
      <button class="option-button${defaults.includes(opt.value) ? ' selected' : ''}" data-value="${opt.value}" onclick="toggleMultiOption('${opt.value}')">
        <div class="option-label">${escapeHtml(opt.label)}</div>
        <div class="option-description">${escapeHtml(opt.description)}</div>
      </button>
    `
      )
      .join('');

    return `
      <div class="chat-input-container">
        <div class="error-message" id="error-message"></div>
        <div class="options-grid">
          ${optionsHTML}
        </div>
        <button class="send-button" id="send-button" onclick="sendMultipleChoices()" style="margin-top: 1rem; width: 100%;">
          ${tr('convo.ui.continue')}
        </button>
      </div>
    `;
  }

  return '';
}

function buildChatScript(lang = 'en') {
  const tr = translator(lang);
  return `
    // Pre-select the recommended sections (server marks them as defaults) so
    // non-technical users get a complete site; they can still toggle any off.
    const selectedOptions = new Set((currentStep && Array.isArray(currentStep.defaults)) ? currentStep.defaults : []);

    async function sendAnswer() {
      const input = document.getElementById('chat-input');
      const button = document.getElementById('send-button');
      const errorDiv = document.getElementById('error-message');

      const answer = input.value.trim();

      if (!answer) {
        errorDiv.textContent = ${JSON.stringify(tr('convo.ui.err_enter'))};
        errorDiv.style.display = 'block';
        return;
      }

      errorDiv.style.display = 'none';
      button.disabled = true;
      button.textContent = ${JSON.stringify(tr('convo.ui.sending'))};

      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/respond\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer })
        });

        const data = await response.json();

        if (data.success) {
          if (data.redirect) {
            window.location.href = data.redirect;
          } else if (data.conversation_complete) {
            // Trigger preview generation
            await generatePreview();
          } else {
            // Reload to show next question
            window.location.reload();
          }
        } else {
          throw new Error(data.error || 'Failed to submit answer');
        }
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
        button.disabled = false;
        button.textContent = ${JSON.stringify(tr('convo.ui.send'))};
      }
    }

    async function selectSingleOption(value) {
      const errorDiv = document.getElementById('error-message');
      errorDiv.style.display = 'none';

      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/respond\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: value })
        });

        const data = await response.json();

        if (data.success) {
          if (data.redirect) {
            window.location.href = data.redirect;
          } else if (data.conversation_complete) {
            await generatePreview();
          } else {
            window.location.reload();
          }
        } else {
          throw new Error(data.error || 'Failed to submit answer');
        }
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
      }
    }

    function toggleMultiOption(value) {
      if (selectedOptions.has(value)) {
        selectedOptions.delete(value);
      } else {
        selectedOptions.add(value);
      }

      // Update UI
      const buttons = document.querySelectorAll('.option-button');
      buttons.forEach(btn => {
        const btnValue = btn.getAttribute('data-value');
        if (btnValue === value) {
          btn.classList.toggle('selected');
        }
      });
    }

    async function sendMultipleChoices() {
      const errorDiv = document.getElementById('error-message');
      const button = document.getElementById('send-button');

      if (selectedOptions.size === 0) {
        errorDiv.textContent = ${JSON.stringify(tr('convo.ui.err_select'))};
        errorDiv.style.display = 'block';
        return;
      }

      errorDiv.style.display = 'none';
      button.disabled = true;
      button.textContent = ${JSON.stringify(tr('convo.ui.sending'))};

      try {
        const response = await fetch(\`/api/ai-builder/\${projectId}/respond\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: Array.from(selectedOptions) })
        });

        const data = await response.json();

        if (data.success) {
          if (data.redirect) {
            window.location.href = data.redirect;
          } else if (data.conversation_complete) {
            await generatePreview();
          } else {
            window.location.reload();
          }
        } else {
          throw new Error(data.error || 'Failed to submit answer');
        }
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
        button.disabled = false;
        button.textContent = ${JSON.stringify(tr('convo.ui.continue'))};
      }
    }

    async function generatePreview() {
      window.location.href = \`/ai-builder/generating/\${projectId}\`;
    }

    // Enter key to submit for text input
    const input = document.getElementById('chat-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendAnswer();
        }
      });
    }
  `;
}

function buildCompletionScript() {
  return `
    // Auto-redirect to generation page
    setTimeout(() => {
      window.location.href = \`/ai-builder/generating/\${projectId}\`;
    }, 1000);
  `;
}

function formatAnswer(answer, stepName) {
  try {
    // Try to parse as JSON (for multiple choice)
    const parsed = JSON.parse(answer);
    if (Array.isArray(parsed)) {
      return parsed.join(', ');
    }
  } catch {
    // Not JSON, return as-is
  }
  return escapeHtml(answer);
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
