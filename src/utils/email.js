/**
 * Email utilities for sending transactional emails
 * Uses Cloudflare Email Workers binding
 */

import { buildPreviewEmailHtml } from '../templates/preview-email.js';

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
    if (!env.SEND_EMAIL) {
      console.warn('Email binding not available, skipping email send');
      return false;
    }

    const emailFrom = env.EMAIL_FROM || 'noreply@caddisfly.ai';
    const emailHtml = buildPreviewEmailHtml(previewUrl, customerEmail);

    const message = {
      from: emailFrom,
      to: customerEmail,
      subject: 'Your Caddisfly Preview is Ready! 🎉',
      html: emailHtml,
    };

    await env.SEND_EMAIL.send(message);
    console.log(`Preview email sent to ${customerEmail} for preview ${previewId}`);
    return true;
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
 * link must reach a real human before any paid work runs. Until the SEND_EMAIL
 * binding is wired (see wrangler.toml), this logs the verify link to the console
 * so the flow is testable end-to-end. It always reports success in stub mode so
 * the create request can complete and the user/tester can use the logged link.
 *
 * @param {Object} env - Environment bindings
 * @param {string} customerEmail - Recipient email address
 * @param {string} token - Single-use verification token
 * @param {string} verifyUrl - Full verification URL (e.g. https://host/verify/<token>)
 * @returns {Promise<boolean>} True if sent (or stubbed), false on real send failure
 */
export async function sendVerificationEmail(env, customerEmail, token, verifyUrl) {
  // Stub mode: no email transport configured yet. Log the link so verification
  // can still be completed manually during development.
  if (!env.SEND_EMAIL) {
    console.warn(
      `[email stub] No SEND_EMAIL binding. Verification link for ${customerEmail}: ${verifyUrl}`
    );
    return true;
  }

  try {
    const emailFrom = env.EMAIL_FROM || 'noreply@caddisfly.ai';

    const message = {
      from: emailFrom,
      to: customerEmail,
      subject: 'Confirm your email to build your free website preview',
      html: buildVerificationEmailHtml(verifyUrl, customerEmail),
    };

    await env.SEND_EMAIL.send(message);
    console.log(`Verification email sent to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
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
 * Sends error notification email (for internal use)
 * @param {Object} env - Environment bindings
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 * @returns {Promise<boolean>} True if sent successfully, false otherwise
 */
export async function sendErrorNotification(env, subject, message) {
  try {
    if (!env.SEND_EMAIL || !env.ADMIN_EMAIL) {
      return false;
    }

    const emailFrom = env.EMAIL_FROM || 'noreply@caddisfly.ai';

    const email = {
      from: emailFrom,
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
    };

    await env.SEND_EMAIL.send(email);
    return true;
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
