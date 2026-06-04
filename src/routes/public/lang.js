// GET /api/lang?to=es&next=/pricing — set the language cookie and redirect back.
// Keeps cookie-writing out of the render path; the switcher links here.

import { setCookie } from '../../utils/crypto.js';
import { isLang, LANG_COOKIE } from '../../i18n/index.js';

export async function handleSetLang(ctx) {
  const to = ctx.query && ctx.query.to;
  const lang = isLang(to) ? to : 'en';

  // Only allow same-site relative redirects.
  let next = (ctx.query && ctx.query.next) || '/';
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) next = '/';

  const res = new Response(null, { status: 302, headers: { Location: next } });
  return setCookie(res, LANG_COOKIE, lang, { maxAge: 365 * 24 * 60 * 60, httpOnly: false, sameSite: 'Lax' });
}
