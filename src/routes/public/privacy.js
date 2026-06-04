// Privacy Policy (/privacy). Companion to /terms.
// The body is editable from the SaaS admin dashboard (/admin/legal) and stored
// in legal_documents; when no override exists, the built-in default in
// legal-content.js is used. NOTE: a practical template, not legal advice —
// have counsel review and confirm processors, jurisdiction, and retention.

import { htmlResponse } from '../../utils/response.js';
import { renderLegalPage, effectiveDoc } from './legal-content.js';

export async function handlePrivacy(ctx) {
  const origin = (ctx && ctx.url && ctx.url.origin) || (ctx && ctx.env && ctx.env.APP_URL) || '';
  const { body } = await effectiveDoc(ctx.env.DB, 'privacy');
  return htmlResponse(renderLegalPage({ slug: 'privacy', body, origin }));
}
