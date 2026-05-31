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
