// Lightweight i18n for the public funnel (no framework). resolveLang() picks the
// language once per request (cookie → Accept-Language → 'en'); t() looks up a
// nested key in the language dictionary with {var} interpolation, falling back to
// English then the key itself. Dictionaries live in ./{en,es,pt}.js.

import { parseCookies } from '../utils/crypto.js';
import { en } from './en.js';
import { es } from './es.js';
import { pt } from './pt.js';

export const LANGS = ['en', 'es', 'pt'];
export const LANG_NAMES = { en: 'English', es: 'Español', pt: 'Português' };
export const LANG_COOKIE = 'cf_lang';

const DICTS = { en, es, pt };

/** Normalize an arbitrary tag (e.g. 'es-419', 'pt_BR') to a supported lang or null. */
function normalize(tag) {
  if (!tag) return null;
  const base = String(tag).toLowerCase().split(/[-_;,\s]/)[0];
  return LANGS.includes(base) ? base : null;
}

/** Resolve the request language: cf_lang cookie → Accept-Language → 'en'. */
export function resolveLang(request) {
  try {
    const cookies = parseCookies(request);
    const fromCookie = normalize(cookies && cookies[LANG_COOKIE]);
    if (fromCookie) return fromCookie;
  } catch { /* ignore */ }

  const al = request.headers.get('Accept-Language') || '';
  for (const part of al.split(',')) {
    const lang = normalize(part.trim());
    if (lang) return lang;
  }
  return 'en';
}

/** True if `tag` is a supported language code. */
export function isLang(tag) {
  return LANGS.includes(tag);
}

/**
 * Translate a dotted key for a language, interpolating {var} placeholders.
 * t('es', 'nav.pricing') → 'Precios'. Falls back to English, then the key.
 */
export function t(lang, key, vars) {
  const dict = DICTS[lang] || en;
  const val = lookup(dict, key);
  const str = val != null ? val : lookup(en, key);
  if (str == null) return key;
  return vars ? str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)) : str;
}

function lookup(dict, key) {
  let cur = dict;
  for (const part of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : null;
}

/** Convenience: bind t() to a language for a page handler — const tr = translator(ctx.lang). */
export function translator(lang) {
  const l = isLang(lang) ? lang : 'en';
  return (key, vars) => t(l, key, vars);
}
