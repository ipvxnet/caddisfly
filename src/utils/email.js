/**
 * Email utilities for sending transactional emails
 * Uses Cloudflare Email Workers binding
 */

import { buildPreviewEmailHtml } from '../templates/preview-email.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Low-level transport: deliver one email through whatever provider is configured.
 *
 * Order of preference:
 *   1. Resend HTTP API (env.RESEND_API_KEY) — can reach arbitrary recipients from
 *      a Worker; this is the real production path.
 *   2. Cloudflare Email Workers binding (env.SEND_EMAIL) — only reaches addresses
 *      verified in Email Routing; kept as a fallback.
 *
 * @param {Object} env - Environment bindings
 * @param {{to: string, subject: string, html: string}} message
 * @returns {Promise<boolean>} true if a transport accepted the message, false if
 *   none is configured. Throws if a configured transport rejects the send.
 */
async function deliverEmail(env, { to, subject, html }) {
  const from = env.EMAIL_FROM || 'noreply@caddisfly.ai';

  if (env.RESEND_API_KEY) {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
    }
    return true;
  }

  if (env.SEND_EMAIL) {
    await env.SEND_EMAIL.send({ from, to, subject, html });
    return true;
  }

  return false;
}

/**
 * Sends preview link email to customer
 * @param {Object} env - Environment bindings
 * @param {string} customerEmail - Recipient email address
 * @param {string} previewId - Preview UUID
 * @param {string} previewUrl - Full preview URL
 * @returns {Promise<boolean>} True if sent successfully, false otherwise
 */
export async function sendPreviewEmail(env, customerEmail, previewId, previewUrl) {
  try {
    const sent = await deliverEmail(env, {
      to: customerEmail,
      subject: 'Your Caddisfly Preview is Ready! 🎉',
      html: buildPreviewEmailHtml(previewUrl, customerEmail),
    });
    if (sent) {
      console.log(`Preview email sent to ${customerEmail} for preview ${previewId}`);
      return true;
    }
    console.warn('No email transport configured, skipping preview email');
    return false;
  } catch (error) {
    console.error('Failed to send preview email:', error);
    // Don't throw - we don't want to fail the entire request if email fails
    return false;
  }
}

/**
 * Sends an email-verification link to the customer.
 *
 * Verifying the email is the gate for paid Google Places enrichment, so this
 * link must reach a real human before any paid work runs. When a transport is
 * configured (RESEND_API_KEY, or the SEND_EMAIL binding) the link is emailed.
 * Otherwise — and on a non-production send failure — the link is logged to the
 * console so the flow stays testable end-to-end in dev/preview. In production a
 * missing transport or send failure reports false so the caller can react.
 *
 * @param {Object} env - Environment bindings
 * @param {string} customerEmail - Recipient email address
 * @param {string} token - Single-use verification token
 * @param {string} verifyUrl - Full verification URL (e.g. https://host/verify/<token>)
 * @returns {Promise<boolean>} True if sent (or stubbed in non-prod), false on failure
 */
export async function sendVerificationEmail(env, customerEmail, token, verifyUrl) {
  const isProduction = env.ENVIRONMENT === 'production';

  try {
    const sent = await deliverEmail(env, {
      to: customerEmail,
      subject: 'Confirm your email to build your free website preview',
      html: buildVerificationEmailHtml(verifyUrl, customerEmail),
    });
    if (sent) {
      console.log(`Verification email sent to ${customerEmail}`);
      return true;
    }
    // No transport configured.
    if (isProduction) {
      console.error('No email transport configured in production; cannot send verification');
      return false;
    }
  } catch (error) {
    console.error('Failed to send verification email:', error);
    if (isProduction) return false;
    // Non-prod: fall through to the stub log so testing is unblocked.
  }

  // Stub fallback (dev/preview only): log the link so verification can still be
  // completed manually without a configured transport.
  console.warn(
    `[email stub] Verification link for ${customerEmail}: ${verifyUrl}`
  );
  return true;
}

/**
 * Builds the HTML body for the verification email.
 * @param {string} verifyUrl - Full verification URL
 * @param {string} customerEmail - Recipient email (for display)
 * @returns {string} HTML string
 */
