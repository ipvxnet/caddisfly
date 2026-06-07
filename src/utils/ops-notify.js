// Operator alerts → Slack (incoming webhook).
//
// notifyOps posts a plain mrkdwn message to env.SLACK_WEBHOOK_URL and is
// fire-and-forget: it silently no-ops when the secret isn't set (same
// degradation pattern as the email stub) and never throws into the calling
// request. Call sites run it off the response path via ctx.ctx.waitUntil.
//
// Setup: Slack app → Incoming Webhooks → copy URL →
//   npx wrangler secret put SLACK_WEBHOOK_URL [--env preview]

/**
 * Post one operator alert to Slack.
 * @param {object} env - Worker env (SLACK_WEBHOOK_URL, ENVIRONMENT)
 * @param {string} text - Slack mrkdwn message
 * @returns {Promise<boolean>} true if Slack accepted it
 */
export async function notifyOps(env, text) {
  if (!env || !env.SLACK_WEBHOOK_URL || !text) {
    console.warn('ops notify skipped:', !env || !env.SLACK_WEBHOOK_URL ? 'SLACK_WEBHOOK_URL not set' : 'empty text');
    return false;
  }
  // Label non-production noise so one channel can serve both envs.
  const prefix = env.ENVIRONMENT === 'production' ? '' : `[${env.ENVIRONMENT || 'dev'}] `;
  try {
    // Defensive: pasted secrets sometimes carry whitespace/newlines.
    const hook = String(env.SLACK_WEBHOOK_URL).trim();
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${prefix}${String(text).slice(0, 3000)}` }),
    });
    if (res.ok) console.log('ops notify: delivered');
    else console.error(`ops notify rejected: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error('ops notify failed:', e.message);
    return false;
  }
}

/** Queue an ops alert off the response path (waitUntil when available). */
export function notifyOpsAsync(ctx, text) {
  const send = notifyOps(ctx.env, text);
  if (ctx.ctx && ctx.ctx.waitUntil) ctx.ctx.waitUntil(send);
  return send;
}
