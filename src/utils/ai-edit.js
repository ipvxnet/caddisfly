/**
 * Helpers for the "AI Edit" feature — chat-driven section editing.
 *
 * The flow is propose → confirm → apply:
 *  - buildEditPrompt() turns the user's request + the section's current content
 *    into an LLM prompt that returns a partial JSON patch + a plain-language
 *    summary + optional image-generation actions.
 *  - sanitizeProposal() hardens the LLM output (drops image-URL fields so images
 *    only ever come from an explicit generate_image action or a user upload).
 *  - mergePatch() deep-merges the confirmed patch over the current content.
 *
 * Text patches reuse the same content_json shape the templates already read
 * (see ai-prompts.js / generate.js defaults).
 */

import { POLICY_INSTRUCTION } from './content-policy.js';

// Per-section editable fields, used to steer the LLM. `images` lists the fields
// that hold image URLs — the LLM must NOT fill these (images come via actions).
const SECTION_FIELDS = {
  header: { text: ['business_name', 'cta_link'], images: ['logo'] },
  hero: { text: ['heading', 'subheading', 'cta_text', 'cta_link'], images: ['background_image', 'image_url'] },
  about: { text: ['heading', 'subheading', 'story', 'values[]'], images: ['image_url'] },
  services: { text: ['heading', 'subheading', 'description', 'services[].{title,description,icon}'], images: [] },
  features: { text: ['heading', 'description', 'features[].{title,description,icon}'], images: [] },
  testimonials: { text: ['heading', 'subheading', 'testimonials[].{name,role,text,rating}'], images: [] },
  contact: { text: ['heading', 'subheading', 'button_text', 'phone', 'email', 'address'], images: [] },
  gallery: { text: ['heading', 'subheading'], images: ['images'] },
  pricing: { text: ['heading', 'subheading', 'plans[].{name,price,features}'], images: [] },
  products: { text: ['heading', 'subheading', 'cta_text'], images: [] },
  stats: { text: ['heading', 'stats[].{number,label}'], images: [] },
  cta: { text: ['heading', 'description', 'cta_text', 'cta_url'], images: [] },
  footer: { text: ['business_name', 'tagline', 'copyright', 'links[]', 'social[]'], images: [] },
};

// Which image fields a generate_image action may target, per section type.
const IMAGE_TARGETS = {
  hero: ['background_image', 'image_url'],
  about: ['image_url'],
  gallery: ['images'],
};

// Fields stripped from an LLM patch — images must come via actions/uploads, never
// a hallucinated URL from the text model.
const IMAGE_URL_FIELDS = ['background_image', 'image_url', 'video_url', 'logo', 'images'];

const DEFAULT_ITEM_ICON = '✓';

/**
 * Ensure list items (services/features) always have a non-empty icon — the LLM
 * sometimes omits one, which renders as a blank icon. Mutates + returns obj.
 * @param {object} obj
 * @returns {object}
 */
export function ensureItemIcons(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of ['services', 'features', 'items']) {
    if (Array.isArray(obj[key])) {
      obj[key] = obj[key].map((it) =>
        it && typeof it === 'object' && (!it.icon || !String(it.icon).trim())
          ? { ...it, icon: DEFAULT_ITEM_ICON }
          : it
      );
    }
  }
  return obj;
}

/**
 * Return the image-target field names allowed for a section type.
 * @param {string} sectionType
 * @returns {string[]}
 */
export function imageTargetsFor(sectionType) {
  return IMAGE_TARGETS[sectionType] || [];
}

/**
 * Build the propose prompt for callWorkersAI.
 * @param {string} sectionType
 * @param {object} content - Current parsed content_json
 * @param {string} message - The user's edit request
 * @param {Array<{role:string,content:string}>} history - Prior turns (capped by caller)
 * @returns {{ system_message: string, prompt: string }}
 */
const EDIT_LANG_FULL = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

