// Terms of Service + Acceptable Use Policy (/terms).
// The body is editable from the SaaS admin dashboard (/admin/legal) and stored
// in legal_documents; when no override exists, the built-in default in
// legal-content.js is used. NOTE: a practical template, not legal advice —
// have counsel review before relying on it.

import { htmlResponse } from '../../utils/response.js';
import { renderLegalPage, effectiveDoc } from './legal-content.js';

export async function handleTerms(ctx) {
  const origin = (ctx && ctx.url && ctx.url.origin) || (ctx && ctx.env && ctx.env.APP_URL) || '';
  const { body } = await effectiveDoc(ctx.env.DB, 'terms');
  return htmlResponse(renderLegalPage({ slug: 'terms', body, origin }));
}
