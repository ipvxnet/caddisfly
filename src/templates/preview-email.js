/**
 * Email template for preview link notifications
 */

/**
 * Builds HTML email template for preview link
 * @param {string} previewUrl - URL to the preview page
 * @param {string} customerEmail - Customer's email address
 * @returns {string} HTML email content
 */
export function buildPreviewEmailHtml(previewUrl, customerEmail) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Caddisfly Preview is Ready!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">
                🎉 Your Preview is Ready!
              </h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                See your website transformed
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333;">
                Hi there! 👋
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333;">
                We've successfully analyzed your website and created a preview of what it could look like with modern, responsive design.
              </p>

              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #333;">
                Your preview includes:
              </p>

              <ul style="margin: 0 0 30px 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #555;">
                <li>Side-by-side comparison of original vs. refactored pages</li>
                <li>Mobile-first responsive design</li>
                <li>Modern HTML5 semantic structure</li>
                <li>Improved accessibility features</li>
              </ul>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${previewUrl}"
                       style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      View Your Preview
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #666; text-align: center;">
                Or copy this link: <a href="${previewUrl}" style="color: #667eea; word-break: break-all;">${previewUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Info Box -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #555;">
                  <strong>⏰ Your preview will be available for 30 days.</strong><br>
                  Want to save it? Upgrade to get the full refactored site delivered to you!
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600; color: #333;">
                Caddisfly
              </p>
              <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">
                Modern websites, automatically refactored
              </p>
              <p style="margin: 0; font-size: 12px; color: #999;">
                This email was sent to ${customerEmail}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Builds plain text version of preview email (for email clients that don't support HTML)
 * @param {string} previewUrl - URL to the preview page
 * @param {string} customerEmail - Customer's email address
 * @returns {string} Plain text email content
 */
export function buildPreviewEmailText(previewUrl, customerEmail) {
  return `
Your Caddisfly Preview is Ready!

Hi there!

We've successfully analyzed your website and created a preview of what it could look like with modern, responsive design.

Your preview includes:
- Side-by-side comparison of original vs. refactored pages
- Mobile-first responsive design
- Modern HTML5 semantic structure
- Improved accessibility features

View your preview here:
${previewUrl}

Your preview will be available for 30 days. Want to save it? Upgrade to get the full refactored site delivered to you!

---
Caddisfly
Modern websites, automatically refactored

This email was sent to ${customerEmail}
  `.trim();
}