function buildVerificationEmailHtml(verifyUrl, customerEmail) {
  return `
    <html>
      <body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f5f6fa; padding: 32px;">
        <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px;">
          <h1 style="font-size: 22px; margin: 0 0 12px;">One quick step</h1>
          <p style="color: #444; line-height: 1.6;">
            Confirm <strong>${customerEmail}</strong> to start building your free website preview.
            We'll pull public details about your business and generate a fresh site for you.
          </p>
          <p style="margin: 28px 0;">
            <a href="${verifyUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff;
                      text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;
                      display: inline-block;">
              Confirm &amp; build my preview
            </a>
          </p>
          <p style="color: #888; font-size: 13px; line-height: 1.6;">
            If the button doesn't work, paste this link into your browser:<br>
            <a href="${verifyUrl}" style="color: #667eea;">${verifyUrl}</a>
          </p>
          <p style="color: #aaa; font-size: 12px; margin-top: 24px;">
            Didn't request this? You can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Sends a passwordless billing magic-link. Clicking it proves email ownership
 * and signs the customer into the billing area. Mirrors sendVerificationEmail:
 * when a transport is configured the link is emailed; in non-prod (or on a
 * non-prod failure / missing transport) the link is logged so the flow stays
 * testable. In production a missing transport / failure reports false.
 *
 * @param {Object} env
 * @param {string} email - Recipient
 * @param {string} linkUrl - Full magic-link URL (https://host/billing/verify/<token>)
 * @returns {Promise<boolean>}
 */
export async function sendMagicLinkEmail(env, email, linkUrl) {
  const isProduction = env.ENVIRONMENT === 'production';
  try {
    const sent = await deliverEmail(env, {
      to: email,
      subject: 'Your Caddisfly billing sign-in link',
      html: buildMagicLinkEmailHtml(linkUrl, email),
    });
    if (sent) {
      console.log(`Billing magic link sent to ${email}`);
      return true;
    }
    if (isProduction) {
      console.error('No email transport configured in production; cannot send magic link');
      return false;
    }
  } catch (error) {
    console.error('Failed to send magic link email:', error);
    if (isProduction) return false;
  }
  console.warn(`[email stub] Billing magic link for ${email}: ${linkUrl}`);
  return true;
}

/**
 * Builds the HTML body for the billing magic-link email.
 * @param {string} linkUrl
 * @param {string} email
 * @returns {string}
 */
function buildMagicLinkEmailHtml(linkUrl, email) {
  return `
    <html>
      <body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f5f6fa; padding: 32px;">
        <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px;">
          <h1 style="font-size: 22px; margin: 0 0 12px;">Sign in to manage your plan</h1>
          <p style="color: #444; line-height: 1.6;">
            Click below to manage billing for <strong>${email}</strong>. This link expires in 15 minutes
            and can only be used once.
          </p>
          <p style="margin: 28px 0;">
            <a href="${linkUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff;
                      text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;
                      display: inline-block;">
              Open billing
            </a>
          </p>
          <p style="color: #888; font-size: 13px; line-height: 1.6;">
            If the button doesn't work, paste this link into your browser:<br>
            <a href="${linkUrl}" style="color: #667eea;">${linkUrl}</a>
          </p>
          <p style="color: #aaa; font-size: 12px; margin-top: 24px;">
            Didn't request this? You can safely ignore this email — no changes were made.
          </p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Sends error notification email (for internal use)
 * @param {Object} env - Environment bindings
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 * @returns {Promise<boolean>} True if sent successfully, false otherwise
 */
export async function sendErrorNotification(env, subject, message) {
  try {
    if (!env.ADMIN_EMAIL) {
      return false;
    }

    return await deliverEmail(env, {
      to: env.ADMIN_EMAIL,
      subject: `[Caddisfly Error] ${subject}`,
      html: `
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #dc3545;">Error Notification</h2>
            <p><strong>Subject:</strong> ${subject}</p>
            <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
              <pre style="margin: 0; white-space: pre-wrap;">${message}</pre>
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              Sent from Caddisfly Workers
            </p>
          </body>
        </html>
      `,
    });
  } catch (error) {
    console.error('Failed to send error notification:', error);
    return false;
  }
}

/**
 * Validates email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Permissive validation for testing - just check for @ symbol and basic structure
  const trimmed = email.trim();
  return trimmed.includes('@') && trimmed.length > 3 && trimmed.indexOf('@') > 0;
}

/**
 * Sanitizes email address
 * @param {string} email - Email address to sanitize
 * @returns {string} Sanitized email address
 */
export function sanitizeEmail(email) {
  return email.trim().toLowerCase();
}