export function buildEditPrompt(sectionType, content, message, history = [], language = 'en') {
  const spec = SECTION_FIELDS[sectionType] || { text: Object.keys(content || {}), images: [] };
  const targets = imageTargetsFor(sectionType);

  const langRule =
    language && language !== 'en' && EDIT_LANG_FULL[language]
      ? `Write all copy in the "patch" in natural, native ${EDIT_LANG_FULL[language]} (the site's language). `
      : '';

  const system_message =
    'You are a website section editor. You receive a section\'s current content as JSON and a ' +
    'user request, and you return ONLY a JSON object describing the change. Never include prose ' +
    'outside the JSON. Keep copy concise and on-brand. Do not invent image URLs. ' +
    langRule +
    POLICY_INSTRUCTION;

  const historyText = history
    .slice(-6)
    .map((h) => `${h.role === 'assistant' ? 'You' : 'User'}: ${h.content}`)
    .join('\n');

  const galleryCount = sectionType === 'gallery' && Array.isArray(content && content.images) ? content.images.length : 0;
  const galleryN = galleryCount || 4;
  const imageRule = targets.length
    ? `IMAGE CHANGES: never put an image URL in "patch". To add or replace ANY image you MUST add a ` +
      `generate_image action: {"type":"generate_image","target":"<one of: ${targets.join(', ')}>","prompt":"<vivid, specific image prompt>"}. ` +
      (sectionType === 'gallery'
        ? `This is a GALLERY (currently ${galleryCount || 'a few'} photos). To replace/refresh the photos you MUST output about ${galleryN} generate_image actions — ONE per photo — each with "target":"images" and a DISTINCT prompt based on the user's request. Outputting these actions is required; do NOT claim you changed the images in "assistant_message" without them.`
        : `Output one generate_image action per image you want to change.`)
    : `This section has no image. Ignore any image requests (note it in "summary").`;

  const prompt = `SECTION TYPE: ${sectionType}
EDITABLE TEXT FIELDS: ${spec.text.join(', ')}
${spec.images.length ? `IMAGE FIELDS (do not fill with URLs): ${spec.images.join(', ')}` : ''}

CURRENT CONTENT (JSON):
${JSON.stringify(content, null, 2)}

${historyText ? `CONVERSATION SO FAR:\n${historyText}\n` : ''}
USER REQUEST: ${message}

Respond with ONLY this JSON shape:
{
  "summary": "<one short sentence describing what you will change>",
  "patch": { <ONLY the fields that change, matching the content shape above; for a list field include the full updated list> },
  "actions": [ ${targets.length ? '<generate_image actions per the IMAGE CHANGES rule>' : ''} ],
  "assistant_message": "<a friendly one-line reply to the user>"
}
Rules: include in "patch" only fields you actually change. ${imageRule} If nothing can change, return an empty "patch" and explain in "summary".`;

  return { system_message, prompt };
}

/**
 * Harden a parsed LLM proposal: strip image-URL fields from the patch, keep only
 * valid generate_image actions for this section type.
 * @param {any} raw - Parsed JSON from the model
 * @param {string} sectionType
 * @returns {{summary:string, patch:object, actions:Array, assistant_message:string}}
 */
export function sanitizeProposal(raw, sectionType) {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const patch = obj.patch && typeof obj.patch === 'object' && !Array.isArray(obj.patch) ? { ...obj.patch } : {};

  // Images only via actions/uploads — never a model-supplied URL.
  for (const f of IMAGE_URL_FIELDS) delete patch[f];

  // Never let a list item ship without an icon.
  ensureItemIcons(patch);

  const targets = imageTargetsFor(sectionType);
  const actions = Array.isArray(obj.actions)
    ? obj.actions
        .filter((a) => a && a.type === 'generate_image' && targets.includes(a.target) && typeof a.prompt === 'string' && a.prompt.trim())
        .map((a) => ({ type: 'generate_image', target: a.target, prompt: a.prompt.trim().slice(0, 400) }))
    : [];

  return {
    summary: typeof obj.summary === 'string' ? obj.summary : '',
    patch,
    actions,
    assistant_message: typeof obj.assistant_message === 'string' ? obj.assistant_message : obj.summary || '',
  };
}

/**
 * Deep-merge a patch over content. Plain objects merge recursively; arrays and
 * primitives replace.
 * @param {object} content
 * @param {object} patch
 * @returns {object}
 */
export function mergePatch(content, patch) {
  const base = content && typeof content === 'object' && !Array.isArray(content) ? content : {};
  const out = { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = mergePatch(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
