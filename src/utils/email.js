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
 * @param {{to: string, subject: string, html: string, replyTo?: string}} message
 * @returns {Promise<boolean>} true if a transport accepted the message, false if
 *   none is configured. Throws if a configured transport rejects the send.
 */
async function deliverEmail(env, { to, subject, html, replyTo }) {
  const from = env.EMAIL_FROM || 'noreply@caddisfly.ai';

  if (env.RESEND_API_KEY) {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
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
 * Sends a team invitation. Clicking the link both joins the team and signs the
 * member in (proves control of their email). Mirrors sendMagicLinkEmail: emails
 * when a transport is configured, logs a stub otherwise (non-prod), reports
 * false on a prod failure.
 *
 * @param {Object} env
 * @param {string} memberEmail - Invited member
 * @param {string} inviteUrl - Full accept URL (https://host/team/accept/<token>)
 * @param {string} ownerEmail - Who invited them (their team)
 * @returns {Promise<boolean>}
 */
export async function sendTeamInviteEmail(env, memberEmail, inviteUrl, ownerEmail) {
  const isProduction = env.ENVIRONMENT === 'production';
  try {
    const sent = await deliverEmail(env, {
      to: memberEmail,
      subject: `${ownerEmail} invited you to their Caddisfly team`,
      html: buildTeamInviteEmailHtml(inviteUrl, memberEmail, ownerEmail),
    });
    if (sent) {
      console.log(`Team invite sent to ${memberEmail} (team: ${ownerEmail})`);
      return true;
    }
    if (isProduction) {
      console.error('No email transport configured in production; cannot send team invite');
      return false;
    }
  } catch (error) {
    console.error('Failed to send team invite email:', error);
    if (isProduction) return false;
  }
  console.warn(`[email stub] Team invite for ${memberEmail} (team ${ownerEmail}): ${inviteUrl}`);
  return true;
}

/** HTML body for a team invitation email. */
function buildTeamInviteEmailHtml(inviteUrl, memberEmail, ownerEmail) {
  return `
    <html>
      <body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f5f6fa; padding: 32px;">
        <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px;">
          <h1 style="font-size: 22px; margin: 0 0 12px;">You've been invited to a Caddisfly team</h1>
          <p style="color: #444; line-height: 1.6;">
            <strong>${ownerEmail}</strong> invited <strong>${memberEmail}</strong> to collaborate on their
            websites. Click below to join the team and sign in. This link expires in 7 days.
          </p>
          <p style="margin: 28px 0;">
            <a href="${inviteUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff;
                      text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;
                      display: inline-block;">
              Join the team
            </a>
          </p>
          <p style="color: #888; font-size: 13px; line-height: 1.6;">
            If the button doesn't work, paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #667eea;">${inviteUrl}</a>
          </p>
          <p style="color: #aaa; font-size: 12px; margin-top: 24px;">
            Didn't expect this? You can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Sends a support-ticket notification (new ticket or reply). Best-effort:
 * emails when a transport is configured, logs a stub otherwise (non-prod).
 * @param {Object} env
 * @param {Object} opts - { to, subject, heading, intro, body, linkUrl, linkLabel }
 * @returns {Promise<boolean>}
 */
export async function sendTicketEmail(env, { to, subject, heading, intro, body, linkUrl, linkLabel }) {
  const isProduction = env.ENVIRONMENT === 'production';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">${esc(heading)}</h1>
        ${intro ? `<p style="color:#444;line-height:1.6;">${esc(intro)}</p>` : ''}
        ${body ? `<blockquote style="border-left:3px solid #cbd5e0;margin:14px 0;padding:6px 14px;color:#555;white-space:pre-wrap;">${esc(body)}</blockquote>` : ''}
        ${linkUrl ? `<p style="margin:24px 0;"><a href="${linkUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">${esc(linkLabel || 'View ticket')}</a></p>` : ''}
      </div>
    </body></html>`;
  try {
    const sent = await deliverEmail(env, { to, subject, html });
    if (sent) return true;
    if (isProduction) {
      console.error('No email transport in production; cannot send ticket email');
      return false;
    }
  } catch (error) {
    console.error('Failed to send ticket email:', error);
    if (isProduction) return false;
  }
  console.warn(`[email stub] Ticket email to ${to}: ${subject} ${linkUrl || ''}`);
  return true;
}

/**
 * Notifies a site owner of a new contact-form submission on their published
 * site. Reply-To is set to the visitor so the owner can answer directly.
 * Best-effort like sendTicketEmail: emails when a transport is configured,
 * logs a stub otherwise (non-prod).
 * @param {Object} env
 * @param {Object} opts - { to, siteName, fromName, fromEmail, message, pagePath, inboxUrl }
 * @returns {Promise<boolean>}
 */
export async function sendFormSubmissionEmail(env, { to, siteName, fromName, fromEmail, message, pagePath, inboxUrl }) {
  const isProduction = env.ENVIRONMENT === 'production';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">New message from your website</h1>
        <p style="color:#444;line-height:1.6;">Someone filled out the contact form on <strong>${esc(siteName)}</strong>${pagePath ? ` (page ${esc(pagePath)})` : ''}.</p>
        <p style="color:#444;line-height:1.6;margin:14px 0 4px;"><strong>${esc(fromName)}</strong> &lt;${esc(fromEmail)}&gt;</p>
        <blockquote style="border-left:3px solid #cbd5e0;margin:6px 0 14px;padding:6px 14px;color:#555;white-space:pre-wrap;">${esc(message)}</blockquote>
        <p style="color:#666;font-size:13px;">Reply to this email to answer them directly.</p>
        ${inboxUrl ? `<p style="margin:24px 0 0;"><a href="${inboxUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Open inbox</a></p>` : ''}
      </div>
    </body></html>`;
  try {
    const sent = await deliverEmail(env, {
      to,
      subject: `New message from ${siteName}`,
      html,
      replyTo: fromEmail || undefined,
    });
    if (sent) return true;
    if (isProduction) {
      console.error('No email transport in production; cannot send form-submission email');
      return false;
    }
  } catch (error) {
    console.error('Failed to send form-submission email:', error);
    if (isProduction) return false;
  }
  console.warn(`[email stub] Form submission email to ${to} for ${siteName}`);
  return true;
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

// ---- store order emails (commerce v1) ---------------------------------------

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function orderItemsTable(items, total, currency, lang, labels) {
  const money = (cents) => {
    try { return new Intl.NumberFormat(lang, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100); }
    catch { return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`; }
  };
  const rows = items
    .map((i) => `<tr><td style="padding:6px 0;color:#444;">${escHtml(i.name)} × ${i.qty}</td><td style="padding:6px 0;color:#444;text-align:right;">${money(i.amount)}</td></tr>`)
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:14px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
    ${rows}
    <tr><td style="padding:10px 0;font-weight:700;color:#111;">${escHtml(labels.total)}</td><td style="padding:10px 0;font-weight:700;color:#111;text-align:right;">${money(total)}</td></tr>
  </table>`;
}

/**
 * Buyer-facing order confirmation (sent in the SITE's language; reply-to the
 * merchant so questions go to the store owner, not to us).
 */
export async function sendOrderBuyerEmail(env, {
  to, businessName, orderRef, items, total, currency, lang, labels, receiptUrl, merchantEmail,
}) {
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 6px;">${escHtml(labels.subject_line)}</h1>
        <p style="color:#444;line-height:1.6;">${escHtml(labels.intro)}</p>
        <p style="color:#666;font-size:13px;margin:14px 0 2px;">${escHtml(labels.order_ref)}: <strong>${escHtml(orderRef)}</strong></p>
        ${orderItemsTable(items, total, currency, lang, labels)}
        ${receiptUrl ? `<p style="margin:20px 0 0;"><a href="${receiptUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">${escHtml(labels.view_receipt)}</a></p>` : ''}
        <p style="color:#666;font-size:13px;margin-top:22px;">${escHtml(labels.questions)}</p>
      </div>
    </body></html>`;
  try {
    return await deliverEmail(env, {
      to,
      subject: labels.subject,
      html,
      replyTo: merchantEmail || undefined,
    });
  } catch (e) {
    console.error('Failed to send buyer order email:', e);
    return false;
  }
}

/** Merchant-facing "new order" notification (English; operator-side). */
export async function sendOrderMerchantEmail(env, {
  to, siteName, orderRef, buyerEmail, items, total, currency, ordersUrl,
}) {
  const labels = { total: 'Total' };
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">🛍 New order on ${escHtml(siteName)}</h1>
        <p style="color:#444;line-height:1.6;">Order <strong>${escHtml(orderRef)}</strong> from <strong>${escHtml(buyerEmail || 'a customer')}</strong>. The payment landed directly in your Stripe account.</p>
        ${orderItemsTable(items, total, currency, 'en', labels)}
        ${ordersUrl ? `<p style="margin:20px 0 0;"><a href="${ordersUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Open orders</a></p>` : ''}
      </div>
    </body></html>`;
  try {
    return await deliverEmail(env, {
      to,
      subject: `🛍 New order on ${siteName} — ${orderRef}`,
      html,
      replyTo: buyerEmail || undefined,
    });
  } catch (e) {
    console.error('Failed to send merchant order email:', e);
    return false;
  }
}
