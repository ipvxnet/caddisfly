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
async function deliverEmail(env, { to, subject, html, replyTo, fromName, attachments }) {
  const fromAddr = env.EMAIL_FROM || 'noreply@caddisfly.ai';
  // Optional display name ("Vito's Pizzeria via Caddisfly <noreply@…>") so the
  // owner's inbox shows WHICH site wrote, not a bare noreply address.
  const safeName = fromName ? String(fromName).replace(/[<>"\r\n]/g, '').trim().slice(0, 80) : '';
  const from = safeName ? `${safeName} <${fromAddr}>` : fromAddr;

  if (env.RESEND_API_KEY) {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from, to, subject, html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        // [{ filename, content(base64) }] — Resend only; the binding fallback ignores them.
        ...(attachments && attachments.length ? { attachments } : {}),
      }),
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

/** Email a customer a link to their hosted quote page (/q/:token). */
export async function sendQuoteEmail(env, { to, issuerName, quoteTitle, totalLabel, viewUrl, replyTo }) {
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const name = issuerName || 'A business';
  const subject = `Your quote from ${name}${quoteTitle ? ` — ${quoteTitle}` : ''}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2733">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px">
      <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
        <h1 style="font-size:1.2rem;margin:0 0 .6rem">You've received a quote from ${e(name)}</h1>
        ${quoteTitle ? `<p style="color:#4a5568;margin:.2rem 0">${e(quoteTitle)}</p>` : ''}
        ${totalLabel ? `<p style="font-size:1.35rem;font-weight:800;margin:.5rem 0">${e(totalLabel)}</p>` : ''}
        <a href="${e(viewUrl)}" style="display:inline-block;background:#5a3da8;color:#fff;text-decoration:none;font-weight:700;padding:.8rem 1.4rem;border-radius:999px;margin-top:.8rem">View your quote →</a>
        <p style="color:#8a94a6;font-size:.78rem;margin-top:1.4rem;word-break:break-all">Or open this link:<br>${e(viewUrl)}</p>
      </div>
    </div></body></html>`;
  return deliverEmail(env, { to, subject, html, fromName: name, replyTo });
}

/** Invite someone to accept a website transfer. */
export async function sendTransferInviteEmail(env, { to, fromEmail, siteName, acceptUrl, requirements }) {
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const subject = `${fromEmail} wants to transfer a website to you`;
  const reqs = (requirements || []).filter(Boolean);
  const reqHtml = reqs.length
    ? `<p style="color:#4a5568;margin:.6rem 0 .2rem;font-size:.9rem">To take it over, your account will need:</p>
       <ul style="color:#4a5568;font-size:.88rem;margin:.2rem 0 0;padding-left:1.1rem">${reqs.map((r) => `<li>${e(r)}</li>`).join('')}</ul>`
    : '';
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2733">
    <div style="max-width:540px;margin:0 auto;padding:32px 20px">
      <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
        <h1 style="font-size:1.25rem;margin:0 0 .6rem">You've been offered a website</h1>
        <p style="color:#4a5568;margin:.2rem 0 .8rem"><strong>${e(fromEmail)}</strong> wants to transfer the website <strong>${e(siteName)}</strong> to your account.</p>
        ${reqHtml}
        <a href="${e(acceptUrl)}" style="display:inline-block;background:#5a3da8;color:#fff;text-decoration:none;font-weight:700;padding:.8rem 1.4rem;border-radius:999px;margin-top:1.1rem">Review &amp; accept →</a>
        <p style="color:#8a94a6;font-size:.78rem;margin-top:1.4rem">This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.</p>
      </div>
    </div></body></html>`;
  return deliverEmail(env, { to, subject, html, replyTo: fromEmail });
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
      fromName: `${siteName} via Caddisfly`,
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
 * Email-to-blog: tells the owner a draft generated from their inbound email is
 * ready to review in the blog manager. Best-effort, like the other notices.
 * @param {Object} env
 * @param {Object} opts - { to, siteName, postTitle, reviewUrl }
 * @returns {Promise<boolean>}
 */
export async function sendBlogDraftReadyEmail(env, { to, siteName, postTitle, reviewUrl }) {
  const isProduction = env.ENVIRONMENT === 'production';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">Your blog post is ready to review ✍️</h1>
        <p style="color:#444;line-height:1.6;">We turned your email into a draft post for <strong>${esc(siteName)}</strong>:</p>
        <p style="color:#111;font-size:17px;font-weight:700;margin:14px 0;">${esc(postTitle)}</p>
        <p style="color:#444;line-height:1.6;">It's saved as a <strong>draft</strong> — nothing is live yet. Review and edit it, then hit Publish when you're happy.</p>
        ${reviewUrl ? `<p style="margin:24px 0;"><a href="${reviewUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Review the draft</a></p>` : ''}
      </div>
    </body></html>`;
  try {
    const sent = await deliverEmail(env, { to, subject: `Your post draft is ready — ${siteName}`, html, fromName: `${siteName} via Caddisfly` });
    if (sent) return true;
    if (isProduction) { console.error('No email transport in production; cannot send blog-draft-ready email'); return false; }
  } catch (error) {
    console.error('Failed to send blog-draft-ready email:', error);
    if (isProduction) return false;
  }
  console.warn(`[email stub] Blog draft ready email to ${to} for ${siteName}: ${reviewUrl || ''}`);
  return true;
}

/**
 * Email-to-blog: tells the owner WHY their inbound email did not become a post.
 * @param {Object} env
 * @param {Object} opts - { to, siteName, kind, billingUrl }
 *   kind: 'paid_only' | 'no_credits' | 'failed' | 'rate_limited' | 'policy'
 * @returns {Promise<boolean>}
 */
export async function sendBlogNoticeEmail(env, { to, siteName, kind, billingUrl }) {
  const isProduction = env.ENVIRONMENT === 'production';
  const COPY = {
    paid_only: {
      h: 'Post-by-email is a paid feature',
      p: `Turning emails into blog posts for <strong>${siteName}</strong> is available on Starter and higher. Upgrade your plan to switch it on.`,
      cta: 'See plans',
    },
    no_credits: {
      h: "You're out of Caddi credits",
      p: `We couldn't turn your email into a post for <strong>${siteName}</strong> because your credit balance is too low. Top up or upgrade, then resend your email.`,
      cta: 'Get more credits',
    },
    rate_limited: {
      h: 'Daily email-to-post limit reached',
      p: `You've hit today's limit of email-to-blog drafts for <strong>${siteName}</strong>. Try again tomorrow, or create posts directly in the blog manager.`,
      cta: 'Open blog manager',
    },
    policy: {
      h: "We couldn't publish that one",
      p: `Your email couldn't be turned into a post for <strong>${siteName}</strong> because the content didn't pass our content guidelines.`,
      cta: '',
    },
    failed: {
      h: "We couldn't create your post",
      p: `Something went wrong turning your email into a draft for <strong>${siteName}</strong>. Please try resending it in a few minutes.`,
      cta: '',
    },
  };
  const c = COPY[kind] || COPY.failed;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">${esc(c.h)}</h1>
        <p style="color:#444;line-height:1.6;">${c.p}</p>
        ${c.cta && billingUrl ? `<p style="margin:24px 0;"><a href="${billingUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">${esc(c.cta)}</a></p>` : ''}
      </div>
    </body></html>`;
  try {
    const sent = await deliverEmail(env, { to, subject: `${c.h} — ${siteName}`, html, fromName: `${siteName} via Caddisfly` });
    if (sent) return true;
    if (isProduction) { console.error('No email transport in production; cannot send blog notice email'); return false; }
  } catch (error) {
    console.error('Failed to send blog notice email:', error);
    if (isProduction) return false;
  }
  console.warn(`[email stub] Blog notice (${kind}) email to ${to} for ${siteName}`);
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

/**
 * Buyer purchase-history magic link (site language). Only ever sent to an
 * email that already has orders on that site (no enumeration / spam vector).
 */
export async function sendBuyerOrdersLinkEmail(env, { to, businessName, linkUrl, labels }) {
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">${escHtml(labels.heading)}</h1>
        <p style="color:#444;line-height:1.6;">${escHtml(labels.intro)}</p>
        <p style="margin:24px 0;"><a href="${linkUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">${escHtml(labels.button)}</a></p>
        <p style="color:#666;font-size:13px;">${escHtml(labels.expiry)}</p>
      </div>
    </body></html>`;
  try {
    return await deliverEmail(env, { to, subject: labels.subject, html });
  } catch (e) {
    console.error('Failed to send buyer orders link email:', e);
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

/** Domain-purchase confirmation (transactional; English like other system mail). */
export async function sendDomainRegisteredEmail(env, { to, domain, autoConnected }) {
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">🌐 ${domain} is yours!</h1>
        <p style="color:#444;line-height:1.6;">Your domain <strong>${domain}</strong> is registered, with free WHOIS privacy enabled.</p>
        ${autoConnected
          ? `<p style="color:#444;line-height:1.6;">We've already pointed it at your website — <strong>https://www.${domain}</strong> goes live automatically as soon as the SSL certificate is issued (usually a few minutes).</p>`
          : `<p style="color:#444;line-height:1.6;">Connect it to one of your sites anytime from the <strong>🌐 Custom domain</strong> panel.</p>`}
        <p style="color:#444;line-height:1.6;">It renews automatically each year using your saved payment method — manage it from your dashboard.</p>
        <p style="margin:24px 0 0;"><a href="${env.APP_URL || 'https://caddisfly.ai'}/dashboard" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Open dashboard</a></p>
      </div>
    </body></html>`;
  try {
    return await deliverEmail(env, { to, subject: `Your domain ${domain} is registered 🎉`, html });
  } catch (e) {
    console.error('Failed to send domain email:', e.message);
    return false;
  }
}

/** Domain successfully auto-renewed. */
export async function sendDomainRenewedEmail(env, { to, domain, amountLabel, expiresLabel }) {
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">🌐 ${domain} renewed</h1>
        <p style="color:#444;line-height:1.6;">Your domain <strong>${domain}</strong> renewed automatically${amountLabel ? ` for ${amountLabel}` : ''}${expiresLabel ? `, and is now paid through <strong>${expiresLabel}</strong>` : ''}.</p>
        <p style="color:#444;line-height:1.6;">No action needed — your site stays online. Manage auto-renew anytime from your dashboard.</p>
      </div>
    </body></html>`;
  try { return await deliverEmail(env, { to, subject: `${domain} renewed for another year`, html }); }
  catch (e) { console.error('domain renewed email failed:', e.message); return false; }
}

/** Auto-renew charge failed — ask the customer to update their card. */
export async function sendDomainRenewalFailedEmail(env, { to, domain, daysLeft, manageUrl }) {
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">⚠️ Couldn’t renew ${domain}</h1>
        <p style="color:#444;line-height:1.6;">We tried to auto-renew <strong>${domain}</strong> but the payment didn’t go through${typeof daysLeft === 'number' ? ` — it expires in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>` : ''}.</p>
        <p style="color:#444;line-height:1.6;">Please update your payment method so your domain and site stay online. We’ll keep trying for a few days.</p>
        <p style="margin:24px 0 0;"><a href="${manageUrl || (env.APP_URL || 'https://caddisfly.ai') + '/billing'}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Update payment method</a></p>
      </div>
    </body></html>`;
  try { return await deliverEmail(env, { to, subject: `Action needed: couldn’t renew ${domain}`, html }); }
  catch (e) { console.error('domain renewal-failed email failed:', e.message); return false; }
}

/** Expiry reminder for a domain with auto-renew OFF. */
export async function sendDomainExpiringEmail(env, { to, domain, daysLeft, manageUrl }) {
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">⏰ ${domain} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</h1>
        <p style="color:#444;line-height:1.6;">Auto-renew is <strong>off</strong> for <strong>${domain}</strong>, so it will expire and your site will go offline unless you renew it.</p>
        <p style="color:#444;line-height:1.6;">Turn auto-renew back on (or renew manually) from your dashboard to keep it.</p>
        <p style="margin:24px 0 0;"><a href="${manageUrl || (env.APP_URL || 'https://caddisfly.ai') + '/domains'}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Manage domain</a></p>
      </div>
    </body></html>`;
  try { return await deliverEmail(env, { to, subject: `${domain} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, html }); }
  catch (e) { console.error('domain expiring email failed:', e.message); return false; }
}

// ---- booking engine ----

const bkEsc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * Visitor confirmation / cancellation for a booking. English v1 (transactional
 * email i18n is a deferred follow-up, same as the rest of email.js).
 */
export async function sendBookingVisitorEmail(env, { to, siteName, serviceName, dateLabel, timeLabel, tz, cancelUrl, cancelled = false, refund = null, paidLabel = null, remainingLabel = null, receiptUrl = null, ics = null, rescheduled = false, oldWhen = null, rescheduleUrl = null }) {
  // refund: null (free booking) | 'refunded' | 'failed' (manual refund coming)
  const title = cancelled ? 'Your booking was cancelled' : rescheduled ? 'Your booking was rescheduled 🔁' : 'Your booking is confirmed ✅';
  const refundLine = refund === 'refunded'
    ? '<p style="color:#065f46;line-height:1.6;font-weight:600;">Your payment has been refunded — it usually appears within 5–10 business days.</p>'
    : refund === 'failed'
      ? '<p style="color:#92400e;line-height:1.6;">The business will refund your payment shortly.</p>'
      : '';
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
        <p style="color:#444;line-height:1.6;"><strong>${bkEsc(serviceName)}</strong> at <strong>${bkEsc(siteName)}</strong></p>
        <p style="color:#111;font-size:17px;font-weight:700;margin:14px 0;">${bkEsc(dateLabel)} · ${bkEsc(timeLabel)}${tz ? ` <span style="color:#888;font-weight:400;">(${bkEsc(tz)})</span>` : ''}</p>
        ${rescheduled && oldWhen ? `<p style="color:#888;margin:0 0 8px;">Previously: <s>${bkEsc(oldWhen)}</s></p>` : ''}
        ${!cancelled && paidLabel ? `<p style="color:#065f46;font-weight:700;margin:6px 0 4px;">${remainingLabel ? 'Deposit paid' : 'Paid'}: ${bkEsc(paidLabel)}${receiptUrl ? ` &nbsp;·&nbsp; <a href="${receiptUrl}" style="color:#2563eb;font-weight:600;">View receipt</a>` : ''}</p>` : ''}
        ${!cancelled && remainingLabel ? `<p style="color:#92400e;font-weight:600;margin:0 0 14px;">Remaining due at your appointment: ${bkEsc(remainingLabel)}</p>` : ''}
        ${cancelled
          ? `${refundLine}<p style="color:#444;line-height:1.6;">This time is no longer reserved. You can book a new time on the website.</p>`
          : `${cancelUrl || rescheduleUrl ? `<p style="color:#444;line-height:1.6;">Need to change plans?</p>
        <p style="margin:24px 0;">${rescheduleUrl ? `<a href="${rescheduleUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;display:inline-block;margin-right:10px;">Pick a new time</a>` : ''}${cancelUrl ? `<a href="${cancelUrl}" style="background:#fff;color:#b91c1c;border:1px solid #fca5a5;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;display:inline-block;">Cancel this booking</a>` : ''}</p>` : ''}`}
      </div>
    </body></html>`;
  const subject = cancelled
    ? `Booking cancelled — ${serviceName} on ${dateLabel}`
    : rescheduled
      ? `Booking moved — ${serviceName} now on ${dateLabel} at ${timeLabel}`
      : `Booking confirmed — ${serviceName} on ${dateLabel} at ${timeLabel}`;
  let attachments;
  if (ics && !cancelled) {
    try {
      const bytes = new TextEncoder().encode(ics);
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      attachments = [{ filename: 'booking.ics', content: btoa(bin) }];
    } catch { /* attachment is a nicety — never block the email */ }
  }
  try { return await deliverEmail(env, { to, subject, html, fromName: `${siteName} via Caddisfly`, attachments }); }
  catch (e) { console.error('booking visitor email failed:', e.message); return false; }
}

/** Owner notification: new booking or a visitor cancellation. */
export async function sendBookingOwnerEmail(env, { to, siteName, serviceName, customerName, customerEmail, dateLabel, timeLabel, note, manageUrl, cancelled = false, rescheduled = false, oldWhen = null, paidLabel = null, remainingLabel = null }) {
  const title = cancelled ? 'A booking was cancelled' : rescheduled ? 'A booking was rescheduled 🔁' : 'New booking 📅';
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
        <p style="color:#111;font-size:17px;font-weight:700;margin:14px 0;">${bkEsc(serviceName)} — ${bkEsc(dateLabel)} · ${bkEsc(timeLabel)}</p>
        ${rescheduled && oldWhen ? `<p style="color:#888;margin:0 0 8px;">Previously: <s>${bkEsc(oldWhen)}</s></p>` : ''}
        <p style="color:#444;line-height:1.6;">${bkEsc(customerName)} &lt;${bkEsc(customerEmail)}&gt;${note ? `<br><em>“${bkEsc(note)}”</em>` : ''}</p>
        ${paidLabel ? `<p style="color:#065f46;font-weight:600;margin:6px 0;">💳 ${remainingLabel ? `Deposit ${bkEsc(paidLabel)} paid — collect ${bkEsc(remainingLabel)} at the appointment` : `Paid ${bkEsc(paidLabel)}`}</p>` : ''}
        ${manageUrl ? `<p style="margin:24px 0;"><a href="${manageUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Open bookings</a></p>` : ''}
      </div>
    </body></html>`;
  const subject = cancelled
    ? `Cancelled: ${serviceName} on ${dateLabel} (${siteName})`
    : rescheduled
      ? `Rescheduled: ${serviceName} now on ${dateLabel} at ${timeLabel} (${siteName})`
      : `New booking: ${serviceName} on ${dateLabel} at ${timeLabel} (${siteName})`;
  try { return await deliverEmail(env, { to, subject, html, replyTo: customerEmail, fromName: `${siteName} via Caddisfly` }); }
  catch (e) { console.error('booking owner email failed:', e.message); return false; }
}

/** Visitor reminder ~24h before an appointment (booking reminder cron). */
export async function sendBookingReminderEmail(env, { to, siteName, serviceName, dateLabel, timeLabel, tz, cancelUrl, rescheduleUrl = null }) {
  const html = `
    <html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">⏰ See you tomorrow!</h1>
        <p style="color:#444;line-height:1.6;">A friendly reminder of your booking with <strong>${bkEsc(siteName)}</strong>:</p>
        <p style="color:#111;font-size:17px;font-weight:700;margin:14px 0;">${bkEsc(serviceName)} — ${bkEsc(dateLabel)} · ${bkEsc(timeLabel)}${tz ? ` <span style="color:#888;font-weight:400;">(${bkEsc(tz)})</span>` : ''}</p>
        ${cancelUrl || rescheduleUrl ? `<p style="color:#444;line-height:1.6;">Plans changed?</p>
        <p style="margin:24px 0;">${rescheduleUrl ? `<a href="${rescheduleUrl}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;display:inline-block;margin-right:10px;">Pick a new time</a>` : ''}${cancelUrl ? `<a href="${cancelUrl}" style="background:#fff;color:#b91c1c;border:1px solid #fca5a5;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;display:inline-block;">Cancel this booking</a>` : ''}</p>` : ''}
      </div>
    </body></html>`;
  try { return await deliverEmail(env, { to, subject: `Reminder: ${serviceName} tomorrow at ${timeLabel} — ${siteName}`, html, fromName: `${siteName} via Caddisfly` }); }
  catch (e) { console.error('booking reminder email failed:', e.message); return false; }
}
