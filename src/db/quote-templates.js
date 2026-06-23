// Editable quote template — the customizable intro / thank-you / terms + branding
// overrides merged onto a quote's issuer at send time. owner = a projectKey
// (customer) or { global: true } (the admin Caddisfly template). See migration 057.

import { keyCol } from './bridge.js';

const EMPTY = { intro: '', thank_you: '', terms: '', accent: '', logo: '' };
const isGlobal = (owner) => !!(owner && owner.global);

/** The saved template for an owner, with empty-string defaults for any unset field. */
export async function getQuoteTemplate(db, owner) {
  let row;
  if (isGlobal(owner)) {
    row = await db.prepare(`SELECT intro, thank_you, terms, accent, logo FROM quote_templates WHERE ai_project_id IS NULL AND project_id IS NULL LIMIT 1`).first();
  } else {
    const k = keyCol(owner);
    row = await db.prepare(`SELECT intro, thank_you, terms, accent, logo FROM quote_templates WHERE ${k.col} = ?`).bind(k.val).first();
  }
  return { ...EMPTY, ...(row || {}) };
}

/** Upsert a template (one row per project, or the single global row). Returns the saved values. */
export async function saveQuoteTemplate(db, owner, t) {
  const clamp = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  const v = {
    intro: clamp(t.intro, 2000),
    thank_you: clamp(t.thank_you, 2000),
    terms: clamp(t.terms, 4000),
    accent: /^#[0-9a-fA-F]{3,8}$/.test((t.accent || '').trim()) ? t.accent.trim() : '',
    logo: clamp(t.logo, 500),
  };
  let existing;
  if (isGlobal(owner)) {
    existing = await db.prepare(`SELECT id FROM quote_templates WHERE ai_project_id IS NULL AND project_id IS NULL LIMIT 1`).first();
  } else {
    const k = keyCol(owner);
    existing = await db.prepare(`SELECT id FROM quote_templates WHERE ${k.col} = ?`).bind(k.val).first();
  }
  if (existing) {
    await db.prepare(`UPDATE quote_templates SET intro=?, thank_you=?, terms=?, accent=?, logo=?, updated_at=unixepoch() WHERE id=?`)
      .bind(v.intro, v.thank_you, v.terms, v.accent, v.logo, existing.id).run();
  } else if (isGlobal(owner)) {
    await db.prepare(`INSERT INTO quote_templates (intro, thank_you, terms, accent, logo) VALUES (?,?,?,?,?)`)
      .bind(v.intro, v.thank_you, v.terms, v.accent, v.logo).run();
  } else {
    const k = keyCol(owner);
    await db.prepare(`INSERT INTO quote_templates (${k.col}, intro, thank_you, terms, accent, logo) VALUES (?,?,?,?,?,?)`)
      .bind(k.val, v.intro, v.thank_you, v.terms, v.accent, v.logo).run();
  }
  return v;
}

/** Merge a saved template over a base issuer object (template wins where non-empty). */
export function applyTemplate(issuer, tpl) {
  if (!tpl) return issuer;
  return {
    ...issuer,
    intro: tpl.intro || issuer.intro || '',
    thankYou: tpl.thank_you || issuer.thankYou || '',
    terms: tpl.terms || issuer.terms || '',
    accent: tpl.accent || issuer.accent,
    logo: tpl.logo || issuer.logo || '',
  };
}
