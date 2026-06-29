// Optional contact-form fields the site OWNER can switch on (Company, Phone, …).
// A curated catalog — NOT free-form — so storage/email/CRM stay schema-light:
// the visitor's answers ride in form_submissions.extra_json keyed by these keys,
// and the owner's choice of which fields show (and which are required) lives in
// the contact section's content_json.form_fields = [{ key, required }].

import { t } from '../../../i18n/index.js';

// Order here is the order fields render on the form and in the inbox/email.
export const CONTACT_FIELD_KEYS = ['phone', 'company', 'subject', 'address', 'preferred_contact'];

export const CONTACT_FIELDS = {
  phone: { type: 'tel', autocomplete: 'tel' },
  company: { type: 'text', autocomplete: 'organization' },
  subject: { type: 'text' },
  address: { type: 'text', autocomplete: 'street-address' },
  preferred_contact: { type: 'select', options: ['email', 'phone', 'either'] },
};

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function fieldLabel(key, lang) {
  return t(lang, `formw.field_${key}`);
}

/** The owner's enabled field config (array of {key, required}) off content_json,
 *  filtered to the known catalog + de-duped, preserving the stored order. */
export function enabledContactFields(data) {
  const raw = Array.isArray(data && data.form_fields) ? data.form_fields : [];
  const seen = new Set();
  const out = [];
  for (const f of raw) {
    const key = f && typeof f === 'object' ? f.key : f;
    if (CONTACT_FIELDS[key] && !seen.has(key)) {
      seen.add(key);
      out.push({ key, required: !!(f && f.required) });
    }
  }
  return out;
}

/** Render the enabled optional inputs (placed between name/email and message). */
export function optionalFieldsHtml(data, lang) {
  const fields = enabledContactFields(data);
  if (!fields.length) return '';
  return fields
    .map(({ key, required }) => {
      const def = CONTACT_FIELDS[key];
      const label = esc(fieldLabel(key, lang)) + (required ? ' <span class="ff-req" aria-hidden="true">*</span>' : '');
      const req = required ? ' required' : '';
      if (def.type === 'select') {
        const opts = def.options
          .map((o) => `<option value="${o}">${esc(t(lang, `formw.pref_${o}`))}</option>`)
          .join('');
        return `
      <div class="form-group">
        <label for="ff_${key}">${label}</label>
        <select id="ff_${key}" name="ff_${key}" data-ff="${key}"${req}>
          <option value="">${esc(t(lang, 'formw.choose'))}</option>
          ${opts}
        </select>
      </div>`;
      }
      const ac = def.autocomplete ? ` autocomplete="${def.autocomplete}"` : '';
      return `
      <div class="form-group">
        <label for="ff_${key}">${label}</label>
        <input type="${def.type}" id="ff_${key}" name="ff_${key}" data-ff="${key}"${ac}${req} />
      </div>`;
    })
    .join('');
}

/** Allowlist + normalize the submitted extra answers for storage (server side).
 *  Only known catalog keys survive; values trimmed and capped. */
export function sanitizeExtra(extra) {
  if (!extra || typeof extra !== 'object') return {};
  const out = {};
  for (const key of CONTACT_FIELD_KEYS) {
    const v = extra[key];
    if (v == null) continue;
    const s = String(v).trim().slice(0, 500);
    if (s) out[key] = s;
  }
  return out;
}

/** For the inbox/email: ordered [{key,label,value}] from a stored extra_json,
 *  with select values localized. */
export function extraFieldList(extraJson, lang) {
  let obj = {};
  try { obj = JSON.parse(extraJson || '{}') || {}; } catch { obj = {}; }
  const out = [];
  for (const key of CONTACT_FIELD_KEYS) {
    if (obj[key] == null || obj[key] === '') continue;
    let value = String(obj[key]);
    if (key === 'preferred_contact') value = t(lang, `formw.pref_${value}`) || value;
    out.push({ key, label: fieldLabel(key, lang), value });
  }
  return out;
}
